"""
Questions Endpoints - CRUD + AI generation + CSV upload
"""
import uuid
import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.core.database import get_db
from app.core.security import require_admin
from app.models.models import Question
from app.schemas.schemas import QuestionCreate, QuestionOut, AIGenerateRequest
from app.services.ai_service import ai_service

router = APIRouter()


@router.post("", response_model=QuestionOut)
async def create_question(
    data: QuestionCreate,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a question manually"""
    options = None
    if data.options:
        options = [o.model_dump() for o in data.options]
    
    test_cases = None
    if data.test_cases:
        test_cases = [tc.model_dump() for tc in data.test_cases]

    question = Question(
        id=str(uuid.uuid4()),
        admin_id=current_user["user_id"],
        type=data.type,
        difficulty=data.difficulty,
        topic=data.topic,
        title=data.title,
        content=data.content,
        options=options,
        correct_answer=data.correct_answer,
        explanation=data.explanation,
        marks=data.marks,
        negative_marks=data.negative_marks,
        time_limit_seconds=data.time_limit_seconds,
        test_cases=test_cases,
        starter_code=data.starter_code,
        rubric=data.rubric,
        tags=data.tags,
        source="manual"
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


@router.get("", response_model=List[QuestionOut])
async def list_questions(
    topic: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List questions for admin's question bank"""
    query = select(Question).where(Question.admin_id == current_user["user_id"])
    
    if topic:
        query = query.where(Question.topic.ilike(f"%{topic}%"))
    if type:
        query = query.where(Question.type == type)
    if difficulty:
        query = query.where(Question.difficulty == difficulty)
    if search:
        query = query.where(
            or_(
                Question.title.ilike(f"%{search}%"),
                Question.content.ilike(f"%{search}%")
            )
        )
    
    query = query.offset(skip).limit(limit).order_by(Question.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/stats")
async def question_stats(
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get question bank statistics"""
    admin_id = current_user["user_id"]
    
    total = await db.execute(select(func.count(Question.id)).where(Question.admin_id == admin_id))
    by_type = await db.execute(
        select(Question.type, func.count(Question.id))
        .where(Question.admin_id == admin_id)
        .group_by(Question.type)
    )
    by_difficulty = await db.execute(
        select(Question.difficulty, func.count(Question.id))
        .where(Question.admin_id == admin_id)
        .group_by(Question.difficulty)
    )
    topics = await db.execute(
        select(Question.topic, func.count(Question.id))
        .where(Question.admin_id == admin_id)
        .group_by(Question.topic)
        .order_by(func.count(Question.id).desc())
        .limit(10)
    )
    
    return {
        "total": total.scalar(),
        "by_type": dict(by_type.all()),
        "by_difficulty": dict(by_difficulty.all()),
        "top_topics": dict(topics.all())
    }


@router.post("/ai-generate")
async def ai_generate_questions(
    data: AIGenerateRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Generate questions using AI"""
    try:
        generated = await ai_service.generate_questions(
            topic=data.topic,
            difficulty=data.difficulty,
            count=data.count,
            q_type=data.type,
            marks=data.marks,
            context=data.context
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
    
    saved_questions = []
    for q_data in generated:
        question = Question(
            id=str(uuid.uuid4()),
            admin_id=current_user["user_id"],
            type=data.type,
            difficulty=data.difficulty,
            topic=q_data.get("topic", data.topic),
            title=q_data.get("title", ""),
            content=q_data.get("content", ""),
            options=q_data.get("options"),
            correct_answer=q_data.get("correct_answer"),
            explanation=q_data.get("explanation"),
            marks=q_data.get("marks", data.marks),
            test_cases=q_data.get("test_cases"),
            starter_code=q_data.get("starter_code"),
            rubric=q_data.get("rubric"),
            is_ai_generated=True,
            source="ai"
        )
        db.add(question)
        saved_questions.append(question)
    
    await db.commit()
    return {
        "generated_count": len(saved_questions),
        "questions": [{"id": q.id, "title": q.title, "topic": q.topic} for q in saved_questions]
    }


@router.post("/csv-upload")
async def upload_questions_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Bulk upload questions from CSV"""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")
    
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
    
    required_fields = {"type", "difficulty", "topic", "title", "content", "marks"}
    
    saved = []
    errors = []
    
    for i, row in enumerate(reader, 1):
        # Only check fields that exist in header
        missing = required_fields - set(row.keys())
        if missing:
            errors.append(f"Row {i}: Missing fields: {missing}")
            continue
        
        # Skip empty rows
        if not row.get("type") or not row.get("content"):
            errors.append(f"Row {i}: Empty type or content")
            continue

        try:
            # Parse MCQ options
            # Supports both formats:
            # Semicolon: "A|text|0;B|text|1" (recommended)
            # Comma:     "A|text|0,B|text|1"
            options = None
            if row.get("type") == "mcq" and row.get("options"):
                options = []
                raw = row["options"].strip()
                # Use semicolon if present, else comma
                sep = ";" if ";" in raw else ","
                for opt_str in raw.split(sep):
                    parts = opt_str.strip().split("|")
                    if len(parts) >= 2:
                        options.append({
                            "id": parts[0].strip(),
                            "text": parts[1].strip(),
                            "is_correct": parts[2].strip() == "1" if len(parts) > 2 else False
                        })
            
            question = Question(
                id=str(uuid.uuid4()),
                admin_id=current_user["user_id"],
                type=row["type"],
                difficulty=row["difficulty"],
                topic=row["topic"],
                title=row["title"],
                content=row["content"],
                options=options,
                correct_answer=row.get("correct_answer"),
                explanation=row.get("explanation"),
                marks=float(row.get("marks", 1)),
                negative_marks=float(row.get("negative_marks", 0)),
                tags=row.get("tags", "").split("|") if row.get("tags") else [],
                source="csv"
            )
            db.add(question)
            saved.append(i)
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
    
    if saved:
        await db.commit()
    
    return {
        "saved": len(saved),
        "errors": errors,
        "total_rows": i if 'i' in dir() else 0
    }


@router.delete("/{question_id}")
async def delete_question(
    question_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a question"""
    result = await db.execute(
        select(Question).where(
            Question.id == question_id,
            Question.admin_id == current_user["user_id"]
        )
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    await db.delete(question)
    await db.commit()
    return {"success": True}


@router.post("/extract-upload")
async def extract_questions_from_file(
    file: UploadFile = File(...),
    q_type: str = "mcq",
    difficulty: str = "medium",
    count: int = 10,
    marks: float = 1.0,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Extract questions from PDF, image, or DOCX using AI"""
    from app.services.file_extractor import extract_text_from_file

    allowed = {'.pdf', '.png', '.jpg', '.jpeg', '.docx', '.txt', '.webp'}
    ext = '.' + file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file. Use: PDF, PNG, JPG, DOCX, TXT")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")

    # Extract text
    try:
        text = await extract_text_from_file(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if len(text) < 50:
        raise HTTPException(status_code=400, detail="Too little text extracted from file.")

    # Trim text to avoid token limits
    text = text[:6000]

    # Generate questions using Groq
    system = "You are an expert educator. Generate assessment questions as valid JSON array only. No extra text."

    if q_type == "mcq":
        prompt = f"""Based on this content, generate {count} MCQ questions at {difficulty} difficulty.

CONTENT:
{text}

Return ONLY a JSON array:
[{{"title":"Short title","content":"Full question","options":[{{"id":"a","text":"Option A","is_correct":false}},{{"id":"b","text":"Option B","is_correct":true}},{{"id":"c","text":"Option C","is_correct":false}},{{"id":"d","text":"Option D","is_correct":false}}],"correct_answer":"b","explanation":"Why correct","marks":{marks},"topic":"Extracted","difficulty":"{difficulty}"}}]"""

    elif q_type == "descriptive":
        prompt = f"""Based on this content, generate {count} descriptive questions at {difficulty} difficulty.

CONTENT:
{text}

Return ONLY a JSON array:
[{{"title":"Short title","content":"Full question","correct_answer":"Model answer","marks":{marks},"topic":"Extracted","difficulty":"{difficulty}"}}]"""

    else:  # coding
        prompt = f"""Based on this content, generate {count} coding problems at {difficulty} difficulty.

CONTENT:
{text}

Return ONLY a JSON array:
[{{"title":"Problem title","content":"Problem statement","starter_code":{{"python":"# code here"}},"marks":{marks},"topic":"Extracted","difficulty":"{difficulty}"}}]"""

    try:
        import json, re
        result = (await ai_service.generate(prompt, system)).strip()
        if result.startswith("```"):
            result = re.sub(r"```(?:json)?", "", result).strip().rstrip("`")
        start = result.find("[")
        end = result.rfind("]") + 1
        if start == -1 or end <= start:
            raise ValueError("AI did not return valid JSON")
        generated = json.loads(result[start:end])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    # Save to DB
    saved = []
    for q_data in generated:
        question = Question(
            id=str(uuid.uuid4()),
            admin_id=current_user["user_id"],
            type=q_type,
            difficulty=difficulty,
            topic=q_data.get("topic", "Extracted"),
            title=q_data.get("title", ""),
            content=q_data.get("content", ""),
            options=q_data.get("options"),
            correct_answer=q_data.get("correct_answer"),
            explanation=q_data.get("explanation"),
            marks=q_data.get("marks", marks),
            test_cases=q_data.get("test_cases"),
            starter_code=q_data.get("starter_code"),
            is_ai_generated=True,
            source="file_extract"
        )
        db.add(question)
        saved.append(question)

    await db.commit()
    return {
        "extracted_chars": len(text),
        "generated_count": len(saved),
        "questions": [{"id": q.id, "title": q.title} for q in saved]
    }
