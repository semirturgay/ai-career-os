# Chrome extension — product principles

The extension is the **primary intake surface** for AI Career OS (M7+). These rules are non‑negotiable.

> **We only read the DOM. We never fetch data from any third party for job or resume content.**

See also [intake-policy.md](intake-policy.md) (repo-wide).

## Capture policy

1. **No third-party fetch** — the extension must not `fetch()` any external career-site URL to load job or resume content. Not in the service worker, not in a hidden tab, not via a proxy.
2. **DOM only** — read text from the **active tab the user is viewing**, via `chrome.scripting.executeScript`. What you see is what we capture.
3. **Our API only** — network calls from the extension go to the configured AI Career OS backend (`apiBaseUrl`), never to job boards.
4. **User-initiated** — capture runs only when the user clicks **Capture** (or an explicit future action). No background crawling or passive harvesting.
5. **URL as metadata** — store `window.location.href` for dedupe and reference only. It is not a fetch target. Normalization (tracking params, stable ids) happens server-side — not in platform-specific extension code.

This extends the repo-wide rule in [vision.md](vision.md): *no job scraping*.

## Source-agnostic by design

We do **not** care which site the user is on. There are no per-platform extractors, hostname routers, or CSS selector maps for Greenhouse, LinkedIn, Wellfound, etc.

| Step | Who | How |
|------|-----|-----|
| Read visible text | Extension | Generic DOM read (`main` / `article` / `body`, strip chrome) |
| Is this one job posting? | Backend LLM | `POST /jobs/classify-capture` — **not** heuristics |
| Extract title, company, requirements | Backend LLM | `POST /jobs/parse-text` |

If the user is on a search-results page or unrelated tab, the classifier returns `is_capturable: false` with an actionable message (e.g. “open one job posting first”). We do not guess from URL or site name.

**Paste intake** (`POST /jobs/parse-text` from the side panel) skips classification — user intent is explicit.

## Capture flow

User opens a job posting in the browser, clicks **Capture job from this tab** in the side panel → visible DOM text → **`POST /jobs/classify-capture`** → **`POST /jobs/parse-text`** → handoff → review → save. Nothing is read or saved until the user clicks capture.

**Duplicate protection:** posting URLs are normalized server-side (tracking params stripped; stable ids when present) and matched via `GET /jobs/by-url`. Re-capturing the same URL skips parse/review and opens the existing job; saving on review returns `409` if the URL already exists.

## Resume intake (extension-first)

- **Primary:** paste resume text in the side panel → `POST /profiles/parse-text` → review → save.
- **Optional:** PDF upload (secondary).

Same human-in-the-loop pattern as job intake.

## Architecture direction

| Layer | Role |
|-------|------|
| **Side panel** | Full app UI (pipeline, match, research) + **Capture job from active tab** CTA |
| **Service worker** | Inject scripts on user capture, call **our** API only |
| **Backend** | LLM classify + structure, match, storage — unchanged |

Capture → classify → parse → review → save → match stays one pipeline; the extension replaces “open localhost tab” as the shell.

## Explicit non-goals

- Fetching job URLs in the background worker
- Opening hidden tabs to load postings
- Per-site / per-ATS DOM extractors or hostname-based capture routing
- Heuristic “job page detection” (list vs detail scoring, platform rules)
- Auto-applying or auto-saving without review
