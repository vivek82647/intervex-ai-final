"""
Student Portal Auth — Intervex ke existing JWT + users table se link
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
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
    """Admin: all students with profile info"""
    rows = await db.execute(text("""
        SELECT u.id as user_id, u.full_name as name, u.email,
               sp.id as student_profile_id, sp.batch, sp.college
        FROM users u
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE u.role = 'candidate' OR u.role = 'user'
        ORDER BY u.created_at DESC
    """))
    return [dict(row) for row in rows.mappings()]
