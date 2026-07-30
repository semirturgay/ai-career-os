/// <reference types="chrome" />

import { IS_EXTENSION } from "./extensionRuntime";

export interface ActiveBrowserTab {
  id: number;
  url: string;
  title?: string;
}

function isCapturableUrl(url: string | undefined): url is string {
  if (!url) {
    return false;
  }
  return !url.startsWith("chrome://") && !url.startsWith("chrome-extension://");
}

export function formatTabLabel(url: string, title?: string): string {
  if (title && title.length > 0 && title.length <= 80) {
    return title;
  }
  try {
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname.slice(0, 40);
  } catch {
    return url.slice(0, 60);
  }
}

export async function getSidePanelWindowId(): Promise<number | null> {
  if (!IS_EXTENSION) {
    return null;
  }

  const window = await chrome.windows.getCurrent();
  return window.id ?? null;
}

export async function queryActiveBrowserTab(windowId?: number | null): Promise<ActiveBrowserTab | null> {
  if (!IS_EXTENSION) {
    return null;
  }

  const resolvedWindowId = windowId ?? (await getSidePanelWindowId());
  if (resolvedWindowId == null) {
    return null;
  }

  const tabs = await chrome.tabs.query({ active: true, windowId: resolvedWindowId });
  const tab = tabs[0];
  if (!tab?.id || !isCapturableUrl(tab.url)) {
    return null;
  }

  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
  };
}

export function subscribeActiveBrowserTab(
  onChange: (tab: ActiveBrowserTab | null) => void,
): () => void {
  if (!IS_EXTENSION) {
    return () => {};
  }

  let windowId: number | null = null;
  let cancelled = false;

  const emit = async () => {
    if (cancelled || windowId == null) {
      return;
    }
    const tab = await queryActiveBrowserTab(windowId);
    if (!cancelled) {
      onChange(tab);
    }
  };

  void getSidePanelWindowId().then((id) => {
    if (cancelled || id == null) {
      onChange(null);
      return;
    }
    windowId = id;
    void emit();
  });

  const onActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
    if (windowId != null && activeInfo.windowId === windowId) {
      void emit();
    }
  };

  const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    if (windowId == null || tab.windowId !== windowId || !tab.active) {
      return;
    }
    if (changeInfo.url != null || changeInfo.title != null || changeInfo.status === "complete") {
      void emit();
    }
  };

  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);

  return () => {
    cancelled = true;
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
  };
}
