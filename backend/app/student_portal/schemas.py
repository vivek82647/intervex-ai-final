from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class StudentProfileCreate(BaseModel):
    user_id: str  # UUID string
    batch: Optional[str] = None
    phone: Optional[str] = None
    college: Optional[str] = None

class StudentProfileOut(BaseModel):
    id: int
    user_id: str
    batch: Optional[str]
    phone: Optional[str]
    college: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SessionResultCreate(BaseModel):
    student_id: int
    interview_session_id: Optional[str] = None
    title: str
    round: str = "Round 1"
    date: str
    score: int
    max_score: int = 100
    status: str = "completed"
    feedback: Optional[str] = ""
    suggestions: List[str] = []
    strengths: List[str] = []
    weaknesses: List[str] = []
    is_published: bool = True

class SessionResultOut(BaseModel):
    id: int
    student_id: int
    interview_session_id: Optional[str]
    title: str
    round: str
    date: str
    score: int
    max_score: int
    status: str
    feedback: Optional[str]
    suggestions: List[str]
    strengths: List[str]
    weaknesses: List[str]
    is_published: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    student_id: Optional[int] = None  # None = broadcast to all
    title: str
    message: str
    type: str = "info"

class NotificationOut(BaseModel):
    id: int
    student_id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardOut(BaseModel):
    student_id: int
    name: str
    email: str
    batch: Optional[str]
    total_sessions: int
    avg_score: float
    best_score: int
    latest_score: int
    rounds_completed: int
    unread_notifications: int
    score_trend: List[dict]
