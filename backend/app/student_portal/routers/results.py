"""
SP Results - Admin publishes, student views
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.core.security import require_admin
from app.student_portal.models.models import SPResult, SPUser

router = APIRouter(prefix="/sp/results", tags=["SP Results"])


def get_sp_student(db):
    """Helper — validate sp_student token"""
    from app.core.security import get_current_user
    return get_current_user


# ── Schemas ────────────────────────────────────────────────────
class QuestionData(BaseModel):
    question: str
    student_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    is_correct: bool = False
    marks_awarded: float = 0
    max_marks: float = 1

class PublishResultRequest(BaseModel):
    student_id: str
    session_title: str
    session_date: str
    round_name: str = "Round 1"
    score: float
    max_score: float = 100
    rank: Optional[int] = None
    status: str = "pending"   # selected / rejected / pending / next_round
    next_round_eligible: bool = False
    next_round_link: Optional[str] = None
    feedback: Optional[str] = None
    strengths: List[str] = []
    weaknesses: List[str] = []
    suggestions: List[str] = []
    questions_data: List[QuestionData] = []


# ── Admin: Publish Result ──────────────────────────────────────
@router.post("")
async def publish_result(
    data: PublishResultRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    # Verify student belongs to this admin
    student = await db.execute(
        select(SPUser).where(
            SPUser.id == data.student_id,
            SPUser.admin_id == current_user["user_id"]
        )
    )
    if not student.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Student not found")

    percentage = round((data.score / data.max_score) * 100, 1) if data.max_score else 0

    result = SPResult(
        id=str(uuid.uuid4()),
        student_id=data.student_id,
        admin_id=current_user["user_id"],
        admin_name=current_user.get("full_name") or current_user.get("email"),
        session_title=data.session_title,
        session_date=data.session_date,
        round_name=data.round_name,
        score=data.score,
        max_score=data.max_score,
        percentage=percentage,
        rank=data.rank,
        status=data.status,
        next_round_eligible=data.next_round_eligible,
        next_round_link=data.next_round_link,
        feedback=data.feedback,
        strengths=data.strengths,
        weaknesses=data.weaknesses,
        suggestions=data.suggestions,
        questions_data=[q.model_dump() for q in data.questions_data],
        is_published=True,
    )
    db.add(result)
    await db.commit()
    await db.refresh(result)
    return {"id": result.id, "message": "Result published successfully"}


# ── Admin: List results they published ────────────────────────
@router.get("/admin")
async def admin_results(
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SPResult, SPUser.full_name, SPUser.email)
        .join(SPUser, SPResult.student_id == SPUser.id)
        .where(SPResult.admin_id == current_user["user_id"])
        .order_by(SPResult.created_at.desc())
    )
    rows = result.all()
    return [
        {
            **{k: v for k, v in r.__dict__.items() if k != "_sa_instance_state"},
            "student_name": name,
            "student_email": email,
        }
        for r, name, email in rows
    ]


# ── Student: View own results ──────────────────────────────────
@router.get("/my/{student_id}")
async def my_results(
    student_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SPResult)
        .where(SPResult.student_id == student_id, SPResult.is_published == True)
        .order_by(SPResult.created_at.desc())
    )
    results = result.scalars().all()
    return [
        {k: v for k, v in r.__dict__.items() if k != "_sa_instance_state"}
        for r in results
    ]
