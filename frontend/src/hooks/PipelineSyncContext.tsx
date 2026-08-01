import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { ApplicationOutcomeStatus, FeedbackEvent, Job, MatchAnalysis } from "../types";
import { usePolling } from "./usePolling";
import { getRunningAsyncTasks, onAsyncTaskSettled, subscribeAsyncTasks } from "../lib/asyncTasks";
import { applicationStatusForJob } from "../lib/applicationStatus";
import { latestAnalysisForJob, pendingAnalysesCount } from "../lib/matches";

interface PipelineSyncContextValue {
  jobs: Job[];
  analyses: MatchAnalysis[];
  feedbackEvents: FeedbackEvent[];
  pendingMatchCount: number;
  loading: boolean;
  refreshPipeline: () => Promise<void>;
  refreshJob: (jobId: string) => Promise<Job>;
  getAnalysesForJob: (jobId: string) => MatchAnalysis[];
  getLatestAnalysisForJob: (jobId: string) => MatchAnalysis | undefined;
  getApplicationStatusForJob: (jobId: string) => ApplicationOutcomeStatus;
}

const PipelineSyncContext = createContext<PipelineSyncContextValue | null>(null);

interface PipelineSyncProviderProps {
  profileId: string;
  children: React.ReactNode;
}

export function PipelineSyncProvider({ profileId, children }: PipelineSyncProviderProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [analyses, setAnalyses] = useState<MatchAnalysis[]>([]);
  const [feedbackEvents, setFeedbackEvents] = useState<FeedbackEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTaskCount, setRunningTaskCount] = useState(0);

  const refreshPipeline = useCallback(async () => {
    const [jobList, analysisList, feedbackList] = await Promise.all([
      api.jobs.list(),
      api.matchAnalyses.list(),
      api.feedback.listForProfile(profileId),
    ]);
    setJobs(jobList);
    setAnalyses(analysisList.filter((entry) => entry.profile_id === profileId));
    setFeedbackEvents(feedbackList.filter((entry) => entry.profile_id === profileId));
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
      feedbackEvents,
      pendingMatchCount,
      loading,
      refreshPipeline,
      refreshJob,
      getAnalysesForJob: (jobId: string) =>
        analyses.filter((entry) => entry.job_id === jobId),
      getLatestAnalysisForJob: (jobId: string) =>
        latestAnalysisForJob(analyses, profileId, jobId),
      getApplicationStatusForJob: (jobId: string) =>
        applicationStatusForJob(feedbackEvents, jobId),
    }),
    [
      analyses,
      feedbackEvents,
      jobs,
      loading,
      pendingMatchCount,
      profileId,
      refreshJob,
      refreshPipeline,
    ],
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

export function useOptionalPipelineSync(): PipelineSyncContextValue | null {
  return useContext(PipelineSyncContext);
}
