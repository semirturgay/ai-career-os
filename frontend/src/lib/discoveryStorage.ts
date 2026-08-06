import type { JobDiscovery } from "../types/discovery";

const STORAGE_PREFIX = "ai-career-os:discovery-monitors:";
const LEGACY_PREFIX = "ai-career-os:discovery-runs:";

function storageKey(profileId: string): string {
  return `${STORAGE_PREFIX}${profileId}`;
}

function legacyStorageKey(profileId: string): string {
  return `${LEGACY_PREFIX}${profileId}`;
}

function migrateLegacyRuns(profileId: string): void {
  try {
    const legacyRaw = localStorage.getItem(legacyStorageKey(profileId));
    if (!legacyRaw) {
      return;
    }

    const legacy = JSON.parse(legacyRaw) as Array<Record<string, unknown>>;
    if (!Array.isArray(legacy) || legacy.length === 0) {
      localStorage.removeItem(legacyStorageKey(profileId));
      return;
    }

    const existing = loadDiscoveryMonitors(profileId);
    if (existing.length > 0) {
      localStorage.removeItem(legacyStorageKey(profileId));
      return;
    }

    const migrated: JobDiscovery[] = legacy.map((item) => ({
      id: String(item.id),
      profile_id: String(item.profile_id),
      criteria: item.criteria as JobDiscovery["criteria"],
      interval: "default",
      enabled: true,
      status: (item.status as JobDiscovery["status"]) ?? "completed",
      candidates: ((item.candidates as JobDiscovery["candidates"]) ?? []).map((candidate) => ({
        ...candidate,
        first_seen_at: candidate.first_seen_at ?? String(item.created_at ?? new Date().toISOString()),
        last_seen_at: candidate.last_seen_at ?? String(item.updated_at ?? new Date().toISOString()),
      })),
      error: (item.error as string | null) ?? null,
      last_run_at: (item.completed_at as string | null) ?? (item.updated_at as string | null) ?? null,
      next_run_at: null,
      last_viewed_at: null,
      created_at: String(item.created_at ?? new Date().toISOString()),
      updated_at: String(item.updated_at ?? new Date().toISOString()),
    }));

    saveDiscoveryMonitors(profileId, migrated);
    localStorage.removeItem(legacyStorageKey(profileId));
  } catch {
    // ignore corrupt legacy data
  }
}

export function loadDiscoveryMonitors(profileId: string): JobDiscovery[] {
  migrateLegacyRuns(profileId);

  try {
    const raw = localStorage.getItem(storageKey(profileId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as JobDiscovery[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDiscoveryMonitors(profileId: string, monitors: JobDiscovery[]): void {
  localStorage.setItem(storageKey(profileId), JSON.stringify(monitors));
}

export function upsertDiscoveryMonitor(profileId: string, monitor: JobDiscovery): JobDiscovery[] {
  const monitors = loadDiscoveryMonitors(profileId);
  const index = monitors.findIndex((item) => item.id === monitor.id);
  const next = [...monitors];
  if (index >= 0) {
    next[index] = monitor;
  } else {
    next.unshift(monitor);
  }
  saveDiscoveryMonitors(profileId, next);
  return next;
}

export function getDiscoveryMonitor(profileId: string, discoveryId: string): JobDiscovery | null {
  return loadDiscoveryMonitors(profileId).find((monitor) => monitor.id === discoveryId) ?? null;
}
