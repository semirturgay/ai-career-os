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

## Scope notes

Two things are deliberately **outside** this policy. Neither is job intake, and neither
loads a page meant for human eyes.

### Company research

User-initiated web search for a company brief — not loading the stored job URL.

### Radar — public ATS APIs

Radar polls **public JSON endpoints that employers publish so job boards can syndicate their
listings** (Greenhouse, Lever, Ashby). Reading a syndication API is not scraping a careers
page. Every rationale behind the rules above still holds:

| Concern | Why it does not apply |
|---------|----------------------|
| Brittle per-site scrapers | One documented API per ATS, not per employer. No CSS selectors, no DOM heuristics |
| Impersonating the user | No cookies, no credentials, no session replay — these endpoints are unauthenticated |
| Risking the user's account | There is no account involved |
| Fetching pages meant for humans | These endpoints exist for machines; syndication is their stated purpose |

The line, stated plainly:

> **Agents read what is published for machines. The human reads what needs a login.**

So LinkedIn and Indeed stay fully supported — through **extension capture**, user-driven, on
a page the user has open. We do not automate them, and we do not export browser sessions to
act on the user's behalf. A headless-browser version of Radar was built and deleted for
exactly this reason; see [milestones/m7-radar.md](milestones/m7-radar.md).

Enforcement is mechanical: `tests/test_radar_policy.py` fails if `playwright` or
`cryptography` return to `pyproject.toml`, if the extension requests the `cookies` permission,
or if per-site host permissions reappear in the manifest.

## References

- [docs/extension.md](../docs/extension.md)
- [docs/vision.md](../docs/vision.md) — guiding principle #6

When adding intake features, ask: *“Does this read what the user already sees, or does it fetch a third-party page?”* If the latter, reject it.

## Source-agnostic capture

We do **not** integrate with, special-case, or maintain extractors for any job board or ATS.

| Layer | Responsibility |
|-------|------------------|
| **Extension** | Read generic visible text from the active tab (strip nav/footer noise only) |
| **Backend classifier** | Chunk visible text, classify each chunk, max-pool `job_post` score |
| **Backend LLM** | Extract structured fields from capturable job text (`POST /jobs/parse-text`) |

Capture validation is a **document classifier task** (`POST /jobs/classify-capture`); field extraction remains an **LLM task** (`POST /jobs/parse-text`) — not hostname rules, CSS selector maps, or heuristics about “what a job page looks like.”

Paste intake skips classification: the user explicitly provides job text.
