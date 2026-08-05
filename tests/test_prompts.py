from app.prompts.loader import load_prompt


def test_load_resume_extraction_prompt():
    prompt = load_prompt("resume_extraction")
    assert "ResumeExtraction schema" in prompt
    assert '"experience"' in prompt
    assert "experience_items" in prompt


def test_load_match_analysis_prompt():
    prompt = load_prompt("match_analysis")
    assert "MatchAnalysis JSON object" in prompt
    assert '"recommendation"' in prompt
    assert "Never hallucinate" in prompt


def test_load_resume_optimization_prompt():
    prompt = load_prompt("resume_optimization")
    assert "suggestions" in prompt
    assert "NEVER invent" in prompt


def test_load_cover_letter_prompts():
    assert "400 characters" in load_prompt("cover_letter_draft").casefold()
    assert "400 characters" in load_prompt("cover_letter_revise").casefold()
    assert "editor" in load_prompt("cover_letter_critique").casefold()


def test_load_company_research_prompts():
    assert "action" in load_prompt("company_research_agent")
    assert "search results" in load_prompt("company_research_synthesize").casefold()


def test_load_job_extraction_prompt():
    prompt = load_prompt("job_extraction")
    assert "JobExtractionLLM schema" in prompt
    assert '"requirements"' in prompt
    assert "Never invent" in prompt
