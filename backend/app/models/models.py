"""
Database Models - Complete Schema for INTERVEX AI
"""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    String, Boolean, Integer, Float, Text, DateTime, JSON,
    ForeignKey, Enum, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
import enum

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    STUDENT = "student"


class QuestionType(str, enum.Enum):
    MCQ = "mcq"
    DESCRIPTIVE = "descriptive"
    CODING = "coding"


class Difficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    MODERATE = "moderate"
    HARD = "hard"
    HIGH = "high"


class SessionStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ENDED = "ended"
    ARCHIVED = "archived"


class AttemptStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    TERMINATED = "terminated"
    EVALUATED = "evaluated"


class WarningType(str, enum.Enum):
    TAB_SWITCH = "tab_switch"
    FULLSCREEN_EXIT = "fullscreen_exit"
    COPY_PASTE = "copy_paste"
    REFRESH = "refresh"
    IDLE = "idle"
    RIGHT_CLICK = "right_click"
    DEV_TOOLS = "dev_tools"
    MULTIPLE_TABS = "multiple_tabs"


# ─── Models ───────────────────────────────────────────────────────────────────

class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization: Mapped[Optional[str]] = mapped_column(String(255))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    role: Mapped[str] = mapped_column(String(20), default="admin")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    classes: Mapped[List["Class"]] = relationship("Class", back_populates="admin", cascade="all, delete")
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="admin", cascade="all, delete")
    questions: Mapped[List["Question"]] = relationship("Question", back_populates="admin", cascade="all, delete")


class Class(Base):
    __tablename__ = "classes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    admin_id: Mapped[str] = mapped_column(String(36), ForeignKey("admins.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    subject: Mapped[Optional[str]] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    admin: Mapped["Admin"] = relationship("Admin", back_populates="classes")
    students: Mapped[List["StudentClassEnrollment"]] = relationship("StudentClassEnrollment", back_populates="class_", cascade="all, delete")
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="class_")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    admin_id: Mapped[str] = mapped_column(String(36), ForeignKey("admins.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    roll_number: Mapped[Optional[str]] = mapped_column(String(100))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("admin_id", "email", name="uq_student_admin_email"),
    )

    enrollments: Mapped[List["StudentClassEnrollment"]] = relationship("StudentClassEnrollment", back_populates="student")
    attempts: Mapped[List["Attempt"]] = relationship("Attempt", back_populates="student")


class StudentClassEnrollment(Base):
    __tablename__ = "student_class_enrollments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False)
    class_id: Mapped[str] = mapped_column(String(36), ForeignKey("classes.id"), nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    student: Mapped["Student"] = relationship("Student", back_populates="enrollments")
    class_: Mapped["Class"] = relationship("Class", back_populates="students")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    admin_id: Mapped[str] = mapped_column(String(36), ForeignKey("admins.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[Optional[dict]] = mapped_column(JSON)
    correct_answer: Mapped[Optional[str]] = mapped_column(Text)
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    marks: Mapped[float] = mapped_column(Float, default=1.0)
    negative_marks: Mapped[float] = mapped_column(Float, default=0.0)
    time_limit_seconds: Mapped[Optional[int]] = mapped_column(Integer)
    test_cases: Mapped[Optional[list]] = mapped_column(JSON)
    starter_code: Mapped[Optional[dict]] = mapped_column(JSON)
    rubric: Mapped[Optional[dict]] = mapped_column(JSON)
    tags: Mapped[Optional[list]] = mapped_column(JSON)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(50), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    admin: Mapped["Admin"] = relationship("Admin", back_populates="questions")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    admin_id: Mapped[str] = mapped_column(String(36), ForeignKey("admins.id"), nullable=False, index=True)
    class_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("classes.id"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    instructions: Mapped[Optional[str]] = mapped_column(Text)

    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    total_marks: Mapped[float] = mapped_column(Float, default=0.0)
    passing_marks: Mapped[Optional[float]] = mapped_column(Float)
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=True)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, default=True)
    show_result_immediately: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_review: Mapped[bool] = mapped_column(Boolean, default=False)

    max_warnings: Mapped[int] = mapped_column(Integer, default=3)
    fullscreen_required: Mapped[bool] = mapped_column(Boolean, default=True)

    join_link: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    join_code: Mapped[str] = mapped_column(String(20))
    password: Mapped[Optional[str]] = mapped_column(String(255))

    status: Mapped[str] = mapped_column(String(20), default="draft")
    scheduled_start: Mapped[Optional[datetime]] = mapped_column(DateTime)
    scheduled_end: Mapped[Optional[datetime]] = mapped_column(DateTime)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    admin: Mapped["Admin"] = relationship("Admin", back_populates="sessions")
    class_: Mapped[Optional["Class"]] = relationship("Class", back_populates="sessions")
    session_questions: Mapped[List["SessionQuestion"]] = relationship("SessionQuestion", back_populates="session", cascade="all, delete")
    attempts: Mapped[List["Attempt"]] = relationship("Attempt", back_populates="session")


class SessionQuestion(Base):
    __tablename__ = "session_questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), nullable=False, index=True)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0)
    marks_override: Mapped[Optional[float]] = mapped_column(Float)
    time_limit_override: Mapped[Optional[int]] = mapped_column(Integer)

    session: Mapped["Session"] = relationship("Session", back_populates="session_questions")
    question: Mapped["Question"] = relationship("Question")


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), nullable=False, index=True)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)

    status: Mapped[str] = mapped_column(String(20), default="not_started")

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    time_taken_seconds: Mapped[Optional[int]] = mapped_column(Integer)

    total_score: Mapped[Optional[float]] = mapped_column(Float)
    max_score: Mapped[Optional[float]] = mapped_column(Float)
    percentage: Mapped[Optional[float]] = mapped_column(Float)

    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    termination_reason: Mapped[Optional[str]] = mapped_column(String(255))

    ai_feedback: Mapped[Optional[dict]] = mapped_column(JSON)
    strengths: Mapped[Optional[list]] = mapped_column(JSON)
    weaknesses: Mapped[Optional[list]] = mapped_column(JSON)

    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    question_order: Mapped[Optional[list]] = mapped_column(JSON)

    student: Mapped["Student"] = relationship("Student", back_populates="attempts")
    session: Mapped["Session"] = relationship("Session", back_populates="attempts")
    answers: Mapped[List["Answer"]] = relationship("Answer", back_populates="attempt", cascade="all, delete")
    warnings: Mapped[List["Warning"]] = relationship("Warning", back_populates="attempt", cascade="all, delete")


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    attempt_id: Mapped[str] = mapped_column(String(36), ForeignKey("attempts.id"), nullable=False, index=True)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id"), nullable=False)

    selected_option: Mapped[Optional[str]] = mapped_column(String(36))
    text_answer: Mapped[Optional[str]] = mapped_column(Text)
    code_answer: Mapped[Optional[str]] = mapped_column(Text)
    language: Mapped[Optional[str]] = mapped_column(String(50))

    marks_awarded: Mapped[Optional[float]] = mapped_column(Float)
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean)

    ai_score: Mapped[Optional[float]] = mapped_column(Float)
    ai_feedback: Mapped[Optional[str]] = mapped_column(Text)
    ai_rubric_scores: Mapped[Optional[dict]] = mapped_column(JSON)

    execution_result: Mapped[Optional[dict]] = mapped_column(JSON)
    test_cases_passed: Mapped[Optional[int]] = mapped_column(Integer)
    test_cases_total: Mapped[Optional[int]] = mapped_column(Integer)

    answered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    time_spent_seconds: Mapped[Optional[int]] = mapped_column(Integer)

    attempt: Mapped["Attempt"] = relationship("Attempt", back_populates="answers")
    question: Mapped["Question"] = relationship("Question")


class Warning(Base):
    __tablename__ = "warnings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    attempt_id: Mapped[str] = mapped_column(String(36), ForeignKey("attempts.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=1)
    details: Mapped[Optional[dict]] = mapped_column(JSON)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    attempt: Mapped["Attempt"] = relationship("Attempt", back_populates="warnings")


class Analytics(Base):
    __tablename__ = "analytics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    admin_id: Mapped[str] = mapped_column(String(36), ForeignKey("admins.id"), nullable=False, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("sessions.id"))
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    data: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class OTPRecord(Base):
    __tablename__ = "otp_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    otp: Mapped[str] = mapped_column(String(6), nullable=False)
    purpose: Mapped[str] = mapped_column(String(100), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)