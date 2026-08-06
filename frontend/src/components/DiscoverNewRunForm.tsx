import { useState } from "react";
import type {
  DiscoveryCreate,
  DiscoveryDefaultInterval,
  DiscoveryInterval,
  DiscoveryRemotePreference,
} from "../types/discovery";
import { DISCOVERY_INTERVAL_OPTIONS } from "../types/discovery";
import { intervalLabel } from "../lib/discoveryIntervals";
import { Button, Field, Input, Select, Textarea } from "./ui";

interface DiscoverNewMonitorFormProps {
  onSubmit: (input: DiscoveryCreate) => Promise<void>;
  loading?: boolean;
  compact?: boolean;
  defaultInterval: DiscoveryDefaultInterval;
}

const REMOTE_OPTIONS: { value: DiscoveryRemotePreference; label: string }[] = [
  { value: "any", label: "Any work mode" },
  { value: "remote", label: "Remote only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site only" },
];

export function DiscoverNewMonitorForm({
  onSubmit,
  loading,
  compact,
  defaultInterval,
}: DiscoverNewMonitorFormProps) {
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [remote, setRemote] = useState<DiscoveryRemotePreference>("any");
  const [interval, setInterval] = useState<DiscoveryInterval>("default");
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState(!compact);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    await onSubmit({
      title: title.trim(),
      country: country.trim() || null,
      city: city.trim() || null,
      remote,
      interval,
      notes: notes.trim() || null,
    });

    setTitle("");
    setCountry("");
    setCity("");
    setRemote("any");
    setInterval("default");
    setNotes("");
    if (compact) {
      setExpanded(false);
    }
  }

  if (compact && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/40 bg-accent/5 px-4 py-3 text-sm font-medium text-accent transition hover:border-accent/60 hover:bg-accent/10"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
          <path
            fillRule="evenodd"
            d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
            clipRule="evenodd"
          />
        </svg>
        New discovery
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-4 rounded-xl border border-border bg-surface-raised p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text">Create a discovery</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Saved search that re-runs on a schedule. Open new links and capture from the page.
          </p>
        </div>
        {compact && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="shrink-0 text-xs text-text-muted hover:text-text"
          >
            Collapse
          </button>
        )}
      </div>

      <Field label="Job title" hint="e.g. Senior Backend Engineer">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Role you're targeting"
          required
          autoComplete="off"
        />
      </Field>

      <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
        <Field label="Country" hint="Optional">
          <Input
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="Germany"
            autoComplete="country-name"
          />
        </Field>
        <Field label="City" hint="Optional">
          <Input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Berlin"
            autoComplete="address-level2"
          />
        </Field>
      </div>

      <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
        <Field label="Work mode">
          <Select
            value={remote}
            onChange={(event) => setRemote(event.target.value as DiscoveryRemotePreference)}
          >
            {REMOTE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Run interval" hint="Uses your Settings default when set to Default">
          <Select
            value={interval}
            onChange={(event) => setInterval(event.target.value as DiscoveryInterval)}
          >
            {DISCOVERY_INTERVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value === "default"
                  ? intervalLabel("default", defaultInterval)
                  : option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" hint="Optional — stack, seniority, industries to prefer or avoid">
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Python, fintech, no agencies…"
          rows={2}
        />
      </Field>

      <Button type="submit" loading={loading} disabled={!title.trim()} className="w-full sm:w-auto">
        Create & run now
      </Button>
    </form>
  );
}

/** @deprecated use DiscoverNewMonitorForm */
export const DiscoverNewRunForm = DiscoverNewMonitorForm;
