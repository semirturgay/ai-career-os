from app.services.cover_letter_normalize import cap_cover_letter_body


def test_cap_cover_letter_body_unchanged_when_under_limit():
    text = "Dear Acme, I am excited to apply."
    assert cap_cover_letter_body(text) == text


def test_cap_cover_letter_body_truncates_at_word_boundary():
    text = "word " * 100
    capped = cap_cover_letter_body(text, max_chars=400)
    assert len(capped) <= 400
    assert not capped.endswith(" ")


def test_cap_cover_letter_body_prefers_sentence_boundary():
    text = (
        "First sentence is complete. "
        "Second sentence is also complete. "
        "Third sentence starts but never finishes because the model ran on"
    )
    capped = cap_cover_letter_body(text, max_chars=95)
    assert capped.endswith(".")
    assert "never finishes" not in capped


def test_normalize_cover_letter_result_payload_caps_body():
    from app.services.cover_letter_normalize import normalize_cover_letter_result_payload

    long_body = "A" * 500
    payload = normalize_cover_letter_result_payload({"body": long_body, "tone": "concise"})
    assert len(payload["body"]) <= 400
