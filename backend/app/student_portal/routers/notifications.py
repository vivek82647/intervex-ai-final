"""
Notifications Router
Admin sends → Student reads (read-only for students)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.student_portal.models.models import StudentNotification, StudentProfile
from app.student_portal.schemas import NotificationCreate, NotificationOut

router = APIRouter(prefix="/api/student-portal/notifications", tags=["SP Notifications"])


# Student: get own notifications
@router.get("/student/{user_id}", response_model=List[NotificationOut])
async def get_my_notifications(user_id: int, db: AsyncSession = Depends(get_db)):
    sp = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile = sp.scalar_one_or_none()
    if not profile:
        return []

    result = await db.execute(
        select(StudentNotification)
        .where(StudentNotification.student_id == profile.id)
        .order_by(StudentNotification.created_at.desc())
    )
    return result.scalars().all()


# Student: unread count
@router.get("/student/{user_id}/unread-count")
async def unread_count(user_id: int, db: AsyncSession = Depends(get_db)):
    sp = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile = sp.scalar_one_or_none()
    if not profile:
        return {"count": 0}

    result = await db.execute(
        select(StudentNotification)
        .where(StudentNotification.student_id == profile.id)
        .where(StudentNotification.is_read == False)
    )
    return {"count": len(result.scalars().all())}


# Student: mark one as read
@router.patch("/{notif_id}/read")
async def mark_read(notif_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StudentNotification).where(StudentNotification.id == notif_id)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Not found")
    notif.is_read = True
    await db.commit()
    return {"ok": True}


# Student: mark all as read
@router.patch("/student/{user_id}/read-all")
async def mark_all_read(user_id: int, db: AsyncSession = Depends(get_db)):
    sp = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile = sp.scalar_one_or_none()
    if not profile:
        return {"ok": True}

    result = await db.execute(
        select(StudentNotification)
        .where(StudentNotification.student_id == profile.id)
        .where(StudentNotification.is_read == False)
    )
    for n in result.scalars().all():
        n.is_read = True
    await db.commit()
    return {"ok": True}


# Admin: send notification (individual or broadcast)
@router.post("/", response_model=List[NotificationOut])
async def send_notification(data: NotificationCreate, db: AsyncSession = Depends(get_db)):
    created = []

    if data.student_id:
        # Individual — student_id here is StudentProfile.id
        notif = StudentNotification(
            student_id=data.student_id,
            title=data.title,
            message=data.message,
            type=data.type,
        )
        db.add(notif)
        created.append(notif)
    else:
        # Broadcast — send to all student profiles
        result = await db.execute(select(StudentProfile))
        profiles = result.scalars().all()
        for profile in profiles:
            notif = StudentNotification(
                student_id=profile.id,
                title=data.title,
                message=data.message,
                type=data.type,
            )
            db.add(notif)
            created.append(notif)

    await db.commit()
    for n in created:
        await db.refresh(n)
    return created
