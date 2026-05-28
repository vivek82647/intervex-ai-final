"""Classes Endpoints"""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import require_admin
from app.models.models import Class, StudentClassEnrollment, Student
from app.schemas.schemas import ClassCreate, ClassOut

router = APIRouter()


@router.post("", response_model=ClassOut)
async def create_class(
    data: ClassCreate,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    cls = Class(
        id=str(uuid.uuid4()),
        admin_id=current_user["user_id"],
        name=data.name,
        description=data.description,
        subject=data.subject,
    )
    db.add(cls)
    await db.commit()
    await db.refresh(cls)
    return ClassOut(**{k: v for k, v in cls.__dict__.items() if k != "_sa_instance_state"}, student_count=0)


@router.get("", response_model=List[ClassOut])
async def list_classes(
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Class).where(Class.admin_id == current_user["user_id"])
    )
    classes = result.scalars().all()
    output = []
    for c in classes:
        count = await db.execute(
            select(func.count(StudentClassEnrollment.id)).where(StudentClassEnrollment.class_id == c.id)
        )
        output.append(ClassOut(
            **{k: v for k, v in c.__dict__.items() if k != "_sa_instance_state"},
            student_count=count.scalar() or 0
        ))
    return output


@router.post("/{class_id}/students/{student_id}")
async def enroll_student(
    class_id: str,
    student_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    enrollment = StudentClassEnrollment(
        id=str(uuid.uuid4()),
        student_id=student_id,
        class_id=class_id,
    )
    db.add(enrollment)
    await db.commit()
    return {"success": True}
