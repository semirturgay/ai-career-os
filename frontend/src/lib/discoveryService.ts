import { api } from "../api/client";
import { ApiError } from "../api/client";
import {
  getDiscoveryRun,
  loadDiscoveryRuns,
  saveDiscoveryRuns,
  upsertDiscoveryRun,
} from "./discoveryStorage";
import type {
  DiscoveryCriteria,
  DiscoveryRunCreate,
  JobDiscoveryCandidate,
  JobDiscoveryRun,
} from "../types/discovery";

/** UI-only until backend discovery endpoints ship. Set false when API is live. */
export const DISCOVERY_LOCAL_MODE = true;

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeCriteria(input: DiscoveryRunCreate): DiscoveryCriteria {
  return {
    title: input.title.trim(),
    country: input.country?.trim() || null,
    city: input.city?.trim() || null,
    remote: input.remote ?? "any",
    notes: input.notes?.trim() || null,
  };
}

function criteriaLabel(criteria: DiscoveryCriteria): string {
  const parts = [criteria.title];
  if (criteria.city) {
    parts.push(criteria.city);
  } else if (criteria.country) {
    parts.push(criteria.country);
  }
  if (criteria.remote !== "any") {
    parts.push(criteria.remote);
  }
  return parts.join(" · ");
}

export function formatDiscoveryCriteria(criteria: DiscoveryCriteria): string {
  return criteriaLabel(criteria);
}

function mockCandidates(criteria: DiscoveryCriteria): JobDiscoveryCandidate[] {
  const location = criteria.city ?? criteria.country ?? "your market";
  const remoteNote =
    criteria.remote === "remote"
      ? "Remote role"
      : criteria.remote === "hybrid"
        ? "Hybrid arrangement"
        : criteria.remote === "onsite"
          ? "On-site role"
          : "Flexible work mode";

  return [
    {
      id: createId("candidate"),
      title: criteria.title,
      company: "Northline Systems",
      url: "https://boards.greenhouse.io/example/jobs/1001",
      snippet: `${remoteNote}. ${criteria.title} team building platform services in ${location}. Python, distributed systems.`,
      source: "greenhouse.io",
      fit_score: 82,
      fit_reason: "Title aligns closely; snippet mentions your core stack.",
      dismissed: false,
    },
    {
      id: createId("candidate"),
      title: `${criteria.title} (Payments)`,
      company: "Riverbank",
      url: "https://jobs.lever.co/example/abc123",
      snippet: `Hiring ${criteria.title.toLowerCase()} for payments infrastructure. ${remoteNote}.`,
      source: "lever.co",
      fit_score: 71,
      fit_reason: "Strong domain overlap; verify seniority on the posting.",
      dismissed: false,
    },
    {
      id: createId("candidate"),
      title: criteria.title,
      company: "Atlas Labs",
      url: "https://jobs.ashbyhq.com/example/role-42",
      snippet: `Growing engineering org in ${location}. Looking for ${criteria.title.toLowerCase()} experience.`,
      source: "ashbyhq.com",
      fit_score: 64,
      fit_reason: "Reasonable title match; limited detail in search snippet.",
      dismissed: false,
    },
  ];
}

const pendingSimulations = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleLocalSimulation(profileId: string, runId: string): void {
  const key = `${profileId}:${runId}`;
  if (pendingSimulations.has(key)) {
    return;
  }

  const timeout = setTimeout(() => {
    pendingSimulations.delete(key);
    const current = getDiscoveryRun(profileId, runId);
    if (!current || current.status !== "running") {
      return;
    }

    const completed: JobDiscoveryRun = {
      ...current,
      status: "completed",
      candidates: mockCandidates(current.criteria),
      error: null,
      updated_at: nowIso(),
      completed_at: nowIso(),
    };
    upsertDiscoveryRun(profileId, completed);
    notifyListeners(profileId);
  }, 4500);

  pendingSimulations.set(key, timeout);
}

const listeners = new Map<string, Set<() => void>>();

function notifyListeners(profileId: string): void {
  listeners.get(profileId)?.forEach((listener) => listener());
}

export function subscribeDiscoveryRuns(profileId: string, listener: () => void): () => void {
  const set = listeners.get(profileId) ?? new Set();
  set.add(listener);
  listeners.set(profileId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(profileId);
    }
  };
}

export async function listDiscoveryRuns(profileId: string): Promise<JobDiscoveryRun[]> {
  if (!DISCOVERY_LOCAL_MODE) {
    try {
      return await api.discover.listRuns(profileId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  const runs = loadDiscoveryRuns(profileId);
  for (const run of runs) {
    if (run.status === "running") {
      scheduleLocalSimulation(profileId, run.id);
    }
  }
  return runs;
}

export async function getDiscoveryRunById(
  profileId: string,
  runId: string,
): Promise<JobDiscoveryRun | null> {
  if (!DISCOVERY_LOCAL_MODE) {
    try {
      return await api.discover.getRun(profileId, runId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  const run = getDiscoveryRun(profileId, runId);
  if (run?.status === "running") {
    scheduleLocalSimulation(profileId, run.id);
  }
  return run;
}

export async function startDiscoveryRun(
  profileId: string,
  input: DiscoveryRunCreate,
): Promise<JobDiscoveryRun> {
  const criteria = normalizeCriteria(input);
  if (!criteria.title) {
    throw new Error("Job title is required");
  }

  if (!DISCOVERY_LOCAL_MODE) {
    return api.discover.startRun(profileId, criteria);
  }

  const timestamp = nowIso();
  const run: JobDiscoveryRun = {
    id: createId("discovery"),
    profile_id: profileId,
    criteria,
    status: "running",
    candidates: [],
    error: null,
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: null,
  };

  upsertDiscoveryRun(profileId, run);
  scheduleLocalSimulation(profileId, run.id);
  notifyListeners(profileId);
  return run;
}

export async function dismissDiscoveryCandidate(
  profileId: string,
  runId: string,
  candidateId: string,
): Promise<JobDiscoveryRun | null> {
  if (!DISCOVERY_LOCAL_MODE) {
    return api.discover.dismissCandidate(profileId, runId, candidateId);
  }

  const run = getDiscoveryRun(profileId, runId);
  if (!run) {
    return null;
  }

  const updated: JobDiscoveryRun = {
    ...run,
    candidates: run.candidates.map((candidate) =>
      candidate.id === candidateId ? { ...candidate, dismissed: true } : candidate,
    ),
    updated_at: nowIso(),
  };
  upsertDiscoveryRun(profileId, updated);
  notifyListeners(profileId);
  return updated;
}

export async function deleteDiscoveryRun(profileId: string, runId: string): Promise<void> {
  if (!DISCOVERY_LOCAL_MODE) {
    await api.discover.deleteRun(profileId, runId);
    notifyListeners(profileId);
    return;
  }

  const runs = loadDiscoveryRuns(profileId).filter((run) => run.id !== runId);
  saveDiscoveryRuns(profileId, runs);
  notifyListeners(profileId);
}
