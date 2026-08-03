from __future__ import annotations


def chunk_text_for_classification(
    text: str,
    *,
    chunk_size: int,
    overlap: int,
) -> list[str]:
    """Split capture text into overlapping chunks for the 512-token classifier."""
    cleaned = text.strip()
    if not cleaned:
        return []
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be >= 0 and < chunk_size")
    if len(cleaned) <= chunk_size:
        return [cleaned]

    chunks: list[str] = []
    step = chunk_size - overlap
    start = 0
    while start < len(cleaned):
        end = min(start + chunk_size, len(cleaned))
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(cleaned):
            break
        start += step

    return chunks
