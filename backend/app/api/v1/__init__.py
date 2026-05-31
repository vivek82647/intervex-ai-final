"""
INTERVEX AI - API v1 Router
Sabhi endpoints yahan register hote hain
"""
from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.classes import router as classes_router
from app.api.v1.endpoints.students import router as students_router
from app.api.v1.endpoints.questions import router as questions_router
from app.api.v1.endpoints.sessions import router as sessions_router
from app.api.v1.endpoints.attempts import router as attempts_router
from app.api.v1.endpoints.results import router as results_router

router = APIRouter()

router.include_router(auth_router,     prefix="/auth",      tags=["Auth"])
router.include_router(admin_router,    prefix="/admin",     tags=["Admin"])
router.include_router(classes_router,  prefix="/classes",   tags=["Classes"])
router.include_router(students_router, prefix="/students",  tags=["Students"])
router.include_router(questions_router,prefix="/questions", tags=["Questions"])
router.include_router(sessions_router, prefix="/sessions",  tags=["Sessions"])
router.include_router(attempts_router, prefix="/attempts",  tags=["Attempts"])
router.include_router(results_router,  prefix="/results",   tags=["Results"])