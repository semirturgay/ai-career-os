export type AtsProvider = "greenhouse" | "lever" | "ashby";
export type RadarPollInterval = "daily" | "3d" | "weekly";
export type WatchedCompanyStatus = "active" | "paused" | "unresolved" | "error";
export type PostingState = "new" | "screened" | "promoted" | "dismissed";
export type RemotePreference = "any" | "remote" | "onsite" | "hybrid";

export const ATS_PROVIDER_LABELS: Record<AtsProvider, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
};

export const POLL_INTERVAL_LABELS: Record<RadarPollInterval, string> = {
  daily: "Every day",
  "3d": "Every 3 days",
  weekly: "Every week",
};

export interface WatchCriteria {
  titles: string[];
  locations: string[];
  remote: RemotePreference;
  exclude: string[];
}

export interface ResolvedBoard {
  name: string;
  ats_provider: AtsProvider;
  ats_token: string;
  board_url: string;
  open_role_count: number | null;
  resolved_via: "url" | "probe" | "search";
}

export interface WatchedCompany {
  id: string;
  profile_id: string;
  name: string;
  ats_provider: AtsProvider;
  ats_token: string;
  board_url: string | null;
  criteria: WatchCriteria;
  status: WatchedCompanyStatus;
  last_polled_at: string | null;
  last_error: string | null;
  last_viewed_at: string | null;
  created_at: string;
  posting_count: number;
  new_posting_count: number;
}

export interface WatchedCompanyCreate {
  name: string;
  ats_provider: AtsProvider;
  ats_token: string;
  board_url?: string | null;
  criteria?: Partial<WatchCriteria>;
}

export interface WatchedCompanyUpdate {
  name?: string;
  status?: "active" | "paused";
  criteria?: Partial<WatchCriteria>;
}

export interface Posting {
  id: string;
  watched_company_id: string;
  company_name: string;
  external_id: string;
  url: string | null;
  title: string;
  location: string | null;
  remote_flag: boolean;
  description: string;
  posted_at: string | null;
  screen_score: number | null;
  screen_reason: string | null;
  state: PostingState;
  job_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface PollResult {
  watched_company_id: string;
  fetched: number;
  new_postings: number;
  screened: number;
  error: string | null;
}

export const EMPTY_CRITERIA: WatchCriteria = {
  titles: [],
  locations: [],
  remote: "any",
  exclude: [],
};

export interface RadarTargetResult {
  radar_target: string | null;
  cleared_postings: number;
  repolled_companies: number;
}
