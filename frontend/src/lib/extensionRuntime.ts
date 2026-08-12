/// <reference types="chrome" />

export const IS_EXTENSION = import.meta.env.VITE_EXTENSION === "true";

const DEFAULT_API_BASE = "http://127.0.0.1:8000/api/v1";

let apiBase = IS_EXTENSION ? DEFAULT_API_BASE : "/api/v1";

/**
 * Set only when the backend runs somewhere that needed a door — see app/api/auth.py.
 * The web build has no way to hold one, and doesn't need it: it is served same-origin
 * by a backend the user already reached.
 */
let apiToken = "";

export function getApiBase(): string {
  return apiBase;
}

export function getApiToken(): string {
  return apiToken;
}

export function configureApiBase(baseUrl: string): void {
  apiBase = baseUrl.replace(/\/$/, "");
}

export function configureApiToken(token: string): void {
  apiToken = token.trim();
}

export async function loadExtensionApiBase(): Promise<string> {
  if (!IS_EXTENSION) {
    return getApiBase();
  }

  const stored = await chrome.storage.sync.get({
    apiBaseUrl: "http://127.0.0.1:8000",
    apiToken: "",
  });
  const base = `${String(stored.apiBaseUrl).replace(/\/$/, "")}/api/v1`;
  configureApiBase(base);
  configureApiToken(String(stored.apiToken ?? ""));
  watchExtensionSettings();
  return base;
}

let watchingSettings = false;

/**
 * The side panel outlives a trip to the options page, so without this a user who fixes
 * their token keeps seeing 401s until they think to reload the panel.
 */
function watchExtensionSettings(): void {
  if (watchingSettings) {
    return;
  }
  watchingSettings = true;

  chrome.storage.sync.onChanged.addListener((changes) => {
    if (changes.apiBaseUrl) {
      configureApiBase(`${String(changes.apiBaseUrl.newValue ?? "").replace(/\/$/, "")}/api/v1`);
    }
    if (changes.apiToken) {
      configureApiToken(String(changes.apiToken.newValue ?? ""));
    }
  });
}

export async function getPanelRoute(): Promise<string> {
  if (!IS_EXTENSION) {
    return "/";
  }
  const stored = await chrome.storage.session.get({ panelRoute: "/" });
  return String(stored.panelRoute || "/");
}
