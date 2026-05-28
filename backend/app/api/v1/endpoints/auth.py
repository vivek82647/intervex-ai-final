"""
Auth Endpoints - Admin & Student authentication
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    get_current_user
)
from app.models.models import Admin, Student, Session as DBSession
from app.schemas.schemas import (
    AdminRegister, AdminLogin, TokenResponse, StudentJoin
)
import uuid

router = APIRouter()


@router.post("/admin/register", response_model=TokenResponse)
async def admin_register(
    data: AdminRegister,
    db: AsyncSession = Depends(get_db)
):
    """Register a new admin account"""
    # Check if email exists
    result = await db.execute(select(Admin).where(Admin.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    admin = Admin(
        id=str(uuid.uuid4()),
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        organization=data.organization,
        role="admin",
        is_verified=True,  # Auto-verify for now; add email verification later
    )
    db.add(admin)
    await db.commit()
    await db.refresh(admin)

    token_data = {"sub": admin.id, "email": admin.email, "role": admin.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=admin.role,
        user_id=admin.id,
        email=admin.email,
        full_name=admin.full_name
    )


@router.post("/admin/login", response_model=TokenResponse)
async def admin_login(
    data: AdminLogin,
    db: AsyncSession = Depends(get_db)
):
    """Admin login with email/password"""
    result = await db.execute(select(Admin).where(Admin.email == data.email))
    admin = result.scalar_one_or_none()
    
    if not admin or not verify_password(data.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not admin.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    token_data = {"sub": admin.id, "email": admin.email, "role": admin.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=admin.role,
        user_id=admin.id,
        email=admin.email,
        full_name=admin.full_name
    )


@router.post("/student/join")
async def student_join(
    data: StudentJoin,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Student joins a session via link"""
    # Find session by join link
    result = await db.execute(
        select(DBSession).where(DBSession.join_link == data.join_link)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Invalid session link")
    
    if session.status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Session is {session.status}. Cannot join."
        )

    # Find or create student record under this admin
    result = await db.execute(
        select(Student).where(
            Student.admin_id == session.admin_id,
            Student.email == data.email
        )
    )
    student = result.scalar_one_or_none()

    if not student:
        student = Student(
            id=str(uuid.uuid4()),
            admin_id=session.admin_id,
            email=data.email,
            full_name=data.full_name,
            roll_number=data.roll_number,
            phone=data.phone,
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)

    # Create student token
    token_data = {
        "sub": student.id,
        "email": student.email,
        "role": "student",
        "session_id": session.id,
        "admin_id": session.admin_id
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


@router.post("/refresh")
async def refresh_token(data: dict, db: AsyncSession = Depends(get_db)):
    """Refresh access token"""
    token = data.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="Refresh token required")
    
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=400, detail="Invalid token type")
    
    new_token_data = {"sub": payload["sub"], "email": payload.get("email"), "role": payload.get("role")}
    return {"access_token": create_access_token(new_token_data), "token_type": "bearer"}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return current_user
