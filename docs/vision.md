# Vision

## What we're building

An **autonomous AI Career Agent** — not another auto-apply bot.

It should behave like an intelligent career assistant that can:

- Discover jobs
- Understand job descriptions
- Understand your experience
- Research companies
- Score opportunities
- Explain **why** a job is or isn't a match
- Optimize resumes
- Generate cover letters
- Prepare interview plans
- Remember previous applications
- Learn from feedback
- Eventually automate applications with human approval

## Long-term vision

An **AI Operating System for career management**.

## What this is NOT

- Not a "spray and pray" auto-applier
- Not a resume template generator with AI slapped on
- Not an agent framework demo project

The core differentiator is **explainable, evidence-based career decisions** — the system tells you *why*, not just *what*.

## Target user

Developers building their own career agent, and eventually job seekers who want an intelligent assistant rather than a black-box bot.

## Open source intent

This repository should be educational. Thousands of developers may read it. Code and documentation should explain **why**, not just **what**.

## Guiding principles

1. **Incremental complexity** — add capabilities only when simpler approaches plateau
2. **Eval-driven** — measure before adding architecture
3. **Human-in-the-loop** — especially for career decisions with real consequences
4. **Production-ready patterns** — clean architecture, observability, testability
5. **No premature abstraction** — prove the simple path first
6. **No third-party fetch for intake** — job and resume content come from **DOM or paste only** ([intake policy](intake-policy.md)). URLs are metadata, never fetched. The [Chrome extension](extension.md) reads the active tab; the backend does not load job posting URLs.

## Current product (M3)

The shipped loop focuses on **explainable matching at job intake**:

1. Upload resume → structured profile with human review
2. Paste job → extract fields → save triggers **automatic full match analysis**
3. Home pipeline ranks opportunities; job detail shows score, strengths, gaps, and evidence

Bulk batch matching was built and removed — one job at a time is the primary workflow. See [project-status.md](project-status.md).

**Next capability:** resume optimization — turn match gaps into actionable improvements (M4).
