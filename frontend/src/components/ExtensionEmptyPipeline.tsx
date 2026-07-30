import { Link } from "react-router-dom";
import { useCaptureFromActiveTab } from "../hooks/useCaptureFromActiveTab";
import { Button, ErrorBanner } from "./ui";

export function ExtensionEmptyPipeline() {
  const { capturing, error, tabHint, tabBlocked, capture } = useCaptureFromActiveTab();

  return (
    <div className="rounded-xl border border-accent/20 bg-gradient-to-b from-accent/5 to-surface-raised px-4 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Next step</p>
      <h3 className="mt-1 text-base font-semibold text-text">Capture a job from your browser</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Open a job posting in a tab, then capture it here. We read the visible page — you review
        before saving — then run explainable match analysis.
      </p>

      <ol className="mt-4 space-y-2.5">
        <li className="flex gap-2.5 text-xs text-text-muted">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
            1
          </span>
          <span>Browse to a job posting (Wellfound, LinkedIn, company careers page…)</span>
        </li>
        <li className="flex gap-2.5 text-xs text-text-muted">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
            2
          </span>
          <span>Click capture — we read the active tab, not the URL</span>
        </li>
        <li className="flex gap-2.5 text-xs text-text-muted">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
            3
          </span>
          <span>Review fields, save, and see your match score</span>
        </li>
      </ol>

      {tabBlocked ? (
        <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted">
          Open a job posting in a normal browser tab, then come back here to capture it.
        </p>
      ) : tabHint ? (
        <p className="mt-4 truncate rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-xs text-text-muted">
          Ready to capture: <span className="font-medium text-text">{tabHint}</span>
        </p>
      ) : null}

      <Button
        onClick={() => void capture()}
        loading={capturing}
        disabled={tabBlocked}
        className="mt-4 w-full py-2.5 text-sm font-semibold"
      >
        {capturing ? "Reading page…" : "Capture job from active tab"}
      </Button>

      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}

      <p className="mt-4 text-center text-xs text-text-muted">
        No posting open?{" "}
        <Link to="/jobs/new" className="font-medium text-accent hover:underline">
          Paste a job description
        </Link>
      </p>
    </div>
  );
}
