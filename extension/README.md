# AI Career OS — Chrome Extension (M7)

Capture job text from the page you are viewing and send it into the **classify → parse → review → save → match** pipeline.

**Principles:** [docs/extension.md](../docs/extension.md) — source-agnostic DOM read, never fetch third-party URLs, user-initiated. We do not maintain per-site extractors; the backend LLM classifies and extracts.

## What it does

1. You open any page that shows a job posting.
2. Open the side panel and click **Capture job from this tab**.
3. Generic DOM text → `POST /jobs/classify-capture` (LLM: is this one job posting?) → if capturable, `POST /jobs/parse-text` → handoff → review in panel.
4. You confirm fields and **Save & analyze match** in the embedded React app.

If the page is a search-results list or unrelated content, the classifier returns a message (e.g. “open one job posting first”) — we do not guess from URL or site name.

We do not integrate with third-party job sites. We only read text already rendered in your active tab when you click capture.

## Build & load (development)

1. Start the backend (see root [README](../README.md)).
2. Build the UI into the extension:

   ```bash
   cd frontend && bun run build:extension
   ```

   Re-run after frontend changes.

3. Chrome → `chrome://extensions` → **Developer mode** → **Load unpacked** → this `extension/` folder.
4. **Settings:** API `http://127.0.0.1:8000` (only setting needed — UI is bundled).

After updating extension JS or rebuilding the UI, click **Reload** on `chrome://extensions`.

## UI surfaces

| Surface | Role |
|---------|------|
| **Toolbar icon** | Opens side panel (primary entry) |
| **Side panel** | Bundled React app — capture bar, pipeline, review, match, settings |
| **Options** | API base URL |

## Capture (DOM only, source-agnostic)

| Step | Behavior |
|------|----------|
| Read | `executeScript` on the active tab — generic visible text (no per-site selectors) |
| Classify | `POST /jobs/classify-capture` — backend LLM, not heuristics |
| Structure | If capturable, `POST /jobs/parse-text` |
| Review | Side panel handoff — nothing saved until you confirm |

**Paste job** in the side panel skips classification — user intent is explicit.

## API endpoints used (our backend only)

- `GET /health` — connectivity check
- `POST /api/v1/jobs/classify-capture`
- `POST /api/v1/jobs/parse-text`
- `POST /api/v1/jobs/intake-handoff`
- `GET /api/v1/jobs/by-url` (duplicate URL hint)
- `POST /api/v1/profiles/parse-text` (paste resume)

The extension **never** `fetch()`es external career-site URLs.
