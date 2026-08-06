import { api } from "../api/client";
import { ApiError } from "../api/client";
import {
  addDiscoveryInterval,
  resolveDiscoveryInterval,
} from "./discoveryIntervals";
import { loadDiscoveryDefaultInterval } from "./discoverySettings";
import {
  getDiscoveryMonitor,
  loadDiscoveryMonitors,
  saveDiscoveryMonitors,
  upsertDiscoveryMonitor,
} from "./discoveryStorage";
import type {
  DiscoveryCreate,
  DiscoveryCriteria,
  DiscoveryUpdate,
  JobDiscovery,
  JobDiscoveryCandidate,
} from "../types/discovery";

/** Use backend API for discoveries. Set true only for offline UI preview. */
export const DISCOVERY_LOCAL_MODE = false;

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeCriteria(input: DiscoveryCreate): DiscoveryCriteria {
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

function computeNextRunAt(monitor: Pick<JobDiscovery, "interval">, from = new Date()): string {
  const defaultInterval = loadDiscoveryDefaultInterval();
  const resolved = resolveDiscoveryInterval(monitor, defaultInterval);
  return addDiscoveryInterval(from, resolved).toISOString();
}

function mockCandidates(criteria: DiscoveryCriteria, seenAt: string): JobDiscoveryCandidate[] {
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
      first_seen_at: seenAt,
      last_seen_at: seenAt,
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
      first_seen_at: seenAt,
      last_seen_at: seenAt,
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
      first_seen_at: seenAt,
      last_seen_at: seenAt,
    },
  ];
}

function mergeCandidates(
  existing: JobDiscoveryCandidate[],
  incoming: JobDiscoveryCandidate[],
): JobDiscoveryCandidate[] {
  const byUrl = new Map(existing.map((candidate) => [candidate.url.toLowerCase(), candidate]));

  for (const candidate of incoming) {
    const key = candidate.url.toLowerCase();
    const prior = byUrl.get(key);
    if (prior) {
      byUrl.set(key, {
        ...prior,
        title: candidate.title,
        company: candidate.company,
        snippet: candidate.snippet,
        source: candidate.source,
        fit_score: candidate.fit_score ?? prior.fit_score,
        fit_reason: candidate.fit_reason ?? prior.fit_reason,
        last_seen_at: candidate.last_seen_at,
      });
    } else {
      byUrl.set(key, candidate);
    }
  }

  return Array.from(byUrl.values()).sort(
    (a, b) => new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime(),
  );
}

const pendingSimulations = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleLocalSimulation(profileId: string, discoveryId: string): void {
  const key = `${profileId}:${discoveryId}`;
  if (pendingSimulations.has(key)) {
    return;
  }

  const timeout = setTimeout(() => {
    pendingSimulations.delete(key);
    const current = getDiscoveryMonitor(profileId, discoveryId);
    if (!current || current.status !== "running") {
      return;
    }

    const completedAt = nowIso();
    const incoming = mockCandidates(current.criteria, completedAt);
    const completed: JobDiscovery = {
      ...current,
      status: "completed",
      candidates: mergeCandidates(current.candidates, incoming),
      error: null,
      last_run_at: completedAt,
      next_run_at: current.enabled ? computeNextRunAt(current, new Date(completedAt)) : null,
      updated_at: completedAt,
    };
    upsertDiscoveryMonitor(profileId, completed);
    notifyListeners(profileId);
  }, 4500);

  pendingSimulations.set(key, timeout);
}

const listeners = new Map<string, Set<() => void>>();

function notifyListeners(profileId: string): void {
  listeners.get(profileId)?.forEach((listener) => listener());
}

export function subscribeDiscoveryMonitors(profileId: string, listener: () => void): () => void {
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

/** @deprecated use subscribeDiscoveryMonitors */
export const subscribeDiscoveryRuns = subscribeDiscoveryMonitors;

export async function listDiscoveryMonitors(profileId: string): Promise<JobDiscovery[]> {
  if (!DISCOVERY_LOCAL_MODE) {
    try {
      return await api.discover.list(profileId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  const monitors = loadDiscoveryMonitors(profileId);
  for (const monitor of monitors) {
    if (monitor.status === "running") {
      scheduleLocalSimulation(profileId, monitor.id);
    }
  }
  return monitors;
}

/** @deprecated use listDiscoveryMonitors */
export const listDiscoveryRuns = listDiscoveryMonitors;

export async function getDiscoveryById(
  profileId: string,
  discoveryId: string,
): Promise<JobDiscovery | null> {
  if (!DISCOVERY_LOCAL_MODE) {
    try {
      return await api.discover.get(profileId, discoveryId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  const monitor = getDiscoveryMonitor(profileId, discoveryId);
  if (monitor?.status === "running") {
    scheduleLocalSimulation(profileId, monitor.id);
  }
  return monitor;
}

/** @deprecated use getDiscoveryById */
export const getDiscoveryRunById = getDiscoveryById;

export async function createDiscoveryMonitor(
  profileId: string,
  input: DiscoveryCreate,
): Promise<JobDiscovery> {
  const criteria = normalizeCriteria(input);
  if (!criteria.title) {
    throw new Error("Job title is required");
  }

  if (!DISCOVERY_LOCAL_MODE) {
    return api.discover.create(profileId, {
      ...criteria,
      interval: input.interval ?? "default",
    });
  }

  const timestamp = nowIso();
  const monitor: JobDiscovery = {
    id: createId("discovery"),
    profile_id: profileId,
    criteria,
    interval: input.interval ?? "default",
    enabled: true,
    status: "running",
    candidates: [],
    error: null,
    last_run_at: null,
    next_run_at: null,
    last_viewed_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  upsertDiscoveryMonitor(profileId, monitor);
  scheduleLocalSimulation(profileId, monitor.id);
  notifyListeners(profileId);
  return monitor;
}

/** @deprecated use createDiscoveryMonitor */
export const startDiscoveryRun = createDiscoveryMonitor;

export async function updateDiscoveryMonitor(
  profileId: string,
  discoveryId: string,
  patch: DiscoveryUpdate,
): Promise<JobDiscovery | null> {
  if (!DISCOVERY_LOCAL_MODE) {
    return api.discover.update(profileId, discoveryId, patch);
  }

  const monitor = getDiscoveryMonitor(profileId, discoveryId);
  if (!monitor) {
    return null;
  }

  const enabled = patch.enabled ?? monitor.enabled;
  const interval = patch.interval ?? monitor.interval;
  const updated: JobDiscovery = {
    ...monitor,
    enabled,
    interval,
    next_run_at:
      enabled && monitor.status !== "running"
        ? computeNextRunAt({ interval }, new Date(monitor.last_run_at ?? Date.now()))
        : enabled
          ? monitor.next_run_at
          : null,
    updated_at: nowIso(),
  };

  upsertDiscoveryMonitor(profileId, updated);
  notifyListeners(profileId);
  return updated;
}

export async function runDiscoveryNow(
  profileId: string,
  discoveryId: string,
): Promise<JobDiscovery | null> {
  if (!DISCOVERY_LOCAL_MODE) {
    return api.discover.runNow(profileId, discoveryId);
  }

  const monitor = getDiscoveryMonitor(profileId, discoveryId);
  if (!monitor) {
    return null;
  }
  if (monitor.status === "running") {
    return monitor;
  }

  const updated: JobDiscovery = {
    ...monitor,
    status: "running",
    error: null,
    updated_at: nowIso(),
  };
  upsertDiscoveryMonitor(profileId, updated);
  scheduleLocalSimulation(profileId, discoveryId);
  notifyListeners(profileId);
  return updated;
}

export async function markDiscoveryViewed(
  profileId: string,
  discoveryId: string,
): Promise<JobDiscovery | null> {
  if (!DISCOVERY_LOCAL_MODE) {
    return api.discover.markViewed(profileId, discoveryId);
  }

  const monitor = getDiscoveryMonitor(profileId, discoveryId);
  if (!monitor) {
    return null;
  }

  const updated: JobDiscovery = {
    ...monitor,
    last_viewed_at: nowIso(),
    updated_at: nowIso(),
  };
  upsertDiscoveryMonitor(profileId, updated);
  notifyListeners(profileId);
  return updated;
}

export async function dismissDiscoveryCandidate(
  profileId: string,
  discoveryId: string,
  candidateId: string,
): Promise<JobDiscovery | null> {
  if (!DISCOVERY_LOCAL_MODE) {
    return api.discover.dismissCandidate(profileId, discoveryId, candidateId);
  }

  const monitor = getDiscoveryMonitor(profileId, discoveryId);
  if (!monitor) {
    return null;
  }

  const updated: JobDiscovery = {
    ...monitor,
    candidates: monitor.candidates.map((candidate) =>
      candidate.id === candidateId ? { ...candidate, dismissed: true } : candidate,
    ),
    updated_at: nowIso(),
  };
  upsertDiscoveryMonitor(profileId, updated);
  notifyListeners(profileId);
  return updated;
}

export async function deleteDiscoveryMonitor(
  profileId: string,
  discoveryId: string,
): Promise<void> {
  if (!DISCOVERY_LOCAL_MODE) {
    await api.discover.delete(profileId, discoveryId);
    notifyListeners(profileId);
    return;
  }

  const monitors = loadDiscoveryMonitors(profileId).filter((monitor) => monitor.id !== discoveryId);
  saveDiscoveryMonitors(profileId, monitors);
  notifyListeners(profileId);
}

/** @deprecated use deleteDiscoveryMonitor */
export const deleteDiscoveryRun = deleteDiscoveryMonitor;
