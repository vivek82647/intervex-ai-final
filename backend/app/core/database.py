"""
Async Database - PostgreSQL (Neon / Render) + SQLite (local)
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

db_url = settings.DATABASE_URL

is_sqlite = db_url.startswith("sqlite")

if not is_sqlite:
    # Normalize URL scheme so asyncpg is always used
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Strip sslmode query param — asyncpg uses connect_args for SSL, not the URL
    for param in ("?sslmode=require", "&sslmode=require", "?sslmode=disable", "&sslmode=disable"):
        db_url = db_url.replace(param, "")

engine = create_async_engine(
    db_url,
    echo=False,
    **({} if is_sqlite else {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
        "connect_args": {"ssl": "require"},
    })
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()