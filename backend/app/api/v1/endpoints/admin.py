"""
Admin Endpoints - Dashboard stats, profile, DB reset
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.core.security import require_admin
from app.models.models import Admin, Class, Student, Session as DBSession, Attempt

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    admin_id = current_user["user_id"]

    total_classes = await db.execute(
        select(func.count(Class.id)).where(Class.admin_id == admin_id)
    )
    total_sessions = await db.execute(
        select(func.count(DBSession.id)).where(DBSession.admin_id == admin_id)
    )
    active_sessions = await db.execute(
        select(func.count(DBSession.id)).where(
            DBSession.admin_id == admin_id, DBSession.status == "active"
        )
    )
    total_attempts = await db.execute(
        select(func.count(Attempt.id))
        .join(DBSession, Attempt.session_id == DBSession.id)
        .where(DBSession.admin_id == admin_id)
    )
    total_students = await db.execute(
        select(func.count(func.distinct(Attempt.student_id)))
        .join(DBSession, Attempt.session_id == DBSession.id)
        .where(DBSession.admin_id == admin_id)
    )
    avg_score = await db.execute(
        select(func.avg(Attempt.percentage))
        .join(DBSession, Attempt.session_id == DBSession.id)
        .where(DBSession.admin_id == admin_id, Attempt.status == "submitted")
    )

    return {
        "total_classes": total_classes.scalar() or 0,
        "total_students": total_students.scalar() or 0,
        "total_sessions": total_sessions.scalar() or 0,
        "active_sessions": active_sessions.scalar() or 0,
        "total_attempts": total_attempts.scalar() or 0,
        "avg_score": round(avg_score.scalar() or 0, 1),
    }


@router.get("/profile")
async def get_profile(
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Admin).where(Admin.id == current_user["user_id"]))
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    return {
        "id": admin.id,
        "email": admin.email,
        "full_name": admin.full_name,
        "organization": admin.organization,
        "avatar_url": admin.avatar_url,
        "role": admin.role,
        "created_at": admin.created_at,
    }


# ─── TEMPORARY: DB Reset — use karne ke baad DELETE kar dena ─────────────────
@router.delete("/reset-db")
async def reset_database(db: AsyncSession = Depends(get_db)):
    """Saari tables saaf karo — TEMPORARY ENDPOINT"""
    await db.execute(text("DELETE FROM warnings"))
    await db.execute(text("DELETE FROM answers"))
    await db.execute(text("DELETE FROM attempts"))
    await db.execute(text("DELETE FROM students"))
    await db.execute(text("DELETE FROM otp_records"))
    await db.commit()
    return {"message": "DB reset done! Students aur attempts sab saaf ho gaye."}
