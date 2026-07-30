importScripts("shared/settings.js", "shared/api.js");

// Capture policy: DOM-only from the active tab. Never fetch third-party job URLs.
// See docs/extension.md

const CAPTURE_SCRIPT_FILES = [
  "content/extractors.js",
  "content/capture-page.js",
];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "run-capture-pipeline") {
    runCapturePipeline(message.tabId)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Capture failed",
          status: error.status,
        }),
      );
    return true;
  }

  if (message?.type === "analyze-job-page") {
    analyzeTab(message.tabId)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Analysis failed",
        }),
      );
    return true;
  }

  return undefined;
});

async function injectCaptureScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: CAPTURE_SCRIPT_FILES,
  });
}

async function captureFromTab(tabId) {
  await injectCaptureScripts(tabId);

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => captureJobPage(),
  });

  if (!result?.result) {
    throw new Error("Could not read job content from this page");
  }
  return result.result;
}

async function analyzeTab(tabId) {
  await injectCaptureScripts(tabId);

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => analyzeCurrentPage(),
  });

  if (!result?.result) {
    throw new Error("Could not analyze this page");
  }
  return result.result;
}

async function runCapturePipeline(tabId) {
  const settings = await getExtensionSettings();
  const tab = await chrome.tabs.get(tabId);

  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
    throw new Error("Open a job posting page first");
  }

  let capture;
  try {
    capture = await captureFromTab(tabId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Capture failed";
    if (message.includes("Cannot access contents of")) {
      throw new Error("This page cannot be read by extensions. Try the company's job board instead.");
    }
    if (message.includes("Receiving end does not exist")) {
      throw new Error("Refresh the job page, then try capture again.");
    }
    throw error;
  }

  if (!capture.text || capture.text.length < 100) {
    throw new Error(
      "Not enough job text on this page (need at least 100 characters). Open a page where the full job description is visible, then try again.",
    );
  }

  let existingJob = null;
  if (capture.url) {
    try {
      const found = await findJobByUrl(settings.apiBaseUrl, capture.url);
      existingJob = found.job;
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
    }
  }

  const parsed = await parseJobText(settings.apiBaseUrl, capture.text);
  const handoff = await createIntakeHandoff(settings.apiBaseUrl, {
    job_text: parsed.job_text,
    structured_data: parsed.structured_data,
    url: capture.url,
    source: capture.source,
  });

  const reviewUrl = `${settings.appBaseUrl}/jobs/new/review?handoff=${handoff.id}`;
  await chrome.tabs.create({ url: reviewUrl });

  return {
    handoffId: handoff.id,
    reviewUrl,
    existingJob,
    preview: {
      title: parsed.structured_data.title,
      company: parsed.structured_data.company,
      source: capture.source,
      url: capture.url,
    },
  };
}
