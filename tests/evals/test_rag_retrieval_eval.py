from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services.rag.job_queries import job_retrieval_queries
from app.services.rag.match_context import retrieve_for_match
from app.services.rag.retrieval import DeterministicEmbeddingProvider
from tests.evals.eval_assertions import load_json
from tests.evals.rag_eval_assertions import evaluate_rag_retrieval

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "rag"


def _iter_rag_eval_cases() -> list[tuple[str, Path]]:
    cases: list[tuple[str, Path]] = []
    for case_dir in sorted(FIXTURES_DIR.iterdir()):
        if not case_dir.is_dir():
            continue
        required = ("profile.json", "job.json", "expected.json")
        if all((case_dir / name).exists() for name in required):
            cases.append((case_dir.name, case_dir))
    return cases


def _load_case(case_dir: Path) -> tuple[SimpleNamespace, SimpleNamespace, dict]:
    profile_data = load_json(case_dir / "profile.json")
    job_data = load_json(case_dir / "job.json")
    expected = load_json(case_dir / "expected.json")

    profile = SimpleNamespace(
        structured_data=profile_data,
        resume_text="Jane Doe resume text",
    )
    job = SimpleNamespace(
        title=job_data["title"],
        company=job_data["company"],
        description=job_data["description"],
        location=job_data.get("location"),
        raw_metadata=job_data.get("raw_metadata", {}),
    )
    return profile, job, expected


@pytest.mark.parametrize("case_name,case_dir", _iter_rag_eval_cases())
@pytest.mark.asyncio
async def test_rag_retrieval_meets_expectations(case_name: str, case_dir: Path):
    profile, job, expected = _load_case(case_dir)
    embedder = DeterministicEmbeddingProvider()

    scored = await retrieve_for_match(
        None,
        profile,
        job,
        embedder,
        top_k=expected.get("top_k", 10),
    )

    failures = evaluate_rag_retrieval(scored, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


@pytest.mark.parametrize("case_name,case_dir", _iter_rag_eval_cases())
def test_job_retrieval_queries_use_requirements(case_name: str, case_dir: Path):
    job_data = load_json(case_dir / "job.json")
    job = SimpleNamespace(
        title=job_data["title"],
        company=job_data["company"],
        description=job_data["description"],
        location=job_data.get("location"),
        raw_metadata=job_data.get("raw_metadata", {}),
    )

    queries = job_retrieval_queries(job)
    requirements = job_data.get("raw_metadata", {}).get("requirements")
    if requirements:
        assert queries == requirements, f"[{case_name}] expected requirement-based queries"
    else:
        assert len(queries) == 1
        assert job.description in queries[0]
