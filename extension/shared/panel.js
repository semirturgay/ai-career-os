const PANEL_ROUTE_KEY = "panelRoute";

async function setPanelRoute(route) {
  await chrome.storage.session.set({ [PANEL_ROUTE_KEY]: route });
}

async function getPanelRoute() {
  const stored = await chrome.storage.session.get(PANEL_ROUTE_KEY);
  return stored[PANEL_ROUTE_KEY] || "/";
}

/** Call from popup click handlers only — Chrome requires a user gesture. */
function openSidePanelFromUserGesture(tab, route = "/") {
  return new Promise((resolve, reject) => {
    if (!tab?.windowId && !tab?.id) {
      reject(new Error("No browser window available for the side panel"));
      return;
    }

    chrome.storage.session.set({ [PANEL_ROUTE_KEY]: route }, () => {
      const target = tab.id ? { tabId: tab.id } : { windowId: tab.windowId };
      chrome.sidePanel.open(target, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  });
}
