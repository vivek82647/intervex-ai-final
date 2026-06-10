"""
Student Portal Auth
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.student_portal.models.models import StudentProfile
from app.student_portal.schemas import StudentProfileCreate, StudentProfileOut

router = APIRouter(prefix="/student-portal/auth", tags=["SP Auth"])


@router.get("/profile/{user_id}", response_model=StudentProfileOut)
async def get_profile(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile


@router.post("/profile", response_model=StudentProfileOut)
async def create_or_update_profile(data: StudentProfileCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == data.user_id)
    )
    profile = result.scalar_one_or_none()

    if profile:
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(profile, k, v)
    else:
        profile = StudentProfile(**data.model_dump())
        db.add(profile)

    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/students")
async def list_students(db: AsyncSession = Depends(get_db)):
    """Admin: list all registered students"""
    result = await db.execute(select(StudentProfile))
    students = result.scalars().all()
    return [
        {
            "student_profile_id": s.id,
            "user_id": s.user_id,
            "name": s.name,
            "email": s.email,
            "batch": s.batch,
            "college": s.college,
        }
        for s in students
    ]
