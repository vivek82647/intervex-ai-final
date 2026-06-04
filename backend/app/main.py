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
from app.core.database import engine, Base, AsyncSessionLocal
from app.api.v1 import router as api_router
from app.websocket.manager import sio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_super_admin():
    """Create the super admin account if it doesn't exist yet"""
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
    # Create all tables in PostgreSQL (safe — skips existing tables)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ PostgreSQL tables ready")
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

# ---------------------------------------------------------------
# CORS — list every origin that should be allowed.
# allow_origins=["*"] conflicts with allow_credentials=True in
# most browsers, so we list origins explicitly instead.
# ---------------------------------------------------------------
ALLOWED_ORIGINS = [
    "https://intervex-ai-final.vercel.app",   # production frontend
    "http://localhost:3000",                    # local React dev
    "http://localhost:5173",                    # local Vite dev
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


@app.get("/health")
@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "INTERVEX AI",
        "version": "2.0.0",
        "db": "PostgreSQL",
        "ai": "Groq (llama-3.3-70b)",
    }


# Entry point for Render / uvicorn:
#   uvicorn app.main:asgi_app --host 0.0.0.0 --port 8000
asgi_app = socket_app