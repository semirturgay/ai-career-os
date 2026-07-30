const statusEl = document.getElementById("status");
const pageUrlEl = document.getElementById("page-url");
const captureBtn = document.getElementById("capture-btn");
const optionsBtn = document.getElementById("options-btn");

function setStatus(message, tone = "default") {
  statusEl.textContent = message;
  statusEl.className = `status${tone === "error" ? " error" : tone === "success" ? " success" : ""}`;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function formatDetectionMessage(analysis) {
  if (analysis.isLikelyJobPost) {
    const parts = ["Likely job posting"];
    if (analysis.title) {
      parts.push(`— ${analysis.title}`);
    }
    if (analysis.company) {
      parts.push(`at ${analysis.company}`);
    }
    parts.push(`(${analysis.confidence} confidence, DOM only)`);
    return parts.join(" ");
  }
  return "This page may not be a job posting. Open a job detail view, then capture. We only read the visible page — never fetch URLs.";
}

async function analyzeActiveTab(tabId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "analyze-job-page", tabId }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response?.ok ? response.result : null);
    });
  });
}

async function init() {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) {
    setStatus("No active tab to capture.", "error");
    captureBtn.disabled = true;
    return;
  }

  if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
    setStatus("Open a job posting page first.", "error");
    captureBtn.disabled = true;
    return;
  }

  pageUrlEl.textContent = tab.url;
  setStatus("Checking if this page looks like a job posting…");

  const analysis = await analyzeActiveTab(tab.id);
  if (analysis) {
    setStatus(formatDetectionMessage(analysis), analysis.isLikelyJobPost ? "success" : "default");
    if (!analysis.isLikelyJobPost && analysis.textLength < 100) {
      captureBtn.disabled = false;
    }
  } else {
    setStatus("Ready to capture. We read this tab's DOM only — never fetch job URLs.");
  }
}

captureBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab?.id) {
    setStatus("No active tab.", "error");
    return;
  }

  captureBtn.disabled = true;
  setStatus("Reading page text and structuring job fields…");

  chrome.runtime.sendMessage({ type: "run-capture-pipeline", tabId: tab.id }, (response) => {
    captureBtn.disabled = false;

    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, "error");
      return;
    }

    if (!response?.ok) {
      setStatus(response?.error || "Capture failed", "error");
      return;
    }

    const { preview, existingJob } = response.result;
    let message = `Captured ${preview.title} at ${preview.company}. Review tab opened.`;
    if (existingJob) {
      message += ` Note: this URL is already saved as "${existingJob.title}".`;
    }
    setStatus(message, "success");
  });
});

optionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

init();
