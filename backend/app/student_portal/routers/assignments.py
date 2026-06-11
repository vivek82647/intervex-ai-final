"""
SP Assignments - Admin creates, student submits, AI checks
"""
import uuid
import base64
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.security import require_admin
from app.student_portal.models.models import SPAssignment, SPSubmission, SPUser

router = APIRouter(prefix="/sp/assignments", tags=["SP Assignments"])


class CreateAssignmentRequest(BaseModel):
    title: str
    description: str
    instructions: Optional[str] = None
    due_date: Optional[str] = None
    max_marks: float = 100
    target_batch: Optional[str] = None
    allowed_file_types: List[str] = ["pdf", "doc", "docx", "jpg", "png"]


# ── Admin: Create Assignment ───────────────────────────────────
@router.post("")
async def create_assignment(
    data: CreateAssignmentRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    due = None
    if data.due_date:
        try:
            due = datetime.fromisoformat(data.due_date)
        except:
            pass

    assignment = SPAssignment(
        id=str(uuid.uuid4()),
        admin_id=current_user["user_id"],
        admin_name=current_user.get("full_name") or current_user.get("email"),
        title=data.title,
        description=data.description,
        instructions=data.instructions,
        due_date=due,
        max_marks=data.max_marks,
        target_batch=data.target_batch,
        allowed_file_types=data.allowed_file_types,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return {"id": assignment.id, "title": assignment.title, "message": "Assignment created"}


# ── Admin: List their assignments ─────────────────────────────
@router.get("/admin")
async def admin_assignments(
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SPAssignment)
        .where(SPAssignment.admin_id == current_user["user_id"])
        .order_by(SPAssignment.created_at.desc())
    )
    assignments = result.scalars().all()
    return [
        {k: v for k, v in a.__dict__.items() if k != "_sa_instance_state"}
        for a in assignments
    ]


# ── Admin: View submissions for an assignment ──────────────────
@router.get("/{assignment_id}/submissions")
async def assignment_submissions(
    assignment_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SPSubmission, SPUser.full_name, SPUser.email)
        .join(SPUser, SPSubmission.student_id == SPUser.id)
        .where(
            SPSubmission.assignment_id == assignment_id,
            SPSubmission.admin_id == current_user["user_id"]
        )
        .order_by(SPSubmission.submitted_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": s.id,
            "student_name": name,
            "student_email": email,
            "file_name": s.file_name,
            "file_type": s.file_type,
            "file_size": s.file_size,
            "is_graded": s.is_graded,
            "marks_awarded": s.marks_awarded,
            "grade_feedback": s.grade_feedback,
            "ai_feedback": s.ai_feedback,
            "submitted_at": s.submitted_at,
        }
        for s, name, email in rows
    ]


# ── Student: View assignments (their admin's) ──────────────────
@router.get("/student/{student_id}")
async def student_assignments(
    student_id: str,
    db: AsyncSession = Depends(get_db)
):
    # Get student's admin_id
    student = await db.execute(
        select(SPUser).where(SPUser.id == student_id)
    )
    student = student.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    result = await db.execute(
        select(SPAssignment)
        .where(
            SPAssignment.admin_id == student.admin_id,
            SPAssignment.is_active == True
        )
        .order_by(SPAssignment.created_at.desc())
    )
    assignments = result.scalars().all()

    # Check which ones student already submitted
    submitted_ids = []
    if assignments:
        subs = await db.execute(
            select(SPSubmission.assignment_id)
            .where(SPSubmission.student_id == student_id)
        )
        submitted_ids = [row[0] for row in subs.fetchall()]

    return [
        {
            **{k: v for k, v in a.__dict__.items() if k != "_sa_instance_state"},
            "submitted": a.id in submitted_ids,
        }
        for a in assignments
    ]


# ── Student: Submit Assignment ─────────────────────────────────
@router.post("/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: str,
    student_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    # Verify assignment exists
    assignment = await db.execute(
        select(SPAssignment).where(SPAssignment.id == assignment_id)
    )
    assignment = assignment.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Verify student
    student = await db.execute(
        select(SPUser).where(SPUser.id == student_id)
    )
    student = student.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Check already submitted
    existing = await db.execute(
        select(SPSubmission).where(
            SPSubmission.assignment_id == assignment_id,
            SPSubmission.student_id == student_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already submitted this assignment")

    # File type check
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in assignment.allowed_file_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(assignment.allowed_file_types)}"
        )

    # File size check (10MB max)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB allowed.")

    # Encode to base64 for storage
    file_b64 = base64.b64encode(content).decode("utf-8")

    submission = SPSubmission(
        id=str(uuid.uuid4()),
        assignment_id=assignment_id,
        student_id=student_id,
        admin_id=assignment.admin_id,
        file_name=file.filename,
        file_type=ext,
        file_data=file_b64,
        file_size=len(content),
    )
    db.add(submission)
    await db.commit()

    # AI check in background
    try:
        from app.services.ai_service import ai_service
        if ext in ["jpg", "jpeg", "png"]:
            prompt = f"""You are an assignment evaluator. This is an image submission for assignment: "{assignment.title}".
Assignment description: {assignment.description}
Max marks: {assignment.max_marks}

Evaluate this submission and provide:
1. Estimated marks (out of {assignment.max_marks})
2. Detailed feedback
3. What was done well
4. What needs improvement

Respond in a clear, structured format."""
            ai_resp = await ai_service.generate(prompt)
        else:
            # For PDF/doc, just give general feedback based on assignment
            prompt = f"""You are an assignment evaluator for assignment: "{assignment.title}".
Description: {assignment.description}
Instructions: {assignment.instructions or 'Follow standard guidelines'}

A student has submitted their work. Please provide:
1. General evaluation criteria for this assignment
2. What a good submission should contain
3. Tips for improvement

Keep response concise and helpful."""
            ai_resp = await ai_service.generate(prompt)

        # Update with AI feedback
        submission.ai_feedback = ai_resp
        await db.commit()
    except:
        pass  # AI feedback optional — don't fail submission

    return {
        "id": submission.id,
        "message": "Assignment submitted successfully",
        "file_name": file.filename,
        "submitted_at": submission.submitted_at,
    }
