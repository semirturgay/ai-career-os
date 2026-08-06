import { api } from "../api/client";
import type { DiscoveryDefaultInterval } from "../types/discovery";
import { DEFAULT_DISCOVERY_INTERVAL } from "./discoveryIntervals";

const STORAGE_KEY = "ai-career-os:discovery-default-interval";

function readLocalInterval(): DiscoveryDefaultInterval {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "daily" || raw === "3d" || raw === "weekly") {
      return raw;
    }
  } catch {
    // ignore
  }
  return DEFAULT_DISCOVERY_INTERVAL;
}

export function loadDiscoveryDefaultInterval(): DiscoveryDefaultInterval {
  return readLocalInterval();
}

export async function fetchDiscoveryDefaultInterval(): Promise<DiscoveryDefaultInterval> {
  try {
    const response = await api.discover.getDefaultInterval();
    saveDiscoveryDefaultInterval(response.discovery_default_interval);
    return response.discovery_default_interval;
  } catch {
    return readLocalInterval();
  }
}

export function saveDiscoveryDefaultInterval(interval: DiscoveryDefaultInterval): void {
  localStorage.setItem(STORAGE_KEY, interval);
}

const listeners = new Set<() => void>();

export function subscribeDiscoveryDefaultInterval(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyDiscoveryDefaultIntervalChanged(): void {
  listeners.forEach((listener) => listener());
}

export async function setDiscoveryDefaultInterval(
  interval: DiscoveryDefaultInterval,
): Promise<void> {
  saveDiscoveryDefaultInterval(interval);
  notifyDiscoveryDefaultIntervalChanged();
  try {
    await api.discover.setDefaultInterval(interval);
  } catch {
    // keep local value when API unavailable (preview/dev)
  }
}
