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
| 7 | Job discovery | Source-agnostic extension capture (DOM + LLM classify), paste resume | **In progress** |
| 8 | [Memory + feedback loop](m8-memory-feedback.md) | Structured feedback, career memory, prompt injection | **In progress** |
| 9 | Interview preparation | Multi-step planning, structured curricula | Planned |
| 10 | Application automation | Human-in-the-loop, guardrails | Planned |

Milestones 4–10 are directional. Each depends on eval results from the previous milestone.

### Archived experiments

| Doc | What it was | Outcome |
|-----|-------------|---------|
| [M3 batch matching (archived)](m3-batch-matching.md) | Bulk “Analyze all” with comparative LLM batching | Built, then **removed from product** — see [M3 match on intake](m3-match-on-intake.md) |

## M7 — Browser extension (in progress)

**Problem:** Users paste jobs one at a time; discovery should happen where they already browse.

**Direction:** Chrome extension reads generic visible text from the **active tab DOM only** — never fetches job URLs, no per-site extractors. Backend LLM classifies (single job posting?) then extracts → review → match. Side panel embeds the app; paste resume is primary onboarding.

See [extension.md](../extension.md) and [extension/README.md](../../extension/README.md).

See [m8-memory-feedback.md](m8-memory-feedback.md) for the active milestone.

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
