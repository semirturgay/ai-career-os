from app.services.job_discovery.jsearch import _to_search_result


def test_extract_job_items_reads_nested_search_v2_payload():
    from app.services.job_discovery.jsearch import _extract_job_items

    payload = {
        "status": "OK",
        "data": {
            "jobs": [{"job_title": "Engineer", "job_apply_link": "https://example.com/jobs/1"}],
            "cursor": "abc",
        },
    }
    items = _extract_job_items(payload)
    assert len(items) == 1
    assert items[0]["job_title"] == "Engineer"


def test_to_search_result_maps_jsearch_payload():
    item = {
        "job_title": "Senior Backend Engineer",
        "employer_name": "Acme Corp",
        "job_apply_link": "https://boards.greenhouse.io/acme/jobs/1",
        "job_description": "Build Python APIs for payments.",
        "job_city": "Berlin",
        "job_country": "DE",
        "job_min_salary": 90000,
        "job_max_salary": 120000,
        "job_salary_period": "YEAR",
        "job_posted_at": "2026-04-01",
    }

    result = _to_search_result(item)
    assert result.title == "Senior Backend Engineer"
    assert result.url == "https://boards.greenhouse.io/acme/jobs/1"
    assert "Acme Corp" in result.snippet
    assert "Python APIs" in result.snippet


def test_to_search_result_uses_apply_options_fallback():
    item = {
        "job_title": "Engineer",
        "apply_options": [{"apply_link": "https://example.com/jobs/2"}],
    }
    result = _to_search_result(item)
    assert result.url == "https://example.com/jobs/2"
