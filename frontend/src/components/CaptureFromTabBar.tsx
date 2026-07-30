/// <reference types="chrome" />

import { useCaptureFromActiveTab } from "../hooks/useCaptureFromActiveTab";
import { IS_EXTENSION } from "../lib/extensionRuntime";
import { Button, ErrorBanner } from "./ui";

export function CaptureFromTabBar() {
  const { capturing, error, tabHint, tabBlocked, capture } = useCaptureFromActiveTab();

  if (!IS_EXTENSION) {
    return null;
  }

  return (
    <section className="border-b border-border bg-surface-raised px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {tabBlocked ? (
            <p className="text-xs text-text-muted">Open a job posting in a browser tab to capture.</p>
          ) : tabHint ? (
            <p className="truncate text-xs text-text-muted">
              Active tab · <span className="font-medium text-text">{tabHint}</span>
            </p>
          ) : (
            <p className="text-xs text-text-muted">Capture the job posting from your active tab.</p>
          )}
        </div>
        <Button
          onClick={() => void capture()}
          loading={capturing}
          disabled={tabBlocked}
          className="shrink-0 px-3 py-1.5 text-xs font-semibold"
        >
          {capturing ? "Reading…" : "Capture tab"}
        </Button>
      </div>
      {error && (
        <div className="mt-2">
          <ErrorBanner message={error} />
        </div>
      )}
    </section>
  );
}
