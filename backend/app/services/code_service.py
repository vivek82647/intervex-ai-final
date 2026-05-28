"""
Code Service - Simple in-process Python execution (no Judge0/Docker needed)
For MCQ/Descriptive tests, code execution is optional
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class CodeService:
    async def run_code(
        self, source_code: str, language: str,
        stdin: str = "", time_limit: int = 5
    ) -> dict:
        """
        Basic code execution note - for full sandbox use Judge0 cloud (free tier).
        For now returns a helpful message.
        """
        if language == "python":
            try:
                import io, sys, signal
                old_stdout = sys.stdout
                sys.stdout = io.StringIO()
                exec_globals = {}
                try:
                    exec(compile(source_code, "<string>", "exec"), exec_globals)
                    output = sys.stdout.getvalue()
                    sys.stdout = old_stdout
                    return {"stdout": output, "stderr": "", "status": "Accepted", "time": "0.1s"}
                except Exception as e:
                    sys.stdout = old_stdout
                    return {"stdout": "", "stderr": str(e), "status": "Runtime Error", "time": "0s"}
            except Exception as e:
                return {"stdout": "", "stderr": str(e), "status": "Error", "time": "0s"}
        else:
            return {
                "stdout": f"Note: {language} execution requires Judge0 (free at judge0.com). Python works locally.",
                "stderr": "",
                "status": "Not Supported Locally",
                "time": "0s"
            }

    async def run_test_cases(self, source_code: str, language: str, test_cases: list) -> dict:
        results = []
        passed = 0
        for tc in test_cases:
            result = await self.run_code(source_code, language, tc.get("input", ""))
            ok = result.get("stdout", "").strip() == tc.get("expected_output", "").strip()
            if ok:
                passed += 1
            results.append({
                "test_case_id": tc.get("id"),
                "passed": ok,
                "output": result.get("stdout", ""),
                "expected": tc.get("expected_output", ""),
                "status": result.get("status"),
            })
        return {"passed": passed, "total": len(test_cases), "results": results}


code_service = CodeService()
