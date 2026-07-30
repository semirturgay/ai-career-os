# AI Career OS — Chrome Extension (M7)

Capture job text from the page you are viewing and send it into the **parse → review → save → match** pipeline.

**Principles:** [docs/extension.md](../docs/extension.md) — DOM-only capture, never fetch third-party URLs, user-initiated.

## What it does

1. You open any page that shows a job posting.
2. Open the side panel and click **Capture job from this tab**.
3. DOM text → `POST /jobs/parse-text` → handoff → review in panel.
4. You confirm fields and **Save & analyze match** in the embedded React app.

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

## Capture (DOM only)

| Step | Behavior |
|------|----------|
| Read | `executeScript` on the active tab — visible text from the page |
| Structure | Our API only — `POST /jobs/parse-text` |
| Review | Side panel handoff — nothing saved until you confirm |

## API endpoints used (our backend only)

- `GET /health` — connectivity check
- `POST /api/v1/jobs/parse-text`
- `POST /api/v1/jobs/intake-handoff`
- `GET /api/v1/jobs/by-url` (duplicate URL hint)

The extension **never** `fetch()`es external career-site URLs.

## Coming next

- Paste resume intake in side panel (`POST /profiles/parse-text`)
