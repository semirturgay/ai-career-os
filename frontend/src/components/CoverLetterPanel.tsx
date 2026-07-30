import { useState } from "react";
import { api } from "../api/client";
import type { CoverLetterResult, MatchAnalysis } from "../types";
import { isFullMatch } from "../lib/matches";
import { AiLoadingState } from "./AiLoadingState";
import { Button, Card, ErrorBanner } from "./ui";

interface CoverLetterPanelProps {
  analysis: MatchAnalysis;
}

export function CoverLetterPanel({ analysis }: CoverLetterPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState<CoverLetterResult | null>(null);

  if (!isFullMatch(analysis)) return null;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.matchAnalyses.generateCoverLetter(analysis.id);
      setLetter(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate cover letter");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!letter) return;
    await navigator.clipboard.writeText(letter.body);
  }

  return (
    <Card
      title="Cover letter"
      description="Draft → critique → revise — max 400 characters"
    >
      {error && (
        <div className="mb-4">
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
    </Card>
  );
}
