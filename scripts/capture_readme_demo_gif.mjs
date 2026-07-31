#!/usr/bin/env node
/**
 * Record a tailored side-panel demo and export docs/assets/demo/demo.gif
 *
 * Prerequisites:
 *   docker compose up --build -d
 *   cd frontend && bun run build:extension
 *   npm install playwright @ffmpeg-installer/ffmpeg
 *   npx playwright install chromium
 */
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, unlinkSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/assets/demo");
const appDir = join(root, "extension/app");
const baseUrl = "http://127.0.0.1:8765";
const apiBase = "http://127.0.0.1:8000/api/v1";
const gifOut = join(outDir, "demo.gif");

const PANEL = { width: 400, height: 760 };

mkdirSync(outDir, { recursive: true });

function waitForPort(port, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        await fetch(`http://127.0.0.1:${port}/`);
        resolve();
      } catch {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}`));
          return;
        }
        setTimeout(tick, 200);
      }
    };
    tick();
  });
}

function startStaticServer() {
  const child = spawn("python3", ["-m", "http.server", "8765", "--bind", "127.0.0.1"], {
    cwd: appDir,
    stdio: "ignore",
  });
  return child;
}

async function apiHealthy() {
  try {
    return (await fetch("http://127.0.0.1:8000/health")).ok;
  } catch {
    return false;
  }
}

function installChromeMock(context) {
  return context.addInitScript(() => {
    const syncData = { apiBaseUrl: "http://127.0.0.1:8000" };
    const sessionData = { panelRoute: "/" };
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
          onChanged: { addListener: () => {}, removeListener: () => {} },
        },
        session: {
          get: (keys) => Promise.resolve(readKeys(keys, sessionData, { panelRoute: "/" })),
          set: (values) => {
            Object.assign(sessionData, values);
            return Promise.resolve();
          },
          remove: () => Promise.resolve(),
        },
      },
      runtime: {
        id: "demo",
        sendMessage: (_m, cb) => cb?.({ ok: false }),
        lastError: null,
      },
      tabs: {
        query: () => Promise.resolve([]),
        onActivated: { addListener: () => {}, removeListener: () => {} },
        onUpdated: { addListener: () => {}, removeListener: () => {} },
      },
      windows: { getCurrent: () => Promise.resolve({ id: 1 }) },
    };
  });
}

async function ensureDemoData() {
  await fetch(`${apiBase}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      llm_provider: "local",
      llm_model: "qwen3.5-9b",
      llm_base_url: "http://127.0.0.1:1234/v1",
    }),
  });

  let profiles = await (await fetch(`${apiBase}/profiles`)).json();
  let profileId = profiles[0]?.id;

  if (!profileId) {
    const res = await fetch(`${apiBase}/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alex Chen",
        headline: "Senior Backend Engineer · Python, FastAPI, PostgreSQL",
        resume_text:
          "Senior backend engineer with 8 years building APIs and data pipelines at Acme Corp. " +
          "Expert in Python, FastAPI, PostgreSQL, and system design.",
      }),
    });
    profileId = (await res.json()).id;
  }

  let jobs = await (await fetch(`${apiBase}/jobs`)).json();
  if (jobs.length === 0) {
    for (const job of [
      {
        title: "Senior Backend Engineer",
        company: "Acme Corp",
        location: "Remote",
        description:
          "Build scalable APIs with Python and FastAPI. Requirements: Python, PostgreSQL, REST, system design.",
        raw_metadata: {
          requirements: ["Python", "FastAPI", "PostgreSQL"],
          match_summary: "Strong stack overlap with your backend experience.",
        },
      },
      {
        title: "Staff Platform Engineer",
        company: "Globex",
        location: "Hybrid · NYC",
        description:
          "Platform tooling team. Go, Kubernetes, observability. Nice to have: Python, Postgres.",
        raw_metadata: { requirements: ["Go", "Kubernetes", "Platform"] },
      },
    ]) {
      await fetch(`${apiBase}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...job, profile_id: profileId }),
      });
    }
    jobs = await (await fetch(`${apiBase}/jobs`)).json();
  }

  const demoJob =
    jobs.find((j) => j.title === "Senior Backend Engineer" && j.company === "Acme Corp") ??
    jobs.find((j) => j.title === "Senior Backend Engineer") ??
    jobs[0];
  return demoJob ? { id: demoJob.id, title: demoJob.title, company: demoJob.company } : null;
}

async function pause(page, ms) {
  await page.waitForTimeout(ms);
}

async function recordDemo(page, demoJob) {
  // 1 — AI provider (first-run setup)
  await page.goto(`${baseUrl}/#/onboarding/ai`);
  await page.waitForSelector("text=Choose your AI provider", { timeout: 20000 });
  await pause(page, 1800);
  await page.locator("text=LM Studio").first().click({ timeout: 5000 }).catch(() => {});
  await pause(page, 1200);

  // 2 — Pipeline home
  await page.goto(`${baseUrl}/#/`);
  await page.waitForSelector("text=Opportunities", { timeout: 20000 });
  await pause(page, 1500);
  await page.mouse.wheel(0, 120);
  await pause(page, 800);

  // 3 — Job detail (click from pipeline for a natural flow)
  if (demoJob) {
    await page.locator(`a[href="#/jobs/${demoJob.id}"]`).first().click({ timeout: 10000 });
    await page.waitForSelector(`text=${demoJob.title}`, { timeout: 20000 });
    await pause(page, 2200);
    const researchTab = page.getByRole("tab", { name: /Research/i });
    if (await researchTab.isEnabled().catch(() => false)) {
      await researchTab.click();
      await pause(page, 1200);
    }
    await page.getByRole("tab", { name: /Match/i }).click().catch(() => {});
    await pause(page, 1000);
  }

  // 4 — Back to pipeline
  await page.goto(`${baseUrl}/#/`);
  await page.waitForSelector("text=Opportunities", { timeout: 20000 });
  await pause(page, 1500);
}

function webmToGif(webmPath, gifPath) {
  execFileSync(
    ffmpegPath,
    [
      "-y",
      "-i",
      webmPath,
      "-vf",
      "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
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

  const demoJob = await ensureDemoData();
  const server = startStaticServer();
  await waitForPort(8765);

  const browser = await chromium.launch();
  let webmPath = null;

  try {
    const context = await browser.newContext({
      viewport: PANEL,
      deviceScaleFactor: 2,
      recordVideo: { dir: outDir, size: PANEL },
    });
    await installChromeMock(context);
    const page = await context.newPage();

    await recordDemo(page, demoJob);

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
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
