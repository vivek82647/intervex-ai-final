"""
Yeh code apne existing models.py mein ADD karo (replace mat karo).
OTPRecord class ko models.py ke end mein paste karo.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
# Apna existing Base import use karo
# from ..core.database import Base  ← already hai tumhare models.py mein


class OTPRecord(Base):
    """OTP records store karne ke liye table"""
    __tablename__ = "otp_records"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    otp = Column(String(6), nullable=False)
    purpose = Column(String, nullable=False)  # "login", "register", "test"
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
