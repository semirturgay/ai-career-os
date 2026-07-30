# AI Career OS — Chrome Extension (M7)

Capture job text from the page you are viewing and send it into the **parse → review → save → match** pipeline.

**Principles:** [docs/extension.md](../docs/extension.md) — DOM-only capture, never fetch third-party URLs, user-initiated, auto-detect job pages.

## What it does

1. You open any page that shows a job posting.
2. The extension **auto-detects** if the page looks like a job post (URL + DOM — no network fetch).
3. Click **Capture & review** → DOM text → `POST /jobs/parse-text` → handoff → web app review.
4. You confirm fields and **Save & analyze match**.

We do not integrate with third-party job sites. We only read text already rendered in your active tab.

## Load unpacked (development)

1. Start the backend and frontend (see root [README](../README.md)).
2. Chrome → `chrome://extensions` → **Developer mode** → **Load unpacked** → this `extension/` folder.
3. **Settings:** API `http://127.0.0.1:8000`, app `http://localhost:5173`.

## Capture (DOM only)

| Step | Behavior |
|------|----------|
| Read | `executeScript` on the active tab — visible text from the page |
| Detect | URL + DOM heuristics (`detectJobPage`) |
| Structure | Our API only — `POST /jobs/parse-text` |
| Review | Web app handoff — nothing saved until you confirm |

If capture fails on an already-open tab, **refresh the page** after loading/updating the extension.

## API endpoints used (our backend only)

- `POST /api/v1/jobs/parse-text`
- `POST /api/v1/jobs/intake-handoff`
- `GET /api/v1/jobs/by-url` (duplicate URL hint)

The extension **never** `fetch()`es external career-site URLs.

## Next steps

- [ ] Side panel with embedded React app
- [ ] Paste resume intake (`POST /profiles/parse-text`)
- [ ] Capture opens side panel instead of localhost tab
