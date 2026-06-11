"""
Student Portal Auth
- Admin creates secret codes
- Students register using secret code
- Students login with email/password
"""
import uuid
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, require_admin, get_current_user
)
from app.student_portal.models.models import SPUser, SPSecretCode

router = APIRouter(prefix="/sp/auth", tags=["SP Auth"])


# ── Schemas ────────────────────────────────────────────────────
class SPRegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    secret_code: str
    batch: Optional[str] = None
    college: Optional[str] = None
    phone: Optional[str] = None

class SPLoginRequest(BaseModel):
    email: EmailStr
    password: str

class CreateSecretCodeRequest(BaseModel):
    code: str
    label: Optional[str] = None
    max_uses: Optional[int] = None


# ── Admin: Create Secret Code ──────────────────────────────────
@router.post("/secret-code")
async def create_secret_code(
    data: CreateSecretCodeRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin creates a secret code for their students"""
    # Check duplicate
    existing = await db.execute(
        select(SPSecretCode).where(SPSecretCode.code == data.code.upper().strip())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This code already exists. Use a different one.")

    code = SPSecretCode(
        id=str(uuid.uuid4()),
        admin_id=current_user["user_id"],
        code=data.code.upper().strip(),
        label=data.label,
        max_uses=data.max_uses,
    )
    db.add(code)
    await db.commit()
    await db.refresh(code)
    return {
        "id": code.id,
        "code": code.code,
        "label": code.label,
        "max_uses": code.max_uses,
        "used_count": code.used_count,
        "is_active": code.is_active,
        "created_at": code.created_at,
    }


@router.get("/secret-codes")
async def list_secret_codes(
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin: list all their secret codes"""
    result = await db.execute(
        select(SPSecretCode).where(SPSecretCode.admin_id == current_user["user_id"])
        .order_by(SPSecretCode.created_at.desc())
    )
    codes = result.scalars().all()
    return [
        {
            "id": c.id, "code": c.code, "label": c.label,
            "max_uses": c.max_uses, "used_count": c.used_count,
            "is_active": c.is_active, "created_at": c.created_at,
        }
        for c in codes
    ]


@router.patch("/secret-code/{code_id}/toggle")
async def toggle_secret_code(
    code_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin: activate or deactivate a secret code"""
    result = await db.execute(
        select(SPSecretCode).where(
            SPSecretCode.id == code_id,
            SPSecretCode.admin_id == current_user["user_id"]
        )
    )
    code = result.scalar_one_or_none()
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    code.is_active = not code.is_active
    await db.commit()
    return {"is_active": code.is_active}


# ── Student: Register ──────────────────────────────────────────
@router.post("/register")
async def sp_register(data: SPRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Student registers using admin's secret code"""
    # Validate secret code
    result = await db.execute(
        select(SPSecretCode).where(
            SPSecretCode.code == data.secret_code.upper().strip(),
            SPSecretCode.is_active == True
        )
    )
    code = result.scalar_one_or_none()
    if not code:
        raise HTTPException(status_code=400, detail="Invalid or expired secret code. Contact your admin.")

    # Check max uses
    if code.max_uses and code.used_count >= code.max_uses:
        raise HTTPException(status_code=400, detail="This code has reached its maximum usage limit.")

    # Check email already registered
    existing = await db.execute(
        select(SPUser).where(SPUser.email == data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email is already registered. Please login.")

    # Create student account
    student = SPUser(
        id=str(uuid.uuid4()),
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(data.password),
        admin_id=code.admin_id,
        secret_code_id=code.id,
        batch=data.batch,
        college=data.college,
        phone=data.phone,
    )
    db.add(student)

    # Increment usage count
    code.used_count += 1
    await db.commit()
    await db.refresh(student)

    token_data = {
        "sub": student.id,
        "email": student.email,
        "role": "sp_student",
        "admin_id": student.admin_id,
    }
    return {
        "access_token": create_access_token(token_data, expires_delta=timedelta(days=7)),
        "token_type": "bearer",
        "user": {
            "id": student.id,
            "full_name": student.full_name,
            "email": student.email,
            "admin_id": student.admin_id,
            "batch": student.batch,
        }
    }


# ── Student: Login ─────────────────────────────────────────────
@router.post("/login")
async def sp_login(data: SPLoginRequest, db: AsyncSession = Depends(get_db)):
    """Student login"""
    result = await db.execute(
        select(SPUser).where(SPUser.email == data.email, SPUser.is_active == True)
    )
    student = result.scalar_one_or_none()
    if not student or not verify_password(data.password, student.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token_data = {
        "sub": student.id,
        "email": student.email,
        "role": "sp_student",
        "admin_id": student.admin_id,
    }
    return {
        "access_token": create_access_token(token_data, expires_delta=timedelta(days=7)),
        "token_type": "bearer",
        "user": {
            "id": student.id,
            "full_name": student.full_name,
            "email": student.email,
            "admin_id": student.admin_id,
            "batch": student.batch,
            "college": student.college,
        }
    }


# ── Admin: List their students ─────────────────────────────────
@router.get("/students")
async def list_my_students(
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin: see all students who registered with their code"""
    result = await db.execute(
        select(SPUser).where(SPUser.admin_id == current_user["user_id"])
        .order_by(SPUser.created_at.desc())
    )
    students = result.scalars().all()
    return [
        {
            "id": s.id, "full_name": s.full_name, "email": s.email,
            "batch": s.batch, "college": s.college,
            "is_active": s.is_active, "created_at": s.created_at,
        }
        for s in students
    ]
