"""
API v1 Router - Aggregates all endpoint routers
"""
from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, admin, classes, students, questions, sessions, attempts, results
)

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(admin.router, prefix="/admin", tags=["Admin"])
router.include_router(classes.router, prefix="/classes", tags=["Classes"])
router.include_router(students.router, prefix="/students", tags=["Students"])
router.include_router(questions.router, prefix="/questions", tags=["Questions"])
router.include_router(sessions.router, prefix="/sessions", tags=["Sessions"])
router.include_router(attempts.router, prefix="/attempts", tags=["Attempts"])
router.include_router(results.router, prefix="/results", tags=["Results"])
