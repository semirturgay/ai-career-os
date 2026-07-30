const PANEL_ROUTE_KEY = "panelRoute";

async function setPanelRoute(route) {
  await chrome.storage.session.set({ [PANEL_ROUTE_KEY]: route });
}
