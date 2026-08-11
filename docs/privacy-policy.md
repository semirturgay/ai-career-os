# Privacy Policy — AI Career OS

**Last updated:** 11 August 2026

AI Career OS is open-source software you run yourself. There is no AI Career OS service,
no account, and no server operated by the developer. This policy describes what the
Chrome extension and the backend do with your data, and is written to be checkable
against the source rather than taken on trust.

## The short version

**The developer receives none of your data.** There is no analytics, no telemetry, no
crash reporting, and no remote endpoint belonging to this project. Your data goes to a
backend you run and, if you configure one, to the LLM provider you chose.

## What the extension handles

| Data | When | Where it goes |
|---|---|---|
| Visible text of a web page | Only when you click capture on that tab | Your backend, to classify and extract job fields |
| The page URL | With a capture | Your backend, stored as job metadata and used to detect duplicates |
| Your resume text and profile | When you upload or paste it | Your backend |
| Backend API URL | When you set it in Options | `chrome.storage.sync`, so it follows your Chrome profile |
| Current panel route | As you navigate the side panel | `chrome.storage.session`, cleared when Chrome closes |

The extension makes network requests to exactly one destination: the backend URL you
configure, which defaults to `http://127.0.0.1:8000` on your own machine. It never
fetches third-party job pages, and it never sends your data anywhere else.

## What it does not do

- **No background reading.** Page text is read only in response to you clicking capture,
  and only from the tab you are looking at.
- **No cookie or session access.** The extension does not request the `cookies`
  permission and cannot read your logins.
- **No per-site tracking.** There are no site-specific integrations and no list of sites
  you visit.
- **No selling or sharing.** There is no third party to share with.

## Permissions, and why each exists

| Permission | Why |
|---|---|
| `activeTab`, `scripting` | Read the visible text of the tab you capture from |
| `tabs` | Know which tab is active, so the panel captures the page you mean |
| `storage` | Remember your backend URL and the panel's current view |
| `sidePanel` | Provide the side panel interface |
| `host_permissions` for `localhost` / `127.0.0.1` on port 8000 | Talk to your own backend |
| `optional_host_permissions` | **Not granted at install.** The first time you capture on a site, Chrome asks for access to that one site. Decline and capture simply will not run there |

## Your backend, your data

Everything the extension sends is stored in a PostgreSQL database on the machine running
the backend. Deleting your data means deleting those rows, or the database:

```bash
docker compose down -v
```

There is no copy anywhere else.

## LLM providers

Structured extraction and analysis are performed by whichever provider you configure.

- **Local provider** (Ollama, LM Studio): your resume and job text never leave your
  machine. This is the default the project is built and tested around.
- **Cloud provider** (OpenAI, Anthropic, Google, Groq, Mistral, Together, Azure, NVIDIA):
  the relevant text is sent to that provider, and their privacy policy and data-retention
  terms apply to it. This is your choice, made explicitly in Settings.

API keys you enter are stored in your own database and are never returned to the browser.

## Radar and public job boards

If you use Radar, your backend requests job listings from the public, unauthenticated
board APIs published by Greenhouse, Lever, and Ashby. These requests contain no personal
data — only the board identifier you added. Those services see your backend's IP address,
as with any HTTP request.

## Children

Not directed at children under 13.

## Changes

Material changes will be recorded in this file, which is version-controlled, so the full
history is visible at
<https://github.com/semirturgay/ai-career-os/commits/main/docs/privacy-policy.md>.

## Contact

Open an issue at <https://github.com/semirturgay/ai-career-os/issues>, or email
semir.turgay@gmail.com.
