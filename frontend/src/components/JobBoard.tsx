import { Link } from "react-router-dom";
import type { Job, MatchAnalysis } from "../types";
import {
  hasMatchResult,
  latestAnalysisForJob,
  recommendationLabel,
  recommendationVariant,
  scoreFromResult,
} from "../lib/matches";
import { getApplicationProgress, nextApplicationTab, progressSummary } from "../lib/applicationProgress";
import {
  applicationStatusLabel,
  applicationStatusVariant,
  shouldShowApplicationStatusBadge,
} from "../lib/applicationStatus";
import type { ApplicationOutcomeStatus } from "../types";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";
import { IS_EXTENSION } from "../lib/extensionRuntime";
import { ExtensionEmptyPipeline } from "./ExtensionEmptyPipeline";
import { JobProgressBar } from "./JobProgressBar";
import { Badge, Button } from "./ui";
import { ScoreRing } from "./ScoreRing";

interface JobBoardProps {
  jobs: Job[];
  analyses: MatchAnalysis[];
  profileId: string;
  getApplicationStatusForJob: (jobId: string) => ApplicationOutcomeStatus;
}

function scoreAccentClass(score: number | null): string {
  if (score == null) return "border-l-border";
  if (score >= 70) return "border-l-success";
  if (score >= 40) return "border-l-warning";
  return "border-l-danger/70";
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

interface JobOpportunityCardProps {
  job: Job;
  analysis: MatchAnalysis | undefined;
  applicationStatus: ApplicationOutcomeStatus;
  compact: boolean;
  rank: number;
}

function JobOpportunityCard({
  job,
  analysis,
  applicationStatus,
  compact,
  rank,
}: JobOpportunityCardProps) {
  const pending = analysis?.status === "pending";
  const failed = analysis?.status === "failed";
  const score = hasMatchResult(analysis) ? scoreFromResult(analysis?.result) : null;
  const rec = hasMatchResult(analysis) ? analysis?.result?.recommendation : undefined;
  const recLabel = recommendationLabel(rec);
  const summary = hasMatchResult(analysis) ? analysis?.result?.summary : null;
  const progress = getApplicationProgress(job, analysis);

  return (
    <li>
      <Link
        to={`/jobs/${job.id}`}
        state={{ fromPipeline: true }}
        className={`group block rounded-xl border border-border bg-surface-raised transition hover:border-accent/30 hover:shadow-sm ${
          compact ? "border-l-[3px] p-3" : "border-l-4 p-4"
        } ${scoreAccentClass(score)}`}
      >
        <div className="flex items-start gap-3">
          <CompanyMark name={job.company} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {compact && rank === 1 && score != null && score >= 70 && (
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                    Top match
                  </p>
                )}
                <p className="truncate font-semibold leading-snug text-text group-hover:text-accent">
                  {job.title}
                </p>
                <p className="mt-0.5 truncate text-sm text-text-muted">
                  {job.company}
                  {job.location ? ` · ${job.location}` : ""}
                </p>
              </div>
              <div className="shrink-0 pt-0.5">
                {pending ? (
                  <span className="flex size-10 flex-col items-center justify-center rounded-full border border-accent/30 bg-accent/5">
                    <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  </span>
                ) : failed ? (
                  <span className="flex size-10 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-xs font-semibold text-danger">
                    !
                  </span>
                ) : (
                  <ScoreRing score={score} size="sm" label="" />
                )}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {pending ? (
                <Badge variant="info">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                    Analyzing…
                  </span>
                </Badge>
              ) : failed ? (
                <Badge variant="danger">Analysis failed</Badge>
              ) : recLabel ? (
                <Badge variant={recommendationVariant(rec)}>{recLabel}</Badge>
              ) : (
                <Badge variant="default">Not analyzed</Badge>
              )}
              {shouldShowApplicationStatusBadge(applicationStatus) && (
                <Badge variant={applicationStatusVariant(applicationStatus)}>
                  {applicationStatusLabel(applicationStatus)}
                </Badge>
              )}
              <span className="text-[11px] text-text-muted">{progressSummary(progress)}</span>
            </div>

            {summary && !pending && (
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">{summary}</p>
            )}

            <div className="mt-2.5">
              <JobProgressBar
                progress={progress}
                activeTab={nextApplicationTab(job, analysis)}
                compact={compact}
              />
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

export function JobBoard({
  jobs,
  analyses,
  profileId,
  getApplicationStatusForJob,
}: JobBoardProps) {
  const embedded = useEmbeddedMode();

  if (jobs.length === 0) {
    if (IS_EXTENSION && embedded) {
      return <ExtensionEmptyPipeline />;
    }

    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-surface-raised px-5 py-12 text-center">
        <p className="text-3xl" aria-hidden>
          💼
        </p>
        <h3 className="mt-3 text-base font-semibold">No opportunities yet</h3>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-text-muted">
          {IS_EXTENSION
            ? "Capture a job from the tab you're viewing, or paste a description on Add job."
            : "Paste a job description — we'll extract fields and run explainable match analysis."}
        </p>
        <Link to="/jobs/new" className="mt-5">
          <Button>{IS_EXTENSION ? "Paste a job" : "Add your first job"}</Button>
        </Link>
      </div>
    );
  }

  const sorted = [...jobs].sort((a, b) => {
    const scoreA = scoreFromResult(latestAnalysisForJob(analyses, profileId, a.id)?.result) ?? -1;
    const scoreB = scoreFromResult(latestAnalysisForJob(analyses, profileId, b.id)?.result) ?? -1;
    return scoreB - scoreA;
  });

  return (
    <ul className={`grid gap-2.5 ${embedded ? "" : "sm:gap-3"}`}>
      {sorted.map((job, index) => (
        <JobOpportunityCard
          key={job.id}
          job={job}
          analysis={latestAnalysisForJob(analyses, profileId, job.id)}
          applicationStatus={getApplicationStatusForJob(job.id)}
          compact={embedded}
          rank={index + 1}
        />
      ))}
    </ul>
  );
}
