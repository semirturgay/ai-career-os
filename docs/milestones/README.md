# Milestones

Incremental build plan. Each milestone adds one capability and is validated before moving on.

## Roadmap

| # | Milestone | AI concepts | Status |
|---|-----------|-------------|--------|
| 0 | Resume extraction | Structured outputs, human review | **Done** |
| 1 | [Explain the match](m1-explain-the-match.md) | Structured outputs, prompt engineering, evals | **Done** |
| 2 | [Job structuring from paste](m2-job-intake.md) | Structured outputs, prompt engineering | **Done** |
| 3 | [Match on job insert](m3-match-on-intake.md) | Background tasks, intake-time matching | **Done** |
| 4 | [Resume optimization](m4-resume-optimization.md) | Reflection, iterative refinement | **Done** |
| 5 | [Progressive match + cover letter](m5-progressive-match-cover-letter.md) | Staged inference, reflection chain | **Done** |
| 6 | [Company research](m6-company-research.md) | Bounded agent loop, web search | **Done** |
| 7 | [Radar — company watch](m7-radar.md) | Scheduled polling of public ATS APIs, two-tier screening | **Done** |
| 8 | [Memory + feedback loop](m8-memory-feedback.md) | Structured feedback, career memory, prompt injection | **Done** |
| 9 | Interview preparation | Multi-step planning, structured curricula | Planned |
| 10 | Application automation | Human-in-the-loop, guardrails | Planned |

Milestones 4–10 are directional. Each depends on eval results from the previous milestone.

### Archived experiments

| Doc | What it was | Outcome |
|-----|-------------|---------|
| [M3 batch matching (archived)](m3-batch-matching.md) | Bulk “Analyze all” with comparative LLM batching | Built, then **removed from product** — see [M3 match on intake](m3-match-on-intake.md) |
| [M7 browser discovery (archived)](m7-radar.md#the-first-attempt-and-why-it-was-abandoned) | Headless Chromium against LinkedIn/Indeed using exported session cookies | Built, then **deleted before shipping** — replaced by public ATS polling |

## M7 — Radar (done)

**Problem:** Every job in the pipeline arrives because the user found it. Discovery is the missing half.

**Direction:** The user puts companies on their radar; we poll each company's **public ATS board** (Greenhouse, Lever, Ashby) on a schedule. Postings arrive with full descriptions, get a cheap Tier-1 screen, and promote to a real `Job` with a full match analysis on one click.

The first attempt scraped LinkedIn and Indeed with a headless browser and exported cookies. It was deleted — see [m7-radar.md](m7-radar.md) for why, and for the alternatives considered.

Job **capture** remains the extension's job: source-agnostic DOM read of the active tab. See [extension.md](../extension.md) and [extension/README.md](../../extension/README.md).

## M8 — Memory + feedback loop (in progress)

## Milestone selection criteria

A milestone is ready to start when:

1. The previous milestone has a working eval harness
2. Eval results show where the current approach plateaus
3. The new concept solves a **measured** problem, not a hypothetical one

## Completed foundation

- [x] Project scaffolding (FastAPI, PostgreSQL, Alembic, Docker)
- [x] CRUD for Profile, Job, MatchAnalysis
- [x] Provider-agnostic LLM client (cloud + local)
- [x] Version-controlled prompts in `app/prompts/`
- [x] Eval harness with golden fixtures
