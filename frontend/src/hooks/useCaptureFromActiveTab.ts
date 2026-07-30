/// <reference types="chrome" />

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { captureAnimationStore } from "../lib/captureAnimationStore";
import { runCaptureFromActiveTab } from "../lib/extensionMessaging";
import { parseExtensionRoute } from "../lib/extensionNavigation";
import { IS_EXTENSION } from "../lib/extensionRuntime";

function formatTabLabel(url: string, title?: string): string {
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

export function useCaptureFromActiveTab() {
  const navigate = useNavigate();
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabHint, setTabHint] = useState<string | null>(null);
  const [tabBlocked, setTabBlocked] = useState(false);

  useEffect(() => {
    if (!IS_EXTENSION) {
      return;
    }

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url) {
        setTabHint(null);
        return;
      }
      if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
        setTabBlocked(true);
        setTabHint(null);
        return;
      }
      setTabBlocked(false);
      setTabHint(formatTabLabel(tab.url, tab.title));
    });
  }, []);

  const capture = useCallback(async () => {
    setCapturing(true);
    setError(null);
    captureAnimationStore.start(tabHint);
    try {
      const result = await runCaptureFromActiveTab();
      if (result.duplicate && result.existingJob) {
        navigate(`/jobs/${result.existingJob.id}`, {
          state: { duplicateCapture: true, existingJob: result.existingJob },
        });
        return;
      }
      navigate(parseExtensionRoute(result.reviewRoute));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      captureAnimationStore.stop();
      setCapturing(false);
    }
  }, [navigate, tabHint]);

  return { capturing, error, tabHint, tabBlocked, capture };
}
