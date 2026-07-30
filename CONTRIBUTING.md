# Contributing to AI Career OS

Thank you for your interest in contributing. This project is built for learning
and transparency around LLM-powered career workflows — issues, docs, eval
fixtures, and code improvements are all welcome.

## Before you start

- Read the [README](README.md) for setup and architecture overview.
- Read [docs/intake-policy.md](docs/intake-policy.md) — **DOM/paste only; never fetch third-party job or resume pages.**
- Browse [docs/ai-engineering.md](docs/ai-engineering.md) for evals, prompts, and
  structured-output patterns.
- Check [open issues](https://github.com/semirturgay/ai-career-os/issues) to avoid
  duplicate work.

## Development setup

```bash
git clone https://github.com/semirturgay/ai-career-os.git
cd ai-career-os
cp .env.example .env
docker compose up db -d
uv sync
uv run alembic upgrade head
uv run pre-commit install
```

Backend: `uv run uvicorn app.main:app --reload`  
Frontend: `cd frontend && bun install && bun run dev` (requires backend running)

Use `127.0.0.1` instead of `localhost` for API and database URLs on macOS.

## How to contribute

### Report bugs

Open a [bug report](https://github.com/semirturgay/ai-career-os/issues/new?template=bug_report.yml)
with steps to reproduce, expected vs actual behavior, and environment details.

### Suggest features

Open a [feature request](https://github.com/semirturgay/ai-career-os/issues/new?template=feature_request.yml)
describing the problem, proposed solution, and alternatives considered.

### Submit code

1. Fork the repository and create a branch from `main`.
2. Make focused changes — one logical concern per pull request when possible.
3. Add or update tests for behavior you change.
4. Run checks locally:

   ```bash
   uv run pytest
   uv run ruff check app tests scripts alembic
   uv run ruff format app tests scripts alembic
   cd frontend && bun run build
   ```

5. Open a pull request using the [PR template](.github/pull_request_template.md).

## Areas we'd love help with

- **Eval quality** — resume/job fixtures, match assertions, regression cases
- **LLM providers** — native structured output adapters (Anthropic, Gemini)
- **RAG** — chunk caching, citation UI, retrieval quality
- **Search** — Tavily/Serper as configurable providers
- **Documentation** — clearer guides for local models and debugging

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body explaining why]
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`

Examples:

```
feat(matcher): add explainable match analysis with eval harness
docs(readme): update roadmap for completed M1
fix(api): poll match analysis until terminal status
```

## Pull request expectations

- Describe **what** changed and **why**.
- Link related issues (`Fixes #123`).
- Keep PRs reviewable — large refactors are easier to land in small steps.
- CI must pass (Ruff, pytest, OpenAPI typegen).

## Secrets and safety

- **Never commit** `.env`, API keys, or real resume/job data with PII.
- Use `.env.example` for documented variables only.
- If you find a security issue, follow [SECURITY.md](.github/SECURITY.md) — do not
  open a public issue.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By
participating, you agree to uphold it.

## Questions

Open a [GitHub Discussion](https://github.com/semirturgay/ai-career-os/discussions)
(if enabled) or a feature-request issue labeled `question` if you're unsure where
your change fits.
