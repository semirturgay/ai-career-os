import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Job, MatchAnalysis } from "../types";
import { usePolling } from "./usePolling";
import { getRunningAsyncTasks, onAsyncTaskSettled, subscribeAsyncTasks } from "../lib/asyncTasks";
import { latestAnalysisForJob, pendingAnalysesCount } from "../lib/matches";

interface PipelineSyncContextValue {
  jobs: Job[];
  analyses: MatchAnalysis[];
  pendingMatchCount: number;
  loading: boolean;
  refreshPipeline: () => Promise<void>;
  refreshJob: (jobId: string) => Promise<Job>;
  getAnalysesForJob: (jobId: string) => MatchAnalysis[];
  getLatestAnalysisForJob: (jobId: string) => MatchAnalysis | undefined;
}

const PipelineSyncContext = createContext<PipelineSyncContextValue | null>(null);

interface PipelineSyncProviderProps {
  profileId: string;
  children: React.ReactNode;
}

export function PipelineSyncProvider({ profileId, children }: PipelineSyncProviderProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [analyses, setAnalyses] = useState<MatchAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTaskCount, setRunningTaskCount] = useState(0);

  const refreshPipeline = useCallback(async () => {
    const [jobList, analysisList] = await Promise.all([
      api.jobs.list(),
      api.matchAnalyses.list(),
    ]);
    setJobs(jobList);
    setAnalyses(analysisList.filter((entry) => entry.profile_id === profileId));
  }, [profileId]);

  const refreshJob = useCallback(async (jobId: string) => {
    const updated = await api.jobs.get(jobId);
    setJobs((current) => current.map((job) => (job.id === jobId ? updated : job)));
    return updated;
  }, []);

  useEffect(() => {
    void refreshPipeline().finally(() => setLoading(false));
  }, [refreshPipeline]);

  useEffect(() => {
    return onAsyncTaskSettled(() => {
      setRunningTaskCount(getRunningAsyncTasks().length);
      void refreshPipeline();
    });
  }, [refreshPipeline]);

  useEffect(() => {
    const syncRunningTasks = () => setRunningTaskCount(getRunningAsyncTasks().length);
    syncRunningTasks();
    return subscribeAsyncTasks(syncRunningTasks);
  }, []);

  const pendingMatchCount = pendingAnalysesCount(analyses, profileId);
  usePolling(refreshPipeline, pendingMatchCount > 0 || runningTaskCount > 0, 2000);

  const value = useMemo<PipelineSyncContextValue>(
    () => ({
      jobs,
      analyses,
      pendingMatchCount,
      loading,
      refreshPipeline,
      refreshJob,
      getAnalysesForJob: (jobId: string) =>
        analyses.filter((entry) => entry.job_id === jobId),
      getLatestAnalysisForJob: (jobId: string) =>
        latestAnalysisForJob(analyses, profileId, jobId),
    }),
    [analyses, jobs, loading, pendingMatchCount, profileId, refreshJob, refreshPipeline],
  );

  return (
    <PipelineSyncContext.Provider value={value}>{children}</PipelineSyncContext.Provider>
  );
}

export function usePipelineSync(): PipelineSyncContextValue {
  const context = useContext(PipelineSyncContext);
  if (!context) {
    throw new Error("usePipelineSync must be used within PipelineSyncProvider");
  }
  return context;
}
