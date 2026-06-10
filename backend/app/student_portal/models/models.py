"""
Student Portal Models — Intervex backend ke saath compatible
Uses same Base + engine from app.core.database
users.id is UUID (String) in Intervex — matched here
"""
from sqlalchemy import (
    Column, Integer, String, Text, Boolean,
    DateTime, ForeignKey, JSON, func
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    batch = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    college = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    notifications = relationship("StudentNotification", back_populates="student", cascade="all, delete-orphan")
    results = relationship("SessionResult", back_populates="student", cascade="all, delete-orphan")


class SessionResult(Base):
    __tablename__ = "session_results"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    interview_session_id = Column(String(36), nullable=True)  # Intervex session UUID

    title = Column(String(255), nullable=False)
    round = Column(String(100), default="Round 1")
    date = Column(String(20), nullable=False)

    score = Column(Integer, default=0)
    max_score = Column(Integer, default=100)
    status = Column(String(50), default="completed")  # completed / pending / failed

    feedback = Column(Text, nullable=True)
    suggestions = Column(JSON, default=list)
    strengths = Column(JSON, default=list)
    weaknesses = Column(JSON, default=list)

    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    student = relationship("StudentProfile", back_populates="results")


class StudentNotification(Base):
    __tablename__ = "student_notifications"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), default="info")   # success | info | warning | error
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("StudentProfile", back_populates="notifications")
