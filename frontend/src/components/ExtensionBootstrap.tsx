import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageLoader } from "./AiLoadingState";
import { getPanelRoute, IS_EXTENSION, loadExtensionApiBase } from "../lib/extensionRuntime";
import { parseExtensionRoute } from "../lib/extensionNavigation";

interface ExtensionBootstrapProps {
  children: React.ReactNode;
}

/** Sync current route to session storage (write-only — never hijacks in-app navigation). */
export function ExtensionRouteSync() {
  const location = useLocation();

  useEffect(() => {
    if (!IS_EXTENSION) {
      return;
    }
    const route = `${location.pathname}${location.search}`;
    void chrome.storage.session.set({ panelRoute: route });
  }, [location.pathname, location.search]);

  return null;
}

export function ExtensionBootstrap({ children }: ExtensionBootstrapProps) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(!IS_EXTENSION);

  useEffect(() => {
    if (!IS_EXTENSION) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      await loadExtensionApiBase();
      const route = await getPanelRoute();
      if (route && route !== "/") {
        navigate(parseExtensionRoute(route), { replace: true });
      }
      if (!cancelled) {
        setReady(true);
      }
    }

    void bootstrap();

    const onSyncChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      const nextApi = changes.apiBaseUrl?.newValue;
      if (typeof nextApi === "string" && nextApi.length > 0) {
        void loadExtensionApiBase();
      }
    };

    chrome.storage.sync.onChanged.addListener(onSyncChange);

    return () => {
      cancelled = true;
      chrome.storage.sync.onChanged.removeListener(onSyncChange);
    };
  }, [navigate]);

  if (!ready) {
    return <PageLoader variant="page" />;
  }

  return children;
}
