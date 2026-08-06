import {
  DISCOVERY_DEFAULT_INTERVAL_OPTIONS,
  DISCOVERY_INTERVAL_OPTIONS,
  type DiscoveryDefaultInterval,
  type DiscoveryInterval,
  type JobDiscovery,
} from "../types/discovery";

export const DEFAULT_DISCOVERY_INTERVAL: DiscoveryDefaultInterval = "weekly";

export function resolveDiscoveryInterval(
  monitor: Pick<JobDiscovery, "interval">,
  defaultInterval: DiscoveryDefaultInterval,
): DiscoveryDefaultInterval {
  if (monitor.interval === "default") {
    return defaultInterval;
  }
  return monitor.interval;
}

export function intervalLabel(
  interval: DiscoveryInterval,
  defaultInterval: DiscoveryDefaultInterval,
): string {
  if (interval === "default") {
    const base = DISCOVERY_DEFAULT_INTERVAL_OPTIONS.find((item) => item.value === defaultInterval);
    return `Default (${base?.label ?? defaultInterval})`;
  }
  return DISCOVERY_INTERVAL_OPTIONS.find((item) => item.value === interval)?.label ?? interval;
}

export function addDiscoveryInterval(from: Date, interval: DiscoveryDefaultInterval): Date {
  const next = new Date(from);
  switch (interval) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "3d":
      next.setDate(next.getDate() + 3);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
  }
  return next;
}

export function formatNextRun(iso: string | null | undefined): string {
  if (!iso) {
    return "Not scheduled";
  }

  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "Due now";
  }

  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 24) {
    return `Next run ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }

  return `Next run ${date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })}`;
}

export function countNewCandidates(
  monitor: JobDiscovery,
  defaultInterval: DiscoveryDefaultInterval,
): number {
  void defaultInterval;
  const viewedAt = monitor.last_viewed_at ? new Date(monitor.last_viewed_at).getTime() : 0;

  return monitor.candidates.filter((candidate) => {
    if (candidate.dismissed) {
      return false;
    }
    return new Date(candidate.first_seen_at).getTime() > viewedAt;
  }).length;
}
