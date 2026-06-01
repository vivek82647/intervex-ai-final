"""
Email Service - Resend API (free, no credit card)
"""
import random
import string
import httpx
from app.core.config import settings


def generate_otp() -> str:
    return ''.join(random.choices(string.digits, k=6))


def get_otp_html(otp: str, purpose: str, name: str = "") -> str:
    purpose_label = {
        "register": "Email Verification",
        "login": "Login Verification",
    }.get(purpose, "Verification")

    greeting = f"Hi {name}," if name else "Hello,"

    return f"""
    <html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#0D1117;margin:0;padding:40px 20px;">
      <div style="max-width:480px;margin:0 auto;background:#161B2E;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#5B6AF5,#00E5FF);padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;font-weight:800;">INTERVEX AI</h1>
          <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">{purpose_label}</p>
        </div>
        <div style="padding:36px 32px;">
          <p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0 0 8px;">{greeting}</p>
          <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 28px;">Your verification code is:</p>
          <div style="background:rgba(91,106,245,0.15);border:2px solid rgba(91,106,245,0.4);border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
            <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:#5B6AF5;font-family:monospace;">{otp}</span>
          </div>
          <p style="color:rgba(255,255,255,0.3);font-size:13px;margin:0;text-align:center;">
            ⏱ Valid for <strong style="color:rgba(255,255,255,0.5);">10 minutes</strong>. Never share this code.
          </p>
        </div>
        <div style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">If you didn't request this, ignore this email.</p>
        </div>
      </div>
    </body></html>
    """


def send_otp_email(to_email: str, otp: str, purpose: str, name: str = "") -> bool:
    """Send OTP via Resend API"""
    if not settings.RESEND_API_KEY:
        print(f"[DEV] OTP for {to_email}: {otp}")
        return True

    subject = {
        "register": "INTERVEX AI — Verify Your Email",
        "login": "INTERVEX AI — Login OTP",
    }.get(purpose, "INTERVEX AI — OTP")

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
                "subject": subject,
                "html": get_otp_html(otp, purpose, name),
            },
            timeout=15,
        )
        if response.status_code in (200, 201):
            return True
        print(f"[Resend Error] {response.status_code}: {response.text}")
        return False
    except Exception as e:
        print(f"[Resend Error] {e}")
        return False
