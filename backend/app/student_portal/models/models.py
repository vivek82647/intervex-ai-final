"""
Student Portal Models
- SPUser: student account (linked to admin via secret code)
- SPSecretCode: admin creates codes for their students
- SPResult: admin publishes results for a student
- SPAssignment: admin creates assignments
- SPSubmission: student submits assignment
- SPNotification: admin sends notifications
"""
import uuid
from sqlalchemy import Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SPSecretCode(Base):
    """Admin creates a secret code — students use it to register"""
    __tablename__ = "sp_secret_codes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id = Column(String(36), nullable=False, index=True)  # Admin.id
    code = Column(String(50), unique=True, nullable=False, index=True)
    label = Column(String(200), nullable=True)  # e.g. "Batch 2024 - Web Dev"
    is_active = Column(Boolean, default=True)
    max_uses = Column(Integer, nullable=True)   # None = unlimited
    used_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    students = relationship("SPUser", back_populates="secret_code_ref")


class SPUser(Base):
    """Student account on the portal"""
    __tablename__ = "sp_users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    admin_id = Column(String(36), nullable=False, index=True)  # which admin they belong to
    secret_code_id = Column(String(36), ForeignKey("sp_secret_codes.id"), nullable=True)
    batch = Column(String(100), nullable=True)
    college = Column(String(200), nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    secret_code_ref = relationship("SPSecretCode", back_populates="students")
    results = relationship("SPResult", back_populates="student", cascade="all, delete-orphan")
    submissions = relationship("SPSubmission", back_populates="student", cascade="all, delete-orphan")
    notifications = relationship("SPNotification", back_populates="student", cascade="all, delete-orphan")


class SPResult(Base):
    """Admin publishes a result for a student"""
    __tablename__ = "sp_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("sp_users.id", ondelete="CASCADE"), nullable=False)
    admin_id = Column(String(36), nullable=False, index=True)

    # Session info
    session_title = Column(String(255), nullable=False)
    session_date = Column(String(50), nullable=False)
    round_name = Column(String(100), default="Round 1")
    admin_name = Column(String(200), nullable=True)   # which admin conducted

    # Score
    score = Column(Float, default=0)
    max_score = Column(Float, default=100)
    percentage = Column(Float, default=0)
    rank = Column(Integer, nullable=True)

    # Selection status
    status = Column(String(50), default="pending")  # selected / rejected / pending / next_round
    next_round_eligible = Column(Boolean, default=False)
    next_round_link = Column(String(500), nullable=True)  # session join link

    # Detailed result
    feedback = Column(Text, nullable=True)
    strengths = Column(JSON, default=list)
    weaknesses = Column(JSON, default=list)
    suggestions = Column(JSON, default=list)

    # Questions breakdown
    questions_data = Column(JSON, default=list)
    # Format: [{"question": "...", "student_answer": "...", "correct_answer": "...", "is_correct": true, "marks": 2}]

    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    student = relationship("SPUser", back_populates="results")


class SPAssignment(Base):
    """Admin creates an assignment"""
    __tablename__ = "sp_assignments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id = Column(String(36), nullable=False, index=True)
    admin_name = Column(String(200), nullable=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    instructions = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    max_marks = Column(Float, default=100)

    # Who can see this assignment — all students of this admin
    target_batch = Column(String(100), nullable=True)  # None = all students

    allowed_file_types = Column(JSON, default=lambda: ["pdf", "doc", "docx", "jpg", "png"])
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    submissions = relationship("SPSubmission", back_populates="assignment", cascade="all, delete-orphan")


class SPSubmission(Base):
    """Student submits an assignment"""
    __tablename__ = "sp_submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = Column(String(36), ForeignKey("sp_assignments.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String(36), ForeignKey("sp_users.id", ondelete="CASCADE"), nullable=False)
    admin_id = Column(String(36), nullable=False, index=True)

    # File info
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_data = Column(Text, nullable=False)   # base64 encoded
    file_size = Column(Integer, nullable=True)

    # Grading
    marks_awarded = Column(Float, nullable=True)
    grade_feedback = Column(Text, nullable=True)
    ai_feedback = Column(Text, nullable=True)  # AI checked feedback
    is_graded = Column(Boolean, default=False)

    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

    assignment = relationship("SPAssignment", back_populates="submissions")
    student = relationship("SPUser", back_populates="submissions")


class SPNotification(Base):
    """Admin sends notification to student(s)"""
    __tablename__ = "sp_notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("sp_users.id", ondelete="CASCADE"), nullable=False)
    admin_id = Column(String(36), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), default="info")   # success | info | warning | error
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("SPUser", back_populates="notifications")
