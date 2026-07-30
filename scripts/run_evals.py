#!/usr/bin/env -S uv run python
"""Run golden eval suites (offline) or optional live LLM evals.

Usage:
    uv run python scripts/run_evals.py
    uv run python scripts/run_evals.py --live
    uv run python scripts/run_evals.py --suite match_analysis
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EVAL_SUITES: dict[str, str] = {
    "resume_extraction": "tests/evals/test_resume_extraction_eval.py",
    "job_extraction": "tests/evals/test_job_extraction_eval.py",
    "match_analysis": "tests/evals/test_match_analysis_eval.py",
    "resume_optimization": "tests/evals/test_resume_optimization_eval.py",
    "cover_letter": "tests/evals/test_cover_letter_eval.py",
    "company_research": "tests/evals/test_company_research_eval.py",
    "rag_retrieval": "tests/evals/test_rag_retrieval_eval.py",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Run AI Career OS eval harness")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Run live LLM evals (requires RUN_LIVE_LLM=1 and configured provider)",
    )
    parser.add_argument(
        "--suite",
        choices=sorted(EVAL_SUITES),
        help="Run a single eval suite (default: all)",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Verbose pytest output",
    )
    args = parser.parse_args()

    if args.live and os.getenv("RUN_LIVE_LLM") != "1":
        print("Set RUN_LIVE_LLM=1 to run live LLM evals.", file=sys.stderr)
        return 2

    targets = [EVAL_SUITES[args.suite]] if args.suite else list(EVAL_SUITES.values())
    marker = "live_llm" if args.live else "not live_llm"

    cmd = ["uv", "run", "pytest", *targets, "-m", marker]
    if args.verbose:
        cmd.append("-v")
    else:
        cmd.append("-q")

    print("AI Career OS — eval harness")
    print(f"Mode: {'live LLM' if args.live else 'offline golden responses'}")
    print(f"Suites: {', '.join(EVAL_SUITES.keys()) if not args.suite else args.suite}")
    print()

    completed = subprocess.run(cmd, cwd=ROOT)
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
