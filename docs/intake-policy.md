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
