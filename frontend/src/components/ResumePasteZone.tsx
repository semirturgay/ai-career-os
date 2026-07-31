import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { ResumeParseResult } from "../types";
import { AiLoadingState } from "./AiLoadingState";
import { Button, ErrorBanner, Textarea } from "./ui";

const MIN_CHARS = 100;

interface ResumePasteZoneProps {
  onParsed: (result: ResumeParseResult) => void;
  compact?: boolean;
}

export function ResumePasteZone({ onParsed, compact = false }: ResumePasteZoneProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pasteText, setPasteText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = pasteText.trim().length;
  const canExtract = charCount >= MIN_CHARS;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleExtract() {
    if (!canExtract) {
      setError(`Paste at least ${MIN_CHARS} characters of your resume`);
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const result = await api.profiles.parseText(pasteText);
      onParsed(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to extract resume fields");
    } finally {
      setExtracting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canExtract && !extracting) {
      e.preventDefault();
      void handleExtract();
    }
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div
        className={`rounded-xl border-2 border-dashed transition ${
          extracting
            ? "border-accent/40 bg-accent/5"
            : "border-border bg-surface hover:border-accent/30"
        }`}
      >
        <div className={compact ? "p-4" : "p-5 sm:p-6"}>
          {extracting ? (
            <div className={compact ? "py-6" : "py-8"}>
              <AiLoadingState variant="resume-extract" size="md" />
            </div>
          ) : (
            <>
              <Textarea
                ref={textareaRef}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste your full resume — experience, skills, education, contact info…"
                rows={compact ? 12 : 16}
                className={`border-0 bg-transparent p-0 shadow-none focus:ring-0 ${
                  compact ? "min-h-[220px]" : "min-h-[320px]"
                }`}
              />
              <p className="mt-3 text-xs text-text-muted">
                Copy from LinkedIn, a PDF, or any document.{" "}
                <kbd className="rounded border border-border bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px]">
                  ⌘ Enter
                </kbd>{" "}
                to extract.
              </p>
            </>
          )}
        </div>
      </div>

      {!extracting && (
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-muted">
            {charCount > 0
              ? `${charCount.toLocaleString()} characters${
                  canExtract ? " · ready" : ` · ${MIN_CHARS - charCount} more needed`
                }`
              : `At least ${MIN_CHARS} characters required`}
          </p>
          <Button onClick={handleExtract} disabled={!canExtract} className="sm:min-w-[180px]">
            Extract resume →
          </Button>
        </div>
      )}
    </div>
  );
}
