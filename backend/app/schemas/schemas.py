"""
Pydantic Schemas - Request/Response models for INTERVEX AI API
"""
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, EmailStr, field_validator, model_validator
import re


# ─── Base ─────────────────────────────────────────────────────────────────────

class BaseResponse(BaseModel):
    success: bool = True
    message: str = "Success"


# ─── Auth ─────────────────────────────────────────────────────────────────────

class AdminRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    email: str
    full_name: str


class StudentJoin(BaseModel):
    join_link: str
    full_name: str
    email: EmailStr
    roll_number: Optional[str] = None
    phone: Optional[str] = None


# ─── Admin ────────────────────────────────────────────────────────────────────

class AdminOut(BaseModel):
    id: str
    email: str
    full_name: str
    organization: Optional[str]
    avatar_url: Optional[str]
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Class ────────────────────────────────────────────────────────────────────

class ClassCreate(BaseModel):
    name: str
    description: Optional[str] = None
    subject: Optional[str] = None


class ClassOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    subject: Optional[str]
    is_active: bool
    student_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Student ──────────────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    email: EmailStr
    full_name: str
    roll_number: Optional[str] = None
    phone: Optional[str] = None
    class_ids: Optional[List[str]] = []


class StudentOut(BaseModel):
    id: str
    email: str
    full_name: str
    roll_number: Optional[str]
    phone: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StudentBulkUpload(BaseModel):
    students: List[StudentCreate]
    class_id: Optional[str] = None


# ─── Question ─────────────────────────────────────────────────────────────────

class MCQOption(BaseModel):
    id: str
    text: str
    is_correct: bool


class TestCase(BaseModel):
    id: str
    input: str
    expected_output: str
    is_hidden: bool = False
    marks: float = 1.0


class QuestionCreate(BaseModel):
    type: str  # mcq, descriptive, coding
    difficulty: str
    topic: str
    title: str
    content: str
    options: Optional[List[MCQOption]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    marks: float = 1.0
    negative_marks: float = 0.0
    time_limit_seconds: Optional[int] = None
    test_cases: Optional[List[TestCase]] = None
    starter_code: Optional[Dict[str, str]] = None
    rubric: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = []


class QuestionOut(BaseModel):
    id: str
    type: str
    difficulty: str
    topic: str
    title: str
    content: str
    options: Optional[List[Dict]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    marks: float
    negative_marks: float
    time_limit_seconds: Optional[int] = None
    test_cases: Optional[List[Dict]] = None
    starter_code: Optional[Dict[str, str]] = None
    rubric: Optional[Dict[str, Any]] = None
    is_ai_generated: bool
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class AIGenerateRequest(BaseModel):
    topic: str
    difficulty: str
    count: int = 5
    type: str = "mcq"
    marks: float = 1.0
    context: Optional[str] = None


# ─── Session ──────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    class_id: Optional[str] = None
    duration_minutes: int
    passing_marks: Optional[float] = None
    shuffle_questions: bool = True
    shuffle_options: bool = True
    show_result_immediately: bool = True
    allow_review: bool = False
    max_warnings: int = 3
    fullscreen_required: bool = True
    password: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    question_ids: List[str] = []


class SessionOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    instructions: Optional[str]
    duration_minutes: int
    total_marks: float
    passing_marks: Optional[float]
    shuffle_questions: bool
    max_warnings: int
    fullscreen_required: bool
    join_link: str
    join_code: str
    status: str
    activated_at: Optional[datetime] = None
    scheduled_start: Optional[datetime]
    scheduled_end: Optional[datetime]
    created_at: datetime
    question_count: int = 0
    time_remaining_seconds: Optional[int] = None  # Admin ke liye live countdown

    class Config:
        from_attributes = True


class SessionStatusUpdate(BaseModel):
    status: str  # active, ended, archived


# ─── Attempt ──────────────────────────────────────────────────────────────────

class AttemptStart(BaseModel):
    session_id: str
    student_id: str


class AnswerSubmit(BaseModel):
    question_id: str
    selected_option: Optional[str] = None
    text_answer: Optional[str] = None
    code_answer: Optional[str] = None
    language: Optional[str] = None
    time_spent_seconds: Optional[int] = None


class AttemptSubmit(BaseModel):
    answers: List[AnswerSubmit]


class WarningCreate(BaseModel):
    type: str
    details: Optional[Dict[str, Any]] = None


class AttemptOut(BaseModel):
    id: str
    session_id: str
    student_id: str
    status: str
    started_at: Optional[datetime]
    submitted_at: Optional[datetime]
    total_score: Optional[float]
    max_score: Optional[float]
    percentage: Optional[float]
    warning_count: int
    ai_feedback: Optional[Dict]
    strengths: Optional[List]
    weaknesses: Optional[List]

    class Config:
        from_attributes = True


# ─── Result ───────────────────────────────────────────────────────────────────

class ResultDetail(BaseModel):
    attempt: AttemptOut
    answers: List[Dict]
    warnings: List[Dict]
    student: StudentOut
    session: SessionOut


# ─── Code Execution ───────────────────────────────────────────────────────────

class CodeExecuteRequest(BaseModel):
    code: str
    language: str  # python, javascript, java, cpp, c
    stdin: Optional[str] = ""
    question_id: Optional[str] = None


class CodeExecuteResponse(BaseModel):
    stdout: Optional[str]
    stderr: Optional[str]
    status: str
    execution_time_ms: Optional[float]
    memory_kb: Optional[float]
    test_results: Optional[List[Dict]] = None


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_classes: int
    total_students: int
    total_sessions: int
    total_attempts: int
    active_sessions: int
    avg_score: float
    completion_rate: float


class LiveSessionStudent(BaseModel):
    student_id: str
    student_name: str
    status: str
    time_remaining: int
    warning_count: int
    completion_percentage: float
    last_activity: Optional[datetime]
