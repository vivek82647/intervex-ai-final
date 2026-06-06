from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy import select, delete as sql_delete
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
    ip_address: Optional[str] = None  # sent from frontend


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


# ─── Student Join — seedha naam+email se, koi OTP nahi ──────────────────────

@router.post("/student/join")
async def student_join(data: StudentJoinRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Session validate karo
    result = await db.execute(select(DBSession).where(DBSession.join_link == data.join_link))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Invalid session link")
    if session.status != "active":
        raise HTTPException(status_code=400, detail=f"Session is '{session.status}' — cannot join right now")

    # Get real IP
    ip_address = data.ip_address or request.client.host or "Unknown"

    # ── STEP 1: EMAIL CHECK — find student first ───────────────────────────────
    result = await db.execute(select(Student).where(Student.email == data.email))
    student = result.scalar_one_or_none()

    if student:
        # Check if this student is terminated in this session
        existing = await db.execute(
            select(Attempt).where(
                Attempt.session_id == session.id,
                Attempt.student_id == student.id
            )
        )
        attempt = existing.scalar_one_or_none()

        if attempt:
            if attempt.status == "submitted":
                raise HTTPException(status_code=400, detail="You have already submitted this test")
            if attempt.status == "terminated":
                if attempt.termination_reason != "REJOIN_APPROVED":
                    raise HTTPException(status_code=403, detail="TERMINATED")
                # Rejoin approved — reset
                attempt.status = "in_progress"
                attempt.termination_reason = None
                attempt.warning_count = 0
                attempt.warning_count = 0
                attempt.started_at = datetime.utcnow()
                # Update IP to new one
                attempt.ip_address = ip_address
                await db.commit()

    # ── STEP 2: IP BLOCK CHECK ─────────────────────────────────────────────────
    # Block if any terminated attempt from this IP exists in this session
    if ip_address and ip_address != "Unknown":
        ip_check = await db.execute(
            select(Attempt).where(
                Attempt.session_id == session.id,
                Attempt.status == "terminated",
                Attempt.ip_address == ip_address,
                Attempt.termination_reason != "REJOIN_APPROVED",
            )
        )
        if ip_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="IP_BLOCKED")
    # ──────────────────────────────────────────────────────────────────────────

    # Create student if not exists
    if not student:
        student = Student(
            id=str(uuid_lib.uuid4()),
            email=data.email,
            full_name=data.full_name,
            password_hash="",
            roll_number=data.roll_number,
            phone=data.phone,
            is_active=True,
            is_verified=True,
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)

    # Store IP in attempt when created
    token_data = {
        "sub": str(student.id), "email": student.email,
        "role": "student", "session_id": session.id,
    }
    return {
        "access_token": create_access_token(token_data),
        "token_type": "bearer",
        "role": "student",
        "student_id": student.id,
        "student_name": student.full_name,
        "session_id": session.id,
        "session_title": session.title,
        "duration_minutes": session.duration_minutes,
    }




# ─── Student Rejoin Request (blocked/terminated student contacts admin) ────────

class RejoinRequestData(BaseModel):
    name: str
    email: EmailStr
    message: Optional[str] = None
    reason: str = "terminated"


@router.post("/student/rejoin-request")
async def student_rejoin_request(data: RejoinRequestData, db: AsyncSession = Depends(get_db)):
    """Store rejoin request so admin can see it in dashboard"""
    from app.models.models import OTPRecord
    from datetime import timedelta
    # Reuse OTPRecord table to store request (purpose="rejoin_request")
    # Clean old requests for this email first
    await db.execute(
        sql_delete(OTPRecord).where(
            OTPRecord.email == data.email,
            OTPRecord.purpose == "rejoin_request"
        )
    )
    import json
    record = OTPRecord(
        email=data.email,
        otp=json.dumps({"name": data.name, "message": data.message or "", "reason": data.reason}),
        purpose="rejoin_request",
        expires_at=datetime.utcnow() + timedelta(days=30),
        is_used=False,
    )
    db.add(record)
    await db.commit()
    return {"message": "Request submitted successfully"}

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


# ─── Admin: Approve Rejoin ────────────────────────────────────────────────────

@router.post("/admin/approve-rejoin/{attempt_id}")
async def approve_rejoin(
    attempt_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
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