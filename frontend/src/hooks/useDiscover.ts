import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createDiscoveryMonitor,
  deleteDiscoveryMonitor,
  dismissDiscoveryCandidate,
  getDiscoveryById,
  listDiscoveryMonitors,
  markDiscoveryViewed,
  runDiscoveryNow,
  subscribeDiscoveryMonitors,
  updateDiscoveryMonitor,
} from "../lib/discoveryService";
import { loadDiscoveryDefaultInterval, fetchDiscoveryDefaultInterval } from "../lib/discoverySettings";
import type { DiscoveryCreate, DiscoveryUpdate, JobDiscovery } from "../types/discovery";
import { usePolling } from "./usePolling";

function isDiscoveryActive(monitor: JobDiscovery | null | undefined): boolean {
  return monitor?.status === "running" || monitor?.status === "pending";
}

export function useDiscoveryMonitors(profileId: string) {
  const [monitors, setMonitors] = useState<JobDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [defaultInterval, setDefaultInterval] = useState(loadDiscoveryDefaultInterval);

  const refresh = useCallback(async () => {
    try {
      const [next, interval] = await Promise.all([
        listDiscoveryMonitors(profileId),
        fetchDiscoveryDefaultInterval(),
      ]);
      setMonitors(next);
      setDefaultInterval(interval);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load discoveries");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    return subscribeDiscoveryMonitors(profileId, () => {
      void refresh();
    });
  }, [profileId, refresh]);

  const activeCount = useMemo(
    () => monitors.filter((monitor) => monitor.status === "running" || monitor.status === "pending").length,
    [monitors],
  );

  usePolling(() => refresh(), activeCount > 0, 2000);

  const createMonitor = useCallback(
    async (input: DiscoveryCreate) => {
      setStarting(true);
      setError(null);
      try {
        const monitor = await createDiscoveryMonitor(profileId, input);
        await refresh();
        return monitor;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create discovery";
        setError(message);
        throw err;
      } finally {
        setStarting(false);
      }
    },
    [profileId, refresh],
  );

  const removeMonitor = useCallback(
    async (discoveryId: string) => {
      await deleteDiscoveryMonitor(profileId, discoveryId);
      await refresh();
    },
    [profileId, refresh],
  );

  return {
    monitors,
    loading,
    error,
    starting,
    activeCount,
    defaultInterval,
    refresh,
    createMonitor,
    removeMonitor,
  };
}

/** @deprecated use useDiscoveryMonitors */
export const useDiscoveryRuns = useDiscoveryMonitors;

export function useDiscovery(profileId: string, discoveryId: string | undefined) {
  const [monitor, setMonitor] = useState<JobDiscovery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultInterval, setDefaultInterval] = useState(loadDiscoveryDefaultInterval);
  const [actionLoading, setActionLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!discoveryId) {
      setMonitor(null);
      setLoading(false);
      return;
    }

    try {
      const [next, interval] = await Promise.all([
        getDiscoveryById(profileId, discoveryId),
        fetchDiscoveryDefaultInterval(),
      ]);
      setMonitor(next);
      setDefaultInterval(interval);
      setError(next ? null : "Discovery not found");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load discovery");
    } finally {
      setLoading(false);
    }
  }, [profileId, discoveryId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    if (!discoveryId) {
      return;
    }
    return subscribeDiscoveryMonitors(profileId, () => {
      void refresh();
    });
  }, [profileId, discoveryId, refresh]);

  usePolling(() => refresh(), isDiscoveryActive(monitor), 2000);

  useEffect(() => {
    if (!discoveryId) {
      return;
    }
    void markDiscoveryViewed(profileId, discoveryId);
  }, [profileId, discoveryId]);

  const dismissCandidate = useCallback(
    async (candidateId: string) => {
      if (!discoveryId) {
        return null;
      }
      const updated = await dismissDiscoveryCandidate(profileId, discoveryId, candidateId);
      setMonitor(updated);
      return updated;
    },
    [profileId, discoveryId],
  );

  const updateMonitor = useCallback(
    async (patch: DiscoveryUpdate) => {
      if (!discoveryId) {
        return null;
      }
      setActionLoading(true);
      try {
        const updated = await updateDiscoveryMonitor(profileId, discoveryId, patch);
        setMonitor(updated);
        return updated;
      } finally {
        setActionLoading(false);
      }
    },
    [profileId, discoveryId],
  );

  const runNow = useCallback(async () => {
    if (!discoveryId) {
      return null;
    }
    setActionLoading(true);
    setMonitor((prev) => (prev ? { ...prev, status: "pending", error: null } : prev));
    try {
      const updated = await runDiscoveryNow(profileId, discoveryId);
      setMonitor(updated);
      void refresh();
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run discovery");
      await refresh();
      return null;
    } finally {
      setActionLoading(false);
    }
  }, [profileId, discoveryId, refresh]);

  return {
    monitor,
    loading,
    error,
    defaultInterval,
    actionLoading,
    refresh,
    dismissCandidate,
    updateMonitor,
    runNow,
  };
}

/** @deprecated use useDiscovery */
export const useDiscoveryRun = useDiscovery;
