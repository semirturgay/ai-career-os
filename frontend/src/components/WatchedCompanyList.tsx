import { Badge, Button } from "./ui";
import { ATS_PROVIDER_LABELS, type WatchedCompany } from "../types/radar";

interface WatchedCompanyListProps {
  companies: WatchedCompany[];
  compact: boolean;
  pollingCompanyId: string | null;
  onPoll: (companyId: string) => void;
  onTogglePaused: (company: WatchedCompany) => void;
  onRemove: (company: WatchedCompany) => void;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "not checked yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "not checked yet";

  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "checked just now";
  if (minutes < 60) return `checked ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `checked ${hours}h ago`;
  return `checked ${Math.round(hours / 24)}d ago`;
}

function statusBadge(company: WatchedCompany) {
  switch (company.status) {
    case "paused":
      return <Badge variant="warning">Paused</Badge>;
    case "unresolved":
      return <Badge variant="danger">Board missing</Badge>;
    case "error":
      return <Badge variant="danger">Error</Badge>;
    default:
      return null;
  }
}

export function WatchedCompanyList({
  companies,
  compact,
  pollingCompanyId,
  onPoll,
  onTogglePaused,
  onRemove,
}: WatchedCompanyListProps) {
  return (
    <ul className={`grid min-w-0 ${compact ? "gap-2.5" : "gap-3"}`}>
      {companies.map((company) => (
        <li
          key={company.id}
          className={`min-w-0 rounded-xl border border-border bg-surface-raised ${
            compact ? "p-3" : "p-4"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold leading-snug text-text">{company.name}</p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {ATS_PROVIDER_LABELS[company.ats_provider] ?? company.ats_provider} ·{" "}
                {company.posting_count} tracked · {relativeTime(company.last_polled_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {company.new_posting_count > 0 && (
                <Badge variant="success">{company.new_posting_count} new</Badge>
              )}
              {statusBadge(company)}
            </div>
          </div>

          {company.last_error && (
            <p className="mt-1.5 break-words text-xs text-danger">{company.last_error}</p>
          )}

          <div className="mt-2.5 flex items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onPoll(company.id)}
              loading={pollingCompanyId === company.id}
              disabled={pollingCompanyId !== null}
            >
              Check now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onTogglePaused(company)}>
              {company.status === "paused" ? "Resume" : "Pause"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => onRemove(company)}
            >
              Remove
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
