"""
Dashboard Router — aggregate performance stats for student
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.database import get_db
from app.student_portal.models.models import SessionResult, StudentProfile, StudentNotification
from app.student_portal.schemas import DashboardOut

router = APIRouter(prefix="/api/student-portal/dashboard", tags=["SP Dashboard"])


@router.get("/{user_id}")
async def get_dashboard(user_id: int, db: AsyncSession = Depends(get_db)):
    # Get student profile
    sp_result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile = sp_result.scalar_one_or_none()

    # Get user info from Intervex users table
    user_row = await db.execute(
        text("SELECT id, full_name, email FROM users WHERE id = :uid"),
        {"uid": user_id}
    )
    user = user_row.mappings().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not profile:
        return {
            "student_id": user_id,
            "name": user["full_name"],
            "email": user["email"],
            "batch": None,
            "total_sessions": 0,
            "avg_score": 0,
            "best_score": 0,
            "latest_score": 0,
            "rounds_completed": 0,
            "unread_notifications": 0,
            "score_trend": [],
        }

    # Sessions
    sessions_result = await db.execute(
        select(SessionResult)
        .where(SessionResult.student_id == profile.id)
        .where(SessionResult.is_published == True)
        .order_by(SessionResult.created_at.asc())
    )
    sessions = sessions_result.scalars().all()

    # Unread notifications
    notif_result = await db.execute(
        select(StudentNotification)
        .where(StudentNotification.student_id == profile.id)
        .where(StudentNotification.is_read == False)
    )
    unread = len(notif_result.scalars().all())

    if not sessions:
        return {
            "student_id": user_id,
            "name": user["full_name"],
            "email": user["email"],
            "batch": profile.batch,
            "total_sessions": 0,
            "avg_score": 0,
            "best_score": 0,
            "latest_score": 0,
            "rounds_completed": 0,
            "unread_notifications": unread,
            "score_trend": [],
        }

    scores = [s.score for s in sessions]
    completed = [s for s in sessions if s.status == "completed"]

    return {
        "student_id": user_id,
        "name": user["full_name"],
        "email": user["email"],
        "batch": profile.batch,
        "total_sessions": len(sessions),
        "avg_score": round(sum(scores) / len(scores), 1),
        "best_score": max(scores),
        "latest_score": scores[-1],
        "rounds_completed": len(completed),
        "unread_notifications": unread,
        "score_trend": [
            {"session": s.round, "score": s.score, "date": s.date, "title": s.title}
            for s in sessions
        ],
    }
