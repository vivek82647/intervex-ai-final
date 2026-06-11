"""
INTERVEX AI - Main FastAPI Application
"""
import logging
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal, is_sqlite
from app.api.v1 import router as api_router
from app.websocket.manager import sio

# ── Student Portal ─────────────────────────────────────────────
from app.student_portal import sp_router
from app.student_portal.models.models import (
    SPSecretCode, SPUser, SPResult,
    SPAssignment, SPSubmission, SPNotification
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_migrations():
    async with engine.begin() as conn:
        if is_sqlite:
            result = await conn.execute(
                __import__('sqlalchemy').text("PRAGMA table_info(sessions)")
            )
            columns = [row[1] for row in result.fetchall()]
            if "activated_at" not in columns:
                await conn.execute(
                    __import__('sqlalchemy').text(
                        "ALTER TABLE sessions ADD COLUMN activated_at TIMESTAMP"
                    )
                )
                logger.info("✅ SQLite: activated_at column added")
        else:
            from sqlalchemy import text
            result = await conn.execute(text(
                """SELECT column_name FROM information_schema.columns
                WHERE table_name='sessions' AND column_name='activated_at'"""
            ))
            if not result.fetchone():
                await conn.execute(text(
                    "ALTER TABLE sessions ADD COLUMN activated_at TIMESTAMP WITHOUT TIME ZONE"
                ))
                logger.info("✅ PostgreSQL: activated_at column added")
            else:
                logger.info("ℹ️  activated_at column already exists")


async def seed_super_admin():
    from sqlalchemy import select
    from app.models.models import Admin
    from app.core.security import hash_password

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Admin).where(Admin.email == settings.SUPER_ADMIN_EMAIL)
        )
        if not result.scalar_one_or_none():
            admin = Admin(
                id=str(uuid.uuid4()),
                email=settings.SUPER_ADMIN_EMAIL,
                password_hash=hash_password(settings.SUPER_ADMIN_PASSWORD),
                full_name="Super Admin",
                organization="INTERVEX AI",
                role="super_admin",
                is_verified=True,
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            logger.info(f"✅ Super admin created: {settings.SUPER_ADMIN_EMAIL}")
        else:
            logger.info("ℹ️  Super admin already exists")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 INTERVEX AI starting...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Tables ready (including Student Portal tables)")
    await run_migrations()
    await seed_super_admin()
    yield
    logger.info("🛑 INTERVEX AI shutting down...")


app = FastAPI(
    title="INTERVEX AI API",
    description="AI-Powered Mock Interview & Assessment Platform",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = [
    "https://intervex-ai-final.vercel.app",
    "https://intervex-ai-final-git-main-viveks-projects.vercel.app",
    "https://*.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

# ── Student Portal routes: /api/sp/... ─────────────────────────
app.include_router(sp_router, prefix="/api")

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


@app.get("/health")
@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "INTERVEX AI",
        "version": "2.0.0",
        "db": "PostgreSQL",
        "ai": "Groq",
        "student_portal": "enabled",
    }


asgi_app = socket_app
