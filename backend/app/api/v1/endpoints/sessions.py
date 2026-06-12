"""
Sessions Endpoints - Create and manage interview sessions
"""
import uuid
import secrets
import string
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_admin, get_current_user
from app.models.models import Session as DBSession, SessionQuestion, Question, Attempt
from app.schemas.schemas import SessionCreate, SessionOut, SessionStatusUpdate
from app.core.config import settings

router = APIRouter()


def generate_join_code(length=8):
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


def generate_join_link(session_id: str) -> str:
    token = secrets.token_urlsafe(16)
    return f"session_{session_id[:8]}_{token}"


@router.post("", response_model=SessionOut)
async def create_session(
    data: SessionCreate,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new interview session"""
    admin_id = current_user["user_id"]
    
    session_id = str(uuid.uuid4())
    join_link = generate_join_link(session_id)
    join_code = generate_join_code()
    
    # Calculate total marks
    total_marks = 0.0
    if data.question_ids:
        result = await db.execute(
            select(Question).where(
                Question.id.in_(data.question_ids),
                Question.admin_id == admin_id
            )
        )
        questions = result.scalars().all()
        total_marks = sum(q.marks for q in questions)
    
    session = DBSession(
        id=session_id,
        admin_id=admin_id,
        class_id=data.class_id,
        title=data.title,
        description=data.description,
        instructions=data.instructions,
        duration_minutes=data.duration_minutes,
        total_marks=total_marks,
        passing_marks=data.passing_marks,
        shuffle_questions=data.shuffle_questions,
        shuffle_options=data.shuffle_options,
        show_result_immediately=data.show_result_immediately,
        allow_review=data.allow_review,
        max_warnings=data.max_warnings,
        fullscreen_required=data.fullscreen_required,
        join_link=join_link,
        join_code=join_code,
        password=data.password,
        scheduled_start=data.scheduled_start,
        scheduled_end=data.scheduled_end,
        status="draft"
    )
    db.add(session)
    
    # Add questions
    for i, q_id in enumerate(data.question_ids):
        sq = SessionQuestion(
            id=str(uuid.uuid4()),
            session_id=session_id,
            question_id=q_id,
            order=i
        )
        db.add(sq)
    
    await db.commit()
    await db.refresh(session)
    
    return SessionOut(
        **{
            k: v for k, v in session.__dict__.items()
            if k not in ("_sa_instance_state",)
        },
        question_count=len(data.question_ids)
    )


@router.get("", response_model=List[SessionOut])
async def list_sessions(
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all sessions for admin"""
    admin_id = current_user["user_id"]
    
    query = select(DBSession).where(DBSession.admin_id == admin_id)
    if status:
        query = query.where(DBSession.status == status)
    query = query.offset(skip).limit(limit).order_by(DBSession.created_at.desc())
    
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    output = []
    for s in sessions:
        # Get question count
        q_count = await db.execute(
            select(func.count(SessionQuestion.id)).where(SessionQuestion.session_id == s.id)
        )
        output.append(SessionOut(
            **{k: v for k, v in s.__dict__.items() if k not in ("_sa_instance_state",)},
            question_count=q_count.scalar() or 0
        ))
    return output


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get session details"""
    result = await db.execute(
        select(DBSession).where(
            DBSession.id == session_id,
            DBSession.admin_id == current_user["user_id"]
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Auto-end: session active hai aur time khatam ho gaya
    time_remaining_seconds = None
    if session.status == "active" and session.activated_at:
        total_seconds = session.duration_minutes * 60
        elapsed = int((datetime.utcnow() - session.activated_at).total_seconds())
        time_remaining_seconds = max(0, total_seconds - elapsed)
        if time_remaining_seconds <= 0:
            session.status = "ended"
            await db.commit()
            time_remaining_seconds = 0

    q_count = await db.execute(
        select(func.count(SessionQuestion.id)).where(SessionQuestion.session_id == session_id)
    )
    return SessionOut(
        **{k: v for k, v in session.__dict__.items() if k not in ("_sa_instance_state",)},
        question_count=q_count.scalar() or 0,
        time_remaining_seconds=time_remaining_seconds
    )


@router.patch("/{session_id}/status")
async def update_session_status(
    session_id: str,
    data: SessionStatusUpdate,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update session status (activate, end, archive)"""
    result = await db.execute(
        select(DBSession).where(
            DBSession.id == session_id,
            DBSession.admin_id == current_user["user_id"]
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    valid_transitions = {
        "draft": ["active"],
        "active": ["ended"],
        "ended": ["archived"],
    }
    
    if data.status not in valid_transitions.get(session.status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {session.status} to {data.status}"
        )
    
    session.status = data.status
    # Session activate hone ka exact time save karo — timer isi se chalega
    if data.status == "active":
        session.activated_at = datetime.utcnow()
    await db.commit()
    return {"success": True, "status": data.status}


@router.get("/{session_id}/questions")
async def get_session_questions(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get questions for a session (stripped for students)"""
    result = await db.execute(
        select(SessionQuestion, Question)
        .join(Question, SessionQuestion.question_id == Question.id)
        .where(SessionQuestion.session_id == session_id)
        .order_by(SessionQuestion.order)
    )
    rows = result.all()
    
    questions = []
    for sq, q in rows:
        q_dict = {
            "id": q.id,
            "type": q.type,
            "difficulty": q.difficulty,
            "topic": q.topic,
            "title": q.title,
            "content": q.content,
            "marks": sq.marks_override or q.marks,
            "time_limit_seconds": sq.time_limit_override or q.time_limit_seconds,
        }
        
        if q.type == "mcq":
            # For students, strip is_correct from options
            options = q.options or []
            if current_user["role"] == "student":
                options = [{"id": o["id"], "text": o["text"]} for o in options]
            q_dict["options"] = options
        elif q.type == "coding":
            q_dict["starter_code"] = q.starter_code
            test_cases = q.test_cases or []
            # Students see only non-hidden test cases
            if current_user["role"] == "student":
                test_cases = [tc for tc in test_cases if not tc.get("is_hidden")]
            q_dict["test_cases"] = test_cases
        
        questions.append(q_dict)
    
    return questions


@router.get("/join/{join_link}")
async def get_session_by_link(
    join_link: str,
    db: AsyncSession = Depends(get_db)
):
    """Get session info from join link (public endpoint)"""
    result = await db.execute(
        select(DBSession).where(DBSession.join_link == join_link)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "id": session.id,
        "title": session.title,
        "description": session.description,
        "instructions": session.instructions,
        "duration_minutes": session.duration_minutes,
        "total_marks": session.total_marks,
        "status": session.status,
        "fullscreen_required": session.fullscreen_required,
    }


@router.get("/{session_id}/live-status")
async def get_live_status(
    session_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get live session stats for admin monitoring dashboard"""
    from app.websocket.manager import active_sessions
    
    session_data = active_sessions.get(session_id, {})
    
    total = len(session_data)
    joined = sum(1 for s in session_data.values() if s["status"] == "joined")
    in_progress = sum(1 for s in session_data.values() if s["status"] == "in_progress")
    submitted = sum(1 for s in session_data.values() if s["status"] == "submitted")
    terminated = sum(1 for s in session_data.values() if s["status"] == "terminated")
    
    students_live = [
        {
            "student_id": sid,
            "student_name": info["student_name"],
            "status": info["status"],
            "warning_count": info.get("warning_count", 0),
            "progress": info.get("progress", 0),
            "time_remaining": info.get("time_remaining"),
            "connected": info.get("connected", False),
            "joined_at": info.get("joined_at"),
            "last_activity": info.get("last_activity"),
        }
        for sid, info in session_data.items()
    ]
    
    return {
        "session_id": session_id,
        "total_students": total,
        "joined": joined,
        "in_progress": in_progress,
        "submitted": submitted,
        "terminated": terminated,
        "students": students_live
    }



@router.patch("/{session_id}/edit")
async def edit_session(
    session_id: str,
    data: dict,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Edit session details � title, description, duration, passing_marks (anytime)"""
    result = await db.execute(
        select(DBSession).where(
            DBSession.id == session_id,
            DBSession.admin_id == current_user["user_id"]
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    allowed_fields = ["title", "description", "instructions", "duration_minutes", "passing_marks", "max_warnings"]
    for field in allowed_fields:
        if field in data and data[field] is not None:
            setattr(session, field, data[field])

    await db.commit()
    return {"success": True, "message": "Session updated"}
@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a session and its questions"""
    result = await db.execute(
        select(DBSession).where(
            DBSession.id == session_id,
            DBSession.admin_id == current_user["user_id"]
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete all related data first (order matters — child tables pehle)
    from app.models.models import Attempt, Answer, Warning

    # 1. Answers aur Warnings — Attempt ke children
    attempt_ids_result = await db.execute(
        select(Attempt.id).where(Attempt.session_id == session_id)
    )
    attempt_ids = [row[0] for row in attempt_ids_result.fetchall()]

    if attempt_ids:
        await db.execute(delete(Warning).where(Warning.attempt_id.in_(attempt_ids)))
        await db.execute(delete(Answer).where(Answer.attempt_id.in_(attempt_ids)))

    # 2. Attempts
    await db.execute(delete(Attempt).where(Attempt.session_id == session_id))

    # 3. Session Questions
    await db.execute(delete(SessionQuestion).where(SessionQuestion.session_id == session_id))

    # 4. Session itself
    await db.delete(session)
    await db.commit()
    return {"success": True}
