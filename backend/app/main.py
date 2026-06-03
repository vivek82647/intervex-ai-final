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


async def run_migrations():
    """Add missing columns to existing tables without dropping data"""
    import aiosqlite
    db_path = "./intervex.db"
    try:
        async with aiosqlite.connect(db_path) as db:
            # Check and add password_hash to students
            cursor = await db.execute("PRAGMA table_info(students)")
            columns = [row[1] for row in await cursor.fetchall()]

            if "password_hash" not in columns:
                await db.execute("ALTER TABLE students ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
                logger.info("✅ Added password_hash to students")

            if "is_verified" not in columns:
                await db.execute("ALTER TABLE students ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0")
                logger.info("✅ Added is_verified to students")

            if "admin_id" not in columns:
                await db.execute("ALTER TABLE students ADD COLUMN admin_id TEXT")
                logger.info("✅ Added admin_id to students")

            await db.commit()
            logger.info("✅ Migrations complete")
    except Exception as e:
        logger.warning(f"Migration note: {e}")


async def seed_super_admin():
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
    logger.info("🚀 INTERVEX AI starting...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables created")
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
@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "INTERVEX AI",
        "version": "2.0.0",
        "db": "SQLite (intervex.db)",
        "ai": "Groq (free)",
    }


asgi_app = socket_app