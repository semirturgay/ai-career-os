import { Link } from "react-router-dom";
import type { JobDiscoveryRun } from "../types/discovery";
import { formatDiscoveryCriteria } from "../lib/discoveryService";
import { Badge } from "./ui";

interface DiscoverRunCardProps {
  run: JobDiscoveryRun;
  compact?: boolean;
  onDelete?: () => void;
}

function statusVariant(status: JobDiscoveryRun["status"]) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "failed":
      return "danger" as const;
    case "running":
    case "pending":
      return "info" as const;
  }
}

function statusLabel(status: JobDiscoveryRun["status"]) {
  switch (status) {
    case "completed":
      return "Done";
    case "failed":
      return "Failed";
    case "running":
      return "Searching…";
    case "pending":
      return "Queued";
  }
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function DiscoverRunCard({ run, compact, onDelete }: DiscoverRunCardProps) {
  const visibleCandidates = run.candidates.filter((candidate) => !candidate.dismissed);
  const criteriaText = formatDiscoveryCriteria(run.criteria);

  return (
    <li className="min-w-0">
      <Link
        to={`/discover/${run.id}`}
        className={`group block min-w-0 rounded-xl border border-border bg-surface-raised transition hover:border-accent/30 hover:shadow-sm ${
          compact ? "p-3" : "p-4"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(run.status)}>{statusLabel(run.status)}</Badge>
              <span className="text-[11px] text-text-muted">{formatWhen(run.created_at)}</span>
            </div>
            <p className="mt-1.5 truncate font-semibold text-text group-hover:text-accent">
              {criteriaText}
            </p>
            {run.criteria.notes && (
              <p className="mt-1 line-clamp-2 text-xs text-text-muted">{run.criteria.notes}</p>
            )}
            <p className="mt-2 text-xs text-text-muted">
              {run.status === "running" || run.status === "pending"
                ? "Agent is searching the web…"
                : run.status === "failed"
                  ? (run.error ?? "Discovery failed")
                  : `${visibleCandidates.length} candidate${visibleCandidates.length === 1 ? "" : "s"} found`}
            </p>
          </div>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4 shrink-0 text-text-muted transition group-hover:text-accent"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </Link>
      {onDelete && run.status !== "running" && (
        <div className="mt-1 flex justify-end px-1">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onDelete();
            }}
            className="text-[11px] text-text-muted hover:text-danger"
          >
            Remove
          </button>
        </div>
      )}
    </li>
  );
}
