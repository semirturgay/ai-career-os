import { useEffect, useState } from "react";
import { DISCOVERY_DEFAULT_INTERVAL_OPTIONS, type DiscoveryDefaultInterval } from "../types/discovery";
import {
  loadDiscoveryDefaultInterval,
  setDiscoveryDefaultInterval,
  subscribeDiscoveryDefaultInterval,
} from "../lib/discoverySettings";
import { Field, Select } from "./ui";

export function DiscoverDefaultIntervalSetting() {
  const [interval, setInterval] = useState<DiscoveryDefaultInterval>(loadDiscoveryDefaultInterval);

  useEffect(() => {
    return subscribeDiscoveryDefaultInterval(() => {
      setInterval(loadDiscoveryDefaultInterval());
    });
  }, []);

  return (
    <section className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-text">Job discovery</h2>
        <p className="text-sm text-text-muted">
          Default run interval for new discoveries set to &ldquo;Default&rdquo;. Override per
          discovery on the Discover tab.
        </p>
      </div>

      <div className="mt-4 max-w-md">
        <Field label="Default interval">
          <Select
            value={interval}
            onChange={(event) => {
              const next = event.target.value as DiscoveryDefaultInterval;
              setInterval(next);
              setDiscoveryDefaultInterval(next);
            }}
          >
            {DISCOVERY_DEFAULT_INTERVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </section>
  );
}
