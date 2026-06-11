"""
SP Notifications - Admin sends, student reads
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.core.security import require_admin
from app.student_portal.models.models import SPNotification, SPUser

router = APIRouter(prefix="/sp/notifications", tags=["SP Notifications"])


class SendNotificationRequest(BaseModel):
    student_id: Optional[str] = None   # None = broadcast to all students
    title: str
    message: str
    type: str = "info"   # success | info | warning | error


# ── Admin: Send Notification ───────────────────────────────────
@router.post("")
async def send_notification(
    data: SendNotificationRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    admin_id = current_user["user_id"]

    if data.student_id:
        # Single student
        student = await db.execute(
            select(SPUser).where(SPUser.id == data.student_id, SPUser.admin_id == admin_id)
        )
        if not student.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Student not found")
        student_ids = [data.student_id]
    else:
        # Broadcast to all students of this admin
        result = await db.execute(
            select(SPUser.id).where(SPUser.admin_id == admin_id, SPUser.is_active == True)
        )
        student_ids = [row[0] for row in result.fetchall()]

    if not student_ids:
        raise HTTPException(status_code=404, detail="No students found")

    for sid in student_ids:
        notif = SPNotification(
            id=str(uuid.uuid4()),
            student_id=sid,
            admin_id=admin_id,
            title=data.title,
            message=data.message,
            type=data.type,
        )
        db.add(notif)

    await db.commit()
    return {"message": f"Notification sent to {len(student_ids)} student(s)"}


# ── Student: Get notifications ─────────────────────────────────
@router.get("/my/{student_id}")
async def my_notifications(
    student_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SPNotification)
        .where(SPNotification.student_id == student_id)
        .order_by(SPNotification.created_at.desc())
    )
    notifs = result.scalars().all()
    return [
        {k: v for k, v in n.__dict__.items() if k != "_sa_instance_state"}
        for n in notifs
    ]


# ── Student: Mark read ─────────────────────────────────────────
@router.patch("/{notif_id}/read")
async def mark_read(notif_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SPNotification).where(SPNotification.id == notif_id)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    await db.commit()
    return {"success": True}


# ── Student: Mark all read ─────────────────────────────────────
@router.patch("/my/{student_id}/read-all")
async def mark_all_read(student_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SPNotification).where(
            SPNotification.student_id == student_id,
            SPNotification.is_read == False
        )
    )
    notifs = result.scalars().all()
    for n in notifs:
        n.is_read = True
    await db.commit()
    return {"updated": len(notifs)}
