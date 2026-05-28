"""
INTERVEX AI - Main FastAPI Application (SQLite + Groq, no Docker)
"""
import logging
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.api.v1 import router as api_router
from app.websocket.manager import sio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_super_admin():
    """Create default super admin on first run"""
    from sqlalchemy import select
    from app.models.models import Admin
    from app.core.security import hash_password
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Admin).where(Admin.email == settings.SUPER_ADMIN_EMAIL))
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
    logger.info("🚀 INTERVEX AI starting (SQLite + Groq mode)...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database ready: intervex.db")
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "INTERVEX AI",
        "version": "2.0.0",
        "db": "SQLite (intervex.db)",
        "ai": "Groq (free)",
    }


asgi_app = socket_app
