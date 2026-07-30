const DEFAULT_SETTINGS = {
  apiBaseUrl: "http://127.0.0.1:8000",
};

async function getExtensionSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return {
    apiBaseUrl: (stored.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl).replace(/\/$/, ""),
  };
}

async function saveExtensionSettings(settings) {
  await chrome.storage.sync.set({
    apiBaseUrl: settings.apiBaseUrl.replace(/\/$/, ""),
  });
}
