import type { CoverLetterResult, Job, ResumeOptimizationResult } from "../types";

const ARTIFACTS_KEY = "artifacts";

export function readResumeArtifact(
  job: Job,
  analysisId: string,
): ResumeOptimizationResult | null {
  return readArtifact<ResumeOptimizationResult>(job, "resume_optimization", analysisId);
}

export function readCoverLetterArtifact(
  job: Job,
  analysisId: string,
): CoverLetterResult | null {
  return readArtifact<CoverLetterResult>(job, "cover_letter", analysisId);
}

function readArtifact<T>(
  job: Job,
  artifactType: string,
  analysisId: string,
): T | null {
  const raw = job.raw_metadata?.[ARTIFACTS_KEY];
  if (!raw || typeof raw !== "object") return null;
  const entry = (raw as Record<string, unknown>)[artifactType];
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  if (record.analysis_id !== analysisId) return null;
  return (record.result as T) ?? null;
}
