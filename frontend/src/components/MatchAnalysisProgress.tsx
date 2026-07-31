import type { MatchAnalysis } from "../types";

interface MatchAnalysisProgressProps {
  analysis: MatchAnalysis | null;
  showUnlocks?: boolean;
}

const STEPS = ["Analyzing", "Ready"] as const;

function activeStep(analysis: MatchAnalysis | null): number {
  if (!analysis) return 0;
  if (analysis.status === "completed") return 1;
  if (analysis.status === "failed") return 1;
  return 0;
}

export function MatchAnalysisProgress({ analysis, showUnlocks = false }: MatchAnalysisProgressProps) {
  if (!analysis) return null;

  const step = activeStep(analysis);
  const failed = analysis.status === "failed";

  return (
    <div className="rounded-xl border border-border bg-surface-raised px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {failed ? "Analysis failed" : step === 1 ? "Analysis complete" : "Analyzing your fit"}
        </p>
        {analysis.status === "pending" && (
          <span className="text-xs text-text-muted">Usually under 30 seconds</span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1">
        {STEPS.map((label, index) => {
          const done = index < step;
          const active = index === step && !failed;
          const failedHere = failed && index === step;
          return (
            <div key={label} className="flex flex-1 items-center gap-1">
              {index > 0 && (
                <span
                  className={`h-0.5 flex-1 ${done ? "bg-accent" : "bg-border"}`}
                  aria-hidden
                />
              )}
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  failedHere
                    ? "bg-danger/15 text-danger"
                    : done
                      ? "bg-accent/20 text-accent"
                      : active
                        ? "bg-accent text-white"
                        : "bg-surface-overlay text-text-muted"
                }`}
              >
                {done ? "✓ " : ""}
                {failedHere ? "Failed" : label}
              </span>
            </div>
          );
        })}
      </div>

      {showUnlocks && step === 1 && analysis.status === "completed" && (
        <p className="mt-3 text-sm text-text-muted">
          Full analysis ready — continue with research, resume tailoring, and cover letter to
          complete your pipeline progress.
        </p>
      )}
    </div>
  );
}
