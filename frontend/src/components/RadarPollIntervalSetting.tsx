import { useEffect, useState } from "react";

import { api } from "../api/client";
import { ErrorBanner, Field, Select } from "./ui";
import { POLL_INTERVAL_LABELS, type RadarPollInterval } from "../types/radar";

const INTERVALS: RadarPollInterval[] = ["daily", "3d", "weekly"];

export function RadarPollIntervalSetting() {
  const [interval, setIntervalValue] = useState<RadarPollInterval>("daily");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.radar
      .getPollInterval()
      .then((result) => {
        if (!cancelled) setIntervalValue(result.radar_poll_interval);
      })
      .catch(() => {
        /* leave the default — this control is not load-bearing */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChange(next: RadarPollInterval) {
    const previous = interval;
    setIntervalValue(next);
    setSaving(true);
    setError(null);
    try {
      await api.radar.setPollInterval(next);
    } catch (err) {
      setIntervalValue(previous);
      setError(err instanceof Error ? err.message : "Could not save that interval");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-w-0 space-y-3">
      <div>
        <h3 className="font-semibold">Radar</h3>
        <p className="text-xs text-text-muted sm:text-sm">
          How often we check each watched company's careers board for new roles.
        </p>
      </div>
      {error && <ErrorBanner message={error} />}
      <Field label="Check for new postings">
        <Select
          value={interval}
          disabled={loading || saving}
          onChange={(event) => handleChange(event.target.value as RadarPollInterval)}
        >
          {INTERVALS.map((value) => (
            <option key={value} value={value}>
              {POLL_INTERVAL_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>
    </section>
  );
}
