"""
Email Service - Gmail SMTP se OTP bhejta hai
"""
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings


def generate_otp(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


def get_otp_html(otp: str, purpose: str = "login", name: str = "") -> str:
    label = {
        "student_join": "Test Access Verification",
        "register": "Test Access Verification",
        "student_register": "Student Registration",
        "student_login": "Student Login",
        "login": "Admin Login",
    }.get(purpose, "Verification")

    greeting = f"Hi {name}," if name else "Hello,"

    return f"""
    <html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#0D1117;margin:0;padding:40px 20px;">
      <div style="max-width:480px;margin:0 auto;background:#161B2E;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#5B6AF5,#00E5FF);padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;font-weight:800;">INTERVEX AI</h1>
          <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">{label}</p>
        </div>
        <div style="padding:36px 32px;">
          <p style="color:rgba(255,255,255,0.6);font-size:14px;margin:0 0 12px;">{greeting}</p>
          <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 28px;">Your one-time verification code:</p>
          <div style="background:rgba(91,106,245,0.15);border:2px solid rgba(91,106,245,0.4);border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
            <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:#5B6AF5;font-family:monospace;">{otp}</span>
          </div>
          <p style="color:rgba(255,255,255,0.3);font-size:13px;margin:0;text-align:center;">
            Valid for <strong style="color:rgba(255,255,255,0.5);">10 minutes</strong>. Never share this code.
          </p>
        </div>
      </div>
    </body></html>
    """


def send_otp_email(to_email: str, otp: str, purpose: str = "login", name: str = "") -> bool:
    """Send OTP via Gmail SMTP. Accepts optional 4th arg 'name'."""
    subject_map = {
        "student_join": "INTERVEX AI — Test Access OTP",
        "register": "INTERVEX AI — Test Access OTP",
        "student_register": "INTERVEX AI — Student Registration OTP",
        "student_login": "INTERVEX AI — Student Login OTP",
        "login": "INTERVEX AI — Admin Login OTP",
    }

    gmail_user = getattr(settings, 'GMAIL_USER', '')
    gmail_pass = getattr(settings, 'GMAIL_APP_PASSWORD', '')

    if not gmail_user or not gmail_pass:
        print(f"[DEV] OTP for {to_email} ({purpose}): {otp}")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject_map.get(purpose, "INTERVEX AI — OTP Verification")
        msg["From"] = f"INTERVEX AI <{gmail_user}>"
        msg["To"] = to_email
        msg.attach(MIMEText(get_otp_html(otp, purpose, name), "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
            server.login(gmail_user, gmail_pass)
            server.sendmail(gmail_user, to_email, msg.as_string())

        print(f"[Gmail] OTP sent to {to_email}")
        return True
    except Exception as e:
        print(f"[Gmail Error] {e}")
        return False