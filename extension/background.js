importScripts("shared/settings.js", "shared/api.js", "shared/panel.js");

// Capture policy: DOM-only from the active tab. Never fetch third-party job URLs.
// See docs/extension.md

const CAPTURE_SCRIPT_FILES = [
  "content/extractors.js",
  "content/capture-page.js",
];

let lastActiveTabId = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Older Chrome builds may not support sidePanel.
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) {
    return;
  }
  void setPanelRoute("/");
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  lastActiveTabId = tabId;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "run-capture-active-tab") {
    captureActiveTab()
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

  if (message?.type === "check-api-health") {
    checkApiHealth(message.apiBaseUrl)
      .then((healthy) => sendResponse({ ok: true, healthy }))
      .catch(() => sendResponse({ ok: true, healthy: false }));
    return true;
  }

  return undefined;
});

async function getActiveBrowserTab() {
  if (lastActiveTabId) {
    try {
      const tab = await chrome.tabs.get(lastActiveTabId);
      if (tab?.id && !tab.url?.startsWith("chrome-extension://")) {
        return tab;
      }
    } catch {
      lastActiveTabId = null;
    }
  }

  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
  for (const win of windows) {
    const activeTab = win.tabs?.find((t) => t.active);
    if (activeTab?.id && !activeTab.url?.startsWith("chrome-extension://")) {
      lastActiveTabId = activeTab.id;
      return activeTab;
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id) {
    lastActiveTabId = tab.id;
  }
  return tab ?? null;
}

async function captureActiveTab() {
  const tab = await getActiveBrowserTab();
  if (!tab?.id) {
    throw new Error("No active browser tab found");
  }
  return runCapturePipeline(tab.id);
}

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

async function runCapturePipeline(tabId) {
  const settings = await getExtensionSettings();
  const tab = await chrome.tabs.get(tabId);

  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
    throw new Error("Open a job posting page in this window, then capture from the side panel.");
  }

  let capture;
  try {
    capture = await captureFromTab(tabId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Capture failed";
    if (message.includes("Cannot access contents of")) {
      throw new Error("This page cannot be read by the extension. Try a different tab.");
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

  if (capture.url) {
    try {
      const found = await findJobByUrl(settings.apiBaseUrl, capture.url);
      const job = found.job;
      return {
        duplicate: true,
        existingJob: {
          id: job.id,
          title: job.title,
          company: job.company,
        },
        reviewRoute: `/jobs/${job.id}`,
      };
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

  const reviewRoute = `/jobs/new/review?handoff=${handoff.id}`;

  return {
    handoffId: handoff.id,
    reviewRoute,
    duplicate: false,
    preview: {
      title: parsed.structured_data.title,
      company: parsed.structured_data.company,
      source: capture.source,
      url: capture.url,
    },
  };
}
