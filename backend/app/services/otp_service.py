"""
OTP Service - Gmail SMTP ke zariye OTP bhejta hai
"""

import random
import string
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from app.models.models import OTPRecord
from app.core.config import settings


def generate_otp(length: int = 6) -> str:
    """6-digit numeric OTP generate karta hai"""
    return ''.join(random.choices(string.digits, k=length))


def send_otp_email(to_email: str, otp: str, purpose: str = "login") -> bool:
    """
    Gmail SMTP se OTP email bhejta hai.
    backend/.env mein GMAIL_USER aur GMAIL_APP_PASSWORD set karna hoga.
    """
    try:
        subject_map = {
            "login": "INTERVEX AI - Admin Login OTP",
            "register": "INTERVEX AI - Account Verification OTP",
            "test": "INTERVEX AI - Test Verification OTP",
        }
        subject = subject_map.get(purpose, "INTERVEX AI - OTP Verification")

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 30px;">
          <div style="max-width: 500px; margin: auto; background: white; border-radius: 10px; 
                      padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #1a1a2e; margin-bottom: 5px;">INTERVEX AI</h2>
            <hr style="border: 1px solid #eee; margin-bottom: 20px;">
            <p style="color: #555; font-size: 15px;">Aapka One-Time Password (OTP) neeche diya gaya hai:</p>
            <div style="background: #1a1a2e; color: #fff; font-size: 36px; font-weight: bold;
                        letter-spacing: 12px; text-align: center; padding: 20px; border-radius: 8px;
                        margin: 20px 0;">
              {otp}
            </div>
            <p style="color: #888; font-size: 13px;">
              ⏰ Yeh OTP sirf <strong>10 minutes</strong> ke liye valid hai.<br>
              🔒 Kisi ke saath share mat karein.
            </p>
            <hr style="border: 1px solid #eee; margin-top: 20px;">
            <p style="color: #bbb; font-size: 12px; text-align: center;">
              INTERVEX AI — AI-Powered Mock Interview Platform
            </p>
          </div>
        </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.GMAIL_USER
        msg["To"] = to_email
        msg.attach(MIMEText(body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)
            server.sendmail(settings.GMAIL_USER, to_email, msg.as_string())

        return True

    except Exception as e:
        print(f"[OTP Email Error] {e}")
        return False


def create_otp(db: Session, email: str, purpose: str) -> str:
    """OTP generate karke DB mein save karta hai aur email bhejta hai"""
    # Purane OTPs delete karo same email+purpose ke liye
    db.query(OTPRecord).filter(
        OTPRecord.email == email,
        OTPRecord.purpose == purpose
    ).delete()
    db.commit()

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
    db.commit()

    # Email bhejo
    sent = send_otp_email(email, otp, purpose)
    if not sent:
        raise Exception("OTP email nahi bhej sake. Gmail settings check karo.")

    return otp  # (debug ke liye return, production mein hata do)


def verify_otp(db: Session, email: str, otp: str, purpose: str) -> bool:
    """OTP verify karta hai — valid, unexpired, unused"""
    record = db.query(OTPRecord).filter(
        OTPRecord.email == email,
        OTPRecord.otp == otp,
        OTPRecord.purpose == purpose,
        OTPRecord.is_used == False,
        OTPRecord.expires_at > datetime.utcnow()
    ).first()

    if not record:
        return False

    # Mark as used
    record.is_used = True
    db.commit()
    return True