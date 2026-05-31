"""
Core Configuration - SQLite + Groq + Resend Email
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
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database
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

    # ── Resend Email (free, no credit card — resend.com) ──
    RESEND_API_KEY: str = ""                          # re_xxxxxxxxxxxxxxxx
    RESEND_FROM_EMAIL: str = "INTERVEX AI <onboarding@resend.dev>"  # default works without custom domain

    # OTP settings
    OTP_EXPIRE_MINUTES: int = 10
    SMTP_TIMEOUT_SECONDS: int = 15

    # Keep these for backward compat (unused now)
    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    MAILGUN_API_KEY: str = ""
    MAILGUN_DOMAIN: str = ""
    MAILGUN_FROM_ADDRESS: str = ""
    MAILGUN_API_BASE_URL: str = "https://api.mailgun.net"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
