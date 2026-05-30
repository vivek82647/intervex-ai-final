"""
AI Service - Anthropic Claude API
"""
import json
import logging
import re
import asyncio
from typing import Optional, List, Dict, Any
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

CLAUDE_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL = "claude-3-5-haiku-latest"  # Fast + cheap


class AIService:
    async def _call_claude(self, prompt: str, system: str = "") -> str:
        if not settings.ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY not set. Get key at console.anthropic.com")
        
        last_err = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        CLAUDE_URL,
                        headers={
                            "x-api-key": settings.ANTHROPIC_API_KEY,
                            "anthropic-version": "2023-06-01",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": CLAUDE_MODEL,
                            "max_tokens": 1024,
                            "system": system or "You are a helpful assistant.",
                            "messages": [{"role": "user", "content": prompt}],
                        },
                    )
                    if response.status_code != 200:
                      logger.error(response.text)
                      response.raise_for_status()
                    return response.json()["content"][0]["text"]
            except Exception as e:
                last_err = e
                if attempt < 2:
                    await asyncio.sleep(2)
        raise last_err

    async def generate(self, prompt: str, system: str = "") -> str:
        try:
            return await self._call_claude(prompt, system)
        except Exception as e:
            logger.error(f"Claude API failed: {e}")
            raise

    async def generate_questions(
        self, topic: str, difficulty: str, count: int,
        q_type: str, marks: float, context: Optional[str] = None
    ) -> List[Dict]:
        system = "You are an expert educator. Generate assessment questions as valid JSON array only. No extra text, no markdown."

        if q_type == "mcq":
            prompt = f"""Generate {count} MCQ questions about "{topic}" at {difficulty} difficulty.
{f'Context: {context}' if context else ''}
Return ONLY a JSON array like:
[{{"title":"Short title","content":"Full question text","options":[{{"id":"a","text":"Option A","is_correct":false}},{{"id":"b","text":"Option B","is_correct":true}},{{"id":"c","text":"Option C","is_correct":false}},{{"id":"d","text":"Option D","is_correct":false}}],"correct_answer":"b","explanation":"Why this is correct","marks":{marks},"topic":"{topic}","difficulty":"{difficulty}"}}]"""

        elif q_type == "descriptive":
            prompt = f"""Generate {count} descriptive questions about "{topic}" at {difficulty} difficulty.
{f'Context: {context}' if context else ''}
Return ONLY a JSON array like:
[{{"title":"Short title","content":"Full question","correct_answer":"Model answer key points","rubric":{{"criteria":[{{"name":"Accuracy","max_marks":{marks*0.4},"description":"Factual correctness"}},{{"name":"Completeness","max_marks":{marks*0.3},"description":"Coverage"}},{{"name":"Clarity","max_marks":{marks*0.3},"description":"Expression"}}],"total_marks":{marks}}},"marks":{marks},"topic":"{topic}","difficulty":"{difficulty}"}}]"""

        elif q_type == "coding":
            prompt = f"""Generate {count} coding problems about "{topic}" at {difficulty} difficulty.
Return ONLY a JSON array like:
[{{"title":"Problem title","content":"Problem statement with examples","starter_code":{{"python":"def solution():\\n    pass","javascript":"function solution() {{\\n  // code\\n}}"}},"test_cases":[{{"id":"1","input":"sample","expected_output":"output","is_hidden":false,"marks":1}}],"marks":{marks},"topic":"{topic}","difficulty":"{difficulty}"}}]"""

        try:
            result = (await self.generate(prompt, system)).strip()
            if result.startswith("```"):
                result = re.sub(r"```(?:json)?", "", result).strip().rstrip("`")
            start = result.find("[")
            end = result.rfind("]") + 1
            if start != -1 and end > start:
                result = result[start:end]
            return json.loads(result)
        except Exception as e:
            logger.error(f"Question gen failed: {e}")
            raise ValueError(f"AI question generation failed: {str(e)}")

    async def evaluate_descriptive(
        self, question: str, correct_answer: str,
        student_answer: str, rubric: Optional[Dict], max_marks: float
    ) -> Dict:
        system = "You are a strict but fair exam evaluator. Return ONLY valid JSON, no extra text."
        prompt = f"""Evaluate this answer:
QUESTION: {question}
MODEL ANSWER: {correct_answer}
STUDENT ANSWER: {student_answer}
MAX MARKS: {max_marks}
RUBRIC: {json.dumps(rubric) if rubric else 'General accuracy and completeness'}

Return JSON only: {{"score":<0 to {max_marks}>,"percentage":<0 to 100>,"feedback":"Detailed feedback","strengths":["s1"],"improvements":["i1"],"rubric_scores":{{}}}}"""
        try:
            result = (await self.generate(prompt, system)).strip()
            if result.startswith("```"):
                result = re.sub(r"```(?:json)?", "", result).strip().rstrip("`")
            start = result.find("{")
            end = result.rfind("}") + 1
            return json.loads(result[start:end])
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            return {"score": 0, "percentage": 0, "feedback": "Evaluation failed.", "strengths": [], "improvements": []}

    async def generate_overall_feedback(
        self, student_name: str, session_title: str,
        score: float, max_score: float,
        topic_scores: Dict[str, float], question_answers: List[Dict]
    ) -> Dict:
        system = "You are an academic advisor. Return only JSON, no extra text."
        pct = (score / max_score * 100) if max_score > 0 else 0
        prompt = f"""Give feedback for student: {student_name}
Session: {session_title}, Score: {score}/{max_score} ({pct:.1f}%)
Topic scores: {json.dumps(topic_scores)}
Return JSON: {{"overall_feedback":"2-3 sentences","strengths":["s1","s2"],"weaknesses":["w1"],"recommendations":["r1","r2"],"performance_level":"Excellent/Good/Average/Poor","next_steps":"What to focus on"}}"""
        try:
            result = (await self.generate(prompt, system)).strip()
            if result.startswith("```"):
                result = re.sub(r"```(?:json)?", "", result).strip().rstrip("`")
            start = result.find("{")
            end = result.rfind("}") + 1
            return json.loads(result[start:end])
        except Exception as e:
            return {"overall_feedback": f"You scored {pct:.1f}%.", "strengths": [], "weaknesses": [], "recommendations": ["Review topics"], "performance_level": "Average", "next_steps": "Keep practicing"}


ai_service = AIService()
