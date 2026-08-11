import { useState } from "react";

import { Button } from "./ui";
import { openBrowserTab } from "../lib/openBrowserTab";
import type { Posting } from "../types/radar";

interface PostingFeedProps {
  postings: Posting[];
  compact: boolean;
  onPromote: (postingId: string) => Promise<void>;
  onDismiss: (postingId: string) => Promise<void>;
}

/** Screen scores are a cheap triage signal, so they get a flatter treatment than
 *  the pipeline's ScoreRing — a full match analysis should still look like the
 *  more authoritative number when you promote. */
function ScoreChip({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-overlay text-xs text-text-muted">
        –
      </span>
    );
  }

  const tone =
    score >= 80
      ? "bg-success/15 text-success"
      : score >= 60
        ? "bg-accent/10 text-accent"
        : score >= 40
          ? "bg-warning/15 text-warning"
          : "bg-surface-overlay text-text-muted";

  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums ${tone}`}
      title={`Screen score ${score} of 100`}
    >
      {score}
    </span>
  );
}

export function PostingFeed({ postings, compact, onPromote, onDismiss }: PostingFeedProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(postingId: string, action: (id: string) => Promise<void>) {
    setBusyId(postingId);
    try {
      await action(postingId);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className={`grid min-w-0 ${compact ? "gap-2.5" : "gap-3"}`}>
      {postings.map((posting) => (
        <li
          key={posting.id}
          className={`min-w-0 rounded-xl border border-border bg-surface-raised transition hover:border-accent/30 ${
            compact ? "p-3" : "p-4"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-semibold leading-snug text-text">{posting.title}</p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {posting.company_name}
                {posting.location ? ` · ${posting.location}` : ""}
                {posting.remote_flag ? " · Remote" : ""}
              </p>
              {posting.screen_reason && (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-muted">
                  {posting.screen_reason}
                </p>
              )}
            </div>
            <ScoreChip score={posting.screen_score} />
          </div>

          <div className="mt-2.5 flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => run(posting.id, onPromote)}
              loading={busyId === posting.id}
              disabled={busyId !== null}
            >
              {compact ? "Add" : "Add to pipeline"}
            </Button>
            {posting.url && (
              <Button size="sm" variant="ghost" onClick={() => openBrowserTab(posting.url!)}>
                View
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => run(posting.id, onDismiss)}
              disabled={busyId !== null}
            >
              Dismiss
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
