from app.schemas.job_capture import JobCaptureClassification
from app.services.document_classifier.page_classifier import classify_page_text
from app.services.intake_validation import job_capture_from_document


def classify_job_capture(
    text: str,
    *,
    page_title: str | None = None,
    page_url: str | None = None,
) -> JobCaptureClassification:
    del page_url
    classification = classify_page_text(text, page_title=page_title)
    page_type, is_capturable, user_message = job_capture_from_document(classification)
    return JobCaptureClassification(
        page_type=page_type,
        is_capturable=is_capturable,
        user_message=user_message,
    )
