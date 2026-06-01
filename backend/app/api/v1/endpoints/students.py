"""Students Endpoints"""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import require_admin
from app.models.models import Student
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
    result = await db.execute(
        select(Student)
    )
    return result.scalars().all()