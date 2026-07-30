# AI Career OS

[![CI](https://img.shields.io/github/actions/workflow/status/semirturgay/ai-career-os/ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white)](https://github.com/semirturgay/ai-career-os/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**An open-source AI operating system for career management** — starting with explainable job matching, not black-box auto-apply bots.

Capture jobs from your browser with the **Chrome extension** (DOM-only — never fetches third-party URLs), or paste descriptions in the web app. Upload or paste your resume, extract structured profile data with an LLM you control, review everything, and get **automatic explainable match analysis** — then research the company, tune your resume, and draft a cover letter.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
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
- **Chrome extension (M7)** — capture job postings from the page you’re viewing (Greenhouse, Lever, LinkedIn, or generic); auto-detect job pages; review in app
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
- **Eval harness** — seven golden suites (resume, job, match, RAG retrieval, optimization, cover letter, research)

---

## How it works

```mermaid
flowchart LR
    subgraph intake [Job intake]
        X[Chrome extension] -->|DOM text| Y[Parse + review]
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
| Extension | Chrome Manifest V3 (DOM capture, side panel planned) |
| Package managers | [uv](https://docs.astral.sh/uv/) (Python), [Bun](https://bun.sh) (frontend) |

---

## Quick start

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Docker (for PostgreSQL)
- Node.js 20+ and [Bun](https://bun.sh) (frontend)
- An LLM provider — cloud API key **or** local LM Studio / Ollama

### 1. Clone and configure

```bash
git clone https://github.com/semirturgay/ai-career-os.git
cd ai-career-os
cp .env.example .env
```

### 2. Start PostgreSQL

```bash
docker compose up db -d
```

### 3. Backend

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

API: http://127.0.0.1:8000  
OpenAPI docs: http://127.0.0.1:8000/docs

### 4. Frontend

Start the backend first (step 3), then:

```bash
cd frontend
bun install
bun run dev
```

`bun run dev` fetches `http://127.0.0.1:8000/openapi.json` and writes gitignored `src/types/api.generated.ts`. Hand-maintained types in `types.ts` remain the default in app code.

App: http://127.0.0.1:5173

### 5. First run

1. Open the app → choose **Local** (LM Studio) or a cloud provider
2. Upload a PDF resume
3. Wait for extraction (local models can take 30–60s)
4. Review structured fields → save profile
5. Add a job — **Chrome extension capture** (see below) or paste in app → review → **Save & analyze match**
6. View ranked pipeline on home; open job detail for match, research, resume, cover letter

> **Note:** Use `127.0.0.1` instead of `localhost` for API URLs on macOS — the Vite proxy and DB URL are configured this way to avoid IPv6 hangs.

### Fresh database / reset migrations

PostgreSQL runs with **pgvector** (`pgvector/pgvector:pg16`) for resume embedding search.
If you had an older dev database or plain `postgres:16` image:

```bash
docker compose down -v
docker compose up db -d
uv run alembic upgrade head
```

---

## Chrome extension

Capture jobs where you already browse them — LinkedIn, Greenhouse, Lever, or any careers page. The extension reads the **active tab DOM only**; it never `fetch()`es job board URLs.

Policy: [docs/intake-policy.md](docs/intake-policy.md) · Architecture: [docs/extension.md](docs/extension.md) · Install details: [extension/README.md](extension/README.md)

### Install (development)

1. Complete [Quick start](#quick-start) steps 1–4 (backend + frontend running).
2. Chrome → `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → select the [`extension/`](extension/) folder.
4. Open extension **Settings** → API `http://127.0.0.1:8000`, app `http://localhost:5173`.

### Capture flow

```mermaid
sequenceDiagram
    participant User
    participant Tab as Job board tab
    participant Ext as Extension
    participant API as AI Career OS API
    participant App as Web app review

    User->>Tab: Opens job posting
    User->>Ext: Capture and review
    Ext->>Tab: Inject script read DOM
    Ext->>API: POST /jobs/parse-text
    Ext->>API: POST /jobs/intake-handoff
    Ext->>App: Open /jobs/new/review?handoff=…
    User->>App: Confirm fields Save and analyze
    API->>API: Background match analysis
```

1. Open a job posting (on LinkedIn search, **click a job** so the detail panel is visible).
2. Extension popup → **likely job posting** detection (URL + DOM — no third-party fetch).
3. **Capture & review** → opens web app review with extracted fields.
4. **Save & analyze match** — same human-in-the-loop flow as paste intake.

### Supported boards

| Source | Notes |
|--------|--------|
| **Greenhouse** | `*.greenhouse.io` |
| **Lever** | `*.lever.co` |
| **LinkedIn** | Search detail panel or `/jobs/view/{id}` |
| **Other** | Generic main-content fallback |

### Extension API calls (our backend only)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/jobs/parse-text` | Structure captured DOM text |
| `POST /api/v1/jobs/intake-handoff` | Hand off to web app review (30 min TTL) |
| `GET /api/v1/jobs/by-url` | Duplicate URL hint |

### Coming next

- Side panel with embedded React app (extension as primary UI)
- Paste resume intake in extension
- Capture opens side panel instead of a new tab

---

## Configuration

Environment variables (see [`.env.example`](.env.example)):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://career:career@127.0.0.1:5432/ai_career_os` | Async Postgres connection |
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
4. Base URL: `http://127.0.0.1:1234/v1`
5. Pick your loaded model from the dropdown

Ollama works the same way with the Ollama preset (`http://127.0.0.1:11434/v1`).

Local models may return JSON with non-standard field names — the backend normalizes common variants before validation.

---

## Development

### Tests

```bash
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
```

### Docker (API + DB)

```bash
docker compose up --build
```

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
├── extension/            # Chrome extension — DOM capture, job board adapters
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
| POST | `/profiles` | Create profile |
| GET | `/profiles` | List profiles |
| GET | `/profiles/{id}` | Get profile |
| PATCH | `/profiles/{id}` | Update profile |
| GET | `/profiles/{id}/resume.pdf` | Download profile as PDF |
| DELETE | `/profiles/{id}` | Delete profile |
| POST | `/jobs/parse-text` | Paste JD → structured `JobExtraction` |
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
| **M7** Chrome extension | **In progress** | DOM-only job capture, auto-detect, extension-first intake |
| — | Planned | Side panel UI, paste resume, LinkedIn/Ashby polish |

Details: [docs/milestones/](docs/milestones/README.md) · Current state: [docs/project-status.md](docs/project-status.md)

### Design notes

- **JSONB first** for LLM output while schemas evolve; promote to relational tables when query patterns stabilize
- **No LangChain** — thin `LLMClient` protocol + httpx adapters
- **Prompts as files** — `app/prompts/*.txt`, loaded via `load_prompt()`

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/intake-policy.md](docs/intake-policy.md) | **DOM/paste only — no third-party job fetch** |
| [docs/extension.md](docs/extension.md) | Chrome extension principles and architecture |
| [extension/README.md](extension/README.md) | Load unpacked, capture flow, supported boards |
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
