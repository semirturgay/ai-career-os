import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Job } from "../types";

export function useJobDetail(jobId: string | undefined) {
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!jobId) return;
    const jobData = await api.jobs.get(jobId);
    setJob(jobData);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    setLoading(true);
    load()
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          navigate("/", { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobId, load, navigate]);

  return { job, setJob, loading, refreshJob: load };
}
