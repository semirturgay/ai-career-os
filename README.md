# AI Career OS

[![CI](https://img.shields.io/github/actions/workflow/status/semirturgay/ai-career-os/ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white)](https://github.com/semirturgay/ai-career-os/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**An open-source AI operating system for career management** — starting with explainable job matching, not black-box auto-apply bots.

Capture jobs from your browser with the **Chrome extension** (source-agnostic DOM read — no per-site integrations; LLM classifies and extracts on our backend), or paste descriptions in the web app. Upload or paste your resume, extract structured profile data with an LLM you control, review everything, and get **automatic explainable match analysis** — then research the company, tune your resume, and draft a cover letter.

<p align="center">
  <img src="docs/assets/demo/demo.gif" alt="AI Career OS demo — job posting capture, profile setup with AI extract, and explainable match pipeline" width="640" />
</p>

<p align="center"><em>Job page + side panel: profile setup → resume extract → capture tab → match pipeline</em></p>

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Install checklist](#install-checklist-backend--extension)
- [Chrome extension](#chrome-extension)
- [Configuration](#configuration)
- [Local LLM setup (LM Studio)](#local-llm-setup-lm-studio)
- [Development](#development)
- [Project structure](#project-structure)
- [API overview](#api-overview)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Community](#community)

---

## Why this exists

Most career tools tell you *what* to do. This project focuses on **why** — structured LLM outputs, human review, and auditable match results.

Built as a learning-friendly codebase for developers who want to understand:

- Provider-agnostic LLM integration (cloud + local)
- Native structured outputs (JSON schema → Pydantic)
- Prompt versioning as plain files
- Human-in-the-loop before data is saved

Long-term vision: an autonomous career assistant that discovers jobs, explains fit with evidence, and helps you act — always with transparency. See [docs/vision.md](docs/vision.md).

**Intake policy:** job and resume content is **DOM or paste only** — we never fetch third-party job pages. See [docs/intake-policy.md](docs/intake-policy.md).

---

## Features

- **PDF resume ingestion** — deterministic text extraction with `pypdf`
- **LLM structured extraction** — skills, experience, education, projects into a typed schema
- **Bring your own model** — OpenAI, Anthropic, Groq, Mistral, Together, Azure OpenAI, NVIDIA NIM, or **local** (Ollama / LM Studio)
- **Model picker** — fetches available models from your provider
- **Human review** — edit extracted fields before saving (resume and job)
- **Job intake wizard** — paste description → extract → review → save with automatic match
- **Chrome extension (M7)** — source-agnostic capture from any page (generic DOM read); backend LLM classifies and extracts — no per-site heuristics
- **RAG-backed match** — retrieves relevant resume chunks before full analysis
- **Job pipeline** — home dashboard ranks jobs by match score with polling
- **Job detail tabs** — match, company research, resume optimization, cover letter (after full analysis)
- **Explainable match analysis** — score, strengths, gaps, and evidence-backed recommendations
- **Company research** — bounded agent loop over web search → source-grounded brief
- **Resume optimization** — gap-driven rewrite suggestions; apply to profile from job detail
- **Cover letter** — 3-pass chain (draft → critique → revise), max 400 characters
- **Export resume PDF** — download your profile as a formatted PDF
- **Re-analyze** — manual retry on job detail when profile or job changes
- **Version-controlled prompts** — prompts live in `app/prompts/`, not buried in code
- **Eval harness** — eight golden suites (resume, job, job capture classification, match, RAG retrieval, optimization, cover letter, research)

---

## How it works

```mermaid
flowchart LR
    subgraph intake [Job intake]
        X[Chrome extension] -->|DOM text| C[Classify + parse]
        C --> Y[Review]
        P[Paste in web app] --> Y
    end
    A[PDF or paste resume] --> B[pypdf / paste text]
    B --> C[LLM structured extraction]
    C --> D[Review and edit]
    D --> E[(Profile)]
    Y --> I[Save and analyze]
    E --> I
    I --> J[RAG + full match]
    J --> K[Pipeline + job detail tabs]
    K --> L[Research / Resume / Cover letter]
```

1. **Profile** — PDF upload or paste → LLM `ResumeExtraction` → review → save
2. **Add a job** — **extension capture** or paste → extract → review → save with `profile_id`
3. **Match analysis** — RAG retrieves resume evidence, then full `MatchResult` in background
4. **Job detail** — company research, resume tweaks, cover letter
5. **Home pipeline** — jobs ranked by score

**Intake policy:** job and resume content is **DOM or paste only** — we never fetch third-party job pages. See [docs/intake-policy.md](docs/intake-policy.md).

---

## Tech stack

| Layer | Technology |
|-------|------------|
| API | FastAPI (async) |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Validation | Pydantic v2 |
| PDF | pypdf |
| LLM client | httpx (OpenAI-compatible + structured output) |
| Frontend | Vite, React, TypeScript, Tailwind CSS |
| Extension | Chrome Manifest V3 (source-agnostic DOM capture, side panel) |
| Package managers | [uv](https://docs.astral.sh/uv/) (Python), [Bun](https://bun.sh) (frontend) |

---

## Quick start

**Goal:** backend API running in Docker + Chrome extension loaded in ~5 minutes.

| Step | Command / action | You should see |
|------|------------------|----------------|
| 1 | `git clone … && cp .env.example .env` | Project on disk |
| 2 | `docker compose up --build` | `Uvicorn running on http://0.0.0.0:8000` |
| 3 | Open http://127.0.0.1:8000/docs | Swagger UI |
| 4 | `cd frontend && bun install && bun run build:extension` | `extension/app/` populated |
| 5 | Load [`extension/`](extension/) in Chrome (see below) | Side panel opens |
| 6 | Extension **Settings** → API `http://127.0.0.1:8000` | Settings save |
| 7 | Pick AI provider + add resume | Pipeline home |

---

## Install checklist (backend + extension)

### A. Backend (Docker — recommended)

**Requires:** [Docker Desktop](https://docs.docker.com/get-docker/) (or Docker Engine + Compose v2)

```bash
git clone https://github.com/semirturgay/ai-career-os.git
cd ai-career-os
cp .env.example .env
docker compose up --build
```

Leave this terminal open (or add `-d` to run in the background).

| Service | URL | Notes |
|---------|-----|--------|
| API | http://127.0.0.1:8000 | Migrations run automatically on startup |
| API docs | http://127.0.0.1:8000/docs | Interactive OpenAPI |
| PostgreSQL | `127.0.0.1:5432` | User/db/password: `career` / `ai_career_os` / `career` |

**Useful commands**

```bash
docker compose up --build -d    # run in background
docker compose logs -f api      # tail API logs
docker compose down             # stop
docker compose down -v          # stop + wipe database
```

**Local LLM (LM Studio / Ollama) with Docker:** keep `http://127.0.0.1:1234/v1` in Settings — the API rewrites it to `host.docker.internal` automatically so it can reach your machine.

<details>
<summary>Alternative: run API on the host (Python dev)</summary>

```bash
docker compose up db -d
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Use `http://127.0.0.1:1234/v1` for LM Studio when the API runs on the host (no rewrite needed).

</details>

---

### B. Chrome extension

**Requires:** [Google Chrome](https://www.google.com/chrome/) + [Bun](https://bun.sh)

```bash
cd frontend
bun install
bun run build:extension
```

Then in Chrome:

1. Open **`chrome://extensions`**
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the **`extension/`** folder from this repo (not `extension/app/`)

<p align="center">
  <img src="docs/assets/demo/chrome-load-extension.png" alt="Load unpacked extension folder in Chrome" width="720" />
</p>

5. Pin the extension → open the **side panel**
6. Go to **Settings** (gear) → set API URL to **`http://127.0.0.1:8000`**
7. After frontend changes: re-run `bun run build:extension`, then click **Reload** on `chrome://extensions`

> **macOS:** Always use `127.0.0.1`, not `localhost`, for the API URL — avoids IPv6 hangs.

---

### C. First run

1. **Side panel** → onboarding → choose **Local** (LM Studio) or a cloud provider  
2. **Upload or paste resume** → review fields → save profile  
3. Open a **job posting** in a normal browser tab  
4. Side panel → **Capture job from this tab** → review → **Save & analyze match**  
5. **Pipeline** tab → open a job → match / research / resume / cover letter  

<p align="center">
  <img src="docs/assets/demo/extension-welcome.png" alt="Extension welcome screen" width="320" />
</p>

---

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `Could not connect to http://127.0.0.1:1234/v1` (Docker) | Start LM Studio server; keep URL as `127.0.0.1:1234` (auto-rewritten). Ensure LM Studio is listening. |
| API URL hangs / no response | Use `127.0.0.1`, not `localhost` |
| Extension shows blank panel | Re-run `bun run build:extension`, reload extension |
| `docker compose up` fails on port 5432 | Stop local Postgres or change the host port in `docker-compose.yml` |
| CORS / network errors from panel | Confirm API URL is `http://127.0.0.1:8000` (no trailing path) |

---

## Chrome extension

Capture job text from **whatever page you have open**. The extension reads generic visible text from the active tab — we do not integrate with or special-case any job board. Our backend LLM decides whether the capture is a single job posting and extracts structured fields (not hostname rules or DOM heuristics). We never fetch third-party URLs.

Policy: [docs/intake-policy.md](docs/intake-policy.md) · Architecture: [docs/extension.md](docs/extension.md) · Install details: [extension/README.md](extension/README.md)

### Install (development)

See [Install checklist (backend + extension)](#install-checklist-backend--extension) — sections **A** (Docker backend) and **B** (Chrome extension).

### Capture flow

```mermaid
sequenceDiagram
    participant User
    participant Tab as Job board tab
    participant Ext as Extension
    participant API as AI Career OS API
    participant App as Side panel (bundled React)

    User->>Tab: Opens job posting
    User->>Ext: Capture and review
    Ext->>Tab: Inject script read DOM
    Ext->>API: POST /jobs/classify-capture
    alt is_capturable
        Ext->>API: POST /jobs/parse-text
        Ext->>API: POST /jobs/intake-handoff
        Ext->>App: Open side panel → review route
        User->>App: Confirm fields Save and analyze
        API->>API: Background match analysis
    else not capturable
        Ext->>User: Show LLM message (e.g. open one job posting)
    end
```

1. Open a page that shows a job posting (make sure the full description is visible on screen).
2. Open the side panel and click **Capture job from this tab**.
3. Review extracted fields in the panel.
4. **Save & analyze match** — same human-in-the-loop flow as paste intake.

### How capture works

| Step | What happens |
|------|----------------|
| **Read DOM** | Inject script into the active tab; read generic visible text (no per-site selectors) |
| **Classify** | Backend LLM decides if this is one capturable job posting (`POST /jobs/classify-capture`) — not heuristics |
| **Structure** | If capturable, LLM extracts fields (`POST /jobs/parse-text` → `JobExtraction`) |
| **Review** | Hand off to side panel; you confirm before save |

We do **not** integrate with, fetch from, or maintain extractors for any third-party site. Paste intake skips classification — user intent is explicit.

### Extension API calls (our backend only)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/jobs/classify-capture` | LLM: is this a single job posting? |
| `POST /api/v1/jobs/parse-text` | Structure captured or pasted job text |
| `POST /api/v1/jobs/intake-handoff` | Hand off to web app review (30 min TTL) |
| `GET /api/v1/jobs/by-url` | Duplicate URL hint |

---

## Configuration

Environment variables (see [`.env.example`](.env.example)). With Docker, copy `.env` before `docker compose up` — compose loads it into the API container.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://career:career@127.0.0.1:5432/ai_career_os` | Async Postgres connection (overridden in Docker Compose to use the `db` service) |
| `OPENAI_API_KEY` | — | Optional fallback if not set in Settings UI |
| `ANTHROPIC_API_KEY` | — | Optional fallback |
| Other `*_API_KEY` | — | Provider-specific env fallbacks |

**API keys** entered in the Settings UI are stored server-side in PostgreSQL — never returned to the browser.

Provider and model selection is persisted in the `app_settings` singleton table.

---

## Local LLM setup (LM Studio)

1. Download a model (e.g. Qwen 3.5 9B)
2. Start the **OpenAI-compatible server** in LM Studio (default port `1234`)
3. In onboarding, select **Local** → **LM Studio** preset
4. Base URL: keep **`http://127.0.0.1:1234/v1`** in Settings — when the API runs in Docker it is rewritten automatically to reach your host (`host.docker.internal`). Use that URL directly only if you run the API on the host with `uv run`.
5. Pick your loaded model from the dropdown

Ollama: same preset with port `11434`. Docker rewrites local URLs automatically; on a host-native API use `http://127.0.0.1:11434/v1`.

Local models may return JSON with non-standard field names — the backend normalizes common variants before validation.

---

## Development

### Docker (default)

```bash
docker compose up --build        # API + Postgres, auto-migrations, hot reload on ./app
docker compose logs -f api
```

### Tests

```bash
uv sync
uv run pytest
```

Eval fixtures live in `tests/evals/fixtures/` — resume extraction, job extraction, match analysis, resume optimization, cover letter, and company research. CI runs golden-response checks on every push.

```bash
# Offline golden evals (no API key)
uv run python scripts/run_evals.py

# Optional live LLM evals (configured provider + Postgres)
RUN_LIVE_LLM=1 uv run python scripts/run_evals.py --live
```

See [docs/ai-engineering.md](docs/ai-engineering.md) for the full AI engineering guide.

### Lint

Fast Python linting with [Ruff](https://docs.astral.sh/ruff/) — covers pyflakes, isort import
sorting, pyupgrade, and bugbear in one tool (no separate pylint/isort install needed):

```bash
uv run ruff check app tests scripts alembic
uv run ruff format app tests scripts alembic          # auto-fix formatting
uv run ruff format --check app tests scripts alembic  # CI mode
```

### Pre-commit

Install git hooks to run ruff + tests before each commit:

```bash
uv sync
uv run pre-commit install
uv run pre-commit run --all-files   # verify setup
```

### Frontend build

```bash
cd frontend && bun run build
cd frontend && bun run build:extension   # Chrome extension bundle
```

### Refresh README demo assets

With the backend running and the extension UI built:

```bash
# Split-screen demo: job posting (left) + side panel (right)
# Resets demo data via Docker Postgres, mocks resume extract for the loading animation
npm install playwright @ffmpeg-installer/ffmpeg
npx playwright install chromium
node scripts/capture_readme_demo_gif.mjs

# Static screenshots (install checklist, API docs)
node scripts/capture_readme_demo.mjs
```

Writes `docs/assets/demo/demo.gif` and PNGs (requires `playwright`; GIF also needs `@ffmpeg-installer/ffmpeg`).

---

## Project structure

```
ai-career-os/
├── app/
│   ├── api/              # FastAPI routes (profiles, jobs, match_analyses, settings, llm)
│   ├── db/               # SQLAlchemy session
│   ├── models/           # ORM models
│   ├── prompts/          # Version-controlled LLM prompts (.txt)
│   ├── schemas/          # Pydantic models (API + LLM outputs)
│   └── services/
│       ├── llm/          # Provider abstraction + generate_structured()
│       ├── search/       # Web search (DuckDuckGo) + tracing
│       ├── rag/          # chunking, embeddings, pgvector retrieval
│       ├── match/        # analyzer, orchestrator, formatters
│       ├── job_intake_handoff.py  # Extension → web app handoff
│       └── …
├── extension/            # Chrome extension — source-agnostic DOM capture
├── frontend/             # Vite + React SPA
├── docs/                 # Architecture, intake policy, extension principles
├── alembic/
├── scripts/run_evals.py
└── tests/evals/
```

---

## API overview

Base path: `/api/v1`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/profiles/parse-resume` | Upload PDF → text + LLM structured extraction |
| POST | `/profiles/parse-text` | Paste resume text → LLM structured extraction |
| POST | `/profiles` | Create profile |
| GET | `/profiles` | List profiles |
| GET | `/profiles/{id}` | Get profile |
| PATCH | `/profiles/{id}` | Update profile |
| GET | `/profiles/{id}/resume.pdf` | Download profile as PDF |
| DELETE | `/profiles/{id}` | Delete profile |
| POST | `/jobs/classify-capture` | LLM: is captured text a single job posting? |
| POST | `/jobs/parse-text` | Paste or captured JD → structured `JobExtraction` |
| POST | `/jobs/intake-handoff` | Extension handoff → web app review screen |
| GET | `/jobs/intake-handoff/{id}` | Load a pending extension capture |
| GET | `/jobs/by-url` | Find an existing job by posting URL |
| POST | `/jobs` | Create job; optional `profile_id` queues match analysis |
| GET | `/jobs` | List jobs |
| GET | `/jobs/{id}` | Get job |
| PATCH | `/jobs/{id}` | Update job |
| DELETE | `/jobs/{id}` | Delete job |
| POST | `/jobs/{id}/company-research` | Agent loop → web search → company brief |
| POST | `/match-analyses` | Manual re-analyze (background LLM matcher) |
| POST | `/match-analyses/{id}/resume-optimization` | Gap-driven resume suggestions |
| POST | `/match-analyses/{id}/cover-letter` | 3-pass cover letter generation |
| GET | `/match-analyses/{id}` | Get analysis status + result |
| GET | `/match-analyses` | List analyses |
| GET | `/settings` | Get LLM provider config |
| PUT | `/settings` | Update LLM provider config |
| POST | `/llm/models` | List models from configured provider |
| GET | `/health` | Health check |

Full interactive docs: http://127.0.0.1:8000/docs

---

## Roadmap

| Milestone | Status | Description |
|-----------|--------|-------------|
| **M0** Resume extraction | Done | PDF → LLM structured output → review → save |
| **M1** Explain the match | Done | Evidence-based match analysis with eval harness |
| **M2** Job intake | Done | Paste JD → structured extraction → review |
| **M3** Match on job insert | Done | Full analysis automatically when a job is saved |
| **M4** Resume optimization | Done | Gap-driven suggestions with review before apply |
| **M5** Cover letter | Done | 3-pass cover letter chain on job detail |
| **M6** Company research | Done | Bounded agent loop + web search + source-grounded brief |
| **M7** Chrome extension | **In progress** | Source-agnostic DOM capture, LLM classify + extract, extension-first intake |
| — | Planned | Re-analyze on job update, production search providers |

Details: [docs/milestones/](docs/milestones/README.md) · Current state: [docs/project-status.md](docs/project-status.md)

### Design notes

- **JSONB first** for LLM output while schemas evolve; promote to relational tables when query patterns stabilize
- **No LangChain** — thin `LLMClient` protocol + httpx adapters
- **Prompts as files** — `app/prompts/*.txt`, loaded via `load_prompt()`

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/intake-policy.md](docs/intake-policy.md) | **DOM/paste only — source-agnostic, LLM classify** |
| [docs/extension.md](docs/extension.md) | Chrome extension principles and architecture |
| [extension/README.md](extension/README.md) | Load unpacked, capture flow, side panel |
| [docs/ai-engineering.md](docs/ai-engineering.md) | Evals, tracing, structured outputs, patterns |
| [docs/vision.md](docs/vision.md) | Long-term product vision |
| [docs/architecture.md](docs/architecture.md) | System design and data model |
| [docs/project-status.md](docs/project-status.md) | Current state and what's next |
| [docs/milestones/m6-company-research.md](docs/milestones/m6-company-research.md) | M6 agent loop + company brief |
| [docs/milestones/m5-progressive-match-cover-letter.md](docs/milestones/m5-progressive-match-cover-letter.md) | Cover letter milestone (historical) |
| [docs/milestones/m3-match-on-intake.md](docs/milestones/m3-match-on-intake.md) | Match on job save |
| [docs/milestones/README.md](docs/milestones/README.md) | Full roadmap |

---

## Contributing

Contributions welcome — see **[CONTRIBUTING.md](CONTRIBUTING.md)** for setup, PR
expectations, and areas where help is needed.

Quick checklist:

1. Fork the repo and branch from `main`
2. Run `uv run pytest` and `uv run ruff check app tests`
3. Open a pull request using the template

Please do not commit `.env` files or API keys.

---

## Community

| Resource | Description |
|----------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to set up, test, and submit changes |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards (Contributor Covenant) |
| [SECURITY.md](.github/SECURITY.md) | How to report vulnerabilities privately |
| [Issue templates](.github/ISSUE_TEMPLATE/) | Bug reports and feature requests |
| [PR template](.github/pull_request_template.md) | Pull request checklist |

---

## License

[MIT](LICENSE) — Copyright (c) 2026 Semir Turğay
