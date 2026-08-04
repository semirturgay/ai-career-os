from app.schemas.job_extraction import JobExtraction


def test_job_extraction_schema_emits_metadata_before_description():
    """JSON-schema models often generate keys in schema order; location must come early."""
    schema = JobExtraction.model_json_schema()
    keys = list(schema["properties"].keys())
    description_idx = keys.index("description")
    for field in ("work_mode", "location", "employment_type"):
        assert keys.index(field) < description_idx, f"{field} should precede description in schema"


def test_job_extraction_schema_location_has_geographic_description():
    schema = JobExtraction.model_json_schema()
    location = schema["properties"]["location"]
    assert "description" in location
    assert "Geographic" in location["description"]
