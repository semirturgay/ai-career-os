import type { JobDiscoveryRun } from "../types/discovery";

const STORAGE_PREFIX = "ai-career-os:discovery-runs:";

function storageKey(profileId: string): string {
  return `${STORAGE_PREFIX}${profileId}`;
}

export function loadDiscoveryRuns(profileId: string): JobDiscoveryRun[] {
  try {
    const raw = localStorage.getItem(storageKey(profileId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as JobDiscoveryRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDiscoveryRuns(profileId: string, runs: JobDiscoveryRun[]): void {
  localStorage.setItem(storageKey(profileId), JSON.stringify(runs));
}

export function upsertDiscoveryRun(profileId: string, run: JobDiscoveryRun): JobDiscoveryRun[] {
  const runs = loadDiscoveryRuns(profileId);
  const index = runs.findIndex((item) => item.id === run.id);
  const next = [...runs];
  if (index >= 0) {
    next[index] = run;
  } else {
    next.unshift(run);
  }
  saveDiscoveryRuns(profileId, next);
  return next;
}

export function getDiscoveryRun(profileId: string, runId: string): JobDiscoveryRun | null {
  return loadDiscoveryRuns(profileId).find((run) => run.id === runId) ?? null;
}
