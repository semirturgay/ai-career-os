from app.services.job_artifacts import (
    ARTIFACT_COVER_LETTER,
    ARTIFACT_RESUME_OPTIMIZATION,
    read_job_artifact,
    save_job_artifact,
)


def test_save_and_read_job_artifact():
    metadata = save_job_artifact(
        None,
        ARTIFACT_RESUME_OPTIMIZATION,
        analysis_id="analysis-1",
        result={"summary": "Updated resume", "suggestions": []},
    )
    saved = read_job_artifact(metadata, ARTIFACT_RESUME_OPTIMIZATION, analysis_id="analysis-1")
    assert saved == {"summary": "Updated resume", "suggestions": []}


def test_read_job_artifact_requires_matching_analysis_id():
    metadata = save_job_artifact(
        None,
        ARTIFACT_COVER_LETTER,
        analysis_id="analysis-1",
        result={
            "body": "Hello",
            "tone": "professional",
            "highlights_used": [],
            "critique_summary": "",
        },
    )
    assert read_job_artifact(metadata, ARTIFACT_COVER_LETTER, analysis_id="analysis-2") is None
