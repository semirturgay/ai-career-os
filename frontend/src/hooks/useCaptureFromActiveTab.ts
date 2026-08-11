/// <reference types="chrome" />

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  formatTabLabel,
  getSidePanelWindowId,
  queryActiveBrowserTab,
  subscribeActiveBrowserTab,
} from "../lib/activeBrowserTab";
import { ensureCapturePermission } from "../lib/capturePermissions";
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

  const clearError = useCallback(() => setError(null), []);

  const capture = useCallback(async () => {
    setError(null);

    // Ask for host access before anything else, while we still hold the click gesture
    // that chrome.permissions.request requires. Doing this ahead of the animation also
    // means the prompt is not competing with a spinner.
    try {
      const tab = await queryActiveBrowserTab(windowId);
      if (tab) {
        await ensureCapturePermission(tab.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Permission denied");
      return;
    }

    setCapturing(true);
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

  return { capturing, error, tabHint, tabBlocked, capture, clearError };
}
