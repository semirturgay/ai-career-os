/// <reference types="chrome" />

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  formatTabLabel,
  getSidePanelWindowId,
  subscribeActiveBrowserTab,
} from "../lib/activeBrowserTab";
import { captureAnimationStore } from "../lib/captureAnimationStore";
import { runCaptureFromActiveTab } from "../lib/extensionMessaging";
import { parseExtensionRoute } from "../lib/extensionNavigation";
import { IS_EXTENSION } from "../lib/extensionRuntime";

export function useCaptureFromActiveTab() {
  const navigate = useNavigate();
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabHint, setTabHint] = useState<string | null>(null);
  const [tabBlocked, setTabBlocked] = useState(false);
  const [windowId, setWindowId] = useState<number | null>(null);

  useEffect(() => {
    if (!IS_EXTENSION) {
      return;
    }

    void getSidePanelWindowId().then(setWindowId);

    return subscribeActiveBrowserTab((tab) => {
      if (!tab) {
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
      const result = await runCaptureFromActiveTab(windowId);
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
  }, [navigate, tabHint, windowId]);

  return { capturing, error, tabHint, tabBlocked, capture };
}
