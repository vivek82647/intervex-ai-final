"""Send OTP emails through Resend API (free, no credit card)."""
import random
import string
import asyncio
import httpx
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.models import OTPRecord
from app.core.config import settings


def generate_otp(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


def get_otp_subject(purpose: str) -> str:
    return {
        "login":    "INTERVEX AI — Admin Login OTP",
        "register": "INTERVEX AI — Account Verification OTP",
        "test":     "INTERVEX AI — Test Access OTP",
    }.get(purpose, "INTERVEX AI — OTP Verification")


def get_otp_html(otp: str, purpose: str = "login") -> str:
    purpose_label = {
        "login":    "Admin Login",
        "register": "Account Verification",
        "test":     "Test Access Verification",
    }.get(purpose, "Verification")

    return f"""
    <html>
    <body style="font-family:'Segoe UI',Arial,sans-serif;background:#0D1117;margin:0;padding:40px 20px;">
      <div style="max-width:480px;margin:0 auto;background:#161B2E;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#5B6AF5,#00E5FF);padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">INTERVEX AI</h1>
          <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">{purpose_label}</p>
        </div>
        <div style="padding:36px 32px;">
          <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 28px;line-height:1.6;">
            Your one-time verification code is:
          </p>
          <div style="background:rgba(91,106,245,0.15);border:2px solid rgba(91,106,245,0.4);border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
            <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:#5B6AF5;font-family:monospace;">{otp}</span>
          </div>
          <p style="color:rgba(255,255,255,0.3);font-size:13px;margin:0;text-align:center;">
            ⏱ Valid for <strong style="color:rgba(255,255,255,0.5);">10 minutes</strong>. Never share this code.
          </p>
        </div>
        <div style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">
            If you didn't request this, please ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
    """


def send_otp_via_resend(to_email: str, otp: str, purpose: str = "login") -> bool:
    """Send OTP using Resend API (free tier: 3000 emails/month, no credit card)."""
    if not settings.RESEND_API_KEY:
        print(f"[DEV MODE] OTP for {to_email} ({purpose}): {otp}")
        return True

    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.RESEND_FROM_EMAIL,
                "to": [to_email],
                "subject": get_otp_subject(purpose),
                "html": get_otp_html(otp, purpose),
            },
            timeout=15,
        )
        if response.status_code in (200, 201):
            return True
        print(f"[Resend Error] HTTP {response.status_code}: {response.text}")
        return False
    except httpx.HTTPError as e:
        print(f"[Resend Error] {e}")
        return False


async def create_otp(db: AsyncSession, email: str, purpose: str) -> str:
    # Remove old OTPs for this email+purpose
    await db.execute(
        delete(OTPRecord).where(
            OTPRecord.email == email,
            OTPRecord.purpose == purpose
        )
    )
    await db.commit()

    otp = generate_otp()
    record = OTPRecord(
        email=email,
        otp=otp,
        purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
        is_used=False,
    )
    db.add(record)
    await db.commit()

    try:
        sent = await asyncio.wait_for(
            asyncio.to_thread(send_otp_via_resend, email, otp, purpose),
            timeout=20,
        )
    except asyncio.TimeoutError:
        raise Exception("OTP email timed out. Please try again.")

    if not sent:
        raise Exception("Failed to send OTP email. Check RESEND_API_KEY in .env")

    return otp


async def verify_otp(db: AsyncSession, email: str, otp: str, purpose: str) -> bool:
    result = await db.execute(
        select(OTPRecord).where(
            OTPRecord.email == email,
            OTPRecord.otp == otp,
            OTPRecord.purpose == purpose,
            OTPRecord.is_used == False,
            OTPRecord.expires_at > datetime.utcnow()
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        return False
    record.is_used = True
    await db.commit()
    return True
