import { useState } from "react";
import { api } from "../api/client";
import type { MatchAnalysis, ResumeOptimizationResult, ResumeSuggestion, Job } from "../types";
import { isFullMatch } from "../lib/matches";
import { readResumeProgress } from "../lib/matchImprovement";
import { AiLoadingState } from "./AiLoadingState";
import { MatchImprovementBanner } from "./MatchImprovementBanner";
import { Badge, Button, Card, ErrorBanner } from "./ui";

interface ResumeOptimizationPanelProps {
  job: Job;
  analysis: MatchAnalysis;
  profileId: string;
  jobAnalyses: MatchAnalysis[];
  onApplied: () => void | Promise<void>;
  onReAnalyze: () => void;
  analyzing?: boolean;
  flat?: boolean;
  onGenerated?: () => void;
}

export function ResumeOptimizationPanel({
  job,
  analysis,
  profileId,
  jobAnalyses,
  onApplied,
  onReAnalyze,
  analyzing = false,
  flat = false,
  onGenerated,
}: ResumeOptimizationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeOptimizationResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState(false);

  const gaps = analysis.result?.gaps ?? [];
  const canOptimize = isFullMatch(analysis) && gaps.length > 0;
  const resumeProgress = readResumeProgress(job);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const optimization = await api.matchAnalyses.optimizeResume(analysis.id);
      setResult(optimization);
      setSelected(new Set(optimization.suggestions.map((_, index) => index)));
      setApplied(false);
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate suggestions");
    } finally {
      setLoading(false);
    }
  }

  function toggleSuggestion(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleApply() {
    if (!result) return;
    const suggestions = result.suggestions.filter((_, index) => selected.has(index));
    if (suggestions.length === 0) {
      setError("Select at least one suggestion to apply");
      return;
    }

    setApplying(true);
    setError(null);
    try {
      await api.profiles.applyResumeSuggestions(profileId, suggestions, {
        jobId: job.id,
        matchAnalysisId: analysis.id,
      });
      setApplied(true);
      await onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply suggestions");
    } finally {
      setApplying(false);
    }
  }

  if (!canOptimize) return null;

  const content = (
    <>
      {error && (
        <div className={flat ? "mb-3" : "mb-4"}>
          <ErrorBanner message={error} />
        </div>
      )}

      {!result && !loading && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            The matcher found {gaps.length} gap{gaps.length === 1 ? "" : "s"}. Generate
            honest rewrite suggestions grounded in your existing experience.
          </p>
          <p className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs leading-relaxed text-text-muted">
            After you apply suggestions, re-run deep match analysis to measure how much your
            score improved — we track the before and after for this job.
          </p>
          <Button onClick={handleGenerate}>Generate resume suggestions</Button>
        </div>
      )}

      {loading && <AiLoadingState variant="resume-optimize" size="md" />}

      {result && !loading && (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-text">{result.summary}</p>

          <ul className="space-y-4">
            {result.suggestions.map((suggestion, index) => (
              <SuggestionItem
                key={`${suggestion.target_label}-${index}`}
                suggestion={suggestion}
                selected={selected.has(index)}
                onToggle={() => toggleSuggestion(index)}
              />
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleApply} loading={applying} disabled={selected.size === 0}>
              Apply selected to profile
            </Button>
            <Button variant="ghost" onClick={() => setResult(null)} disabled={applying}>
              Regenerate
            </Button>
          </div>

          {applied && (
            <p className="text-sm font-medium text-success">Profile updated with selected suggestions.</p>
          )}

          {(applied || resumeProgress) && (
            <MatchImprovementBanner
              job={job}
              analysis={analysis}
              profileId={profileId}
              jobAnalyses={jobAnalyses}
              onReAnalyze={onReAnalyze}
              analyzing={analyzing}
              prominent={applied || !!resumeProgress?.awaiting_reanalysis}
            />
          )}
        </div>
      )}

      {!result && !loading && resumeProgress && (
        <MatchImprovementBanner
          job={job}
          analysis={analysis}
          profileId={profileId}
          jobAnalyses={jobAnalyses}
          onReAnalyze={onReAnalyze}
          analyzing={analyzing}
          prominent={!!resumeProgress.awaiting_reanalysis}
        />
      )}
    </>
  );

  if (flat) {
    return <div>{content}</div>;
  }

  return (
    <Card
      title="Resume improvements"
      description="Tailor your profile to close gaps for this job — review before applying"
    >
      {content}
    </Card>
  );
}

function SuggestionItem({
  suggestion,
  selected,
  onToggle,
}: {
  suggestion: ResumeSuggestion;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="rounded-lg border border-border bg-surface px-4 py-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 size-4 rounded border-border accent-accent"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{suggestion.section}</Badge>
            <Badge variant="default">{suggestion.action}</Badge>
            <span className="text-xs text-text-muted">{suggestion.target_label}</span>
          </div>
          <p className="text-xs text-text-muted">Gap: {suggestion.gap_evidence}</p>
          {suggestion.current_text && (
            <p className="text-sm text-text-muted line-through">{suggestion.current_text}</p>
          )}
          <p className="text-sm text-text">{suggestion.suggested_text}</p>
          <p className="text-xs text-text-muted">{suggestion.rationale}</p>
        </div>
      </label>
    </li>
  );
}
