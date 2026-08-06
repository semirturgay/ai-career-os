import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteDiscoveryRun,
  dismissDiscoveryCandidate,
  getDiscoveryRunById,
  listDiscoveryRuns,
  startDiscoveryRun,
  subscribeDiscoveryRuns,
} from "../lib/discoveryService";
import type { DiscoveryRunCreate, JobDiscoveryRun } from "../types/discovery";

export function useDiscoveryRuns(profileId: string) {
  const [runs, setRuns] = useState<JobDiscoveryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await listDiscoveryRuns(profileId);
      setRuns(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load discovery runs");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    return subscribeDiscoveryRuns(profileId, () => {
      void refresh();
    });
  }, [profileId, refresh]);

  const startRun = useCallback(
    async (input: DiscoveryRunCreate) => {
      setStarting(true);
      setError(null);
      try {
        const run = await startDiscoveryRun(profileId, input);
        await refresh();
        return run;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start discovery";
        setError(message);
        throw err;
      } finally {
        setStarting(false);
      }
    },
    [profileId, refresh],
  );

  const removeRun = useCallback(
    async (runId: string) => {
      await deleteDiscoveryRun(profileId, runId);
      await refresh();
    },
    [profileId, refresh],
  );

  const activeCount = useMemo(
    () => runs.filter((run) => run.status === "running" || run.status === "pending").length,
    [runs],
  );

  return {
    runs,
    loading,
    error,
    starting,
    activeCount,
    refresh,
    startRun,
    removeRun,
  };
}

export function useDiscoveryRun(profileId: string, runId: string | undefined) {
  const [run, setRun] = useState<JobDiscoveryRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!runId) {
      setRun(null);
      setLoading(false);
      return;
    }

    try {
      const next = await getDiscoveryRunById(profileId, runId);
      setRun(next);
      setError(next ? null : "Discovery run not found");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load discovery run");
    } finally {
      setLoading(false);
    }
  }, [profileId, runId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    if (!runId) {
      return;
    }
    return subscribeDiscoveryRuns(profileId, () => {
      void refresh();
    });
  }, [profileId, runId, refresh]);

  const dismissCandidate = useCallback(
    async (candidateId: string) => {
      if (!runId) {
        return null;
      }
      const updated = await dismissDiscoveryCandidate(profileId, runId, candidateId);
      setRun(updated);
      return updated;
    },
    [profileId, runId],
  );

  return {
    run,
    loading,
    error,
    refresh,
    dismissCandidate,
  };
}
