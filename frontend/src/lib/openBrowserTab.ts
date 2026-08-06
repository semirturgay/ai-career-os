/// <reference types="chrome" />

import { IS_EXTENSION } from "./extensionRuntime";

export async function openBrowserTab(url: string): Promise<void> {
  if (IS_EXTENSION) {
    await chrome.tabs.create({ url, active: true });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
