from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token, hash_password, get_current_user
)
from app.models.models import Admin
from app.services.otp_service import create_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["auth"])


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
    role: str = "admin"

class MessageResponse(BaseModel):
    message: str
    email: str = None

class ResendOTPRequest(BaseModel):
    email: EmailStr
    purpose: str


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

    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    return {
        "access_token": token,
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
            role=data.role,
            is_active=False
        )
        db.add(new_user)
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
    await db.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    return {
        "access_token": token,
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


# ─── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


# ─── Admin Alias Routes (frontend /auth/admin/* calls ke liye) ─────────────────
# Frontend /api/v1/auth/admin/register aur /api/v1/auth/admin/login call karta hai

@router.post("/admin/register", response_model=MessageResponse)
async def admin_register_alias(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Alias for /register — frontend compatibility"""
    return await register_request_otp(data, db)


@router.post("/admin/login", response_model=MessageResponse)
async def admin_login_alias(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Alias for /login — frontend compatibility"""
    return await login_request_otp(data, db)


@router.post("/admin/verify-otp")
async def admin_verify_otp_alias(data: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Alias for /verify-otp — frontend compatibility"""
    return await verify_login_otp(data, db)


@router.post("/admin/verify-register-otp")
async def admin_verify_register_otp_alias(data: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Alias for /verify-register-otp — frontend compatibility"""
    return await verify_register_otp(data, db)


@router.post("/admin/resend-otp", response_model=MessageResponse)
async def admin_resend_otp_alias(data: ResendOTPRequest, db: AsyncSession = Depends(get_db)):
    """Alias for /resend-otp — frontend compatibility"""
    return await resend_otp(data, db)