import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { FeedbackEvent, MatchGap } from "../types";
import { Button, Textarea } from "./ui";

export interface MatchFeedbackContext {
  profileId: string;
  jobId: string;
  analysisId: string;
}

function analysisFeedback(events: FeedbackEvent[], analysisId: string): FeedbackEvent[] {
  return events.filter((event) => event.match_analysis_id === analysisId);
}

export function useJobFeedback(jobId: string | undefined) {
  const [events, setEvents] = useState<FeedbackEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(jobId));

  const refresh = useCallback(async () => {
    if (!jobId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setEvents(await api.feedback.listForJob(jobId));
    } catch (err) {
      console.error(err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { events, loading, refresh };
}

function MatchHelpfulPrompt({
  context,
  events,
  onSubmitted,
}: {
  context: MatchFeedbackContext;
  events: FeedbackEvent[];
  onSubmitted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = analysisFeedback(events, context.analysisId).find(
    (event) => event.event_type === "match_helpful",
  );
  const helpful =
    existing?.payload && typeof existing.payload.helpful === "boolean"
      ? existing.payload.helpful
      : null;

  async function submit(value: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      await api.feedback.create({
        profile_id: context.profileId,
        job_id: context.jobId,
        match_analysis_id: context.analysisId,
        event_type: "match_helpful",
        payload: { helpful: value },
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feedback");
    } finally {
      setSubmitting(false);
    }
  }

  if (helpful !== null) {
    return (
      <p className="rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm text-text-muted">
        Thanks — marked as {helpful ? "helpful" : "not helpful"}. This feeds your career memory.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-elevated px-4 py-3">
      <p className="text-sm font-medium text-text">Was this match analysis helpful?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="px-3 py-1.5"
          loading={submitting}
          onClick={() => void submit(true)}
        >
          Yes
        </Button>
        <Button
          variant="ghost"
          className="px-3 py-1.5"
          loading={submitting}
          onClick={() => void submit(false)}
        >
          Not really
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function GapDisputeControl({
  context,
  gap,
  events,
  onSubmitted,
}: {
  context: MatchFeedbackContext;
  gap: MatchGap;
  events: FeedbackEvent[];
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = analysisFeedback(events, context.analysisId).find(
    (event) =>
      event.event_type === "gap_dispute" &&
      event.payload.gap_evidence === gap.evidence,
  );

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.feedback.create({
        profile_id: context.profileId,
        job_id: context.jobId,
        match_analysis_id: context.analysisId,
        event_type: "gap_dispute",
        payload: {
          gap_evidence: gap.evidence,
          user_note: note.trim() || null,
        },
      });
      setOpen(false);
      setNote("");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feedback");
    } finally {
      setSubmitting(false);
    }
  }

  if (existing) {
    return (
      <p className="mt-2 text-xs text-text-muted">
        You disagreed with this gap
        {typeof existing.payload.user_note === "string" && existing.payload.user_note
          ? `: “${existing.payload.user_note}”`
          : "."}
      </p>
    );
  }

  return (
    <div className="mt-2">
      {!open ? (
        <Button variant="ghost" className="h-auto px-0 py-0 text-xs text-text-muted" onClick={() => setOpen(true)}>
          Disagree with this gap
        </Button>
      ) : (
        <div className="space-y-2 rounded-lg border border-border bg-surface px-3 py-3">
          <p className="text-xs text-text-muted">Where does your resume cover this?</p>
          <Textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. AWS is listed under the Globex project"
          />
          <div className="flex flex-wrap gap-2">
            <Button className="px-3 py-1.5" loading={submitting} onClick={() => void submit()}>
              Save disagreement
            </Button>
            <Button variant="ghost" className="px-3 py-1.5" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function MatchFeedbackPanel({
  context,
  gaps,
  events,
  onSubmitted,
}: {
  context: MatchFeedbackContext;
  gaps: MatchGap[];
  events: FeedbackEvent[];
  onSubmitted: () => void;
}) {
  return (
    <div className="space-y-4">
      <MatchHelpfulPrompt context={context} events={events} onSubmitted={onSubmitted} />
      {gaps.length > 0 && (
        <p className="text-xs text-text-muted">
          Disagree with a gap below — we&apos;ll remember it for future match runs.
        </p>
      )}
    </div>
  );
}

export function GapDisputeFeedback({
  context,
  gap,
  events,
  onSubmitted,
}: {
  context: MatchFeedbackContext;
  gap: MatchGap;
  events: FeedbackEvent[];
  onSubmitted: () => void;
}) {
  return (
    <GapDisputeControl
      context={context}
      gap={gap}
      events={events}
      onSubmitted={onSubmitted}
    />
  );
}
