"""
Student Portal — main router
Add to Intervex main.py:
    from app.student_portal import sp_router
    app.include_router(sp_router, prefix="/api")
"""
from fastapi import APIRouter
from app.student_portal.routers.auth import router as auth_router
from app.student_portal.routers.results import router as results_router
from app.student_portal.routers.assignments import router as assignments_router
from app.student_portal.routers.notifications import router as notifications_router
from app.student_portal.routers.dashboard import router as dashboard_router, ai_router

sp_router = APIRouter()
sp_router.include_router(auth_router)
sp_router.include_router(results_router)
sp_router.include_router(assignments_router)
sp_router.include_router(notifications_router)
sp_router.include_router(dashboard_router)
sp_router.include_router(ai_router)
