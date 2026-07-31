import type { Job, MatchAnalysis } from "../types";
import { isFullMatch } from "./matches";

export type ApplicationStepId = "match" | "research" | "resume" | "cover_letter";

export type JobDetailTab = "match" | "company" | "resume" | "cover";

export type ApplicationStepStatus = "done" | "pending" | "todo" | "skipped";

export interface ApplicationStep {
  id: ApplicationStepId;
  label: string;
  shortLabel: string;
  status: ApplicationStepStatus;
}

export interface ApplicationProgress {
  steps: ApplicationStep[];
  completedCount: number;
  totalCount: number;
  percent: number;
}

function readProgressFlag(job: Job, step: "resume" | "cover_letter"): boolean {
  const progress = job.raw_metadata?.application_progress;
  if (!progress || typeof progress !== "object") return false;
  const entry = (progress as Record<string, unknown>)[step];
  if (entry && typeof entry === "object" && entry !== null && "completed" in entry) {
    return !!(entry as { completed?: boolean }).completed;
  }
  return !!entry;
}

export function getApplicationProgress(
  job: Job,
  analysis: MatchAnalysis | null | undefined,
): ApplicationProgress {
  const fullMatch = isFullMatch(analysis);
  const gaps = analysis?.result?.gaps?.length ?? 0;
  const matchPending = analysis?.status === "pending";
  const matchFailed = analysis?.status === "failed";

  const matchStatus: ApplicationStepStatus = fullMatch
    ? "done"
    : matchPending
      ? "pending"
      : matchFailed
        ? "todo"
        : "todo";

  const researchDone = !!job.company_brief;
  const resumeDone = readProgressFlag(job, "resume") || (fullMatch && gaps === 0);
  const resumeStatus: ApplicationStepStatus = resumeDone
    ? gaps === 0 && !readProgressFlag(job, "resume")
      ? "skipped"
      : "done"
    : fullMatch
      ? "todo"
      : "todo";

  const coverDone = readProgressFlag(job, "cover_letter");

  const steps: ApplicationStep[] = [
    {
      id: "match",
      label: "Match analysis",
      shortLabel: "Match",
      status: matchStatus,
    },
    {
      id: "research",
      label: "Company research",
      shortLabel: "Research",
      status: researchDone ? "done" : fullMatch ? "todo" : "todo",
    },
    {
      id: "resume",
      label: "Resume tailoring",
      shortLabel: "Resume",
      status: !fullMatch ? "todo" : resumeStatus,
    },
    {
      id: "cover_letter",
      label: "Cover letter",
      shortLabel: "Cover",
      status: coverDone ? "done" : fullMatch ? "todo" : "todo",
    },
  ];

  const completedCount = steps.filter(
    (step) => step.status === "done" || step.status === "skipped",
  ).length;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    percent: Math.round((completedCount / steps.length) * 100),
  };
}

export function progressSummary(progress: ApplicationProgress): string {
  if (progress.completedCount === 0) return "Not started";
  if (progress.completedCount === progress.totalCount) return "Ready to apply";
  const next = progress.steps.find((step) => step.status === "todo" || step.status === "pending");
  if (next?.status === "pending") return "Analyzing match…";
  if (next) return `Next: ${next.shortLabel}`;
  return `${progress.completedCount}/${progress.totalCount} complete`;
}

const STEP_HINTS: Record<ApplicationStepId, string> = {
  match: "Explainable fit score, strengths, and gaps",
  research: "Culture, news, and interview signals from the web",
  resume: "AI suggestions tailored to this job's gaps",
  cover_letter: "Short targeted draft you can copy and edit",
};

export function tabToApplicationStepId(tab: JobDetailTab): ApplicationStepId {
  switch (tab) {
    case "company":
      return "research";
    case "resume":
      return "resume";
    case "cover":
      return "cover_letter";
    default:
      return "match";
  }
}

export function stepTooltip(step: ApplicationStep, extra?: string): string {
  const status =
    step.status === "done"
      ? "Complete"
      : step.status === "skipped"
        ? "Not needed"
        : step.status === "pending"
          ? "In progress"
          : "Not started";
  const hint = STEP_HINTS[step.id];
  return extra ? `${step.label} — ${status}. ${hint} ${extra}` : `${step.label} — ${status}. ${hint}`;
}

export function nextApplicationStep(
  job: Job,
  analysis: MatchAnalysis | null | undefined,
): ApplicationStep | null {
  const progress = getApplicationProgress(job, analysis);
  return (
    progress.steps.find((step) => step.status === "todo" || step.status === "pending") ?? null
  );
}

export function applicationStepToTab(stepId: ApplicationStepId): JobDetailTab {
  switch (stepId) {
    case "research":
      return "company";
    case "resume":
      return "resume";
    case "cover_letter":
      return "cover";
    default:
      return "match";
  }
}

export function nextApplicationTab(
  job: Job,
  analysis: MatchAnalysis | null | undefined,
): JobDetailTab {
  const next = nextApplicationStep(job, analysis);
  if (!next) return "match";
  return applicationStepToTab(next.id);
}
