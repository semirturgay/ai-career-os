import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { JobDiscoveryCandidate } from "../types/discovery";
import { openBrowserTab } from "../lib/openBrowserTab";
import { Badge, Button } from "./ui";
import { ScoreRing } from "./ScoreRing";

interface DiscoverCandidateCardProps {
  candidate: JobDiscoveryCandidate;
  compact?: boolean;
  onDismiss?: () => void;
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function CompanyMark({ name }: { name: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-sm font-semibold text-accent"
      aria-hidden
    >
      {letter}
    </span>
  );
}

export function DiscoverCandidateCard({ candidate, compact, onDismiss }: DiscoverCandidateCardProps) {
  const [inPipeline, setInPipeline] = useState(false);
  const [checkingPipeline, setCheckingPipeline] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCheckingPipeline(true);

    api.jobs
      .getByUrl(candidate.url)
      .then(() => {
        if (!cancelled) {
          setInPipeline(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInPipeline(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingPipeline(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [candidate.url]);

  async function handleOpen() {
    setOpening(true);
    try {
      await openBrowserTab(candidate.url);
    } finally {
      setOpening(false);
    }
  }

  const source = candidate.source ?? hostnameFromUrl(candidate.url);

  return (
    <article
      className={`rounded-xl border border-border bg-surface-raised ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-start gap-3">
        <CompanyMark name={candidate.company} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-text">{candidate.title}</p>
              <p className="mt-0.5 truncate text-sm text-text-muted">{candidate.company}</p>
            </div>
            {candidate.fit_score != null && (
              <ScoreRing score={candidate.fit_score} size={compact ? "sm" : "md"} />
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {source && <Badge variant="default">{source}</Badge>}
            {inPipeline && <Badge variant="success">In pipeline</Badge>}
            {checkingPipeline && !inPipeline && (
              <span className="text-[10px] text-text-muted">Checking pipeline…</span>
            )}
          </div>

          <p className="mt-2 line-clamp-3 text-sm text-text-muted">{candidate.snippet}</p>

          {candidate.fit_reason && (
            <p className="mt-2 text-xs text-text">
              <span className="font-medium text-accent">Fit signal:</span> {candidate.fit_reason}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void handleOpen()}
              loading={opening}
              className={compact ? "w-full" : undefined}
            >
              Open posting
            </Button>
            {!inPipeline && (
              <p className="text-[11px] text-text-muted">
                Then use Capture on the job page to analyze fit.
              </p>
            )}
            {onDismiss && (
              <Button type="button" variant="ghost" onClick={onDismiss} className="ml-auto">
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
