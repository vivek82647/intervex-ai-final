"""
AI Service - Groq API (Free)
"""
import json
import logging
import re
import asyncio
from typing import Optional, List, Dict, Any
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


class AIService:
    async def _call_groq(self, prompt: str, system: str = "") -> str:
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not set. Get free key at console.groq.com")

        last_err = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        GROQ_URL,
                        headers={
                            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": GROQ_MODEL,
                            "messages": [
                                {"role": "system", "content": system},
                                {"role": "user", "content": prompt},
                            ],
                            "temperature": 0.4,
                            "max_tokens": 4096,
                        },
                    )
                    response.raise_for_status()
                    return response.json()["choices"][0]["message"]["content"]
            except Exception as e:
                last_err = e
                if attempt < 2:
                    await asyncio.sleep(2)
        raise last_err

    async def generate(self, prompt: str, system: str = "") -> str:
        try:
            return await self._call_groq(prompt, system)
        except Exception as e:
            logger.error(f"Groq API failed: {e}")
            raise

    async def generate_questions(
        self, topic: str, difficulty: str, count: int,
        q_type: str, marks: float, context: Optional[str] = None
    ) -> List[Dict]:

        if q_type == "mcq":
            system = (
                "You are an expert educator. You ONLY generate MCQ (Multiple Choice Questions). "
                "Every question MUST have exactly 4 options labeled a, b, c, d. "
                "Return ONLY a valid JSON array. No markdown, no explanation, no extra text."
            )
            prompt = f"""STRICTLY generate {count} MCQ (Multiple Choice) questions about "{topic}" at {difficulty} difficulty.
{f'Use this content as source: {context}' if context else ''}

RULES:
- Every question MUST be MCQ with exactly 4 options
- Exactly one option must have "is_correct": true
- Return ONLY JSON array, nothing else

JSON format:
[
  {{
    "title": "Short title",
    "content": "Full question text?",
    "options": [
      {{"id": "a", "text": "Option A", "is_correct": false}},
      {{"id": "b", "text": "Option B", "is_correct": true}},
      {{"id": "c", "text": "Option C", "is_correct": false}},
      {{"id": "d", "text": "Option D", "is_correct": false}}
    ],
    "correct_answer": "b",
    "explanation": "Why b is correct",
    "marks": {marks},
    "topic": "{topic}",
    "difficulty": "{difficulty}"
  }}
]"""

        elif q_type == "descriptive":
            system = (
                "You are an expert educator. You ONLY generate DESCRIPTIVE questions. "
                "Descriptive questions require written answers — NO options, NO MCQ format. "
                "Return ONLY a valid JSON array. No markdown, no explanation, no extra text."
            )
            prompt = f"""STRICTLY generate {count} DESCRIPTIVE (long answer) questions about "{topic}" at {difficulty} difficulty.
{f'Use this content as source: {context}' if context else ''}

RULES:
- Questions must require detailed written answers
- NO options field, NO MCQ format
- Include model answer and rubric
- Return ONLY JSON array, nothing else

JSON format:
[
  {{
    "title": "Short title",
    "content": "Full descriptive question requiring detailed answer?",
    "correct_answer": "Detailed model answer with key points",
    "rubric": {{
      "criteria": [
        {{"name": "Accuracy", "max_marks": {marks * 0.4}, "description": "Factual correctness"}},
        {{"name": "Completeness", "max_marks": {marks * 0.3}, "description": "Coverage of key points"}},
        {{"name": "Clarity", "max_marks": {marks * 0.3}, "description": "Clear explanation"}}
      ],
      "total_marks": {marks}
    }},
    "marks": {marks},
    "topic": "{topic}",
    "difficulty": "{difficulty}"
  }}
]"""

        elif q_type == "coding":
            system = (
                "You are an expert programming instructor. You ONLY generate CODING problems. "
                "Each problem must have starter code and test cases — NO MCQ options. "
                "Return ONLY a valid JSON array. No markdown, no explanation, no extra text."
            )
            prompt = f"""STRICTLY generate {count} CODING problems about "{topic}" at {difficulty} difficulty.
{f'Use this content as source: {context}' if context else ''}

RULES:
- Each must be a programming problem to solve with code
- Include starter code in Python and JavaScript
- Include at least 2 test cases
- NO options, NO MCQ format
- Return ONLY JSON array, nothing else

JSON format:
[
  {{
    "title": "Problem title",
    "content": "Problem statement with input/output examples",
    "starter_code": {{
      "python": "def solution():\\n    pass",
      "javascript": "function solution() {{\\n  // code\\n}}"
    }},
    "test_cases": [
      {{"id": "1", "input": "sample input", "expected_output": "expected output", "is_hidden": false, "marks": 1}},
      {{"id": "2", "input": "edge case", "expected_output": "expected output", "is_hidden": true, "marks": 1}}
    ],
    "marks": {marks},
    "topic": "{topic}",
    "difficulty": "{difficulty}"
  }}
]"""

        else:
            raise ValueError(f"Unknown question type: {q_type}")

        try:
            result = (await self.generate(prompt, system)).strip()
            # Remove markdown code blocks if present
            if result.startswith("```"):
                result = re.sub(r"```(?:json)?", "", result).strip().rstrip("`").strip()
            # Extract JSON array
            start = result.find("[")
            end = result.rfind("]") + 1
            if start != -1 and end > start:
                result = result[start:end]
            parsed = json.loads(result)
            # Validate type — remove any MCQ that sneaked into descriptive/coding
            if q_type == "descriptive":
                for q in parsed:
                    q.pop("options", None)
                    q.pop("correct_answer_option", None)
            return parsed
        except Exception as e:
            logger.error(f"Question gen failed: {e}")
            raise ValueError(f"AI question generation failed: {str(e)}")

    async def evaluate_descriptive(
        self, question: str, correct_answer: str,
        student_answer: str, rubric: Optional[Dict], max_marks: float
    ) -> Dict:
        system = "You are a strict but fair exam evaluator. Return ONLY valid JSON, no extra text."
        prompt = f"""Evaluate this student answer:

QUESTION: {question}
MODEL ANSWER: {correct_answer}
STUDENT ANSWER: {student_answer}
MAX MARKS: {max_marks}
RUBRIC: {json.dumps(rubric) if rubric else 'General accuracy and completeness'}

Return ONLY this JSON:
{{
  "score": <number between 0 and {max_marks}>,
  "percentage": <number between 0 and 100>,
  "feedback": "Detailed constructive feedback",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "rubric_scores": {{}}
}}"""
        try:
            result = (await self.generate(prompt, system)).strip()
            if result.startswith("```"):
                result = re.sub(r"```(?:json)?", "", result).strip().rstrip("`").strip()
            start = result.find("{")
            end = result.rfind("}") + 1
            return json.loads(result[start:end])
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            return {
                "score": 0, "percentage": 0,
                "feedback": "Evaluation failed. Please retry.",
                "strengths": [], "improvements": []
            }

    async def generate_overall_feedback(
        self, student_name: str, session_title: str,
        score: float, max_score: float,
        topic_scores: Dict[str, float], question_answers: List[Dict]
    ) -> Dict:
        system = "You are an academic advisor. Return ONLY valid JSON, no extra text."
        pct = (score / max_score * 100) if max_score > 0 else 0
        prompt = f"""Give performance feedback for:
Student: {student_name}
Session: {session_title}
Score: {score}/{max_score} ({pct:.1f}%)
Topic scores: {json.dumps(topic_scores)}

Return ONLY this JSON:
{{
  "overall_feedback": "2-3 sentences about overall performance",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "performance_level": "Excellent",
  "next_steps": "What to focus on next"
}}"""
        try:
            result = (await self.generate(prompt, system)).strip()
            if result.startswith("```"):
                result = re.sub(r"```(?:json)?", "", result).strip().rstrip("`").strip()
            start = result.find("{")
            end = result.rfind("}") + 1
            return json.loads(result[start:end])
        except Exception as e:
            return {
                "overall_feedback": f"You scored {pct:.1f}%.",
                "strengths": [], "weaknesses": [],
                "recommendations": ["Review all topics"],
                "performance_level": "Average",
                "next_steps": "Keep practicing"
            }



    async def chat(self, messages: list, system: str = "") -> str:
        """Multi-turn chat with message history"""
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not set")
        
        all_messages = []
        if system:
            all_messages.append({"role": "system", "content": system})
        all_messages.extend(messages)
        
        last_err = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        GROQ_URL,
                        headers={
                            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": GROQ_MODEL,
                            "messages": all_messages,
                            "temperature": 0.7,
                            "max_tokens": 1024,
                        },
                    )
                    response.raise_for_status()
                    return response.json()["choices"][0]["message"]["content"]
            except Exception as e:
                last_err = e
                if attempt < 2:
                    import asyncio
                    await asyncio.sleep(2)
        raise last_err

ai_service = AIService()
