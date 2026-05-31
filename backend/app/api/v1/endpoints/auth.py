from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..core.database import get_db
from ..core.security import (
    verify_password, create_access_token, get_password_hash, get_current_user
)
from ..models.models import Admin as User
from ..services.otp_service import create_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

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


# ─── Step 1: Login — password check, OTP bhejo ───────────────────────────────

@router.post("/login", response_model=MessageResponse)
def login_request_otp(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
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
        create_otp(db, data.email, purpose="login")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    return {
        "message": f"OTP bhej diya gaya hai {data.email} pe. 10 minutes mein enter karo.",
        "email": data.email
    }


# ─── Step 2: OTP verify, JWT token lo ────────────────────────────────────────

@router.post("/verify-otp")
def verify_login_otp(data: OTPVerifyRequest, db: Session = Depends(get_db)):
    if not verify_otp(db, data.email, data.otp, data.purpose):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP galat hai ya expire ho gaya"
        )

    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User nahi mila")

    token = create_access_token({"sub": str(user.id), "role": user.role})
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


# ─── Registration ─────────────────────────────────────────────────────────────

@router.post("/register", response_model=MessageResponse)
def register_request_otp(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=400, detail="Email already registered hai")
    else:
        new_user = User(
            email=data.email,
            password_hash=get_password_hash(data.password),
            full_name=data.full_name,
            role=data.role,
            is_active=False
        )
        db.add(new_user)
        db.commit()

    try:
        create_otp(db, data.email, purpose="register")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "message": f"Verification OTP bhej diya {data.email} pe.",
        "email": data.email
    }


@router.post("/verify-register-otp")
def verify_register_otp(data: OTPVerifyRequest, db: Session = Depends(get_db)):
    if not verify_otp(db, data.email, data.otp, "register"):
        raise HTTPException(status_code=400, detail="OTP galat hai ya expire ho gaya")

    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User nahi mila")

    user.is_active = True
    db.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role})
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


# ─── Resend OTP ───────────────────────────────────────────────────────────────

@router.post("/resend-otp", response_model=MessageResponse)
def resend_otp(data: ResendOTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email registered nahi hai")

    try:
        create_otp(db, data.email, data.purpose)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": f"OTP dobara bhej diya {data.email} pe.", "email": data.email}


# ─── Me ───────────────────────────────────────────────────────────────────────

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role
    }