# Job & resume intake — DOM / paste only

**We only read the DOM. We never fetch data from any third party for job or resume content.**

This applies to the Chrome extension, backend job/resume intake, and any future intake path.

## Allowed

- Read text from the **active browser tab** the user is viewing (content script / `executeScript`)
- User **paste** of job description or resume text
- User **PDF upload** (local file → pypdf on our server — not a URL fetch)
- Call **our API** from the extension (`apiBaseUrl` only)
- Store job `url` as **metadata** for dedupe (query our DB via `GET /jobs/by-url` — not fetch the URL)

## Forbidden

- `fetch()`, `httpx`, or hidden tabs to load any third-party job or careers page URL
- Background crawlers, scrapers, or “import from URL” features for job postings
- Proxy services that fetch job pages on the user’s behalf
- Prefetching job content when the user has not opened that page

## Scope note

**Company research** is separate: user-initiated web search for a company brief (not loading the stored job URL). Do not conflate with job intake.

## References

- [docs/extension.md](../docs/extension.md)
- [docs/vision.md](../docs/vision.md) — guiding principle #6

When adding intake features, ask: *“Does this read what the user already sees, or does it fetch a third-party page?”* If the latter, reject it.

## Source-agnostic capture

We do **not** integrate with, special-case, or maintain extractors for any job board or ATS (LinkedIn, Greenhouse, Wellfound, Lever, etc.).

| Layer | Responsibility |
|-------|------------------|
| **Extension** | Read generic visible text from the active tab (strip nav/footer noise only) |
| **Backend LLM** | Classify whether the capture is a single job posting; extract structured fields |

Capture validation and field extraction are **LLM tasks** (`POST /jobs/classify-capture`, `POST /jobs/parse-text`) — not hostname rules, CSS selector maps, or heuristics about “what a job page looks like.”

Paste intake skips classification: the user explicitly provides job text.
