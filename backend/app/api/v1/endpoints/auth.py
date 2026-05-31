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


# ─── Step 1: Login — password check, OTP bhejo ────────────────────────────────

@router.post("/login", response_model=MessageResponse)
async def login_request_otp(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Admin).where(Admin.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ya password galat hai"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account inactive hai"
        )

    try:
        await create_otp(db, data.email, purpose="login")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    return {
        "message": f"OTP bhej diya gaya hai {data.email} pe. 10 minutes mein enter karo.",
        "email": data.email
    }


# ─── Step 2: OTP verify, JWT token lo ─────────────────────────────────────────

@router.post("/verify-otp")
async def verify_login_otp(data: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    ok = await verify_otp(db, data.email, data.otp, data.purpose)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP galat hai ya expire ho gaya"
        )

    result = await db.execute(select(Admin).where(Admin.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User nahi mila")

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
            raise HTTPException(status_code=400, detail="Email already registered hai")
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
        "message": f"Verification OTP bhej diya {data.email} pe.",
        "email": data.email
    }


@router.post("/verify-register-otp")
async def verify_register_otp(data: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    ok = await verify_otp(db, data.email, data.otp, "register")
    if not ok:
        raise HTTPException(status_code=400, detail="OTP galat hai ya expire ho gaya")

    result = await db.execute(select(Admin).where(Admin.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User nahi mila")

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
        raise HTTPException(status_code=404, detail="Email registered nahi hai")

    try:
        await create_otp(db, data.email, data.purpose)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": f"OTP dobara bhej diya {data.email} pe.", "email": data.email}


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
