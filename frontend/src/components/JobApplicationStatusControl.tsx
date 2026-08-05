import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ApplicationOutcomeStatus } from "../types";
import { useJobFeedback } from "./MatchFeedbackControls";
import { useOptionalPipelineSync } from "../hooks/PipelineSyncContext";
import {
  APPLICATION_STATUS_OPTIONS,
  applicationStatusLabel,
  applicationStatusVariant,
  latestApplicationOutcome,
} from "../lib/applicationStatus";
import { Badge, Button, Field, Select, Textarea } from "./ui";
import { CollapsibleSection } from "./CollapsibleSection";

interface JobApplicationStatusControlProps {
  profileId: string;
  jobId: string;
  /** Collapsed toolbar style for side panel / when match is running. */
  compact?: boolean;
}

export function JobApplicationStatusControl({
  profileId,
  jobId,
  compact = false,
}: JobApplicationStatusControlProps) {
  const pipeline = useOptionalPipelineSync();
  const { events, loading, refresh } = useJobFeedback(jobId);
  const current = latestApplicationOutcome(events, jobId);
  const [status, setStatus] = useState<ApplicationOutcomeStatus>(current.status);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    setStatus(current.status);
    setNote("");
    setShowNote(false);
    setSavedMessage(null);
  }, [current.status, loading, events.length]);

  async function handleSave() {
    if (status === current.status && !note.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSavedMessage(null);
    try {
      await api.feedback.create({
        profile_id: profileId,
        job_id: jobId,
        event_type: "application_outcome",
        payload: {
          status,
          note: note.trim() || null,
        },
      });
      await refresh();
      await pipeline?.refreshPipeline();
      setNote("");
      setShowNote(false);
      setSavedMessage(`Status updated to ${applicationStatusLabel(status).toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update application status");
    } finally {
      setSubmitting(false);
    }
  }

  const dirty = status !== current.status || note.trim().length > 0;

  if (loading) {
    return null;
  }

  const statusSelect = (
    <Select
      value={status}
      onChange={(event) => setStatus(event.target.value as ApplicationOutcomeStatus)}
      className={compact ? "py-1.5 text-sm" : undefined}
    >
      {APPLICATION_STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );

  const saveRow = (
    <div className={`flex flex-wrap items-center gap-3 ${compact ? "" : "mt-4"}`}>
      <Button
        className={compact ? "px-3 py-1.5 text-xs" : "px-3 py-1.5"}
        loading={submitting}
        disabled={!dirty}
        onClick={() => void handleSave()}
      >
        Save status
      </Button>
      {savedMessage && <p className="text-xs text-success sm:text-sm">{savedMessage}</p>}
      {error && <p className="text-xs text-danger sm:text-sm">{error}</p>}
    </div>
  );

  if (compact) {
    return (
      <CollapsibleSection
        title="Application status"
        trailing={
          <Badge variant={applicationStatusVariant(current.status)}>
            {applicationStatusLabel(current.status)}
          </Badge>
        }
        contentClassName="space-y-3 border-t border-border px-5 py-4"
      >
        <Field label="Status">{statusSelect}</Field>
        {showNote ? (
          <Field label="Note">
            <Textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional context for future you"
            />
          </Field>
        ) : (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="text-left text-xs text-accent hover:underline"
          >
            Add note
          </button>
        )}
        {saveRow}
      </CollapsibleSection>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface-raised px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text">Application status</h2>
          <p className="mt-1 text-sm text-text-muted">
            Track where this opportunity stands — we&apos;ll remember it for your pipeline.
          </p>
        </div>
        <Badge variant={applicationStatusVariant(current.status)}>
          {applicationStatusLabel(current.status)}
        </Badge>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
        <Field label="Update status">{statusSelect}</Field>
        <Field label="Note (optional)" hint="Interview date, recruiter name, why you passed, etc.">
          <Textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional context for future you"
          />
        </Field>
      </div>

      {saveRow}
    </section>
  );
}
