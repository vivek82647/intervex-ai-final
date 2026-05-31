from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token, create_refresh_token, decode_token,
    hash_password, get_current_user
)
from app.models.models import Admin
from app.services.otp_service import create_otp, verify_otp

router = APIRouter(tags=["auth"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str
    purpose: str = "login"

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization: Optional[str] = None

class MessageResponse(BaseModel):
    message: str
    email: str = None

class ResendOTPRequest(BaseModel):
    email: EmailStr
    purpose: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ─── Step 1: Login — validate password and send OTP ──────────────────────────

@router.post("/login", response_model=MessageResponse)
async def login_request_otp(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Admin).where(Admin.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )

    try:
        await create_otp(db, data.email, purpose="login")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    return {
        "message": f"An OTP was sent to {data.email}. Enter it within 10 minutes.",
        "email": data.email
    }


# ─── Step 2: Verify OTP and issue JWT tokens ─────────────────────────────────

@router.post("/verify-otp")
async def verify_login_otp(data: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    ok = await verify_otp(db, data.email, data.otp, data.purpose)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The OTP is incorrect or has expired"
        )

    result = await db.execute(select(Admin).where(Admin.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token_data = {"sub": str(user.id), "role": user.role, "email": user.email}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role
        }
    }


# ─── Registration ──────────────────────────────────────────────────────────────

@router.post("/register", response_model=MessageResponse)
async def register_request_otp(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Admin).where(Admin.email == data.email))
    existing = result.scalar_one_or_none()

    if existing:
        if existing.is_active:
            raise HTTPException(status_code=400, detail="Email is already registered")
    else:
        new_user = Admin(
            email=data.email,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            organization=data.organization,
            role="admin",
            is_active=False
        )
        db.add(new_user)
        await db.commit()
    if existing and not existing.is_active:
        existing.password_hash = hash_password(data.password)
        existing.full_name = data.full_name
        existing.organization = data.organization
        existing.role = "admin"
        await db.commit()

    try:
        await create_otp(db, data.email, purpose="register")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "message": f"A verification OTP was sent to {data.email}.",
        "email": data.email
    }


@router.post("/verify-register-otp")
async def verify_register_otp(data: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    ok = await verify_otp(db, data.email, data.otp, "register")
    if not ok:
        raise HTTPException(status_code=400, detail="The OTP is incorrect or has expired")

    result = await db.execute(select(Admin).where(Admin.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    user.is_verified = True
    await db.commit()

    token_data = {"sub": str(user.id), "role": user.role, "email": user.email}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role
        }
    }


# ─── Resend OTP ────────────────────────────────────────────────────────────────

@router.post("/resend-otp", response_model=MessageResponse)
async def resend_otp(data: ResendOTPRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Admin).where(Admin.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Email is not registered")

    try:
        await create_otp(db, data.email, data.purpose)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": f"A new OTP was sent to {data.email}.", "email": data.email}


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


# ─── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


# ─── Student Join (OTP-based) ─────────────────────────────────────────────────

from app.models.models import Student, Session as DBSession
import uuid as uuid_lib

class StudentJoinRequest(BaseModel):
    join_link: str
    full_name: str
    email: EmailStr
    roll_number: Optional[str] = None
    phone: Optional[str] = None

class StudentJoinOTPVerify(BaseModel):
    join_link: str
    full_name: str
    email: EmailStr
    roll_number: Optional[str] = None
    phone: Optional[str] = None
    otp: str


@router.post("/student/join/send-otp")
async def student_join_send_otp(
    data: StudentJoinRequest,
    db: AsyncSession = Depends(get_db)
):
    """Step 1: Validate session link and send OTP to student email."""
    result = await db.execute(
        select(DBSession).where(DBSession.join_link == data.join_link)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Invalid session link")
    if session.status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Session is '{session.status}' — cannot join right now"
        )

    try:
        await create_otp(db, data.email, purpose="test")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": f"OTP sent to {data.email}", "email": data.email}


@router.post("/student/join")
async def student_join_verify_otp(
    data: StudentJoinOTPVerify,
    db: AsyncSession = Depends(get_db)
):
    """Step 2: Verify OTP and issue student token."""
    ok = await verify_otp(db, data.email, data.otp, purpose="test")
    if not ok:
        raise HTTPException(status_code=400, detail="OTP is incorrect or has expired")

    result = await db.execute(
        select(DBSession).where(DBSession.join_link == data.join_link)
    )
    session = result.scalar_one_or_none()
    if not session or session.status != "active":
        raise HTTPException(status_code=400, detail="Session is no longer available")

    # Find or create student
    result = await db.execute(
        select(Student).where(
            Student.admin_id == session.admin_id,
            Student.email == data.email
        )
    )
    student = result.scalar_one_or_none()

    if not student:
        student = Student(
            id=str(uuid_lib.uuid4()),
            admin_id=session.admin_id,
            email=data.email,
            full_name=data.full_name,
            roll_number=data.roll_number,
            phone=data.phone,
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)

    token_data = {
        "sub": str(student.id),
        "email": student.email,
        "role": "student",
        "session_id": session.id,
        "admin_id": session.admin_id,
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
