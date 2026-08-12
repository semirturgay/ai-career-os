const DEFAULT_SETTINGS = {
  apiBaseUrl: "http://127.0.0.1:8000",
  // Only needed when the backend was started with API_TOKEN set — i.e. when it lives
  // somewhere other than this machine. Empty is the right value for localhost.
  apiToken: "",
};

async function getExtensionSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return {
    apiBaseUrl: (stored.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl).replace(/\/$/, ""),
    apiToken: (stored.apiToken || "").trim(),
  };
}

async function saveExtensionSettings(settings) {
  await chrome.storage.sync.set({
    apiBaseUrl: settings.apiBaseUrl.replace(/\/$/, ""),
    apiToken: (settings.apiToken || "").trim(),
  });
}
