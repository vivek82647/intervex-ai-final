"""
Core Configuration - SQLite + Groq (Free, no Docker needed)
"""
import secrets
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "INTERVEX AI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = secrets.token_urlsafe(32)

    # Email - Gmail SMTP for OTP
    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""
    OTP_EXPIRE_MINUTES: int = 10
    SMTP_TIMEOUT_SECONDS: int = 15

    # JWT
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # SQLite - no PostgreSQL needed!
    DATABASE_URL: str = "sqlite+aiosqlite:///./intervex.db"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Groq API (free at console.groq.com)
    GROQ_API_KEY: str = ""

    # Super Admin
    SUPER_ADMIN_EMAIL: str = "admin@intervex.ai"
    SUPER_ADMIN_PASSWORD: str = "Admin@123!"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
