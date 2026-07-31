import type { Job, MatchAnalysis } from "../types";
import {
  formatScoreDelta,
  matchScoreHistory,
  readResumeProgress,
  type MatchScoreSnapshot,
} from "../lib/matchImprovement";
import { Button } from "./ui";

interface MatchImprovementBannerProps {
  job: Job;
  analysis: MatchAnalysis | null;
  profileId: string;
  jobAnalyses: MatchAnalysis[];
  onReAnalyze?: () => void;
  analyzing?: boolean;
  prominent?: boolean;
}

function ScoreHistoryStrip({ history }: { history: MatchScoreSnapshot[] }) {
  if (history.length < 2) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
      <span className="font-medium text-text">Score history</span>
      {history.map((entry, index) => (
        <span key={entry.analysisId} className="inline-flex items-center gap-2">
          {index > 0 && <span aria-hidden>→</span>}
          <span className="rounded-md bg-surface-overlay px-2 py-0.5 tabular-nums font-medium text-text">
            {entry.score}
          </span>
        </span>
      ))}
    </div>
  );
}

export function MatchImprovementBanner({
  job,
  analysis,
  profileId,
  jobAnalyses,
  onReAnalyze,
  analyzing = false,
  prominent = false,
}: MatchImprovementBannerProps) {
  const resumeProgress = readResumeProgress(job);
  const history = matchScoreHistory(jobAnalyses, profileId, job.id);

  if (!resumeProgress) return null;

  const awaiting = resumeProgress.awaiting_reanalysis;
  const hasImprovement =
    !awaiting &&
    resumeProgress.score_delta != null &&
    resumeProgress.baseline_score != null &&
    resumeProgress.remeasured_score != null;

  if (!awaiting && !hasImprovement) return null;

  if (awaiting) {
    return (
      <div
        className={`rounded-xl border border-accent/40 bg-accent/5 ${
          prominent ? "px-5 py-4" : "px-4 py-3"
        }`}
      >
        <p className={`font-semibold text-text ${prominent ? "text-base" : "text-sm"}`}>
          Measure your improvement
        </p>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">
          You updated your profile with{" "}
          {resumeProgress.suggestions_count ?? "tailored"} resume suggestion
          {(resumeProgress.suggestions_count ?? 1) === 1 ? "" : "s"}. Re-run deep match
          analysis to see how much your score improved
          {resumeProgress.baseline_score != null
            ? ` from ${Math.round(resumeProgress.baseline_score)}`
            : ""}
          .
        </p>
        {onReAnalyze && (
          <Button className="mt-3" onClick={onReAnalyze} loading={analyzing}>
            Re-run deep analysis
          </Button>
        )}
        {resumeProgress.baseline_score != null && (
          <p className="mt-2 text-xs text-text-muted">
            Baseline before tailoring:{" "}
            <span className="font-medium tabular-nums text-text">
              {Math.round(resumeProgress.baseline_score)}
            </span>
            {resumeProgress.baseline_gap_count != null && (
              <>
                {" "}
                · {resumeProgress.baseline_gap_count} gap
                {resumeProgress.baseline_gap_count === 1 ? "" : "s"}
              </>
            )}
          </p>
        )}
      </div>
    );
  }

  const delta = resumeProgress.score_delta ?? 0;
  const improved = delta > 0;
  const baseline = Math.round(resumeProgress.baseline_score!);
  const current = Math.round(resumeProgress.remeasured_score!);
  const isCurrentAnalysis =
    analysis?.id === resumeProgress.remeasured_analysis_id ||
    analysis?.id === jobAnalyses[jobAnalyses.length - 1]?.id;

  return (
    <div
      className={`rounded-xl border ${
        improved ? "border-success/40 bg-success/5" : "border-border bg-surface-overlay/40"
      } ${prominent ? "px-5 py-4" : "px-4 py-3"}`}
    >
      <p className={`font-semibold ${improved ? "text-success" : "text-text"} ${prominent ? "text-base" : "text-sm"}`}>
        {improved
          ? `Match improved ${formatScoreDelta(delta)} points`
          : delta < 0
            ? `Match changed ${formatScoreDelta(delta)} points`
            : "Match score unchanged after tailoring"}
      </p>
      <p className="mt-1 text-sm text-text-muted">
        <span className="tabular-nums font-medium text-text">{baseline}</span>
        {" → "}
        <span className="tabular-nums font-medium text-text">{current}</span>
        {isCurrentAnalysis && analysis?.result?.gaps && resumeProgress.remeasured_gap_count != null && (
          <>
            {" "}
            · gaps {resumeProgress.baseline_gap_count ?? "?"} → {resumeProgress.remeasured_gap_count}
          </>
        )}
      </p>
      <ScoreHistoryStrip history={history} />
    </div>
  );
}
