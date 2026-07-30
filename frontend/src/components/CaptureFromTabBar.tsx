/// <reference types="chrome" />

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { runCaptureFromActiveTab } from "../lib/extensionMessaging";
import { parseExtensionRoute } from "../lib/extensionNavigation";
import { IS_EXTENSION } from "../lib/extensionRuntime";
import { Button, ErrorBanner } from "./ui";

function TabIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 h-5 w-5 shrink-0 text-accent"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 8V6a2 2 0 012-2h3l2 2h7a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2v-2"
      />
    </svg>
  );
}

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

export function CaptureFromTabBar() {
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

  async function handleCapture() {
    setCapturing(true);
    setError(null);
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
      setCapturing(false);
    }
  }

  if (!IS_EXTENSION) {
    return null;
  }

  return (
    <section className="border-b border-border bg-accent/5 px-3 py-3">
      <div className="flex items-start gap-3">
        <TabIcon />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">Capture job from active tab</p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Reads the posting from the page you have open in this browser window — not from the URL.
            You review and edit before anything is saved.
          </p>
          {tabBlocked ? (
            <p className="mt-2 text-xs text-text-muted">
              Open a job posting in a normal browser tab first, then capture here.
            </p>
          ) : tabHint ? (
            <p className="mt-2 truncate text-xs text-text-muted" title={tabHint}>
              Active tab: <span className="font-medium text-text">{tabHint}</span>
            </p>
          ) : null}
        </div>
      </div>

      <Button
        onClick={() => void handleCapture()}
        loading={capturing}
        disabled={tabBlocked}
        className="mt-3 w-full py-2.5 text-sm font-semibold"
      >
        {capturing ? "Reading page…" : "Capture job from this tab"}
      </Button>

      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}
    </section>
  );
}
