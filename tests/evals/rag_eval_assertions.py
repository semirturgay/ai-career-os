from __future__ import annotations

from typing import Any

from app.schemas.rag import ScoredChunk


def evaluate_rag_retrieval(
    scored: list[ScoredChunk],
    expected: dict[str, Any],
    *,
    case_name: str,
) -> list[str]:
    failures: list[str] = []

    min_chunks = expected.get("min_chunks", 0)
    if len(scored) < min_chunks:
        failures.append(
            f"[{case_name}] expected at least {min_chunks} retrieved chunks, got {len(scored)}"
        )

    chunk_ids = [item.chunk.id for item in scored]
    for chunk_id in expected.get("must_include_chunk_ids", []):
        if chunk_id not in chunk_ids:
            failures.append(f"[{case_name}] expected chunk id {chunk_id!r} in retrieval results")

    min_scores = expected.get("min_score_for_chunk_ids", {})
    scores_by_id = {item.chunk.id: item.score for item in scored}
    for chunk_id, min_score in min_scores.items():
        score = scores_by_id.get(chunk_id)
        if score is None:
            failures.append(f"[{case_name}] expected chunk id {chunk_id!r} in retrieval results")
        elif score < min_score:
            failures.append(
                f"[{case_name}] expected chunk {chunk_id!r} score >= {min_score}, got {score:.3f}"
            )

    top_k_terms = expected.get("must_include_terms_in_top_k")
    if top_k_terms:
        limit = top_k_terms.get("k", len(scored))
        combined = " ".join(item.chunk.text for item in scored[:limit]).casefold()
        for term in top_k_terms.get("terms", []):
            if term.casefold() not in combined:
                failures.append(f"[{case_name}] expected top-{limit} chunks to mention {term!r}")

    min_sections = expected.get("min_sections", {})
    section_counts: dict[str, int] = {}
    for item in scored:
        section_counts[item.chunk.section] = section_counts.get(item.chunk.section, 0) + 1
    for section, minimum in min_sections.items():
        if section_counts.get(section, 0) < minimum:
            failures.append(
                f"[{case_name}] expected at least {minimum} {section!r} chunks, "
                f"got {section_counts.get(section, 0)}"
            )

    return failures
