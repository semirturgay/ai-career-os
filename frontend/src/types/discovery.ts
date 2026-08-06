export type DiscoveryRunStatus = "pending" | "running" | "completed" | "failed";

export type DiscoveryRemotePreference = "any" | "remote" | "hybrid" | "onsite";

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
}

export interface JobDiscoveryRun {
  id: string;
  profile_id: string;
  criteria: DiscoveryCriteria;
  status: DiscoveryRunStatus;
  candidates: JobDiscoveryCandidate[];
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface DiscoveryRunCreate {
  title: string;
  country?: string | null;
  city?: string | null;
  remote?: DiscoveryRemotePreference;
  notes?: string | null;
}
