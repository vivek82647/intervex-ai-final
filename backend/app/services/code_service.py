"""
Code Service - in-process code execution & auto-grading for coding questions.

WHY THIS FILE WAS REWRITTEN
----------------------------
The previous version had two bugs that made almost every "correct" pandas/
function-style submission show up as "Test Case Failed":

1. It never called the student's function. It just `exec()`d the raw source
   and compared whatever happened to be printed to stdout against
   `expected_output`. A submission like
       def group_data(df, group_by, calculate_mean):
           return df.groupby(group_by)[calculate_mean].mean().reset_index()
   prints NOTHING, so stdout was always "" -> always "failed", no matter how
   correct the logic was.
2. `pandas`/`numpy` were not even installed (see backend/requirements.txt),
   so any submission that did `import pandas as pd` crashed with
   ModuleNotFoundError before it could run at all.

This version:
- Detects the question's entry function (e.g. `group_data`) and actually
  CALLS it with the test case's input, then compares the RETURN VALUE to
  expected_output - matching how these questions are phrased
  ("the function should take X and return Y").
- Parses test-case input/expected_output with `ast.literal_eval` first
  (AI-generated cases are often Python-literal style with single quotes,
  e.g. [{'name': 'John'}], which is NOT valid JSON) then falls back to JSON,
  then raw string.
- Compares results with order-insensitive dict keys and float tolerance
  (so 8.5 vs 8.500000000001, or int 90 vs float 90.0, no longer fails a
  correct answer).
- Awards PARTIAL marks based on each test case's own `marks` weight instead
  of all-or-nothing, and falls back gracefully to a legacy stdout-compare
  mode for plain script-style questions that have no function definition.

KNOWN LIMITATION (please read)
-------------------------------
This still executes student code in-process via exec() - there is no OS
level sandbox (no Docker / Judge0 / gVisor). A malicious submission could
still do real damage (e.g. infinite loops, reading server env vars). A
thread-based timeout is added so requests don't hang forever, but this is
NOT a security boundary. For a production assessment platform handling
many real students, the test-execution bug fixed here was the urgent
correctness issue, but moving execution to Judge0 (free tier) or a
container sandbox is still recommended before scaling up.
"""
import ast
import asyncio
import inspect
import io
import json
import logging
import math
import re
import sys
from typing import Any, Optional

logger = logging.getLogger(__name__)

_ENTRY_FN_RE = re.compile(r"^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", re.MULTILINE)
_DATAFRAME_PARAM_NAMES = ("df", "dataframe", "data", "dataset")
_PRELUDE_STD_MODULES = ("math", "re", "json", "itertools", "collections", "datetime", "statistics")


def extract_function_name(code: Optional[str]) -> Optional[str]:
    """Pull the first top-level `def name(...)` out of a starter/source snippet."""
    if not code:
        return None
    match = _ENTRY_FN_RE.search(code)
    return match.group(1) if match else None


def _parse_literal(text: Any) -> Any:
    """Test cases are often authored as Python-literal strings (single quotes),
    e.g. "[{'name': 'John', 'score': 90}]", which json.loads() rejects.
    Try ast.literal_eval first, then JSON, then fall back to the raw string."""
    if not isinstance(text, str):
        return text
    stripped = text.strip()
    if stripped == "":
        return stripped
    try:
        return ast.literal_eval(stripped)
    except (ValueError, SyntaxError, TypeError, MemoryError, RecursionError):
        pass
    try:
        return json.loads(stripped)
    except (ValueError, json.JSONDecodeError):
        pass
    return stripped


def _jsonable(obj: Any) -> Any:
    """Convert pandas/numpy objects (and nested structures) into plain,
    comparison-friendly Python values."""
    try:
        import pandas as pd
        if isinstance(obj, pd.DataFrame):
            return [_jsonable(r) for r in obj.to_dict(orient="records")]
        if isinstance(obj, pd.Series):
            return {k: _jsonable(v) for k, v in obj.to_dict().items()}
    except ImportError:
        pass
    try:
        import numpy as np
        if isinstance(obj, np.generic):
            obj = obj.item()
        elif isinstance(obj, np.ndarray):
            return [_jsonable(v) for v in obj.tolist()]
    except ImportError:
        pass
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonable(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


def _deep_equal(a: Any, b: Any, rel_tol: float = 1e-4, abs_tol: float = 1e-6) -> bool:
    """Deep comparison that is order-insensitive for dict keys and tolerant
    of float precision / int-vs-float differences."""
    a, b = _jsonable(a), _jsonable(b)
    if isinstance(a, bool) or isinstance(b, bool):
        return a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(float(a), float(b), rel_tol=rel_tol, abs_tol=abs_tol)
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a.keys()) != set(b.keys()):
            return False
        return all(_deep_equal(a[k], b[k], rel_tol, abs_tol) for k in a)
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        if len(a) != len(b):
            return False
        return all(_deep_equal(x, y, rel_tol, abs_tol) for x, y in zip(a, b))
    if isinstance(a, str) and isinstance(b, str):
        return a.strip() == b.strip()
    return a == b


def _build_exec_globals() -> dict:
    """Pre-import the modules these questions actually need so a missing
    `import pandas as pd` line (or a missing package on the server) doesn't
    silently fail every test."""
    g: dict = {"__builtins__": __builtins__}
    for name in _PRELUDE_STD_MODULES:
        try:
            g[name] = __import__(name)
        except ImportError:
            pass
    for alias, mod_name in (("pd", "pandas"), ("np", "numpy")):
        try:
            g[alias] = __import__(mod_name)
        except ImportError:
            logger.warning("Optional module '%s' not installed - install it in requirements.txt", mod_name)
    return g


def _maybe_dataframe(value: Any, param_name: str):
    """If a parameter name looks like it expects a DataFrame and the value is
    a JSON-shaped list of dicts, build the DataFrame automatically. This
    bridges plain-JSON test case storage with pandas-based questions."""
    if param_name.lower() not in _DATAFRAME_PARAM_NAMES:
        return value
    if isinstance(value, list) and value and all(isinstance(r, dict) for r in value):
        try:
            import pandas as pd
            return pd.DataFrame(value)
        except ImportError:
            return value
    return value


def _call_entry_function(source_code: str, entry_function: str, raw_input: str):
    """Exec the student's source, locate entry_function, call it with the
    parsed test-case input, and return (return_value, captured_stdout)."""
    g = _build_exec_globals()
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        exec(compile(source_code, "<submission>", "exec"), g)
        fn = g.get(entry_function)
        if fn is None or not callable(fn):
            raise NameError(f"Function '{entry_function}' was not defined in the submission")

        parsed = _parse_literal(raw_input)
        try:
            params = list(inspect.signature(fn).parameters.keys())
        except (TypeError, ValueError):
            params = []

        if isinstance(parsed, list) and len(params) > 1 and len(parsed) == len(params):
            args = [_maybe_dataframe(v, p) for v, p in zip(parsed, params)]
            result = fn(*args)
        elif isinstance(parsed, dict) and params and set(parsed.keys()) <= set(params):
            kwargs = {k: _maybe_dataframe(v, k) for k, v in parsed.items()}
            result = fn(**kwargs)
        else:
            arg = _maybe_dataframe(parsed, params[0] if params else "")
            result = fn(arg)

        return result, sys.stdout.getvalue()
    finally:
        sys.stdout = old_stdout


def _run_script_for_stdout(source_code: str):
    g = _build_exec_globals()
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        exec(compile(source_code, "<submission>", "exec"), g)
        return sys.stdout.getvalue()
    finally:
        sys.stdout = old_stdout


class CodeService:
    async def run_code(
        self, source_code: str, language: str,
        stdin: str = "", time_limit: int = 5
    ) -> dict:
        """Plain "Run Code" button (no test cases) - just executes and
        returns whatever was printed."""
        if language != "python":
            return {
                "stdout": f"Note: {language} execution requires Judge0 (free at judge0.com). Python works locally.",
                "stderr": "", "status": "Not Supported Locally", "time": "0s",
            }
        loop = asyncio.get_event_loop()
        try:
            output, err = await asyncio.wait_for(
                loop.run_in_executor(None, self._safe_run_script, source_code),
                timeout=time_limit,
            )
            if err:
                return {"stdout": "", "stderr": err, "status": "Runtime Error", "time": f"<{time_limit}s"}
            return {"stdout": output, "stderr": "", "status": "Accepted", "time": f"<{time_limit}s"}
        except asyncio.TimeoutError:
            return {"stdout": "", "stderr": "Time limit exceeded", "status": "Time Limit Exceeded", "time": f"{time_limit}s"}
        except Exception as e:
            return {"stdout": "", "stderr": str(e), "status": "Error", "time": "0s"}

    @staticmethod
    def _safe_run_script(source_code: str):
        try:
            return _run_script_for_stdout(source_code), None
        except Exception as e:
            return "", str(e)

    # Backward-compat alias - attempts.py's plain "no test cases" branch calls
    # `code_service.execute(...)`, which never existed on the old class and
    # would have raised AttributeError every time it was hit.
    async def execute(self, source_code: str, language: str, stdin: str = "", time_limit: int = 5) -> dict:
        return await self.run_code(source_code, language, stdin, time_limit)

    async def run_test_cases(
        self,
        source_code: str,
        language: str,
        test_cases: list,
        entry_function: Optional[str] = None,
        time_limit: int = 5,
    ) -> dict:
        """Run every test case and return both raw pass/fail counts AND a
        marks-weighted partial score (each test case carries its own
        `marks` field - previously ignored)."""
        if language != "python":
            results = [{
                "test_case_id": tc.get("id"), "passed": False,
                "output": "", "expected": tc.get("expected_output", ""),
                "status": "Not Supported Locally",
                "error": f"{language} grading needs Judge0/a sandbox; not available in-process.",
                "marks": float(tc.get("marks", 1.0) or 1.0),
            } for tc in test_cases]
            total_marks = sum(r["marks"] for r in results)
            return {"passed": 0, "total": len(test_cases), "earned_marks": 0.0,
                    "max_marks": round(total_marks, 4), "results": results}

        entry_function = entry_function or extract_function_name(source_code)
        loop = asyncio.get_event_loop()
        results = []
        passed = 0
        earned_marks = 0.0
        total_marks = 0.0

        for tc in test_cases:
            tc_marks = float(tc.get("marks", 1.0) or 1.0)
            total_marks += tc_marks
            raw_input = tc.get("input", "")
            expected_raw = tc.get("expected_output", "")
            expected = _parse_literal(expected_raw)
            ok, output_display, status, error = False, "", "Runtime Error", None

            try:
                if entry_function:
                    result, _stdout = await asyncio.wait_for(
                        loop.run_in_executor(None, _call_entry_function, source_code, entry_function, raw_input),
                        timeout=time_limit,
                    )
                    actual = _jsonable(result)
                    ok = _deep_equal(actual, expected)
                    output_display = json.dumps(actual, default=str)
                    status = "Accepted" if ok else "Wrong Answer"
                else:
                    # Legacy fallback for plain script-style questions with no
                    # detectable function (compares printed stdout).
                    stdout_text = await asyncio.wait_for(
                        loop.run_in_executor(None, _run_script_for_stdout, source_code),
                        timeout=time_limit,
                    )
                    actual_parsed = _parse_literal(stdout_text.strip())
                    ok = _deep_equal(actual_parsed, expected) or stdout_text.strip() == str(expected_raw).strip()
                    output_display = stdout_text.strip()
                    status = "Accepted" if ok else "Wrong Answer"
            except asyncio.TimeoutError:
                status, error = "Time Limit Exceeded", f"Exceeded {time_limit}s"
            except Exception as e:
                status, error = "Runtime Error", str(e)

            if ok:
                passed += 1
                earned_marks += tc_marks

            results.append({
                "test_case_id": tc.get("id"),
                "passed": ok,
                "output": output_display,
                "expected": expected_raw,
                "status": status,
                "error": error,
                "marks": tc_marks,
            })

        return {
            "passed": passed,
            "total": len(test_cases),
            "earned_marks": round(earned_marks, 4),
            "max_marks": round(total_marks, 4) if total_marks else 0.0,
            "results": results,
        }


code_service = CodeService()