const apiStatusEl = document.getElementById("api-status");
const apiStatusLabelEl = document.getElementById("api-status-label");
const openPanelBtn = document.getElementById("open-panel-btn");
const optionsBtn = document.getElementById("options-btn");

function setApiStatus(healthy) {
  apiStatusEl.className = `pill ${healthy ? "ok" : "error"}`;
  apiStatusLabelEl.textContent = healthy ? "API online" : "API offline";
}

async function sendBackgroundMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response ?? { ok: false });
    });
  });
}

async function checkApiHealthFromSettings() {
  const settings = await getExtensionSettings();
  const response = await sendBackgroundMessage({
    type: "check-api-health",
    apiBaseUrl: settings.apiBaseUrl,
  });
  return Boolean(response?.healthy);
}

openPanelBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) {
      return;
    }
    openSidePanelFromUserGesture(tab, "/").then(() => window.close());
  });
});

optionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

checkApiHealthFromSettings().then(setApiStatus);
