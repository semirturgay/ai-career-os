from app.services.resume_paste_parser import prepare_resume_text


def test_prepare_resume_text_strips_html_and_keeps_content():
    raw = (
        """
    <div>
      <p>Jane Doe</p>
      <p>Senior Backend Engineer</p>
      <ul><li>Python</li><li>FastAPI</li></ul>
      <p>"""
        + ("Built APIs at scale. " * 8)
        + """</p>
    </div>
    """
    )
    text = prepare_resume_text(raw)
    assert "Jane Doe" in text
    assert "Senior Backend Engineer" in text
    assert "Python" in text
    assert "<div>" not in text
    assert len(text) >= 100


def test_prepare_resume_text_accepts_plain_text():
    raw = "Jane Doe\nEngineer\n" + ("Experience bullet point. " * 12)
    text = prepare_resume_text(raw.strip())
    assert text.startswith("Jane Doe")
    assert len(text) >= 100
