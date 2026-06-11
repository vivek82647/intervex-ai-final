"""
SP Dashboard + AI Assistant (Groq)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import List

from app.core.database import get_db
from app.student_portal.models.models import SPUser, SPResult, SPNotification, SPAssignment, SPSubmission

router = APIRouter(prefix="/sp/dashboard", tags=["SP Dashboard"])
ai_router = APIRouter(prefix="/sp/ai", tags=["SP AI Assistant"])


# ── Dashboard ──────────────────────────────────────────────────
@router.get("/{student_id}")
async def get_dashboard(student_id: str, db: AsyncSession = Depends(get_db)):
    # Student info
    student = await db.execute(select(SPUser).where(SPUser.id == student_id))
    student = student.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Results
    results_res = await db.execute(
        select(SPResult)
        .where(SPResult.student_id == student_id, SPResult.is_published == True)
        .order_by(SPResult.created_at.asc())
    )
    results = results_res.scalars().all()

    total_sessions = len(results)
    avg_score = round(sum(r.percentage for r in results) / total_sessions, 1) if results else 0
    best_score = round(max((r.percentage for r in results), default=0), 1)
    latest_score = round(results[-1].percentage if results else 0, 1)

    # Selection status from latest result
    latest_result = results[-1] if results else None
    selection_status = latest_result.status if latest_result else "pending"
    next_round_eligible = latest_result.next_round_eligible if latest_result else False
    next_round_link = latest_result.next_round_link if latest_result else None

    # Unread notifications
    unread = await db.execute(
        select(func.count(SPNotification.id))
        .where(SPNotification.student_id == student_id, SPNotification.is_read == False)
    )
    unread_count = unread.scalar() or 0

    # Pending assignments
    assignments_res = await db.execute(
        select(SPAssignment)
        .where(SPAssignment.admin_id == student.admin_id, SPAssignment.is_active == True)
    )
    all_assignments = assignments_res.scalars().all()

    submitted_res = await db.execute(
        select(SPSubmission.assignment_id).where(SPSubmission.student_id == student_id)
    )
    submitted_ids = {row[0] for row in submitted_res.fetchall()}
    pending_assignments = len([a for a in all_assignments if a.id not in submitted_ids])

    # Score trend for chart
    score_trend = [
        {
            "session": r.session_title[:20],
            "round": r.round_name,
            "score": round(r.percentage, 1),
            "date": r.session_date,
        }
        for r in results
    ]

    # Rank
    rank = latest_result.rank if latest_result else None

    return {
        "student_id": student_id,
        "name": student.full_name,
        "email": student.email,
        "batch": student.batch,
        "college": student.college,
        "total_sessions": total_sessions,
        "avg_score": avg_score,
        "best_score": best_score,
        "latest_score": latest_score,
        "rank": rank,
        "selection_status": selection_status,
        "next_round_eligible": next_round_eligible,
        "next_round_link": next_round_link,
        "unread_notifications": unread_count,
        "pending_assignments": pending_assignments,
        "score_trend": score_trend,
    }


# ── AI Assistant ───────────────────────────────────────────────
class AIChatRequest(BaseModel):
    student_id: str
    message: str
    history: List[dict] = []   # [{"role": "user/assistant", "content": "..."}]


@ai_router.post("/chat")
async def ai_chat(data: AIChatRequest, db: AsyncSession = Depends(get_db)):
    """AI Assistant powered by Groq"""
    # Get student context
    student = await db.execute(select(SPUser).where(SPUser.id == data.student_id))
    student = student.scalar_one_or_none()

    # Get recent results for context
    results_res = await db.execute(
        select(SPResult)
        .where(SPResult.student_id == data.student_id, SPResult.is_published == True)
        .order_by(SPResult.created_at.desc())
        .limit(3)
    )
    recent_results = results_res.scalars().all()

    context = ""
    if recent_results:
        context = "Student's recent performance:\n"
        for r in recent_results:
            context += f"- {r.session_title}: {r.percentage:.1f}% ({r.status})\n"

    system_prompt = f"""You are a helpful AI assistant for students on the Intervex Student Portal.
You help students with:
- Understanding their performance and results
- Study tips and interview preparation
- Assignment help and guidance  
- Career advice and next steps
- Answering subject-related doubts

{f"Student name: {student.full_name}" if student else ""}
{context}

Be encouraging, concise, and practical. Use simple language."""

    try:
        from app.services.ai_service import ai_service

        # Build messages with history
        messages = []
        for h in data.history[-6:]:   # last 6 messages for context
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": data.message})

        response = await ai_service.chat(messages, system=system_prompt)
        return {"response": response, "role": "assistant"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


class AssignmentCheckRequest(BaseModel):
    student_id: str
    assignment_id: str
    submission_text: str   # student pastes their answer text


@ai_router.post("/check-assignment")
async def ai_check_assignment(data: AssignmentCheckRequest, db: AsyncSession = Depends(get_db)):
    """AI checks student's assignment answer"""
    assignment = await db.execute(
        select(SPAssignment).where(SPAssignment.id == data.assignment_id)
    )
    assignment = assignment.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    prompt = f"""You are an expert assignment evaluator.

Assignment Title: {assignment.title}
Description: {assignment.description}
Instructions: {assignment.instructions or 'Standard guidelines apply'}
Max Marks: {assignment.max_marks}

Student's Submission:
{data.submission_text[:3000]}

Please evaluate and provide:
1. **Estimated Score**: X / {assignment.max_marks}
2. **What's Good**: (3-4 points)
3. **What Needs Improvement**: (3-4 points)
4. **Specific Suggestions**: (actionable tips)
5. **Overall Grade**: A/B/C/D with brief justification

Be fair, constructive, and specific."""

    try:
        from app.services.ai_service import ai_service
        response = await ai_service.generate(prompt)
        return {"feedback": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")
