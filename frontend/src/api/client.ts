import type { ApplicationOutcomeStatus, CompanyBrief, CoverLetterResult, FeedbackEvent, FeedbackEventCreate, Job, JobCreate, JobCreateResponse, JobIntakeHandoff, JobParseResult, MatchAnalysis, Profile, ProfileCreate, ResumeOptimizationResult, ResumeParseResult, ResumeSuggestion } from "../types";
import type { PollResult, Posting, PostingState, RadarPollInterval, RadarTargetResult, ResolvedBoard, WatchedCompany, WatchedCompanyCreate, WatchedCompanyUpdate } from "../types/radar";
import type { AppSettings, ListModelsRequest, ModelListResponse, SettingsUpdate } from "../types/settings";
import { getApiBase, getApiToken } from "../lib/extensionRuntime";
import {
  duplicateJobFromApiDetail,
  duplicateJobFromErrorMessage,
  type DuplicateJobInfo,
} from "../lib/jobUrl";

class ApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function duplicateJobFromError(error: ApiError): DuplicateJobInfo | null {
  if (error.status !== 409) {
    return null;
  }
  const fromDetail = duplicateJobFromApiDetail(error.detail);
  if (fromDetail) {
    return fromDetail;
  }
  return duplicateJobFromErrorMessage(error.message);
}

/** Empty unless the backend was started with API_TOKEN — see app/api/auth.py. */
function applyAuth(headers: Headers): Headers {
  const token = getApiToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = applyAuth(new Headers(options?.headers));
  if (options?.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = res.statusText;
    let detail: unknown;
    try {
      const body = await res.json();
      detail = body.detail;
      if (body.detail) {
        if (res.status === 409 && duplicateJobFromApiDetail(body.detail)) {
          message = "This job is already in your pipeline";
        } else {
          message =
            typeof body.detail === "string"
              ? body.detail
              : typeof body.detail === "object" &&
                  body.detail !== null &&
                  "message" in body.detail &&
                  typeof body.detail.message === "string"
                ? body.detail.message
                : JSON.stringify(body.detail);
        }
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  profiles: {
    list: () => request<Profile[]>("/profiles"),
    create: (data: ProfileCreate) =>
      request<Profile>("/profiles", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<ProfileCreate>) =>
      request<Profile>(`/profiles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    applyResumeSuggestions: (
      id: string,
      suggestions: ResumeSuggestion[],
      context?: { jobId: string; matchAnalysisId: string },
    ) =>
      request<Profile>(`/profiles/${id}/apply-resume-suggestions`, {
        method: "POST",
        body: JSON.stringify({
          suggestions,
          job_id: context?.jobId,
          match_analysis_id: context?.matchAnalysisId,
        }),
      }),
    parseResume: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<ResumeParseResult>("/profiles/parse-resume", {
        method: "POST",
        body: form,
      });
    },
    parseText: (text: string) =>
      request<ResumeParseResult>("/profiles/parse-text", {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    downloadResumePdf: async (id: string) => {
      const res = await fetch(`${getApiBase()}/profiles/${id}/resume.pdf`, {
        headers: applyAuth(new Headers()),
      });
      if (!res.ok) {
        let message = res.statusText;
        try {
          const body = await res.json();
          if (body.detail) {
            message = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
          }
        } catch {
          // ignore parse errors
        }
        throw new ApiError(res.status, message);
      }
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = disposition.match(/filename="([^"]+)"/i);
      const filename = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : asciiMatch?.[1] ?? "resume.pdf";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
  },

  jobs: {
    list: (params?: { applicationStatus?: ApplicationOutcomeStatus[] }) => {
      const search = new URLSearchParams();
      params?.applicationStatus?.forEach((status) => {
        search.append("application_status", status);
      });
      const query = search.toString();
      return request<Job[]>(`/jobs${query ? `?${query}` : ""}`);
    },
    get: (id: string) => request<Job>(`/jobs/${id}`),
    create: (data: JobCreate) =>
      request<JobCreateResponse>("/jobs", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<JobCreate>) =>
      request<Job>(`/jobs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    parseText: (text: string) =>
      request<JobParseResult>("/jobs/parse-text", {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    getIntakeHandoff: (handoffId: string) =>
      request<JobIntakeHandoff>(`/jobs/intake-handoff/${handoffId}`),
    getByUrl: (url: string) =>
      request<{ job: Job }>(`/jobs/by-url?${new URLSearchParams({ url }).toString()}`),
    researchCompany: (id: string) =>
      request<CompanyBrief>(`/jobs/${id}/company-research`, { method: "POST" }),
  },

  matchAnalyses: {
    list: () => request<MatchAnalysis[]>("/match-analyses"),
    get: (id: string) => request<MatchAnalysis>(`/match-analyses/${id}`),
    create: (profileId: string, jobId: string) =>
      request<MatchAnalysis>("/match-analyses", {
        method: "POST",
        body: JSON.stringify({ profile_id: profileId, job_id: jobId }),
      }),
    optimizeResume: (analysisId: string) =>
      request<ResumeOptimizationResult>(
        `/match-analyses/${analysisId}/resume-optimization`,
        { method: "POST" },
      ),
    generateCoverLetter: (analysisId: string) =>
      request<CoverLetterResult>(`/match-analyses/${analysisId}/cover-letter`, {
        method: "POST",
      }),
  },

  feedback: {
    create: (data: FeedbackEventCreate) =>
      request<FeedbackEvent>("/feedback", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listForProfile: (profileId: string) =>
      request<FeedbackEvent[]>(`/feedback?profile_id=${encodeURIComponent(profileId)}`),
    listForJob: (jobId: string) => request<FeedbackEvent[]>(`/jobs/${jobId}/feedback`),
  },

  settings: {
    get: () => request<AppSettings>("/settings"),
    update: (data: SettingsUpdate) =>
      request<AppSettings>("/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },

  llm: {
    listModels: (data: ListModelsRequest) =>
      request<ModelListResponse>("/llm/models", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  radar: {
    listCompanies: (profileId: string) =>
      request<WatchedCompany[]>(`/profiles/${profileId}/radar`),
    resolve: (profileId: string, query: string) =>
      request<ResolvedBoard>(`/profiles/${profileId}/radar/resolve`, {
        method: "POST",
        body: JSON.stringify({ query }),
      }),
    addCompany: (profileId: string, body: WatchedCompanyCreate) =>
      request<WatchedCompany>(`/profiles/${profileId}/radar`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateCompany: (profileId: string, companyId: string, patch: WatchedCompanyUpdate) =>
      request<WatchedCompany>(`/profiles/${profileId}/radar/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    removeCompany: (profileId: string, companyId: string) =>
      request<void>(`/profiles/${profileId}/radar/${companyId}`, {
        method: "DELETE",
      }),
    poll: (profileId: string, companyId: string) =>
      request<PollResult>(`/profiles/${profileId}/radar/${companyId}/poll`, {
        method: "POST",
      }),
    markViewed: (profileId: string, companyId: string) =>
      request<WatchedCompany>(`/profiles/${profileId}/radar/${companyId}/viewed`, {
        method: "POST",
      }),
    listPostings: (
      profileId: string,
      options: { state?: PostingState[]; minScore?: number; companyId?: string } = {},
    ) => {
      const params = new URLSearchParams();
      for (const state of options.state ?? []) params.append("state", state);
      if (options.minScore != null) params.set("min_score", String(options.minScore));
      if (options.companyId) params.set("company_id", options.companyId);
      const query = params.toString();
      return request<Posting[]>(
        `/profiles/${profileId}/radar/postings${query ? `?${query}` : ""}`,
      );
    },
    promotePosting: (profileId: string, postingId: string) =>
      request<Job>(`/profiles/${profileId}/radar/postings/${postingId}/promote`, {
        method: "POST",
      }),
    dismissPosting: (profileId: string, postingId: string) =>
      request<Posting>(`/profiles/${profileId}/radar/postings/${postingId}/dismiss`, {
        method: "POST",
      }),
    setTarget: (profileId: string, target: string) =>
      request<RadarTargetResult>(`/profiles/${profileId}/radar/target`, {
        method: "PUT",
        body: JSON.stringify({ target }),
      }),
    getPollInterval: () =>
      request<{ radar_poll_interval: RadarPollInterval }>("/settings/radar-poll-interval"),
    setPollInterval: (interval: RadarPollInterval) =>
      request<{ radar_poll_interval: RadarPollInterval }>("/settings/radar-poll-interval", {
        method: "PUT",
        body: JSON.stringify({ radar_poll_interval: interval }),
      }),
  },
};

export type { DuplicateJobInfo };
export { ApiError, duplicateJobFromError };
