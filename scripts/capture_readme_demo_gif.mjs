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

const VIEWPORT = { width: 960, height: 720 };

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
  company: "FinTech Labs",
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
        "Senior Backend Engineer\nFinTech Labs\nRemote\n\n" +
        MOCK_JOB_EXTRACTION.description +
        "\n\nRequirements:\n- " +
        MOCK_JOB_EXTRACTION.requirements.join("\n- "),
      structured_data: MOCK_JOB_EXTRACTION,
      url: `http://127.0.0.1:${port}/demo/job-posting.html`,
      source: "FinTech Labs",
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
        title: "Senior Backend Engineer — FinTech Labs",
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
                      company: "FinTech Labs",
                      source: "FinTech Labs",
                      url: demoJobUrl,
                    },
                  },
                });
              }, 4200);
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

async function installPanelMocks(context) {
  await context.route("**/profiles/parse-text", async (route) => {
    await delay(3600);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_RESUME_PARSE),
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
    await pause(page, 1600);
    await panel.getByRole("button", { name: "Set up your profile" }).click();
    await panel.locator("text=Choose your AI provider").waitFor({ timeout: 20000 });
    await pause(page, 1000);
  } else {
    await page.locator("iframe#panel").evaluate((el) => {
      el.contentWindow.location.hash = "#/onboarding/ai";
    });
    await panel.locator("text=Choose your AI provider").waitFor({ timeout: 25000 });
    await pause(page, 1000);
  }

  // 2 — AI provider (settings pre-seeded to local; highlight LM Studio preset)
  await panel.locator("text=Local / Self-hosted").click();
  await pause(page, 600);
  await panel.getByRole("button", { name: "LM Studio", exact: true }).click();
  await pause(page, 900);
  await panel.getByRole("button", { name: "Continue" }).click();
  await panel.locator("text=Add your resume").waitFor({ timeout: 20000 });
  await pause(page, 1000);

  // 3 — Paste resume + extract animation
  const textarea = panel.locator("textarea").first();
  await textarea.click();
  await textarea.fill(DEMO_RESUME_TEXT.slice(0, 180));
  await pause(page, 500);
  await textarea.fill(DEMO_RESUME_TEXT);
  await pause(page, 700);
  await panel.getByRole("button", { name: "Extract resume →" }).click();
  await panel.locator("text=Reading your resume").waitFor({ timeout: 10000 });
  await pause(page, 3800);

  // 4 — Review extracted profile
  await panel.locator("text=Review profile").waitFor({ timeout: 20000 });
  await pause(page, 2200);
  await panel.getByRole("button", { name: "Save & continue" }).click();
  await panel.locator("text=Capture a job from your browser").waitFor({ timeout: 25000 });
  await pause(page, 1500);

  // 5 — Capture tab suction overlay
  await panel.getByRole("button", { name: "Capture tab" }).click();
  await panel.locator("text=Capturing from tab").waitFor({ timeout: 10000 });
  await pause(page, 4200);

  // 6 — Job review after capture
  await panel.locator("text=Senior Backend Engineer").first().waitFor({ timeout: 20000 });
  await panel.locator("text=FinTech Labs").first().waitFor({ timeout: 10000 });
  await pause(page, 2400);

  // 7 — Save job (creates pending match analysis)
  await panel.getByRole("button", { name: "Save & analyze match" }).click();
  await panel.locator("text=Deep match analysis").waitFor({ timeout: 25000 }).catch(() => {});
  await pause(page, 2800);

  // 8 — Back to pipeline
  await page.locator("iframe#panel").evaluate((el) => {
    el.contentWindow.location.hash = "#/";
  });
  await panel
    .locator("text=Opportunities")
    .or(panel.locator("text=Senior Backend Engineer"))
    .first()
    .waitFor({ timeout: 20000 });
  await pause(page, 1800);
}

function webmToGif(webmPath, gifPath) {
  execFileSync(
    ffmpegPath,
    [
      "-y",
      "-i",
      webmPath,
      "-vf",
      "fps=8,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
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
