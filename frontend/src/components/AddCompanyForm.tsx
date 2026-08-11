import { useState } from "react";

import { Badge, Button, ErrorBanner, Field, Input } from "./ui";
import { ATS_PROVIDER_LABELS, type ResolvedBoard } from "../types/radar";

interface AddCompanyFormProps {
  onResolve: (query: string) => Promise<ResolvedBoard>;
  onConfirm: (board: ResolvedBoard) => Promise<void>;
}

const RESOLVED_VIA_HINT: Record<ResolvedBoard["resolved_via"], string> = {
  url: "Matched directly from the URL you pasted.",
  probe: "Found by checking each ATS for a board with this name.",
  search: "Found via web search — double-check it's the right company.",
};

export function AddCompanyForm({ onResolve, onConfirm }: AddCompanyFormProps) {
  const [query, setQuery] = useState("");
  const [candidate, setCandidate] = useState<ResolvedBoard | null>(null);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;

    setResolving(true);
    setError(null);
    setCandidate(null);
    try {
      setCandidate(await onResolve(query.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find a board for that company");
    } finally {
      setResolving(false);
    }
  }

  async function handleConfirm() {
    if (!candidate) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(candidate);
      setQuery("");
      setCandidate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that company");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleResolve} className="space-y-3">
        <Field
          label="Company name or careers URL"
          hint="We look for a public Greenhouse, Lever, or Ashby board. Pasting the careers URL is the surest way."
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Anthropic — or https://job-boards.greenhouse.io/anthropic"
            disabled={resolving || saving}
          />
        </Field>
        <Button type="submit" loading={resolving} disabled={!query.trim() || saving}>
          Find board
        </Button>
      </form>

      {error && <ErrorBanner message={error} />}

      {/* A left rule rather than a full card — this sits inside a form and a second
          bordered box costs real width in the side panel. */}
      {candidate && (
        <div className="space-y-2 border-l-2 border-accent/50 pl-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-text">{candidate.name}</span>
            <Badge variant="info">{ATS_PROVIDER_LABELS[candidate.ats_provider]}</Badge>
            {candidate.open_role_count != null && (
              <Badge>{candidate.open_role_count} open roles</Badge>
            )}
          </div>
          <a
            href={candidate.board_url}
            target="_blank"
            rel="noreferrer"
            className="block break-all text-xs text-accent underline"
          >
            {candidate.board_url}
          </a>
          <p className="text-xs text-text-muted">{RESOLVED_VIA_HINT[candidate.resolved_via]}</p>
          <div className="flex items-center gap-1.5 pt-0.5">
            <Button size="sm" onClick={handleConfirm} loading={saving}>
              Add to radar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCandidate(null)} disabled={saving}>
              Not this one
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
