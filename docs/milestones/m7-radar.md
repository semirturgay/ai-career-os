# M7 — Radar (company watch)

**Status:** Done (MVP)

**Problem:** Every job in the pipeline arrives because the user found it. There is no
path where the product brings work *to* the user. Discovery is the missing half.

---

## What shipped

The user puts companies they'd want to work at on their radar. We resolve each to its
public ATS board and poll it on a schedule. New postings arrive with **full descriptions**,
get a cheap fit score, and promote to a real `Job` with a full `MatchAnalysis` on one click.

Nav `Radar` · route `/radar` · models `WatchedCompany` + `Posting` · package `app/services/radar/`.

```
scheduler tick (60s)
  └─ for each active company past its interval:
       claim (FOR UPDATE SKIP LOCKED)
       → AtsSource.fetch()          Greenhouse | Lever | Ashby — full JSON, keyless
       → Tier 0 criteria filter     free, structural
       → dedupe on (company, external_id)
       → Tier 1 screen              MatchDepth.SCREEN, capped, sequential
  user clicks "Add to pipeline"
       → structure_job() → Job → run_match_analysis()   Tier 2, existing path
```

---

## The first attempt, and why it was abandoned

The initial M7 discovery build drove **headless Chromium against LinkedIn and Indeed**
using session cookies exported from the user's browser by the extension. It was deleted
before shipping. Four independent problems, one root cause:

| Problem | Detail |
|---|---|
| **Scraping approach** | Playwright + replayed cookies + hardcoded CSS selectors, in a repo whose capture path is deliberately source-agnostic and *tested* to stay that way |
| **Candidates were a dead end** | Discovery emitted a URL and a ~15-word snippet. The intake policy forbids fetching that URL, so nothing could turn a candidate into a `Job`. It also invented a second `fit_score` from the snippet, undercutting the real `MatchAnalysis` |
| **Too much machinery** | Scheduler, interval enum, credential store, Fernet layer, extension `cookies` permission, Playwright — for a single-user local app |
| **Ignored what existed** | A second ReAct loop (orphaned, still imported via private names), a second scoring notion, no reuse of the classifier or `MatchDepth` |

**Root cause:** the feature picked the two sources on the internet with no public job API.
LinkedIn and Indeed *force* scraping, which forces credentials, which yields only URLs,
which forces a shadow data model. Changing the source collapsed all four at once.

Bugs found while diagnosing, now moot: the `add_init_script` localStorage injection was a
silent no-op (a bare arrow function was created and discarded); Indeed was never queried
because LinkedIn always filled the 8-slot pool first; a crashed run left `status='running'`
forever with no reaper; and default-install cookie encryption derived its Fernet key from
`settings.database_url` — the published default string, identical on every install.

Before that, `74fdc49` shipped JSearch via RapidAPI and it was reverted the next day.
Two reversals in a row with no design doc is what this document exists to stop.

---

## Alternatives considered

| Option | Why not |
|---|---|
| **Aggregator-first** (Adzuna, Jooble) | Works from a query alone with no bootstrapping problem, and stays the natural next tier. Rejected for the MVP because keyed APIs reintroduce credential management and return far noisier results than a board the user explicitly chose |
| **Extension-driven scheduling** (`chrome.alarms` + a real tab) | Solves anti-bot completely — it *is* the user's browser — but only runs while Chrome is open, and still opens a background tab, so it needs the same policy carve-out for strictly less capability |
| **Server browser, source-agnostic** (Playwright + the existing classifier instead of CSS selectors) | Self-healing and philosophically consistent, but keeps every Docker, anti-bot, and cookie problem |
| **On-demand only** (score the job-list page the user is already on) | Genuinely attractive and reuses the `job_list` classifier label — but gives up unattended monitoring, which is the point of the feature |
| **Keep Discover as a web-search feature** | Search results are URLs and snippets. That is the dead end we started from |

---

## Why ATS APIs are consistent with the intake policy

`docs/intake-policy.md` forbids fetching third-party job pages. Radar polls **public JSON
endpoints that employers publish specifically so job boards can syndicate their listings**.
Every rationale behind the policy is satisfied:

- *No brittle per-site scrapers* — one documented API per ATS, not per employer, and no CSS
- *No impersonating the user* — no cookies, no credentials, no session replay
- *No risking the user's account* — nothing is authenticated
- *No fetching pages meant for human eyes* — these endpoints exist for machines

The line, stated plainly: **agents read what is published for machines; the human reads what
needs a login.** LinkedIn and Indeed remain fully supported through extension capture — they
just stay user-driven. The policy carries this as an explicit third carve-out, alongside
company research.

---

## Design decisions

**`Posting` is not a shadow `Job`.** A `Posting` is what an ATS advertises; a `Job` is what
the user commits to. Keeping them distinct means a company with 200 open roles doesn't flood
a pipeline meant to hold things you're actually working on. Because the posting stores the
full description, promotion is a purely local operation.

**Extraction happens at promotion, not at poll time.** A routine poll of 30 companies costs
close to zero tokens beyond Tier-1 screening.

**Screening is capped and sequential.** `m3-batch-matching.md` records that comparative batch
matching was built and removed for timing out at 10 JDs. Tier 1 uses a small prompt
(`posting_screen.txt`, ~1.5k chars of description), runs one posting at a time, caps at
`radar_screen_limit_per_poll`, and treats a single failure as non-fatal — the posting stays
`new` and is retried next poll.

**Dedupe on the ATS id, not the URL.** `(watched_company_id, external_id)` is a stable
natural key. URL normalization was always a guess.

**Resolution is user-confirmed.** Three tiers — pasted URL, slug probe, web-search fallback —
but the candidate board is always shown for confirmation before anything is saved, matching
the human-review pattern used everywhere else in the product.

**The scheduler stayed in-process.** For a single-user local app a queue is more machinery
than the problem needs. It gained the four things the old one lacked: `FOR UPDATE SKIP LOCKED`
claims, retained task references, a concurrency cap, and a stale-claim reaper.

---

## Evals

`posting_screen` golden suite (`tests/evals/`), registered in `EVAL_SUITES`. Two cases: a
strong backend fit and a seniority mismatch. Assertions are behavioral — score bands, a
reason that names a concrete signal rather than "good match", and a length cap.

Registering it also surfaced that `job_capture_classification` and `resume_paste` had never
been added to the runner, so the README's "eight suites" only ran as seven. There are now ten,
and `test_radar_policy.py` fails if a suite exists on disk without being registered.

---

## Follow-ups

- Workable, SmartRecruiters, and Recruitee sources (additive behind `AtsSource`)
- Aggregator tier for companies with no public ATS board
- Per-company criteria editing in the UI (the model and API already carry it)
- Auto-promote above a score threshold, as an opt-in setting
