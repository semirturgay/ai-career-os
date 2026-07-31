import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { CoverLetterResult, Job, MatchAnalysis } from "../types";
import { taskKey, trackAsyncTask, useAsyncTask } from "../lib/asyncTasks";
import { readCoverLetterArtifact } from "../lib/jobArtifacts";
import { isFullMatch } from "../lib/matches";
import { AiLoadingState } from "./AiLoadingState";
import { Button, Card, ErrorBanner } from "./ui";

interface CoverLetterPanelProps {
  job: Job;
  analysis: MatchAnalysis;
  flat?: boolean;
  onGenerated?: () => void | Promise<void>;
}

export function CoverLetterPanel({
  job,
  analysis,
  flat = false,
  onGenerated,
}: CoverLetterPanelProps) {
  const generateTaskKey = taskKey("cover", job.id, analysis.id);
  const generateTask = useAsyncTask(generateTaskKey);
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState<CoverLetterResult | null>(() =>
    readCoverLetterArtifact(job, analysis.id),
  );
  const loading = generateTask?.status === "running";

  useEffect(() => {
    const saved = readCoverLetterArtifact(job, analysis.id);
    if (saved) setLetter(saved);
  }, [job.id, job.updated_at, analysis.id]);

  if (!isFullMatch(analysis)) return null;

  async function handleGenerate() {
    setError(null);
    try {
      const result = await trackAsyncTask(
        {
          key: generateTaskKey,
          kind: "cover",
          jobId: job.id,
          label: "Generating cover letter",
        },
        () => api.matchAnalyses.generateCoverLetter(analysis.id),
      );
      setLetter(result);
      await onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate cover letter");
    }
  }

  async function handleCopy() {
    if (!letter) return;
    await navigator.clipboard.writeText(letter.body);
  }

  const content = (
    <>
      {error && (
        <div className={flat ? "mb-3" : "mb-4"}>
          <ErrorBanner message={error} />
        </div>
      )}

      {!letter && !loading && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Generates a short tailored note (max 400 characters) from your match analysis,
            company research, and resume evidence, then self-critiques and revises.
          </p>
          <Button onClick={handleGenerate}>Generate cover letter</Button>
        </div>
      )}

      {loading && <AiLoadingState variant="cover-letter" size="md" />}

      {letter && !loading && (
        <div className="space-y-4">
          <p className="text-xs text-text-muted">{letter.critique_summary}</p>
          <div className="rounded-lg border border-border bg-surface px-4 py-4">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-text">
              {letter.body}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleCopy}>
              Copy to clipboard
            </Button>
            <Button variant="ghost" onClick={() => setLetter(null)} disabled={loading}>
              Regenerate
            </Button>
          </div>
        </div>
      )}
    </>
  );

  if (flat) {
    return <div>{content}</div>;
  }

  return (
    <Card
      title="Cover letter"
      description="Draft → critique → revise — max 400 characters"
    >
      {content}
    </Card>
  );
}
