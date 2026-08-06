import { Link } from "react-router-dom";
import type { DiscoveryDefaultInterval, JobDiscovery } from "../types/discovery";
import { countNewCandidates, formatNextRun, intervalLabel } from "../lib/discoveryIntervals";
import { formatDiscoveryCriteria } from "../lib/discoveryService";
import { Badge } from "./ui";

interface DiscoverMonitorCardProps {
  monitor: JobDiscovery;
  defaultInterval: DiscoveryDefaultInterval;
  compact?: boolean;
  onDelete?: () => void;
}

function statusVariant(monitor: JobDiscovery) {
  if (!monitor.enabled) {
    return "warning" as const;
  }
  switch (monitor.status) {
    case "completed":
      return "success" as const;
    case "failed":
      return "danger" as const;
    case "running":
    case "pending":
      return "info" as const;
  }
}

function statusLabel(monitor: JobDiscovery) {
  if (!monitor.enabled) {
    return "Paused";
  }
  switch (monitor.status) {
    case "completed":
      return "Active";
    case "failed":
      return "Failed";
    case "running":
      return "Searching…";
    case "pending":
      return "Queued";
  }
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) {
    return "Never";
  }

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

export function DiscoverMonitorCard({
  monitor,
  defaultInterval,
  compact,
  onDelete,
}: DiscoverMonitorCardProps) {
  const visibleCandidates = monitor.candidates.filter((candidate) => !candidate.dismissed);
  const criteriaText = formatDiscoveryCriteria(monitor.criteria);
  const newCount = countNewCandidates(monitor, defaultInterval);

  return (
    <li className="min-w-0">
      <Link
        to={`/discover/${monitor.id}`}
        className={`group block min-w-0 rounded-xl border border-border bg-surface-raised transition hover:border-accent/30 hover:shadow-sm ${
          compact ? "p-3" : "p-4"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(monitor)}>{statusLabel(monitor)}</Badge>
              <Badge variant="default">{intervalLabel(monitor.interval, defaultInterval)}</Badge>
              {newCount > 0 && <Badge variant="info">{newCount} new</Badge>}
            </div>
            <p className="mt-1.5 truncate font-semibold text-text group-hover:text-accent">
              {criteriaText}
            </p>
            {monitor.criteria.notes && (
              <p className="mt-1 line-clamp-2 text-xs text-text-muted">{monitor.criteria.notes}</p>
            )}
            <p className="mt-2 text-xs text-text-muted">
              {monitor.status === "running" || monitor.status === "pending"
                ? "Agent is searching the web…"
                : monitor.status === "failed"
                  ? (monitor.error ?? "Last run failed")
                  : `${visibleCandidates.length} candidate${visibleCandidates.length === 1 ? "" : "s"} · Last run ${formatWhen(monitor.last_run_at)} · ${monitor.enabled ? formatNextRun(monitor.next_run_at) : "Paused"}`}
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
      {onDelete && monitor.status !== "running" && (
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

/** @deprecated use DiscoverMonitorCard */
export const DiscoverRunCard = DiscoverMonitorCard;
