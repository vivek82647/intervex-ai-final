"""Students Endpoints"""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import require_admin
from app.models.models import Student, Attempt, Session as DBSession
from app.schemas.schemas import StudentCreate, StudentOut

router = APIRouter()


@router.post("", response_model=StudentOut)
async def create_student(
    data: StudentCreate,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(
        select(Student).where(Student.email == data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Student with this email already exists")

    student = Student(
        id=str(uuid.uuid4()),
        email=data.email,
        password_hash="",
        is_verified=False,
        full_name=data.full_name,
        roll_number=data.roll_number,
        phone=data.phone,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student


@router.get("", response_model=List[StudentOut])
async def list_students(
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Sirf wahi students jo is admin ki sessions mein join hue hain"""
    admin_id = current_user["user_id"]

    # Is admin ki saari sessions ke IDs nikalo
    sessions_result = await db.execute(
        select(DBSession.id).where(DBSession.admin_id == admin_id)
    )
    session_ids = [row[0] for row in sessions_result.fetchall()]

    if not session_ids:
        return []

    # Un sessions mein jo students aaye hain unke IDs nikalo
    attempts_result = await db.execute(
        select(Attempt.student_id).where(
            Attempt.session_id.in_(session_ids)
        ).distinct()
    )
    student_ids = [row[0] for row in attempts_result.fetchall()]

    if not student_ids:
        return []

    # Woh students return karo
    result = await db.execute(
        select(Student).where(Student.id.in_(student_ids))
    )
    return result.scalars().all()
