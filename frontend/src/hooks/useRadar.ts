import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type {
  PollResult,
  Posting,
  PostingState,
  ResolvedBoard,
  WatchedCompany,
  WatchedCompanyCreate,
  WatchedCompanyUpdate,
} from "../types/radar";

interface UseRadarResult {
  companies: WatchedCompany[];
  postings: Posting[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  resolve: (query: string) => Promise<ResolvedBoard>;
  addCompany: (body: WatchedCompanyCreate) => Promise<WatchedCompany>;
  updateCompany: (companyId: string, patch: WatchedCompanyUpdate) => Promise<void>;
  removeCompany: (companyId: string) => Promise<void>;
  pollCompany: (companyId: string) => Promise<PollResult>;
  promotePosting: (postingId: string) => Promise<string>;
  dismissPosting: (postingId: string) => Promise<void>;
  pollingCompanyId: string | null;
}

const VISIBLE_STATES: PostingState[] = ["new", "screened"];

export function useRadar(profileId: string | null): UseRadarResult {
  const [companies, setCompanies] = useState<WatchedCompany[]>([]);
  const [postings, setPostings] = useState<Posting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingCompanyId, setPollingCompanyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setCompanies([]);
      setPostings([]);
      setLoading(false);
      return;
    }
    try {
      const [nextCompanies, nextPostings] = await Promise.all([
        api.radar.listCompanies(profileId),
        api.radar.listPostings(profileId, { state: VISIBLE_STATES }),
      ]);
      setCompanies(nextCompanies);
      setPostings(nextPostings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your radar");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resolve = useCallback(
    async (query: string) => {
      if (!profileId) throw new Error("No active profile");
      return api.radar.resolve(profileId, query);
    },
    [profileId],
  );

  const addCompany = useCallback(
    async (body: WatchedCompanyCreate) => {
      if (!profileId) throw new Error("No active profile");
      const created = await api.radar.addCompany(profileId, body);
      await refresh();
      return created;
    },
    [profileId, refresh],
  );

  const updateCompany = useCallback(
    async (companyId: string, patch: WatchedCompanyUpdate) => {
      if (!profileId) return;
      await api.radar.updateCompany(profileId, companyId, patch);
      await refresh();
    },
    [profileId, refresh],
  );

  const removeCompany = useCallback(
    async (companyId: string) => {
      if (!profileId) return;
      await api.radar.removeCompany(profileId, companyId);
      await refresh();
    },
    [profileId, refresh],
  );

  const pollCompany = useCallback(
    async (companyId: string) => {
      if (!profileId) throw new Error("No active profile");
      setPollingCompanyId(companyId);
      try {
        const result = await api.radar.poll(profileId, companyId);
        await refresh();
        return result;
      } finally {
        setPollingCompanyId(null);
      }
    },
    [profileId, refresh],
  );

  const promotePosting = useCallback(
    async (postingId: string) => {
      if (!profileId) throw new Error("No active profile");
      const job = await api.radar.promotePosting(profileId, postingId);
      await refresh();
      return job.id;
    },
    [profileId, refresh],
  );

  const dismissPosting = useCallback(
    async (postingId: string) => {
      if (!profileId) return;
      await api.radar.dismissPosting(profileId, postingId);
      setPostings((current) => current.filter((item) => item.id !== postingId));
    },
    [profileId],
  );

  return useMemo(
    () => ({
      companies,
      postings,
      loading,
      error,
      refresh,
      resolve,
      addCompany,
      updateCompany,
      removeCompany,
      pollCompany,
      promotePosting,
      dismissPosting,
      pollingCompanyId,
    }),
    [
      companies,
      postings,
      loading,
      error,
      refresh,
      resolve,
      addCompany,
      updateCompany,
      removeCompany,
      pollCompany,
      promotePosting,
      dismissPosting,
      pollingCompanyId,
    ],
  );
}
