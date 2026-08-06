import type { DiscoveryDefaultInterval } from "../types/discovery";
import { DEFAULT_DISCOVERY_INTERVAL } from "./discoveryIntervals";

const STORAGE_KEY = "ai-career-os:discovery-default-interval";

export function loadDiscoveryDefaultInterval(): DiscoveryDefaultInterval {
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

export function saveDiscoveryDefaultInterval(interval: DiscoveryDefaultInterval): void {
  localStorage.setItem(STORAGE_KEY, interval);
}

const listeners = new Set<() => void>();

export function subscribeDiscoveryDefaultInterval(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyDiscoveryDefaultIntervalChanged(): void {
  listeners.forEach((listener) => listener());
}

export function setDiscoveryDefaultInterval(interval: DiscoveryDefaultInterval): void {
  saveDiscoveryDefaultInterval(interval);
  notifyDiscoveryDefaultIntervalChanged();
}
