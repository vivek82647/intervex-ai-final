"""Send OTP emails through Gmail SMTP."""
import random
import string
import asyncio
from datetime import datetime, timedelta
import smtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.models import OTPRecord
from app.core.config import settings


def generate_otp(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


def get_otp_subject(purpose: str) -> str:
    subject_map = {
        "login": "INTERVEX AI - Admin Login OTP",
        "register": "INTERVEX AI - Account Verification OTP",
        "test": "INTERVEX AI - Test Verification OTP",
    }
    return subject_map.get(purpose, "INTERVEX AI - OTP Verification")


def get_otp_html(otp: str) -> str:
    return f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 30px;">
          <div style="max-width: 500px; margin: auto; background: white; border-radius: 10px;
                      padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #1a1a2e; margin-bottom: 5px;">INTERVEX AI</h2>
            <hr style="border: 1px solid #eee; margin-bottom: 20px;">
            <p style="color: #555; font-size: 15px;">Your One-Time Password (OTP):</p>
            <div style="background: #1a1a2e; color: #fff; font-size: 36px; font-weight: bold;
                        letter-spacing: 12px; text-align: center; padding: 20px; border-radius: 8px;
                        margin: 20px 0;">
              {otp}
            </div>
            <p style="color: #888; font-size: 13px;">
              This OTP is valid for <strong>10 minutes</strong>.<br>
              Do not share it with anyone.
            </p>
          </div>
        </body>
        </html>
        """


def send_otp_email(to_email: str, otp: str, purpose: str = "login") -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = get_otp_subject(purpose)
        msg["From"] = settings.GMAIL_USER
        msg["To"] = to_email
        msg.attach(MIMEText(get_otp_html(otp), "html"))

        with smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
        ) as server:
            server.starttls()
            server.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)
            server.sendmail(settings.GMAIL_USER, to_email, msg.as_string())

        return True

    except Exception as e:
        print(f"[OTP Email Error] {e}")
        return False


def send_otp_email_via_mailgun(to_email: str, otp: str, purpose: str = "login") -> bool:
    from_email = settings.MAILGUN_FROM_ADDRESS or f"INTERVEX AI <postmaster@{settings.MAILGUN_DOMAIN}>"
    try:
        response = httpx.post(
            f"{settings.MAILGUN_API_BASE_URL}/v3/{settings.MAILGUN_DOMAIN}/messages",
            auth=("api", settings.MAILGUN_API_KEY),
            data={
                "from": from_email,
                "to": to_email,
                "subject": get_otp_subject(purpose),
                "html": get_otp_html(otp),
            },
            timeout=settings.SMTP_TIMEOUT_SECONDS,
        )
        if response.status_code == 200:
            return True
        print(f"[Mailgun Email Error] HTTP {response.status_code}: {response.text}")
        return False
    except httpx.HTTPError as e:
        print(f"[Mailgun Email Error] {e}")
        return False


async def create_otp(db: AsyncSession, email: str, purpose: str) -> str:
    if settings.APP_ENV == "production" and not (
        settings.MAILGUN_API_KEY and settings.MAILGUN_DOMAIN
    ):
        raise Exception("Email delivery is not configured. Add MAILGUN_API_KEY and MAILGUN_DOMAIN.")

    # Remove previous OTPs for this purpose.
    await db.execute(
        delete(OTPRecord).where(
            OTPRecord.email == email,
            OTPRecord.purpose == purpose
        )
    )
    await db.commit()

    otp = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    record = OTPRecord(
        email=email,
        otp=otp,
        purpose=purpose,
        expires_at=expires_at,
        is_used=False
    )
    db.add(record)
    await db.commit()

    # Run the blocking email provider call in a worker thread.
    send_email = (
        send_otp_email_via_mailgun
        if settings.MAILGUN_API_KEY and settings.MAILGUN_DOMAIN
        else send_otp_email
    )
    try:
        sent = await asyncio.wait_for(
            asyncio.to_thread(send_email, email, otp, purpose),
            timeout=settings.SMTP_TIMEOUT_SECONDS + 5,
        )
    except asyncio.TimeoutError:
        raise Exception("OTP email service timed out. Please try again.")
    if not sent:
        raise Exception("Unable to send the OTP email. Check the email service configuration.")

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
