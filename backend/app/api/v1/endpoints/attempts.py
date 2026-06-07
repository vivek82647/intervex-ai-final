"""
Attempts Endpoints - Student test-taking flow
STRICT: Terminate hone ke baad koi rejoin nahi (bina admin approval ke)
Laptop band — remaining time se hi shuru hoga
"""
import uuid
import random
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user, require_student
from app.models.models import (
    Attempt, Answer, Warning, Session as DBSession,
    SessionQuestion, Question, Student
)
from app.schemas.schemas import AttemptSubmit, WarningCreate
from app.services.ai_service import ai_service
from app.services.code_service import code_service

router = APIRouter()


@router.post("/start")
async def start_attempt(
    data: dict,
    request: Request,
    current_user: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db)
):
    """Student starts a test attempt — reconnect safe, terminate strict"""
    session_id = data.get("session_id") or current_user.get("session_id")
    student_id = current_user["user_id"]

    # Session verify karo
    result = await db.execute(select(DBSession).where(DBSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session or session.status != "active":
        raise HTTPException(status_code=400, detail="Session not available")

    # Existing attempt check karo
    existing = await db.execute(
        select(Attempt).where(
            Attempt.session_id == session_id,
            Attempt.student_id == student_id
        )
    )
    attempt = existing.scalar_one_or_none()

    if attempt:
        # ── TERMINATED — strict block ─────────────────────────────────────────
        if attempt.status == "terminated":
            if attempt.termination_reason != "REJOIN_APPROVED":
                raise HTTPException(status_code=403, detail="TERMINATED")
            # Admin approved — reset
            attempt.status = "in_progress"
            attempt.termination_reason = None
            attempt.warning_count = 0
            attempt.started_at = datetime.utcnow()
            await db.commit()

        if attempt.status == "submitted":
            raise HTTPException(status_code=400, detail="You have already submitted this test")

        # ── RECONNECT LOGIC — laptop band wala case ───────────────────────────
        # Jitna time beet gaya utna time waste — remaining time se shuru hoga
        total_seconds = session.duration_minutes * 60
        elapsed_seconds = 0

        if attempt.started_at:
            elapsed_seconds = int((datetime.utcnow() - attempt.started_at).total_seconds())

        time_remaining_seconds = max(0, total_seconds - elapsed_seconds)

        # Time khatam — auto submit
        if time_remaining_seconds <= 0:
            if attempt.status == "in_progress":
                attempt.status = "submitted"
                attempt.submitted_at = datetime.utcnow()
                attempt.time_taken_seconds = total_seconds
                if attempt.total_score is None:
                    attempt.total_score = 0.0
                    attempt.max_score = session.total_marks
                    attempt.percentage = 0.0
                await db.commit()
            raise HTTPException(
                status_code=400,
                detail="Time is up! Your test has been auto-submitted."
            )

        return {
            "attempt_id": attempt.id,
            "status": attempt.status,
            "started_at": attempt.started_at,
            "question_order": attempt.question_order,
            "duration_minutes": session.duration_minutes,
            "max_warnings": session.max_warnings,
            "time_remaining_seconds": time_remaining_seconds,  # EXACT remaining time
            "elapsed_seconds": elapsed_seconds,
            "reconnected": True,
        }

    # ── NAYA ATTEMPT ──────────────────────────────────────────────────────────
    result = await db.execute(
        select(SessionQuestion)
        .where(SessionQuestion.session_id == session_id)
        .order_by(SessionQuestion.order)
    )
    session_questions = result.scalars().all()
    question_ids = [sq.question_id for sq in session_questions]

    if session.shuffle_questions:
        random.shuffle(question_ids)

    attempt = Attempt(
        id=str(uuid.uuid4()),
        session_id=session_id,
        student_id=student_id,
        status="in_progress",
        started_at=datetime.utcnow(),
        question_order=question_ids,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "started_at": attempt.started_at,
        "question_order": question_ids,
        "duration_minutes": session.duration_minutes,
        "max_warnings": session.max_warnings,
        "time_remaining_seconds": session.duration_minutes * 60,
        "elapsed_seconds": 0,
        "reconnected": False,
    }


@router.post("/{attempt_id}/answer")
async def save_answer(
    attempt_id: str,
    data: dict,
    current_user: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Attempt).where(
            Attempt.id == attempt_id,
            Attempt.student_id == current_user["user_id"]
        )
    )
    attempt = result.scalar_one_or_none()
    if not attempt or attempt.status not in ("in_progress",):
        raise HTTPException(status_code=400, detail="Invalid attempt")

    question_id = data.get("question_id")
    existing_ans = await db.execute(
        select(Answer).where(
            Answer.attempt_id == attempt_id,
            Answer.question_id == question_id
        )
    )
    answer = existing_ans.scalar_one_or_none()

    if answer:
        answer.selected_option = data.get("selected_option")
        answer.text_answer = data.get("text_answer")
        answer.code_answer = data.get("code_answer")
        answer.language = data.get("language")
        answer.time_spent_seconds = data.get("time_spent_seconds")
    else:
        answer = Answer(
            id=str(uuid.uuid4()),
            attempt_id=attempt_id,
            question_id=question_id,
            selected_option=data.get("selected_option"),
            text_answer=data.get("text_answer"),
            code_answer=data.get("code_answer"),
            language=data.get("language"),
            time_spent_seconds=data.get("time_spent_seconds"),
        )
        db.add(answer)

    await db.commit()
    return {"success": True}


@router.post("/{attempt_id}/run-code")
async def run_code(
    attempt_id: str,
    data: dict,
    current_user: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Attempt).where(
            Attempt.id == attempt_id,
            Attempt.student_id == current_user["user_id"]
        )
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    question_id = data.get("question_id")
    code = data.get("code", "")
    language = data.get("language", "python")
    stdin = data.get("stdin", "")

    q_result = await db.execute(select(Question).where(Question.id == question_id))
    question = q_result.scalar_one_or_none()

    if question and question.test_cases:
        visible_cases = [tc for tc in question.test_cases if not tc.get("is_hidden")]
        result = await code_service.run_test_cases(code, language, visible_cases)
        return result
    else:
        result = await code_service.execute(code, language, stdin)
        return result


@router.post("/{attempt_id}/warning")
async def record_warning(
    attempt_id: str,
    data: WarningCreate,
    current_user: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Attempt).where(
            Attempt.id == attempt_id,
            Attempt.student_id == current_user["user_id"]
        )
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    warning = Warning(
        id=str(uuid.uuid4()),
        attempt_id=attempt_id,
        type=data.type,
        details=data.details,
    )
    db.add(warning)
    attempt.warning_count += 1
    await db.commit()

    return {"warning_count": attempt.warning_count}


@router.post("/{attempt_id}/submit")
async def submit_attempt(
    attempt_id: str,
    current_user: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Attempt).where(
            Attempt.id == attempt_id,
            Attempt.student_id == current_user["user_id"]
        )
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status == "submitted":
        raise HTTPException(status_code=400, detail="Already submitted")
    if attempt.status == "terminated":
        raise HTTPException(status_code=403, detail="Your session was terminated. You cannot submit.")

    session_result = await db.execute(select(DBSession).where(DBSession.id == attempt.session_id))
    session = session_result.scalar_one_or_none()

    answers_result = await db.execute(
        select(Answer, Question)
        .join(Question, Answer.question_id == Question.id)
        .where(Answer.attempt_id == attempt_id)
    )
    answer_rows = answers_result.all()

    total_score = 0.0
    max_score = session.total_marks if session else 0.0
    topic_scores: dict = {}

    for answer, question in answer_rows:
        marks_earned = 0.0

        if question.type == "mcq":
            if answer.selected_option:
                options = question.options or []
                correct_opt = next((o for o in options if o.get("is_correct")), None)
                is_correct = correct_opt and answer.selected_option == correct_opt.get("id")
                answer.is_correct = is_correct
                if is_correct:
                    marks_earned = question.marks
                elif question.negative_marks > 0:
                    marks_earned = -question.negative_marks
                answer.marks_awarded = marks_earned

        elif question.type == "descriptive":
            if answer.text_answer:
                try:
                    eval_result = await ai_service.evaluate_descriptive(
                        question=question.content,
                        correct_answer=question.correct_answer or "",
                        student_answer=answer.text_answer,
                        rubric=question.rubric,
                        max_marks=question.marks
                    )
                    marks_earned = eval_result.get("score", 0)
                    answer.ai_score = marks_earned
                    answer.ai_feedback = eval_result.get("feedback")
                    answer.ai_rubric_scores = eval_result.get("rubric_scores")
                except Exception:
                    marks_earned = 0
                answer.marks_awarded = marks_earned

        elif question.type == "coding":
            if answer.code_answer and question.test_cases:
                try:
                    exec_result = await code_service.run_test_cases(
                        answer.code_answer,
                        answer.language or "python",
                        question.test_cases
                    )
                    passed = exec_result.get("passed", 0)
                    total = exec_result.get("total", 0)
                    marks_earned = (passed / total * question.marks) if total > 0 else 0
                    answer.test_cases_passed = passed
                    answer.test_cases_total = total
                    answer.execution_result = exec_result
                except Exception:
                    marks_earned = 0
                answer.marks_awarded = marks_earned

        total_score += marks_earned
        topic_scores[question.topic] = topic_scores.get(question.topic, 0) + marks_earned

    student_result = await db.execute(select(Student).where(Student.id == attempt.student_id))
    student = student_result.scalar_one_or_none()

    try:
        feedback = await ai_service.generate_overall_feedback(
            student_name=student.full_name if student else "Student",
            session_title=session.title if session else "Assessment",
            score=total_score,
            max_score=max_score,
            topic_scores=topic_scores,
            question_answers=[]
        )
    except Exception:
        feedback = {
            "overall_feedback": f"Score: {total_score:.1f}/{max_score:.1f}",
            "strengths": [],
            "weaknesses": [],
            "performance_level": "Average"
        }

    now = datetime.utcnow()
    time_taken = int((now - attempt.started_at).total_seconds()) if attempt.started_at else 0

    attempt.status = "submitted"
    attempt.submitted_at = now
    attempt.time_taken_seconds = time_taken
    attempt.total_score = max(0, total_score)
    attempt.max_score = max_score
    attempt.percentage = (total_score / max_score * 100) if max_score > 0 else 0
    attempt.ai_feedback = feedback
    attempt.strengths = feedback.get("strengths", [])
    attempt.weaknesses = feedback.get("weaknesses", [])

    await db.commit()

    return {
        "success": True,
        "score": attempt.total_score,
        "max_score": attempt.max_score,
        "percentage": attempt.percentage,
        "feedback": feedback,
        "show_result": session.show_result_immediately if session else True
    }


@router.get("/{attempt_id}/result")
async def get_attempt_result(
    attempt_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    answers_result = await db.execute(
        select(Answer, Question)
        .join(Question, Answer.question_id == Question.id)
        .where(Answer.attempt_id == attempt_id)
    )

    answers_data = []
    for answer, question in answers_result.all():
        answers_data.append({
            "question_id": question.id,
            "question_title": question.title,
            "question_content": question.content,
            "question_type": question.type,
            "topic": question.topic,
            "max_marks": question.marks,
            "marks_awarded": answer.marks_awarded,
            "is_correct": answer.is_correct,
            "selected_option": answer.selected_option,
            "text_answer": answer.text_answer,
            "code_answer": answer.code_answer,
            "ai_feedback": answer.ai_feedback,
            "correct_answer": question.correct_answer if attempt.status == "submitted" else None,
            "explanation": question.explanation if attempt.status == "submitted" else None,
            "test_cases_passed": answer.test_cases_passed,
            "test_cases_total": answer.test_cases_total,
        })

    warnings_result = await db.execute(
        select(Warning).where(Warning.attempt_id == attempt_id)
    )
    warnings = [{"type": w.type, "timestamp": w.timestamp, "details": w.details}
                for w in warnings_result.scalars().all()]

    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "total_score": attempt.total_score,
        "max_score": attempt.max_score,
        "percentage": attempt.percentage,
        "time_taken_seconds": attempt.time_taken_seconds,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "warning_count": attempt.warning_count,
        "ai_feedback": attempt.ai_feedback,
        "strengths": attempt.strengths,
        "weaknesses": attempt.weaknesses,
        "answers": answers_data,
        "warnings": warnings
    }


@router.post("/{attempt_id}/terminate")
async def terminate_attempt(
    attempt_id: str,
    data: dict,
    current_user: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db)
):
    """Called by frontend when warnings exceed limit"""
    result = await db.execute(
        select(Attempt).where(
            Attempt.id == attempt_id,
            Attempt.student_id == current_user["user_id"]
        )
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status in ("submitted", "terminated"):
        return {"status": attempt.status}

    attempt.status = "terminated"
    attempt.termination_reason = data.get("reason", "Policy violation")
    attempt.submitted_at = datetime.utcnow()
    await db.commit()
    return {"status": "terminated"}
