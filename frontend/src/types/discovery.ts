export type DiscoveryRunStatus = "pending" | "running" | "completed" | "failed";

export type DiscoveryRemotePreference = "any" | "remote" | "hybrid" | "onsite";

/** Per-monitor interval; `default` uses the profile/workspace default from Settings. */
export type DiscoveryInterval = "default" | "daily" | "3d" | "weekly";

/** Concrete schedule used when interval is not `default`. */
export type DiscoveryDefaultInterval = "daily" | "3d" | "weekly";

export interface DiscoveryCriteria {
  title: string;
  country: string | null;
  city: string | null;
  remote: DiscoveryRemotePreference;
  notes: string | null;
}

export interface JobDiscoveryCandidate {
  id: string;
  title: string;
  company: string;
  url: string;
  snippet: string;
  source: string | null;
  fit_score: number | null;
  fit_reason: string | null;
  dismissed: boolean;
  first_seen_at: string;
  last_seen_at: string;
}

/** Scheduled discovery monitor — runs on an interval and accumulates candidates. */
export interface JobDiscovery {
  id: string;
  profile_id: string;
  criteria: DiscoveryCriteria;
  interval: DiscoveryInterval;
  enabled: boolean;
  status: DiscoveryRunStatus;
  candidates: JobDiscoveryCandidate[];
  error: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryCreate {
  title: string;
  country?: string | null;
  city?: string | null;
  remote?: DiscoveryRemotePreference;
  notes?: string | null;
  interval?: DiscoveryInterval;
}

export interface DiscoveryUpdate {
  interval?: DiscoveryInterval;
  enabled?: boolean;
}

export const DISCOVERY_INTERVAL_OPTIONS: {
  value: DiscoveryInterval;
  label: string;
  hint?: string;
}[] = [
  { value: "default", label: "Default (from settings)" },
  { value: "daily", label: "Daily" },
  { value: "3d", label: "Every 3 days" },
  { value: "weekly", label: "Weekly" },
];

export const DISCOVERY_DEFAULT_INTERVAL_OPTIONS: {
  value: DiscoveryDefaultInterval;
  label: string;
}[] = [
  { value: "daily", label: "Daily" },
  { value: "3d", label: "Every 3 days" },
  { value: "weekly", label: "Weekly (recommended)" },
];

/** @deprecated use JobDiscovery */
export type JobDiscoveryRun = JobDiscovery;

/** @deprecated use DiscoveryCreate */
export type DiscoveryRunCreate = DiscoveryCreate;
