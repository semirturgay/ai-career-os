from app.schemas.job_extraction import JobExtraction
from app.services.job_extraction_normalize import normalize_job_payload


def test_normalize_truncates_long_description():
    payload = normalize_job_payload(
        {
            "title": "Engineer",
            "company": "Acme",
            "description": "x" * 150,
        }
    )
    assert len(payload["description"]) == 100


def test_normalize_job_payload_maps_aliases():
    payload = normalize_job_payload(
        {
            "job_title": "Backend Engineer",
            "company_name": "Acme",
            "role_summary": "Build APIs.",
            "qualifications": ["Python", "FastAPI"],
        }
    )
    result = JobExtraction.model_validate(payload)
    assert result.title == "Backend Engineer"
    assert result.company == "Acme"
    assert "Python" in result.requirements


def test_normalize_remote_work_mode_from_location_field():
    payload = normalize_job_payload({"location": "Remote", "title": "Engineer", "company": "Acme"})
    result = JobExtraction.model_validate(payload)
    assert result.work_mode == "remote"
    assert result.location == "Remote"


def test_normalize_hybrid_with_city():
    payload = normalize_job_payload(
        {
            "work_mode": "hybrid",
            "location": "Berlin, Germany",
            "title": "Engineer",
            "company": "Acme",
        }
    )
    result = JobExtraction.model_validate(payload)
    assert result.work_mode == "hybrid"
    assert result.location == "Hybrid · Berlin, Germany"


def test_normalize_on_site_from_workplace_type():
    payload = normalize_job_payload(
        {
            "workplace_type": "On-site",
            "office_location": "San Francisco, CA",
            "title": "Engineer",
            "company": "Acme",
        }
    )
    result = JobExtraction.model_validate(payload)
    assert result.work_mode == "on-site"
    assert result.location == "On-site · San Francisco, CA"
