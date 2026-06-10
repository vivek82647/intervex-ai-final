"""
Student Portal — main router aggregator
Include this in Intervex's app/main.py
"""
from fastapi import APIRouter
from app.student_portal.routers import auth, sessions, notifications, dashboard

student_portal_router = APIRouter()

student_portal_router.include_router(auth.router)
student_portal_router.include_router(sessions.router)
student_portal_router.include_router(notifications.router)
student_portal_router.include_router(dashboard.router)
