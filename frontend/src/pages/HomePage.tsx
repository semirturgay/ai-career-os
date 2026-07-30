import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Job } from "../types";
import { JobBoard } from "../components/JobBoard";
import { Layout } from "../components/Layout";
import { PageLoader } from "../components/AiLoadingState";
import { useProfileRoute } from "../components/RequireProfileLayout";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";
import { usePolling } from "../hooks/usePolling";
import { pendingAnalysesCount, scoreFromResult, latestAnalysisForJob } from "../lib/matches";
import type { MatchAnalysis } from "../types";

export function HomePage() {
  const { profile } = useProfileRoute();
  const embedded = useEmbeddedMode();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [analyses, setAnalyses] = useState<MatchAnalysis[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const refreshAnalyses = useCallback(async () => {
    const analysisList = await api.matchAnalyses.list();
    setAnalyses(analysisList.filter((a) => a.profile_id === profile.id));
  }, [profile.id]);

  useEffect(() => {
    async function load() {
      try {
        const [jobList, analysisList] = await Promise.all([
          api.jobs.list(),
          api.matchAnalyses.list(),
        ]);
        setJobs(jobList);
        setAnalyses(analysisList.filter((a) => a.profile_id === profile.id));
      } catch (err) {
        console.error(err);
      } finally {
        setDataLoading(false);
      }
    }
    load();
  }, [profile.id]);

  const pendingCount = pendingAnalysesCount(analyses, profile.id);
  usePolling(refreshAnalyses, pendingCount > 0);

  if (dataLoading) {
    return (
      <Layout title="Pipeline" subtitle="Your opportunities">
        <PageLoader variant="page" />
      </Layout>
    );
  }

  const analyzedCount = jobs.filter((job) => {
    const a = latestAnalysisForJob(analyses, profile.id, job.id);
    return a?.status === "completed";
  }).length;

  const topMatch = jobs
    .map((job) => ({
      job,
      score: scoreFromResult(latestAnalysisForJob(analyses, profile.id, job.id)?.result),
    }))
    .filter((item) => item.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  return (
    <Layout title="Pipeline" subtitle="Your opportunities">
      <div className={embedded ? "space-y-4" : "space-y-8"}>
        <section
          className={`rounded-xl border border-border bg-surface-raised ${
            embedded ? "px-3 py-3" : "p-6 shadow-sm sm:p-8"
          }`}
        >
          {embedded ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{profile.name}</p>
                {profile.headline && (
                  <p className="truncate text-xs text-text-muted">{profile.headline}</p>
                )}
              </div>
              <Link
                to="/profile"
                className="shrink-0 text-xs font-medium text-accent hover:underline"
              >
                Profile
              </Link>
            </div>
          ) : (
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-accent">Your profile</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{profile.name}</h2>
                {profile.headline && (
                  <p className="mt-2 max-w-xl text-text-muted">{profile.headline}</p>
                )}
                <Link
                  to="/profile"
                  className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
                >
                  View full profile →
                </Link>
              </div>
              <div className="flex flex-wrap gap-6">
                <Stat label="Jobs tracked" value={String(jobs.length)} />
                <Stat label="Analyzed" value={`${analyzedCount}/${jobs.length}`} />
                {topMatch?.score != null && (
                  <Stat label="Best match" value={`${Math.round(topMatch.score)}%`} />
                )}
              </div>
            </div>
          )}

          {embedded && jobs.length > 0 && (
            <div className="mt-3 flex gap-4 border-t border-border pt-3">
              <InlineStat label="Tracked" value={String(jobs.length)} />
              <InlineStat label="Analyzed" value={`${analyzedCount}/${jobs.length}`} />
              {topMatch?.score != null && (
                <InlineStat label="Best" value={`${Math.round(topMatch.score)}%`} />
              )}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h3 className={`font-semibold ${embedded ? "text-base" : "text-lg"}`}>Opportunities</h3>
            <p className="text-xs text-text-muted sm:text-sm">
              {pendingCount > 0
                ? `Analyzing ${pendingCount} job${pendingCount === 1 ? "" : "s"}…`
                : "Ranked by match score"}
            </p>
          </div>

          <JobBoard jobs={jobs} analyses={analyses} profileId={profile.id} />
        </section>
      </div>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[5rem]">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-bold tabular-nums text-text">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
    </div>
  );
}
