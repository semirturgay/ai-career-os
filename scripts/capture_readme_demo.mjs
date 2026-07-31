#!/usr/bin/env node
/**
 * Capture README demo screenshots (and optional side-panel video).
 * Requires: backend at http://127.0.0.1:8000, extension UI built to extension/app/
 *
 * Usage: node scripts/capture_readme_demo.mjs
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/assets/demo");
const appDir = join(root, "extension/app");
const baseUrl = "http://127.0.0.1:8765";
const apiBase = "http://127.0.0.1:8000/api/v1";

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
  child.on("error", (err) => {
    throw new Error(`Failed to start static server: ${err.message}`);
  });
  return child;
}

async function apiHealthy() {
  try {
    const res = await fetch("http://127.0.0.1:8000/health");
    return res.ok;
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

    const storage = {
      sync: {
        get: (keys) => Promise.resolve(readKeys(keys, syncData, { apiBaseUrl: "http://127.0.0.1:8000" })),
        onChanged: { addListener: () => {}, removeListener: () => {} },
      },
      session: {
        get: (keys) => Promise.resolve(readKeys(keys, sessionData, { panelRoute: "/" })),
        set: (values) => {
          Object.assign(sessionData, values);
          return Promise.resolve();
        },
        remove: (keys) => {
          for (const key of [].concat(keys)) delete sessionData[key];
          return Promise.resolve();
        },
      },
    };

    window.chrome = {
      storage,
      runtime: {
        id: "readme-demo",
        sendMessage: (_message, callback) => {
          if (callback) callback({ ok: false, error: "demo" });
        },
        get lastError() {
          return null;
        },
      },
      tabs: {
        query: () => Promise.resolve([]),
        onActivated: { addListener: () => {}, removeListener: () => {} },
        onUpdated: { addListener: () => {}, removeListener: () => {} },
      },
      windows: {
        getCurrent: () => Promise.resolve({ id: 1 }),
      },
    };
  });
}

async function seedDemoData() {
  await fetch(`${apiBase}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      llm_provider: "local",
      llm_model: "demo-model",
      llm_base_url: "http://127.0.0.1:1234/v1",
    }),
  });

  const profilesRes = await fetch(`${apiBase}/profiles`);
  const profiles = profilesRes.ok ? await profilesRes.json() : [];
  let profileId = profiles[0]?.id;

  if (!profileId) {
    const profileRes = await fetch(`${apiBase}/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alex Chen",
        headline: "Senior Backend Engineer · Python, FastAPI, PostgreSQL",
        resume_text:
          "Senior backend engineer with 8 years building APIs and data pipelines. " +
          "Led migration to FastAPI and PostgreSQL at Acme Corp. Strong Python, SQL, " +
          "and system design. MS Computer Science.",
      }),
    });
    if (!profileRes.ok) {
      console.warn("Could not seed profile:", await profileRes.text());
      return;
    }
    profileId = (await profileRes.json()).id;
  }

  const jobsRes = await fetch(`${apiBase}/jobs`);
  const jobs = jobsRes.ok ? await jobsRes.json() : [];
  if (jobs.length > 0) {
    return;
  }

  await fetch(`${apiBase}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      location: "Remote",
      description:
        "We are looking for a senior backend engineer to build scalable APIs with Python and FastAPI. " +
        "Requirements: 5+ years Python, PostgreSQL, REST APIs, system design experience.",
      profile_id: profileId,
      raw_metadata: {
        requirements: ["Python", "FastAPI", "PostgreSQL", "REST APIs"],
        match_summary: "Strong Python backend fit with relevant stack overlap.",
      },
    }),
  });

  await fetch(`${apiBase}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Staff Platform Engineer",
      company: "Globex",
      location: "Hybrid · NYC",
      description:
        "Platform team building internal developer tools. Go, Kubernetes, and observability. " +
        "Nice to have: Python, Postgres, on-call rotation.",
      profile_id: profileId,
      raw_metadata: {
        requirements: ["Go", "Kubernetes", "Platform engineering"],
      },
    }),
  });
}

async function main() {
  const healthy = await apiHealthy();
  if (!healthy) {
    console.error("Backend not running. Start it first: docker compose up --build -d");
    process.exit(1);
  }

  const server = startStaticServer();
  await waitForPort(8765);

  const browser = await chromium.launch();
  const panel = { width: 400, height: 760 };

  try {
    const videoContext = await browser.newContext({
      viewport: panel,
      deviceScaleFactor: 2,
      recordVideo: { dir: outDir, size: panel },
    });
    await installChromeMock(videoContext);
    const videoPage = await videoContext.newPage();

    await videoPage.goto(`${baseUrl}/#/onboarding/ai`);
    await videoPage.waitForSelector("text=Choose your AI provider", { timeout: 20000 });
    await videoPage.waitForTimeout(800);
    await videoPage.screenshot({ path: join(outDir, "extension-ai-setup.png") });

    await seedDemoData();

    await videoPage.goto(`${baseUrl}/#/`);
    await videoPage.waitForSelector("text=Opportunities", { timeout: 20000 });
    await videoPage.waitForTimeout(1200);
    await videoPage.screenshot({ path: join(outDir, "extension-pipeline.png") });

    const profilesRes = await fetch(`${apiBase}/profiles`);
    const profiles = profilesRes.ok ? await profilesRes.json() : [];
    if (profiles.length === 0) {
      await videoPage.goto(`${baseUrl}/#/welcome`);
      await videoPage.waitForSelector("text=Match jobs with evidence", { timeout: 20000 });
      await videoPage.waitForTimeout(800);
      await videoPage.screenshot({ path: join(outDir, "extension-welcome.png") });
    } else {
      console.log("Skipping welcome screenshot — profile already exists (fresh DB shows welcome).");
    }

    await videoPage.waitForTimeout(600);
    await videoContext.close();
    const videoPath = await videoPage.video()?.path();
    if (videoPath) {
      console.log("Recorded video:", videoPath);
    }

    const docsContext = await browser.newContext({
      viewport: { width: 1280, height: 840 },
      deviceScaleFactor: 2,
    });
    const docsPage = await docsContext.newPage();
    await docsPage.goto("http://127.0.0.1:8000/docs");
    await docsPage.waitForSelector("text=AI Career OS", { timeout: 15000 });
    await docsPage.waitForTimeout(500);
    await docsPage.screenshot({ path: join(outDir, "api-docs.png") });
    await docsContext.close();

    console.log(`Screenshots saved to ${outDir}`);
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
