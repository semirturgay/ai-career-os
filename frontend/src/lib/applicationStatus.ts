import type { ApplicationOutcomeStatus, FeedbackEvent } from "../types";

export const APPLICATION_STATUS_OPTIONS: {
  value: ApplicationOutcomeStatus;
  label: string;
}[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "rejected", label: "Rejected" },
  { value: "offer", label: "Offer" },
  { value: "passed", label: "Passed" },
];

const STATUS_LABELS = Object.fromEntries(
  APPLICATION_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ApplicationOutcomeStatus, string>;

export function applicationStatusLabel(status: ApplicationOutcomeStatus): string {
  return STATUS_LABELS[status];
}

export function latestApplicationOutcome(
  events: FeedbackEvent[],
  jobId?: string,
): { status: ApplicationOutcomeStatus; note: string | null } {
  const latest = events
    .filter(
      (event) =>
        event.event_type === "application_outcome" &&
        (!jobId || event.job_id === jobId),
    )
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];

  if (!latest) {
    return { status: "saved", note: null };
  }

  const status = latest.payload.status;
  if (typeof status !== "string") {
    return { status: "saved", note: null };
  }

  return {
    status: status as ApplicationOutcomeStatus,
    note: typeof latest.payload.note === "string" ? latest.payload.note : null,
  };
}

export function applicationStatusForJob(
  events: FeedbackEvent[],
  jobId: string,
): ApplicationOutcomeStatus {
  return latestApplicationOutcome(events, jobId).status;
}

export function shouldShowApplicationStatusBadge(
  status: ApplicationOutcomeStatus,
): boolean {
  return status !== "saved";
}

export function applicationStatusVariant(
  status: ApplicationOutcomeStatus,
): "default" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "offer":
      return "success";
    case "interviewing":
      return "info";
    case "applied":
      return "warning";
    case "rejected":
    case "passed":
      return "danger";
    default:
      return "default";
  }
}
