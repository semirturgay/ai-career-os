# Milestone 8: Memory + feedback loop

**Status:** In progress  
**Concepts:** Structured memory, user feedback capture, prompt context injection, eval-friendly audit trail

## Problem

Today the system **remembers facts** (profiles, jobs, match analyses, company briefs) but not **judgment**:

- A user may disagree with a gap (“I do have AWS — it’s in project X”).
- Match scores improve after resume tailoring, but the *reason* the user accepted or rejected a suggestion is lost.
- There is no durable record of application outcomes (applied, rejected, interview).
- Future match runs start from scratch — they do not learn from prior corrections on the same profile.

The vision doc calls for an agent that *remembers previous applications* and *learns from feedback*. M8 adds the **first explicit feedback + memory layer** without jumping to fine-tuning or agent frameworks.

## What we already have (not M8)

| Mechanism | Where | What it stores |
|-----------|--------|----------------|
| Match history | `match_analyses` table | Multiple analyses per job/profile |
| Resume tailoring progress | `job.raw_metadata.application_progress.resume` | Baseline score, remeasurement delta |
| Profile evolution | `profiles.structured_data` | User-applied resume suggestions |
| Company brief | `jobs.company_brief` | One-shot research snapshot |
| RAG chunks | `resume_chunk_embeddings` | Retrieval for match evidence |

M8 **extends** this with user-authored feedback and profile-level memory that downstream LLM tasks can read.

## M8 scope (phased)

We ship in three phases. Each phase is independently useful and has its own eval/acceptance criteria.

### Phase 1 — Capture feedback events

**Goal:** Persist structured user feedback with clear provenance.

**New entity:** `FeedbackEvent`

```python
FeedbackEvent
├── id: UUID
├── profile_id → Profile
├── job_id → Job | None          # optional — some feedback is global
├── match_analysis_id → MatchAnalysis | None
├── event_type: str              # see types below
├── payload: JSONB               # type-specific fields
├── created_at
```

**Event types (v1):**

| `event_type` | When | Example `payload` |
|--------------|------|-------------------|
| `match_helpful` | User rates match result | `{ "helpful": true }` |
| `gap_dispute` | User disagrees with a gap | `{ "gap_evidence": "...", "user_note": "Listed under Globex project" }` |
| `strength_confirm` | User confirms a strength | `{ "strength_evidence": "..." }` |
| `preference` | Profile-level preference | `{ "key": "work_mode", "value": "remote_only", "note": "..." }` |
| `application_outcome` | User updates job status | `{ "status": "applied", "note": "..." }` |

**API (v1):**

- `POST /api/v1/feedback` — create event
- `GET /api/v1/feedback?profile_id=…` — list for profile (newest first)
- `GET /api/v1/jobs/{id}/feedback` — list for a job

**UI (v1):**

- Match result panel: “Was this helpful?” + per-gap “Disagree” with optional note
- Job detail: application status dropdown (saved → applied → interviewing → rejected → offer → passed)

**Acceptance:** Feedback survives refresh; API returns typed events; unit tests for create/list.

---

### Phase 2 — Profile memory + prompt injection

**Goal:** Turn feedback into **retrieval-friendly memory** the matcher can use.

**New entity:** `CareerMemory` (or computed view — start with materialized snippets on Profile)

```python
# Option A: dedicated table (preferred for audit + eval)
CareerMemory
├── id: UUID
├── profile_id → Profile
├── category: str                # preference | correction | outcome_pattern
├── content: str                 # human-readable snippet for prompt injection
├── source_feedback_ids: JSONB   # lineage back to FeedbackEvent rows
├── active: bool
├── created_at, updated_at
```

**Service:** `memory/synthesizer.py`

- On new feedback (or batch job): distill `FeedbackEvent` rows → 1–3 sentence `CareerMemory` snippets.
- v1 can be **rule-based** (no extra LLM call): e.g. gap dispute → “User notes they have AWS experience (Globex project).”
- v2 (optional): LLM summarization when event volume grows.

**Prompt change:** `match_analysis.txt` gains a `{career_memory}` block — only injected when snippets exist.

**Acceptance:** Re-analyze after gap dispute shows memory in trace logs; golden eval fixture with memory context; memory does not override resume evidence (supplements only).

---

### Phase 3 — Pipeline intelligence

**Goal:** Use memory + outcomes in the **home pipeline**, not only match.

**Features:**

- Job `application_status` column (promoted from feedback events for query speed)
- Pipeline filters: Applied / Interviewing / Rejected
- “Similar past outcomes” hint on job detail (same company, same gap pattern) — read-only v1
- Cover letter + resume optimization prompts get `{career_memory}` block (same snippets)

**Acceptance:** Pipeline filter works; status change writes both `FeedbackEvent` and `Job.application_status`.

---

## Explicit non-goals (M8)

- Fine-tuning or embedding the feedback into model weights
- LangChain / vector “infinite memory” stores
- Automatic application without user action
- Cross-user learning (single-user local dev remains)
- Scraping or external calendar integration

## Eval strategy

| Phase | Eval |
|-------|------|
| 1 | API contract tests; fixture feedback rows |
| 2 | Golden match with `career_memory` fixture — assert gap dispute reduces false gap |
| 3 | Pipeline filter integration test |

Add `tests/evals/fixtures/match/with_career_memory/` when Phase 2 lands.

## Implementation order (step-by-step)

| Step | Deliverable | You review |
|------|-------------|------------|
| **1** | This milestone doc + roadmap updates | Done |
| **2** | Alembic migration + `FeedbackEvent` model + schemas | Done |
| **3** | `POST/GET /feedback` routes + tests | Done |
| **4** | Match panel feedback UI (helpful + gap dispute) | Done |
| **5** | Job application status UI + `application_outcome` events | Done |
| **6** | `CareerMemory` model + synthesizer + match prompt injection | AI behavior |
| **7** | Pipeline filters + job status column | Product polish |
| **8** | Golden eval + docs update in `project-status.md` | Quality gate |

## References

- [Vision — remember applications, learn from feedback](../vision.md)
- [Architecture — Feedback in inputs diagram](../architecture.md)
- [M4 resume optimization](m4-resume-optimization.md) — baseline/rematch tracking we extend
- [AI engineering](../ai-engineering.md) — prompt injection pattern
