import { Link } from "react-router-dom";
import { Button } from "./ui";

export interface DuplicateJobInfo {
  id: string;
  title: string;
  company: string;
}

interface DuplicateJobBannerProps {
  job: DuplicateJobInfo;
  context?: "capture" | "review";
  captureSource?: string | null;
}

export function DuplicateJobBanner({
  job,
  context = "review",
  captureSource,
}: DuplicateJobBannerProps) {
  const sourceLabel = captureSource ? `Captured from ${captureSource}` : null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4">
      <p className="text-sm font-medium text-text">
        {context === "capture"
          ? "This job is already in your pipeline"
          : "This posting is already saved"}
      </p>
      {sourceLabel && <p className="mt-1 text-xs text-text-muted">{sourceLabel}</p>}
      <p className="mt-2 text-sm text-text-muted">
        Open the existing entry instead of creating another copy.
      </p>
      <Link
        to={`/jobs/${job.id}`}
        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
      >
        {job.title}
        {job.company ? ` · ${job.company}` : ""}
        <span aria-hidden="true">→</span>
      </Link>
      <div className="mt-3">
        <Link to={`/jobs/${job.id}`}>
          <Button type="button" variant="secondary" className="text-sm">
            Open existing job
          </Button>
        </Link>
      </div>
    </div>
  );
}
