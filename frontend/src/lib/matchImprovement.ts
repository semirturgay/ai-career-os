import type { Job, MatchAnalysis } from "../types";
import { isFullMatch, scoreFromResult } from "./matches";

export interface ResumeProgress {
  baseline_score?: number;
  baseline_gap_count?: number;
  baseline_analysis_id?: string;
  awaiting_reanalysis?: boolean;
  remeasured_score?: number;
  remeasured_analysis_id?: string;
  score_delta?: number;
  remeasured_gap_count?: number;
  suggestions_count?: number;
  suggestions_applied_at?: string;
}

export interface MatchScoreSnapshot {
  analysisId: string;
  score: number;
  gapCount: number;
  createdAt: string;
}

export function readResumeProgress(job: Job): ResumeProgress | null {
  const progress = job.raw_metadata?.application_progress;
  if (!progress || typeof progress !== "object") return null;
  const resume = (progress as Record<string, unknown>).resume;
  if (!resume || typeof resume !== "object") return null;
  return resume as ResumeProgress;
}

export function matchScoreHistory(
  analyses: MatchAnalysis[],
  profileId: string,
  jobId: string,
): MatchScoreSnapshot[] {
  return analyses
    .filter(
      (analysis) =>
        analysis.profile_id === profileId &&
        analysis.job_id === jobId &&
        analysis.status === "completed" &&
        isFullMatch(analysis),
    )
    .map((analysis) => ({
      analysisId: analysis.id,
      score: scoreFromResult(analysis.result) ?? 0,
      gapCount: analysis.result?.gaps?.length ?? 0,
      createdAt: analysis.created_at,
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function formatScoreDelta(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(0)}`;
  if (delta < 0) return delta.toFixed(0);
  return "0";
}
