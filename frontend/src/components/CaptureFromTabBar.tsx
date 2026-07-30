/// <reference types="chrome" />

import { Link } from "react-router-dom";
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
      <p className="truncate text-xs text-text-muted">
        {tabBlocked ? (
          "Open a job posting in a browser tab to capture."
        ) : tabHint ? (
          <>
            Active tab · <span className="font-medium text-text">{tabHint}</span>
          </>
        ) : (
          "Capture the job posting from your active tab."
        )}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <Link to="/jobs/new" className="shrink-0">
          <Button variant="secondary" className="px-3 py-1.5 text-xs font-semibold">
            Paste job
          </Button>
        </Link>
        <Button
          onClick={() => void capture()}
          loading={capturing}
          disabled={tabBlocked}
          className="min-w-0 flex-1 py-1.5 text-xs font-semibold"
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
