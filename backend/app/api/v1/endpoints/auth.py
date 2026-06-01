from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token, create_refresh_token, decode_token,
    hash_password, get_current_user
)
from app.models.models import Admin, Student, Session as DBSession, Attempt
import uuid as uuid_lib

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class StudentJoinRequest(BaseModel):
    join_link: str
    full_name: str
    email: EmailStr
    roll_number: Optional[str] = None
    phone: Optional[str] = None


# ─── Admin Login ──────────────────────────────────────────────────────────────

@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Admin).where(Admin.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    token_data = {"sub": str(user.id), "role": user.role, "email": user.email}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role}
    }


# ─── Admin Register ───────────────────────────────────────────────────────────

@router.post("/register")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Admin).where(Admin.email == data.email))
    existing = result.scalar_one_or_none()
    if existing and existing.is_active:
        raise HTTPException(status_code=400, detail="Email is already registered")
    if existing:
        existing.password_hash = hash_password(data.password)
        existing.full_name = data.full_name
        existing.organization = data.organization
        existing.is_active = True
        existing.is_verified = True
        await db.commit()
        user = existing
    else:
        user = Admin(
            id=str(uuid_lib.uuid4()), email=data.email,
            password_hash=hash_password(data.password),
            full_name=data.full_name, organization=data.organization,
            role="admin", is_active=True, is_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    token_data = {"sub": str(user.id), "role": user.role, "email": user.email}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role}
    }


# ─── Student Join ─────────────────────────────────────────────────────────────

@router.post("/student/join")
async def student_join(data: StudentJoinRequest, db: AsyncSession = Depends(get_db)):
    # Validate session
    result = await db.execute(select(DBSession).where(DBSession.join_link == data.join_link))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Invalid session link")
    if session.status != "active":
        raise HTTPException(status_code=400, detail=f"Session is '{session.status}' — cannot join right now")

    # Find or create student
    result = await db.execute(
        select(Student).where(Student.admin_id == session.admin_id, Student.email == data.email)
    )
    student = result.scalar_one_or_none()
    if not student:
        student = Student(
            id=str(uuid_lib.uuid4()), admin_id=session.admin_id,
            email=data.email, full_name=data.full_name,
            roll_number=data.roll_number, phone=data.phone,
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)

    # Check existing attempt
    existing = await db.execute(
        select(Attempt).where(Attempt.session_id == session.id, Attempt.student_id == student.id)
    )
    attempt = existing.scalar_one_or_none()

    if attempt:
        if attempt.status == "submitted":
            raise HTTPException(status_code=400, detail="You have already submitted this test")

        if attempt.status == "terminated":
            # Only allow rejoin if admin approved (termination_reason = 'REJOIN_APPROVED')
            if attempt.termination_reason != "REJOIN_APPROVED":
                raise HTTPException(status_code=403, detail="TERMINATED")
            # Admin approved — reset attempt for fresh start
            attempt.status = "in_progress"
            attempt.termination_reason = None
            attempt.warning_count = 0
            attempt.started_at = datetime.utcnow()
            await db.commit()
            await db.refresh(attempt)

    token_data = {
        "sub": str(student.id), "email": student.email,
        "role": "student", "session_id": session.id, "admin_id": session.admin_id,
    }
    return {
        "access_token": create_access_token(token_data),
        "token_type": "bearer", "role": "student",
        "student_id": student.id, "student_name": student.full_name,
        "session_id": session.id, "session_title": session.title,
        "duration_minutes": session.duration_minutes,
    }


# ─── Refresh & Me ─────────────────────────────────────────────────────────────

@router.post("/refresh")
async def refresh_access_token(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    result = await db.execute(select(Admin).where(Admin.id == payload.get("sub")))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    token_data = {"sub": str(user.id), "role": user.role, "email": user.email}
    return {"access_token": create_access_token(token_data), "token_type": "bearer"}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


# ─── Admin: Approve Rejoin (REST endpoint as backup to WebSocket) ─────────────

@router.post("/admin/approve-rejoin/{attempt_id}")
async def approve_rejoin(
    attempt_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin approves a terminated student's rejoin request"""
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admins only")
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status != "terminated":
        raise HTTPException(status_code=400, detail="Attempt is not terminated")
    attempt.termination_reason = "REJOIN_APPROVED"
    await db.commit()
    return {"message": "Rejoin approved. Student can now re-enter the test."}