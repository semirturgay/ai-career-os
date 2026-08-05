import type { MatchAnalysis, MatchResult, Job } from "../types";
import { MatchImprovementBanner } from "./MatchImprovementBanner";
import {
  GapDisputeFeedback,
  MatchFeedbackPanel,
  useJobFeedback,
  type MatchFeedbackContext,
} from "./MatchFeedbackControls";
import { ScoreRing } from "./ScoreRing";
import { Badge, Button, Card } from "./ui";

interface MatchResultPanelProps {
  analysis: MatchAnalysis | null;
  job?: Job;
  profileId?: string;
  jobAnalyses?: MatchAnalysis[];
  profileName?: string;
  jobTitle?: string;
  onAnalyze?: () => void;
  analyzing?: boolean;
}

function analyzeLabel(analysis: MatchAnalysis | null): string {
  if (analysis?.status === "failed") return "Retry analysis";
  if (analysis?.status === "completed") return "Re-analyze match";
  return "Analyze match";
}

const recommendationLabels: Record<
  MatchResult["recommendation"],
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  apply: { label: "Apply", variant: "success" },
  "maybe apply": { label: "Maybe", variant: "warning" },
  "do not apply": { label: "Skip", variant: "danger" },
};

function ResultContent({
  result,
  feedbackContext,
}: {
  result: MatchResult;
  feedbackContext?: MatchFeedbackContext;
}) {
  const rec = recommendationLabels[result.recommendation];
  const isLegacyScreen = result.depth === "screen";
  const { events, loading, refresh } = useJobFeedback(feedbackContext?.jobId);
  const showFeedback = Boolean(feedbackContext) && !isLegacyScreen && !loading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-6">
        <ScoreRing score={result.score} size="lg" />
        <div className="flex flex-wrap gap-2">
          <Badge variant={rec.variant}>{rec.label}</Badge>
        </div>
      </div>

      {isLegacyScreen && result.reason && (
        <p className="text-sm text-text-muted">{result.reason}</p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-text-muted">Summary</h3>
        <p className="text-sm leading-relaxed text-text">{result.summary}</p>
      </div>

      {showFeedback && feedbackContext && (
        <MatchFeedbackPanel
          context={feedbackContext}
          gaps={result.gaps ?? []}
          events={events}
          onSubmitted={() => void refresh()}
        />
      )}

      {!isLegacyScreen && (result.strengths?.length ?? 0) > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-success">Strengths</h3>
          <ul className="space-y-3">
            {result.strengths.map((s, i) => (
              <li
                key={i}
                className="rounded-lg border border-success/20 bg-success/5 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-text">{s.evidence}</p>
                  <Badge variant="success">{s.point.toFixed(1)}/10</Badge>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLegacyScreen && (result.gaps?.length ?? 0) > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-warning">Gaps</h3>
          <ul className="space-y-3">
            {result.gaps.map((g, i) => (
              <li
                key={i}
                className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-text">{g.evidence}</p>
                  <div className="flex shrink-0 gap-2">
                    <Badge variant={severityVariant(g.severity)}>{g.severity}</Badge>
                    <Badge variant="warning">{g.point.toFixed(1)}/10</Badge>
                  </div>
                </div>
                {showFeedback && feedbackContext && (
                  <GapDisputeFeedback
                    context={feedbackContext}
                    gap={g}
                    events={events}
                    onSubmitted={() => void refresh()}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLegacyScreen && (result.retrieved_chunks?.length ?? 0) > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-text-muted">Resume evidence used</h3>
          <ul className="space-y-2">
            {result.retrieved_chunks!.map((chunk) => (
              <li
                key={chunk.id}
                className="rounded-lg border border-border bg-surface-elevated px-4 py-3"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="info">{chunk.section}</Badge>
                  <span className="font-mono text-xs text-text-muted">{chunk.id}</span>
                  <span className="text-xs text-text-muted">
                    relevance {(chunk.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-text">{chunk.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function severityVariant(severity: MatchResult["gaps"][number]["severity"]) {
  if (severity === "high") return "danger";
  if (severity === "medium") return "warning";
  return "info";
}

export function MatchResultPanel({
  analysis,
  job,
  profileId,
  jobAnalyses = [],
  profileName,
  jobTitle,
  onAnalyze,
  analyzing = false,
}: MatchResultPanelProps) {
  const showAnalyzeButton = onAnalyze && analysis?.status !== "pending";

  if (!analysis) {
    return (
      <Card title="Match result" description="Run an analysis to see explainable output here">
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-center text-sm text-text-muted">
            Compare this job against your profile for an explainable fit score.
          </p>
          {onAnalyze && (
            <Button onClick={onAnalyze} loading={analyzing}>
              Analyze match
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const statusVariant =
    analysis.status === "completed"
      ? "success"
      : analysis.status === "failed"
        ? "danger"
        : "info";

  return (
    <Card
      title="Match result"
      description={
        profileName && jobTitle
          ? `${profileName} → ${jobTitle}`
          : "Explainable match analysis"
      }
      action={
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={statusVariant}>{analysis.status}</Badge>
          {showAnalyzeButton && (
            <Button variant="secondary" onClick={onAnalyze} loading={analyzing} className="px-3 py-1.5">
              {analyzeLabel(analysis)}
            </Button>
          )}
        </div>
      }
    >
      {job && profileId && (
        <div className="mb-4">
          <MatchImprovementBanner
            job={job}
            analysis={analysis}
            profileId={profileId}
            jobAnalyses={jobAnalyses}
            onReAnalyze={onAnalyze}
            analyzing={analyzing}
          />
        </div>
      )}

      {analysis.status === "failed" && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {analysis.error ?? "Analysis failed"}
        </div>
      )}

      {analysis.status === "completed" && analysis.result && (
        <ResultContent
          result={analysis.result}
          feedbackContext={
            profileId && job
              ? {
                  profileId,
                  jobId: job.id,
                  analysisId: analysis.id,
                }
              : undefined
          }
        />
      )}

      {analysis.status === "completed" && !analysis.result && (
        <p className="py-4 text-center text-sm text-text-muted">No result data yet.</p>
      )}
    </Card>
  );
}
