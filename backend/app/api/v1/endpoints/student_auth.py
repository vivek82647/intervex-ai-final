"""
Student Authentication - Register + Login with OTP
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import uuid as uuid_lib

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.models import Student, OTPRecord, Attempt, Session as DBSession
from app.services.email_service import send_otp_email, generate_otp

router = APIRouter(prefix="/student", tags=["student-auth"])

OTP_EXPIRE_MINUTES = 10


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def create_and_send_otp(db: AsyncSession, email: str, purpose: str, name: str = "") -> bool:
    # Delete old OTPs
    await db.execute(delete(OTPRecord).where(OTPRecord.email == email, OTPRecord.purpose == purpose))
    await db.commit()

    otp = generate_otp()
    record = OTPRecord(
        email=email, otp=otp, purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
        is_used=False,
    )
    db.add(record)
    await db.commit()

    import asyncio
    sent = await asyncio.to_thread(send_otp_email, email, otp, purpose, name)
    return sent


async def verify_otp_code(db: AsyncSession, email: str, otp: str, purpose: str) -> bool:
    result = await db.execute(
        select(OTPRecord).where(
            OTPRecord.email == email,
            OTPRecord.otp == otp,
            OTPRecord.purpose == purpose,
            OTPRecord.is_used == False,
            OTPRecord.expires_at > datetime.utcnow()
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        return False
    record.is_used = True
    await db.commit()
    return True


# ─── Register ─────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    roll_number: Optional[str] = None
    phone: Optional[str] = None

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class JoinRequest(BaseModel):
    join_link: str


@router.post("/register/send-otp")
async def register_send_otp(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Step 1: Check email not taken, send OTP"""
    result = await db.execute(select(Student).where(Student.email == data.email))
    existing = result.scalar_one_or_none()

    if existing and existing.is_verified:
        raise HTTPException(status_code=400, detail="Email already registered. Please login.")

    # Store temp data in OTP record notes — or just send OTP
    sent = await create_and_send_otp(db, data.email, "register", data.full_name)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")

    return {"message": f"OTP sent to {data.email}"}


@router.post("/register/verify-otp")
async def register_verify_otp(
    otp_data: OTPVerifyRequest,
    reg_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Step 2: Verify OTP and create account"""
    if not await verify_otp_code(db, reg_data.email, otp_data.otp, "register"):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    result = await db.execute(select(Student).where(Student.email == reg_data.email))
    existing = result.scalar_one_or_none()

    if existing:
        existing.password_hash = hash_password(reg_data.password)
        existing.full_name = reg_data.full_name
        existing.is_verified = True
        existing.is_active = True
        await db.commit()
        student = existing
    else:
        student = Student(
            id=str(uuid_lib.uuid4()),
            email=reg_data.email,
            password_hash=hash_password(reg_data.password),
            full_name=reg_data.full_name,
            roll_number=reg_data.roll_number,
            phone=reg_data.phone,
            is_verified=True,
            is_active=True,
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)

    token_data = {"sub": str(student.id), "email": student.email, "role": "student"}
    return {
        "access_token": create_access_token(token_data),
        "token_type": "bearer",
        "student": {"id": student.id, "email": student.email, "full_name": student.full_name}
    }


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/login/send-otp")
async def login_send_otp(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Step 1: Verify password, send OTP"""
    result = await db.execute(select(Student).where(Student.email == data.email))
    student = result.scalar_one_or_none()

    if not student or not verify_password(data.password, student.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not student.is_verified:
        raise HTTPException(status_code=400, detail="Email not verified. Please register first.")
    if not student.is_active:
        raise HTTPException(status_code=403, detail="Account is blocked. Contact your administrator.")

    sent = await create_and_send_otp(db, data.email, "login", student.full_name)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")

    return {"message": f"OTP sent to {data.email}"}


@router.post("/login/verify-otp")
async def login_verify_otp(
    otp_data: OTPVerifyRequest,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Step 2: Verify OTP, return token"""
    result = await db.execute(select(Student).where(Student.email == login_data.email))
    student = result.scalar_one_or_none()
    if not student or not student.is_active:
        raise HTTPException(status_code=403, detail="Account blocked or not found")

    if not await verify_otp_code(db, login_data.email, otp_data.otp, "login"):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    token_data = {"sub": str(student.id), "email": student.email, "role": "student"}
    return {
        "access_token": create_access_token(token_data),
        "token_type": "bearer",
        "student": {"id": student.id, "email": student.email, "full_name": student.full_name}
    }


# ─── Join Session ─────────────────────────────────────────────────────────────

@router.post("/join")
async def join_session(data: JoinRequest, db: AsyncSession = Depends(get_db)):
    """Authenticated student joins a session via link"""
    from app.core.security import get_current_user
    # This endpoint requires Bearer token — handled by middleware
    # Returns session info for the student to start test
    result = await db.execute(select(DBSession).where(DBSession.join_link == data.join_link))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Invalid session link")
    if session.status != "active":
        raise HTTPException(status_code=400, detail=f"Session is '{session.status}'")
    return {
        "session_id": session.id,
        "session_title": session.title,
        "duration_minutes": session.duration_minutes,
        "instructions": session.instructions,
    }


# ─── Admin: Unblock student for rejoin ────────────────────────────────────────

@router.post("/unblock/{attempt_id}")
async def unblock_for_rejoin(attempt_id: str, db: AsyncSession = Depends(get_db)):
    """Admin unblocks a terminated student's attempt for rejoin"""
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status != "terminated":
        raise HTTPException(status_code=400, detail="Attempt is not terminated")

    attempt.status = "in_progress"
    attempt.termination_reason = "REJOIN_APPROVED"
    attempt.warning_count = 0
    attempt.started_at = datetime.utcnow()
    await db.commit()
    return {"message": "Student unblocked. They can now rejoin."}
