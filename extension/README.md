# AI Career OS — Chrome Extension (M7)

Capture job postings from your browser and send them into the **parse → review → save → match** pipeline.

**Principles:** [docs/extension.md](../docs/extension.md) — DOM-only capture, never fetch job URLs, user-initiated, auto-detect job pages.

## What it does

1. You browse a job posting (Greenhouse, Lever, LinkedIn, or any page).
2. The extension **auto-detects** if the page looks like a job post (URL + DOM — no network fetch to the job site).
3. Click **Capture & review** → DOM text → `POST /jobs/parse-text` → handoff → web app review.
4. You confirm fields and **Save & analyze match**.

## Load unpacked (development)

1. Start the backend and frontend:

```bash
docker compose up db -d
uv run alembic upgrade head
uv run uvicorn app.main:app --reload

cd frontend && npm run dev
```

2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select this `extension/` folder
5. Open extension **Settings** and confirm:
   - API: `http://127.0.0.1:8000`
   - App: `http://localhost:5173`

## Supported capture (DOM adapters)

| Source | Detection | Notes |
|--------|-----------|-------|
| Greenhouse | `*.greenhouse.io` | Title, company, description selectors |
| Lever | `*.lever.co` | Posting headline + content |
| LinkedIn | `linkedin.com/jobs/*` | Job detail panel on search results or `/jobs/view/{id}` |
| Other sites | Generic fallback | Main content text + page title |

If capture fails on an already-open tab, **refresh the page** after loading/updating the extension.

## API endpoints used (our backend only)

- `POST /api/v1/jobs/parse-text`
- `POST /api/v1/jobs/intake-handoff`
- `GET /api/v1/jobs/by-url` (duplicate URL hint)

The extension **never** `fetch()`es job board URLs — only our API.

## Next steps

- [ ] Side panel with embedded React app
- [ ] Paste resume intake (`POST /profiles/parse-text`)
- [ ] Ashby adapter
- [ ] Capture opens side panel instead of localhost tab
