"""Results Endpoints - Analytics and export"""
import io
import csv
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import require_admin
from app.models.models import Attempt, Student, Session as DBSession, Answer, Question

router = APIRouter()


@router.get("/session/{session_id}")
async def session_results(
    session_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all results for a session"""
    result = await db.execute(
        select(Attempt, Student)
        .join(Student, Attempt.student_id == Student.id)
        .where(Attempt.session_id == session_id)
        .order_by(Attempt.total_score.desc())
    )
    rows = result.all()

    results = []
    for attempt, student in rows:
        results.append({
            "attempt_id": attempt.id,
            "student_id": student.id,
            "student_name": student.full_name,
            "student_email": student.email,
            "roll_number": student.roll_number,
            "status": attempt.status,
            "score": attempt.total_score,
            "max_score": attempt.max_score,
            "percentage": attempt.percentage,
            "time_taken_seconds": attempt.time_taken_seconds,
            "warning_count": attempt.warning_count,
            "submitted_at": attempt.submitted_at,
            "performance_level": attempt.ai_feedback.get("performance_level") if attempt.ai_feedback else None,
        })

    # Summary stats
    submitted = [r for r in results if r["status"] == "submitted"]
    avg_score = sum(r["percentage"] or 0 for r in submitted) / len(submitted) if submitted else 0

    return {
        "session_id": session_id,
        "total_attempts": len(results),
        "submitted": len(submitted),
        "avg_score": round(avg_score, 1),
        "results": results
    }


@router.get("/session/{session_id}/export/csv")
async def export_csv(
    session_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Export session results as CSV"""
    result = await db.execute(
        select(Attempt, Student)
        .join(Student, Attempt.student_id == Student.id)
        .where(Attempt.session_id == session_id)
        .order_by(Attempt.total_score.desc())
    )
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Student Name", "Email", "Roll Number",
        "Score", "Max Score", "Percentage",
        "Status", "Time Taken (s)", "Warnings",
        "Performance Level", "Submitted At"
    ])

    for attempt, student in rows:
        perf = attempt.ai_feedback.get("performance_level") if attempt.ai_feedback else "N/A"
        writer.writerow([
            student.full_name, student.email, student.roll_number or "",
            attempt.total_score or 0, attempt.max_score or 0,
            f"{attempt.percentage:.1f}%" if attempt.percentage else "0%",
            attempt.status, attempt.time_taken_seconds or 0,
            attempt.warning_count, perf,
            attempt.submitted_at.isoformat() if attempt.submitted_at else ""
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=results_{session_id}.csv"}
    )


@router.get("/session/{session_id}/analytics")
async def session_analytics(
    session_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Deep analytics for a session"""
    # Topic-wise performance
    topic_perf = await db.execute(
        select(Question.topic, func.avg(Answer.marks_awarded), func.count(Answer.id))
        .join(Answer, Question.id == Answer.question_id)
        .join(Attempt, Answer.attempt_id == Attempt.id)
        .where(Attempt.session_id == session_id)
        .group_by(Question.topic)
    )

    # Difficulty analysis
    diff_perf = await db.execute(
        select(Question.difficulty, func.avg(Answer.marks_awarded / Question.marks * 100))
        .join(Answer, Question.id == Answer.question_id)
        .join(Attempt, Answer.attempt_id == Attempt.id)
        .where(Attempt.session_id == session_id)
        .group_by(Question.difficulty)
    )

    return {
        "topic_performance": [
            {"topic": t, "avg_score": round(avg or 0, 2), "total_answers": count}
            for t, avg, count in topic_perf.all()
        ],
        "difficulty_performance": [
            {"difficulty": d, "avg_percentage": round(avg or 0, 1)}
            for d, avg in diff_perf.all()
        ],
    }
