import { useState } from "react";

import { Button, ErrorBanner, Input } from "./ui";

interface RadarTargetBarProps {
  target: string | null;
  headline: string | null;
  compact: boolean;
  onSave: (target: string) => Promise<void>;
}

/** What Radar should surface. Lives on the profile, not per company — your field
 *  doesn't change from one employer to the next. */
export function RadarTargetBar({ target, headline, compact, onSave }: RadarTargetBarProps) {
  const effective = target?.trim() || headline?.trim() || "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(effective);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
        <label className="block text-xs font-medium text-text-muted" htmlFor="radar-target">
          Looking for
        </label>
        <Input
          id="radar-target"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleSave();
            if (event.key === "Escape") {
              setDraft(effective);
              setEditing(false);
            }
          }}
          placeholder="Senior backend or platform engineering, remote in Europe"
          disabled={saving}
        />
        <p className="text-xs text-text-muted">
          Plain language. We use it to skip roles in other fields before scoring anything.
        </p>
        {error && <ErrorBanner message={error} />}
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={handleSave} loading={saving}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setDraft(effective);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`flex w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-surface-raised text-left transition hover:border-accent/30 ${
        compact ? "px-3 py-2" : "px-4 py-2.5"
      }`}
    >
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-text-muted">
        Looking for
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          effective ? "text-text" : "text-text-muted italic"
        }`}
      >
        {effective || "Anything — tap to narrow it down"}
      </span>
      <span className="shrink-0 text-xs text-accent">Edit</span>
    </button>
  );
}
