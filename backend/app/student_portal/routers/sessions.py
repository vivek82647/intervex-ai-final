"""
Session Results Router — Admin publishes, Student reads
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.student_portal.models.models import SessionResult, StudentProfile
from app.student_portal.schemas import SessionResultCreate, SessionResultOut

router = APIRouter(prefix="/api/student-portal/sessions", tags=["SP Sessions"])


# Student: get own results
@router.get("/student/{user_id}", response_model=List[SessionResultOut])
async def get_my_sessions(user_id: int, db: AsyncSession = Depends(get_db)):
    # Get student profile from user_id
    sp = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile = sp.scalar_one_or_none()
    if not profile:
        return []

    result = await db.execute(
        select(SessionResult)
        .where(SessionResult.student_id == profile.id)
        .where(SessionResult.is_published == True)
        .order_by(SessionResult.created_at.desc())
    )
    return result.scalars().all()


# Student: get single session detail
@router.get("/detail/{session_id}", response_model=SessionResultOut)
async def get_session_detail(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionResult).where(SessionResult.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


# Admin: publish result for a student
@router.post("/", response_model=SessionResultOut)
async def publish_result(data: SessionResultCreate, db: AsyncSession = Depends(get_db)):
    session = SessionResult(**data.model_dump())
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


# Admin: update a result
@router.patch("/{session_id}", response_model=SessionResultOut)
async def update_result(session_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionResult).where(SessionResult.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    for k, v in data.items():
        setattr(session, k, v)
    await db.commit()
    await db.refresh(session)
    return session


# Admin: toggle publish status
@router.patch("/{session_id}/publish")
async def toggle_publish(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionResult).where(SessionResult.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Not found")
    session.is_published = not session.is_published
    await db.commit()
    return {"published": session.is_published}


# Admin: get all results for a student profile
@router.get("/admin/student/{student_profile_id}", response_model=List[SessionResultOut])
async def admin_get_student_sessions(student_profile_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionResult)
        .where(SessionResult.student_id == student_profile_id)
        .order_by(SessionResult.created_at.desc())
    )
    return result.scalars().all()
