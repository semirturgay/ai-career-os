/// <reference types="chrome" />

export const IS_EXTENSION = import.meta.env.VITE_EXTENSION === "true";

const DEFAULT_API_BASE = "http://127.0.0.1:8000/api/v1";

let apiBase = IS_EXTENSION ? DEFAULT_API_BASE : "/api/v1";

export function getApiBase(): string {
  return apiBase;
}

export function configureApiBase(baseUrl: string): void {
  apiBase = baseUrl.replace(/\/$/, "");
}

export async function loadExtensionApiBase(): Promise<string> {
  if (!IS_EXTENSION) {
    return getApiBase();
  }

  const stored = await chrome.storage.sync.get({ apiBaseUrl: "http://127.0.0.1:8000" });
  const base = `${String(stored.apiBaseUrl).replace(/\/$/, "")}/api/v1`;
  configureApiBase(base);
  return base;
}

export async function getPanelRoute(): Promise<string> {
  if (!IS_EXTENSION) {
    return "/";
  }
  const stored = await chrome.storage.session.get({ panelRoute: "/" });
  return String(stored.panelRoute || "/");
}
