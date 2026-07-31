#!/usr/bin/env node
/**
 * Record a split-screen README demo (job page + side panel) → docs/assets/demo/demo.gif
 *
 * Flow: welcome → AI setup → resume paste + extract animation → review → save profile
 *       → capture tab suction animation → job review → pipeline
 *
 * Prerequisites:
 *   docker compose up --build -d
 *   cd frontend && bun run build:extension
 *   npm install playwright @ffmpeg-installer/ffmpeg
 *   npx playwright install chromium
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const require = createRequire(import.meta.url);
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/assets/demo");
const appDir = join(root, "extension/app");
const demoDir = join(root, "docs/assets/demo");
const port = 8765;
const apiBase = "http://127.0.0.1:8000/api/v1";
const gifOut = join(outDir, "demo.gif");
const frameUrl = `http://127.0.0.1:${port}/demo/demo-frame.html`;

const VIEWPORT = { width: 1200, height: 780 };

/** Demo pacing — settings actions readable; loading animations ~3s each. */
const TIMING = {
  welcomeHoldMs: 1400,
  aiProviderHoldMs: 1800,
  aiSelectHoldMs: 900,
  aiLmStudioHoldMs: 1100,
  aiContinueHoldMs: 700,
  uploadHoldMs: 600,
  reviewHoldMs: 1400,
  jobReviewHoldMs: 1600,
  loadingHoldMs: 2800,
  resumeExtractMockMs: 3200,
  captureMockMs: 3200,
  matchSaveDelayMs: 3200,
  matchResultHoldMs: 2200,
  matchEvidenceHoldMs: 1800,
};

const MOCK_MATCH_RESULT = {
  depth: "full",
  score: 88.5,
  recommendation: "apply",
  strengths: [
    {
      point: 9.5,
      evidence:
        "8 years of backend engineering experience with Python, FastAPI, and PostgreSQL across Acme Corp and Globex Inc.",
    },
    {
      point: 9.2,
      evidence:
        "Designed REST and GraphQL APIs and led a migration to FastAPI microservices at Acme Corp.",
    },
    {
      point: 8.8,
      evidence: "Demonstrated CI/CD experience through GitHub Actions pipelines at Globex Inc.",
    },
  ],
  gaps: [
    {
      point: 4.5,
      severity: "medium",
      evidence:
        "AWS experience is listed as nice-to-have in the job description but is not explicitly mentioned in the resume.",
    },
    {
      point: 3.0,
      severity: "low",
      evidence: "Kubernetes production experience is not explicitly listed in the resume.",
    },
  ],
  summary:
    "Jane Doe is a strong match for this Senior Backend Engineer role. Her Python, FastAPI, PostgreSQL, and API design experience align closely with the core requirements. The main gaps are optional cloud infrastructure technologies that are not explicitly mentioned. Overall, she should apply.",
};

/** Shared state between Playwright routes and the recording flow. */
const demoCaptureState = { lastCreatedJobId: null, demoMatchAnalysis: null };

const DEMO_RESUME_TEXT = `Jane Doe
Senior Backend Engineer | Python, FastAPI, PostgreSQL
jane.doe@example.com · +1 555 010 2000

Summary
Backend engineer with 8 years building APIs and data services for product teams.

Skills
Python, FastAPI, PostgreSQL, Docker, REST APIs, system design

Experience
Acme Corp — Senior Backend Engineer (2020 - Present)
- Designed REST and GraphQL APIs serving 2M daily requests.
- Led migration from monolith to FastAPI microservices.
- Improved p95 latency by 40% through query optimization.

Globex Inc — Software Engineer (2016 - 2019)
- Built internal tooling in Python and PostgreSQL.
- Introduced CI/CD pipelines with GitHub Actions.

Education
State University — B.S. Computer Science (2012 - 2016)`;

const MOCK_RESUME_PARSE = {
  name: "Jane Doe",
  headline: "Senior Backend Engineer | Python, FastAPI, PostgreSQL",
  resume_text: DEMO_RESUME_TEXT,
  structured_data: {
    name: "Jane Doe",
    headline: "Senior Backend Engineer | Python, FastAPI, PostgreSQL",
    email: "jane.doe@example.com",
    phone: "+1 555 010 2000",
    skills: ["Python", "FastAPI", "PostgreSQL", "Docker", "REST APIs"],
    experience: [
      {
        title: "Senior Backend Engineer",
        company: "Acme Corp",
        duration: "January 2020 - Present",
        highlights: [
          "Designed REST and GraphQL APIs serving 2M daily requests.",
          "Led migration from monolith to FastAPI microservices.",
        ],
      },
      {
        title: "Software Engineer",
        company: "Globex Inc",
        duration: "June 2016 - December 2019",
        highlights: ["Built internal tooling in Python and PostgreSQL."],
      },
    ],
    education: [
      {
        degree: "B.S. Computer Science",
        school: "State University",
        duration: "2012 - 2016",
        highlights: [],
      },
    ],
    projects: [],
  },
};

const MOCK_JOB_EXTRACTION = {
  title: "Senior Backend Engineer",
  company: "RandomishLabs",
  work_mode: "remote",
  location: "Remote",
  match_summary:
    "Senior backend role building Python payment APIs at scale for a global financial platform.",
  description:
    "We are looking for a Senior Backend Engineer to build high-scale payment APIs for our global financial platform. You will design services in Python, collaborate with product teams, and own production systems end to end.",
  employment_type: "full-time",
  salary_range: null,
  requirements: [
    "5+ years of professional Python experience",
    "Strong experience with FastAPI or similar async web frameworks",
    "PostgreSQL and query optimization",
    "REST or GraphQL API design",
    "Experience with Docker and CI/CD pipelines",
  ],
};

mkdirSync(outDir, { recursive: true });

function contentType(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function startDemoServer() {
  if (!existsSync(join(appDir, "index.html"))) {
    throw new Error("Extension UI not built. Run: cd frontend && bun run build:extension");
  }

  const server = http.createServer((req, res) => {
    const pathname = (req.url ?? "/").split("?")[0];
    let filePath;

    if (pathname.startsWith("/demo/")) {
      filePath = join(demoDir, pathname.slice("/demo/".length));
    } else if (pathname === "/" || pathname === "/index.html") {
      filePath = join(appDir, "index.html");
    } else {
      filePath = join(appDir, pathname.replace(/^\//, ""));
      if (!existsSync(filePath)) {
        filePath = join(appDir, "index.html");
      }
    }

    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType(filePath) });
    createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function apiHealthy() {
  try {
    return (await fetch("http://127.0.0.1:8000/health")).ok;
  } catch {
    return false;
  }
}

async function resetDemoState() {
  await fetch(`${apiBase}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      llm_provider: "local",
      llm_model: "qwen3.5-9b",
      llm_base_url: "http://127.0.0.1:1234/v1",
    }),
  });

  try {
    execFileSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "career",
        "-d",
        "ai_career_os",
        "-c",
        "TRUNCATE match_analyses, jobs, profiles RESTART IDENTITY CASCADE;",
      ],
      { cwd: root, stdio: "ignore" },
    );
    return { fresh: true };
  } catch {
    const jobs = await (await fetch(`${apiBase}/jobs`)).json();
    for (const job of jobs) {
      await fetch(`${apiBase}/jobs/${job.id}`, { method: "DELETE" });
    }
    const profiles = await (await fetch(`${apiBase}/profiles`)).json();
    return { fresh: profiles.length === 0 };
  }
}

async function createCaptureHandoff() {
  const res = await fetch(`${apiBase}/jobs/intake-handoff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_text:
        "Senior Backend Engineer\nRandomishLabs\nRemote\n\n" +
        MOCK_JOB_EXTRACTION.description +
        "\n\nRequirements:\n- " +
        MOCK_JOB_EXTRACTION.requirements.join("\n- "),
      structured_data: MOCK_JOB_EXTRACTION,
      url: `http://127.0.0.1:${port}/demo/job-posting.html`,
      source: "RandomishLabs",
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create intake handoff: ${res.status}`);
  }
  return (await res.json()).id;
}

function installChromeMock(context, { handoffId, jobPageUrl }) {
  return context.addInitScript(
    ({ handoffId: captureHandoffId, jobPageUrl: demoJobUrl }) => {
      const syncData = { apiBaseUrl: "http://127.0.0.1:8000" };
      const sessionData = { panelRoute: "/welcome" };
      const demoTab = {
        id: 42,
        url: demoJobUrl,
        title: "Senior Backend Engineer — RandomishLabs",
        active: true,
        windowId: 1,
      };

      const readKeys = (keys, store, fallback) => {
        const result = {};
        if (typeof keys === "string") {
          result[keys] = store[keys];
          return result;
        }
        for (const [key, defaultValue] of Object.entries(keys ?? {})) {
          result[key] = store[key] ?? defaultValue ?? fallback?.[key];
        }
        return result;
      };

      window.chrome = {
        storage: {
          sync: {
            get: (keys) =>
              Promise.resolve(readKeys(keys, syncData, { apiBaseUrl: "http://127.0.0.1:8000" })),
            set: (values) => {
              Object.assign(syncData, values);
              return Promise.resolve();
            },
            onChanged: { addListener: () => {}, removeListener: () => {} },
          },
          session: {
            get: (keys) => Promise.resolve(readKeys(keys, sessionData, { panelRoute: "/welcome" })),
            set: (values) => {
              Object.assign(sessionData, values);
              return Promise.resolve();
            },
            remove: (keys) => {
              if (typeof keys === "string") {
                delete sessionData[keys];
              } else {
                for (const key of keys) {
                  delete sessionData[key];
                }
              }
              return Promise.resolve();
            },
          },
        },
        runtime: {
          id: "demo",
          sendMessage: (message, cb) => {
            if (message?.type === "run-capture-active-tab") {
              window.setTimeout(() => {
                cb?.({
                  ok: true,
                  result: {
                    reviewRoute: `/jobs/new/review?handoff=${captureHandoffId}`,
                    handoffId: captureHandoffId,
                    preview: {
                      title: "Senior Backend Engineer",
                      company: "RandomishLabs",
                      source: "RandomishLabs",
                      url: demoJobUrl,
                    },
                  },
                });
              }, 3200);
              return;
            }
            cb?.({ ok: false });
          },
          lastError: null,
        },
        tabs: {
          query: ({ active }) => Promise.resolve(active ? [demoTab] : []),
          onActivated: { addListener: () => {}, removeListener: () => {} },
          onUpdated: { addListener: () => {}, removeListener: () => {} },
        },
        windows: { getCurrent: () => Promise.resolve({ id: 1 }) },
      };
    },
    { handoffId, jobPageUrl },
  );
}

function panelLocator(page) {
  return page.frameLocator('iframe#panel');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pause(_page, ms) {
  await delay(ms);
}

async function waitForDemoMatchMock(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (demoCaptureState.demoMatchAnalysis && demoCaptureState.lastCreatedJobId) {
      return;
    }
    await delay(100);
  }
  throw new Error("Demo match analysis mock was not set — job save intercept failed");
}

function jobFrame(page) {
  return page.locator("iframe.job-pane");
}

async function triggerJobCaptureOverlay(page, durationMs = TIMING.captureMockMs) {
  await jobFrame(page).evaluate((iframe, ms) => {
    iframe.contentWindow?.postMessage({ type: "demo-capture-start", durationMs: ms }, "*");
  }, durationMs);
}

/** Wait for a loading state title, then hold briefly so the animation reads in the GIF. */
async function holdLoadingAnimation(panel, titleSnippet, holdMs = TIMING.loadingHoldMs) {
  await panel.locator(`text=${titleSnippet}`).waitFor({ timeout: 15000 });
  await delay(holdMs);
}

function patchMatchAnalysisList(list) {
  if (!demoCaptureState.demoMatchAnalysis) {
    return list;
  }
  const patched = list.map((item) =>
    item.id === demoCaptureState.demoMatchAnalysis.id ? demoCaptureState.demoMatchAnalysis : item,
  );
  if (!patched.some((item) => item.id === demoCaptureState.demoMatchAnalysis.id)) {
    patched.unshift(demoCaptureState.demoMatchAnalysis);
  }
  return patched;
}

async function installPanelMocks(context) {
  await context.route("**/profiles/parse-text", async (route) => {
    await delay(TIMING.resumeExtractMockMs);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_RESUME_PARSE),
    });
  });

  await context.route("**/match-analyses/*", async (route) => {
    if (route.request().method() !== "GET" || !demoCaptureState.demoMatchAnalysis) {
      await route.continue();
      return;
    }
    const id = route.request().url().split("/match-analyses/")[1]?.split("?")[0];
    if (id && id === demoCaptureState.demoMatchAnalysis.id) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(demoCaptureState.demoMatchAnalysis),
      });
      return;
    }
    await route.continue();
  });

  await context.route(/\/match-analyses\/?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const list = patchMatchAnalysisList(await response.json());
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      contentType: "application/json",
      body: JSON.stringify(list),
    });
  });

  await context.route(/\/jobs\/?$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    demoCaptureState.lastCreatedJobId = null;
    demoCaptureState.demoMatchAnalysis = null;
    const postBody = route.request().postDataJSON();
    let profileId = postBody?.profile_id;
    if (!profileId) {
      const profiles = await (await fetch(`${apiBase}/profiles`)).json();
      profileId = profiles[0]?.id;
    }
    const response = await route.fetch();
    const json = await response.json();
    demoCaptureState.lastCreatedJobId = json.id ?? null;
    if (json.match_analysis_id && profileId) {
      const now = new Date().toISOString();
      demoCaptureState.demoMatchAnalysis = {
        id: String(json.match_analysis_id),
        profile_id: String(profileId),
        job_id: String(json.id),
        status: "completed",
        result: MOCK_MATCH_RESULT,
        error: null,
        created_at: now,
        updated_at: now,
      };
    }
    await delay(TIMING.matchSaveDelayMs);
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      contentType: "application/json",
      body: JSON.stringify(json),
    });
  });
}

async function recordDemo(page, { fresh }) {
  const panel = panelLocator(page);

  await page.goto(frameUrl);
  await page.waitForSelector("iframe#panel");
  await pause(page, 1200);

  if (fresh) {
    await panel.locator("text=Match jobs with evidence").waitFor({ timeout: 25000 });
    await pause(page, TIMING.welcomeHoldMs);
    await panel.getByRole("button", { name: "Set up your profile" }).click();
    await panel.locator("text=Choose your AI provider").waitFor({ timeout: 20000 });
    await pause(page, TIMING.aiProviderHoldMs);
  } else {
    await page.locator("iframe#panel").evaluate((el) => {
      el.contentWindow.location.hash = "#/onboarding/ai";
    });
    await panel.locator("text=Choose your AI provider").waitFor({ timeout: 25000 });
    await pause(page, TIMING.aiProviderHoldMs);
  }

  // 2 — AI provider setup (slow enough to read each choice)
  await panel.locator("text=Local / Self-hosted").click();
  await pause(page, TIMING.aiSelectHoldMs);
  await panel.getByRole("button", { name: "LM Studio", exact: true }).click();
  await pause(page, TIMING.aiLmStudioHoldMs);
  await panel.getByRole("button", { name: "Continue" }).click();
  await panel.locator("text=Add your resume").waitFor({ timeout: 20000 });
  await pause(page, TIMING.uploadHoldMs);

  // 3 — Paste resume + extract animation (~3s)
  const textarea = panel.locator("textarea").first();
  await textarea.fill(DEMO_RESUME_TEXT);
  await pause(page, 500);
  await panel.getByRole("button", { name: "Extract resume →" }).click();
  await holdLoadingAnimation(panel, "Reading your resume");

  // 4 — Review extracted profile
  await panel.locator("text=Review profile").waitFor({ timeout: 20000 });
  await pause(page, TIMING.reviewHoldMs);
  await panel.getByRole("button", { name: "Save & continue" }).click();
  await panel.locator("text=Capture a job from your browser").waitFor({ timeout: 25000 });
  await pause(page, 800);

  // 5 — Capture overlay (~3s) — job page harvest + panel suction
  await panel.getByRole("button", { name: "Capture tab" }).click();
  await triggerJobCaptureOverlay(page);
  await holdLoadingAnimation(panel, "Capturing from tab");

  // 6 — Job review after capture
  await panel.locator("text=Senior Backend Engineer").first().waitFor({ timeout: 20000 });
  await pause(page, TIMING.jobReviewHoldMs);

  // 7 — Save & analyze match → completed score + evidence-based reasoning
  demoCaptureState.lastCreatedJobId = null;
  await panel.getByRole("button", { name: "Save & analyze match" }).click();
  await holdLoadingAnimation(panel, "Deep match analysis", TIMING.matchSaveDelayMs);
  await waitForDemoMatchMock();
  await panel.locator("text=Senior Backend Engineer").first().waitFor({ timeout: 25000 });

  await panel.locator("text=Match analysis").waitFor({ timeout: 10000 }).catch(() => {});
  await panel.locator("text=Designed REST and GraphQL APIs").waitFor({ timeout: 15000 });
  await panel
    .getByText("89", { exact: true })
    .waitFor({ timeout: 5000 })
    .catch(() => {});
  await panel.locator("text=Summary").waitFor({ timeout: 5000 }).catch(() => {});
  await pause(page, TIMING.matchEvidenceHoldMs);

  await panel.locator("text=Strengths").scrollIntoViewIfNeeded();
  await pause(page, 600);
  await panel.locator("text=Designed REST and GraphQL APIs").scrollIntoViewIfNeeded();
  await pause(page, TIMING.matchResultHoldMs);

  await panel.getByRole("heading", { name: "Gaps" }).scrollIntoViewIfNeeded();
  await pause(page, 600);
  await panel.locator("text=AWS experience is listed").scrollIntoViewIfNeeded();
  await pause(page, TIMING.matchResultHoldMs);
}

function webmToGif(webmPath, gifPath) {
  execFileSync(
    ffmpegPath,
    [
      "-y",
      "-i",
      webmPath,
      "-vf",
      "fps=9,scale=1200:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
      "-loop",
      "0",
      gifPath,
    ],
    { stdio: "inherit" },
  );
}

async function main() {
  if (!(await apiHealthy())) {
    console.error("Start the backend first: docker compose up --build -d");
    process.exit(1);
  }

  const { fresh } = await resetDemoState();
  const handoffId = await createCaptureHandoff();
  const server = await startDemoServer();

  const browser = await chromium.launch();
  let webmPath = null;

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      recordVideo: { dir: outDir, size: VIEWPORT },
    });
    await installChromeMock(context, {
      handoffId,
      jobPageUrl: `http://127.0.0.1:${port}/demo/job-posting.html`,
    });
    await installPanelMocks(context);

    const page = await context.newPage();
    await recordDemo(page, { fresh });

    webmPath = await page.video()?.path();
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();

    if (!webmPath) {
      throw new Error("No video recorded");
    }

    console.log("Converting to GIF…");
    webmToGif(webmPath, gifOut);

    const sizeMb = (statSync(gifOut).size / (1024 * 1024)).toFixed(2);
    console.log(`Wrote ${gifOut} (${sizeMb} MB)`);

    unlinkSync(webmPath);
    for (const name of readdirSync(outDir)) {
      if (name.endsWith(".webm")) unlinkSync(join(outDir, name));
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
