"""
Core Configuration - PostgreSQL (Neon) + Groq + Resend
"""
import secrets
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "INTERVEX AI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = secrets.token_urlsafe(32)

    # JWT
    JWT_SECRET_KEY: str = "change-this-to-a-fixed-secret-key-in-dotenv"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database — SQLite locally, PostgreSQL on Render
    DATABASE_URL: str = "sqlite+aiosqlite:///./intervex.db"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Groq
    GROQ_API_KEY: str = ""

    # Super Admin
    SUPER_ADMIN_EMAIL: str = "admin@intervex.ai"
    SUPER_ADMIN_PASSWORD: str = "Admin@123!"

    # Resend Email
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "INTERVEX AI <onboarding@resend.dev>"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()