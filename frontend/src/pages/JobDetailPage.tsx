import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { JobExtraction } from "../types";
import { AiLoadingState, PageLoader } from "../components/AiLoadingState";
import { Layout } from "../components/Layout";
import { JobDetailTabs, type JobDetailTab } from "../components/JobDetailTabs";
import { useProfileRoute } from "../components/RequireProfileLayout";
import { useJobDetail } from "../hooks/useJobDetail";
import { useMatchAnalysis } from "../hooks/useMatchAnalysis";
import { usePipelineSync } from "../hooks/PipelineSyncContext";
import {
  buildJobExtractSource,
  canExtractFromText,
  extractionMetadata,
} from "../lib/jobExtraction";
import { Badge, Button, ErrorBanner } from "../components/ui";
import { DuplicateJobBanner } from "../components/DuplicateJobBanner";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";
import type { DuplicateJobInfo } from "../lib/jobUrl";

interface JobDetailLocationState {
  focusMatch?: boolean;
  fromIntake?: boolean;
  fromPipeline?: boolean;
  matchAnalysisId?: string;
  focusTab?: JobDetailTab;
  duplicateCapture?: boolean;
  existingJob?: DuplicateJobInfo;
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const embedded = useEmbeddedMode();
  const detailState = location.state as JobDetailLocationState | null;
  const duplicateCapture = detailState?.duplicateCapture ?? false;
  const duplicateJob = detailState?.existingJob ?? null;
  const intakeRef = useRef({
    focusMatch: detailState?.focusMatch ?? false,
    fromIntake: detailState?.fromIntake ?? false,
    matchAnalysisId: detailState?.matchAnalysisId,
  });
  const matchSectionRef = useRef<HTMLElement>(null);
  const { profile } = useProfileRoute();
  const { job, setJob, loading } = useJobDetail(id);
  const {
    getAnalysesForJob,
    getLatestAnalysisForJob,
    refreshPipeline,
    refreshJob: syncJobInPipeline,
  } = usePipelineSync();
  const pipelineAnalysis = job ? getLatestAnalysisForJob(job.id) : undefined;
  const analysisId = pipelineAnalysis?.id ?? intakeRef.current.matchAnalysisId;
  const { analysis, setAnalysis } = useMatchAnalysis(analysisId);
  const jobAnalyses = job ? getAnalysesForJob(job.id) : [];
  const [analyzing, setAnalyzing] = useState(false);
  const [reExtracting, setReExtracting] = useState(false);
  const [applyingExtraction, setApplyingExtraction] = useState(false);
  const [pendingExtraction, setPendingExtraction] = useState<{
    extraction: JobExtraction;
    jobText: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshedAnalysisRef = useRef<string | null>(null);

  const handleRefreshJob = useCallback(async () => {
    if (!id) return;
    const updated = await syncJobInPipeline(id);
    setJob(updated);
  }, [id, setJob, syncJobInPipeline]);

  useEffect(() => {
    if (!intakeRef.current.focusMatch || loading) return;
    intakeRef.current.focusMatch = false;
    matchSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    navigate(location.pathname, { replace: true, state: null });
  }, [loading, location.pathname, navigate]);

  useEffect(() => {
    if (analysis?.status !== "completed" || !id || !analysis.id) return;
    if (refreshedAnalysisRef.current === analysis.id) return;
    refreshedAnalysisRef.current = analysis.id;
    void handleRefreshJob();
  }, [analysis?.status, analysis?.id, id, handleRefreshJob]);

  async function handleAnalyze() {
    if (!job) return;
    setAnalyzing(true);
    setError(null);
    try {
      const created = await api.matchAnalyses.create(profile.id, job.id);
      setAnalysis(created);
      await refreshPipeline();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start analysis");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleReExtract() {
    if (!job) return;
    const sourceText = buildJobExtractSource(job);
    if (!canExtractFromText(sourceText)) {
      setError("Not enough job text to re-extract — edit the job and add a longer description");
      return;
    }

    setReExtracting(true);
    setError(null);
    try {
      const result = await api.jobs.parseText(sourceText);
      setPendingExtraction({
        extraction: result.structured_data,
        jobText: result.job_text,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-extract job fields");
    } finally {
      setReExtracting(false);
    }
  }

  async function handleApplyExtraction() {
    if (!job || !pendingExtraction) return;
    setApplyingExtraction(true);
    setError(null);
    try {
      const { extraction, jobText } = pendingExtraction;
      const updated = await api.jobs.update(job.id, {
        title: extraction.title,
        company: extraction.company,
        description: extraction.description,
        location: extraction.location ?? undefined,
        raw_metadata: {
          ...(job.raw_metadata ?? {}),
          ...extractionMetadata(extraction, jobText),
        },
      });
      setJob(updated);
      setPendingExtraction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update job");
    } finally {
      setApplyingExtraction(false);
    }
  }

  if (loading || !job) {
    return (
      <Layout title="Job" subtitle="Opportunity details">
        <PageLoader variant="page" />
      </Layout>
    );
  }

  const requirements = Array.isArray(job.raw_metadata?.requirements)
    ? (job.raw_metadata.requirements as string[])
    : [];
  const canReExtract = canExtractFromText(buildJobExtractSource(job));
  const analysisPending = analysis?.status === "pending";
  const showAnalyzeButton = !analysisPending;
  const analyzeLabel =
    analysis?.status === "failed"
      ? "Retry analysis"
      : analysis?.status === "completed"
        ? "Re-analyze match"
        : "Analyze match";

  const fromIntake = intakeRef.current.fromIntake;
  const fromPipeline = detailState?.fromPipeline ?? (embedded && !fromIntake);
  const focusTab = detailState?.focusTab;
  const focusNextStep = fromPipeline && !focusTab && !fromIntake;
  const matchFirst = embedded || fromIntake;

  const jobDetailsSection = matchFirst ? (
    <details className="rounded-xl border border-border bg-surface-raised">
      <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-text hover:bg-surface-overlay/50">
        Job description · {job.company}
        {requirements.length > 0 && (
          <span className="ml-2 font-normal text-text-muted">({requirements.length} requirements)</span>
        )}
      </summary>
      <div className="space-y-4 border-t border-border px-5 py-4">
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm text-accent hover:underline"
          >
            View job link
          </a>
        )}
        {requirements.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {requirements.map((req) => (
              <Badge key={req} variant="info">
                {req}
              </Badge>
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{job.description}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          {showAnalyzeButton && (
            <Button onClick={handleAnalyze} loading={analyzing} variant="secondary">
              {analyzeLabel}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={handleReExtract}
            loading={reExtracting}
            disabled={!canReExtract}
          >
            Re-extract fields
          </Button>
        </div>
      </div>
    </details>
  ) : (
    <section className="rounded-xl border border-border bg-surface-raised p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{job.title}</h2>
          <p className="mt-1 text-text-muted">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-accent hover:underline"
            >
              View job link
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {showAnalyzeButton && (
            <Button onClick={handleAnalyze} loading={analyzing}>
              {analyzeLabel}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={handleReExtract}
            loading={reExtracting}
            disabled={!canReExtract}
          >
            Re-extract fields
          </Button>
        </div>
      </div>

      {pendingExtraction && (
        <section className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <h3 className="text-sm font-medium">Review extracted fields</h3>
          <p className="mt-1 text-sm text-text-muted">
            Apply these changes to update the saved job, or cancel to keep the current version.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-text-muted">Title</dt>
              <dd className="font-medium">{pendingExtraction.extraction.title}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Company</dt>
              <dd className="font-medium">{pendingExtraction.extraction.company}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Location</dt>
              <dd className="font-medium">{pendingExtraction.extraction.location ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Employment</dt>
              <dd className="font-medium">{pendingExtraction.extraction.employment_type ?? "—"}</dd>
            </div>
          </dl>
          {pendingExtraction.extraction.requirements.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {pendingExtraction.extraction.requirements.slice(0, 8).map((req) => (
                <Badge key={req} variant="info">
                  {req}
                </Badge>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button onClick={handleApplyExtraction} loading={applyingExtraction}>
              Apply changes
            </Button>
            <Button variant="ghost" onClick={() => setPendingExtraction(null)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {requirements.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {requirements.slice(0, 8).map((req) => (
            <Badge key={req} variant="info">
              {req}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          Description
        </h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{job.description}</p>
      </div>
    </section>
  );

  return (
    <Layout title={job.title} subtitle={`${job.company}${job.location ? ` · ${job.location}` : ""}`}>
      <div className="space-y-6">
        <Link to="/" className="text-sm text-text-muted hover:text-accent lg:hidden">
          ← Pipeline
        </Link>

        {duplicateCapture && duplicateJob && (
          <DuplicateJobBanner job={duplicateJob} context="capture" />
        )}

        {error && <ErrorBanner message={error} />}

        {reExtracting && <AiLoadingState variant="job-extract" size="sm" />}

        {matchFirst ? (
          <>
            <section ref={matchSectionRef}>
              <JobDetailTabs
                job={job}
                analysis={analysis}
                profileName={profile.name}
                showProgress={fromIntake || analysisPending}
                initialTab={focusTab}
                focusNextStep={focusNextStep}
                onJobUpdated={setJob}
                onRefreshJob={handleRefreshJob}
                onReAnalyze={handleAnalyze}
                analyzing={analyzing}
                jobAnalyses={jobAnalyses}
                profileId={profile.id}
              />
            </section>
            {jobDetailsSection}
          </>
        ) : (
          <>
            {jobDetailsSection}
            <section ref={matchSectionRef}>
              <JobDetailTabs
                job={job}
                analysis={analysis}
                profileName={profile.name}
                showProgress={fromIntake || analysisPending}
                initialTab={focusTab}
                focusNextStep={focusNextStep}
                onJobUpdated={setJob}
                onRefreshJob={handleRefreshJob}
                onReAnalyze={handleAnalyze}
                analyzing={analyzing}
                jobAnalyses={jobAnalyses}
                profileId={profile.id}
              />
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
