import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { JobExtraction, JobParseResult } from "../types";
import { extractionMetadata } from "../lib/jobExtraction";
import { JobIntakeSteps } from "../components/JobIntakeSteps";
import { Layout } from "../components/Layout";
import { PageLoader } from "../components/AiLoadingState";
import { useProfileRoute } from "../components/RequireProfileLayout";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";
import { Badge, Button, ErrorBanner, Field, Input, Textarea } from "../components/ui";

interface JobReviewLocationState {
  parsed?: JobParseResult;
}

function workModeLabel(mode: JobExtraction["work_mode"]) {
  if (!mode) return null;
  return mode.charAt(0).toUpperCase() + mode.slice(1).replace("-", " ");
}

export function JobReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const handoffId = searchParams.get("handoff");
  const state = location.state as JobReviewLocationState | null;
  const stateParsed = state?.parsed;
  const { profile } = useProfileRoute();
  const embedded = useEmbeddedMode();

  const [parsed, setParsed] = useState<JobParseResult | null>(stateParsed ?? null);
  const [captureSource, setCaptureSource] = useState<string | null>(null);
  const [loadingHandoff, setLoadingHandoff] = useState(Boolean(handoffId && !stateParsed));
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [locationText, setLocationText] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [workMode, setWorkMode] = useState<JobExtraction["work_mode"]>(null);
  const [employmentType, setEmploymentType] = useState<string | null>(null);
  const [matchSummary, setMatchSummary] = useState("");
  const [jobMetadata, setJobMetadata] = useState<Record<string, unknown> | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stateParsed) {
      setParsed(stateParsed);
      return;
    }

    if (!handoffId) {
      navigate("/jobs/new", { replace: true });
      return;
    }

    let cancelled = false;
    setLoadingHandoff(true);
    setError(null);

    api.jobs
      .getIntakeHandoff(handoffId)
      .then((handoff) => {
        if (cancelled) return;
        setParsed({
          job_text: handoff.job_text,
          structured_data: handoff.structured_data,
        });
        setUrl(handoff.url ?? "");
        setCaptureSource(handoff.source);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load captured job");
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingHandoff(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [handoffId, navigate, stateParsed]);

  useEffect(() => {
    if (!parsed) {
      return;
    }
    const extraction = parsed.structured_data;
    setTitle(extraction.title);
    setCompany(extraction.company);
    setLocationText(extraction.location ?? "");
    setDescription(extraction.description);
    setRequirements(extraction.requirements);
    setWorkMode(extraction.work_mode ?? null);
    setEmploymentType(extraction.employment_type ?? null);
    setMatchSummary(extraction.match_summary);
    setJobMetadata(extractionMetadata(extraction, parsed.job_text));
  }, [parsed]);

  if (loadingHandoff || !parsed) {
    return (
      <Layout title="Add job" subtitle="Review captured details">
        <div className="mx-auto max-w-2xl animate-pulse space-y-4 py-12">
          {error ? (
            <ErrorBanner message={error} />
          ) : (
            <>
              <div className="h-4 w-48 rounded bg-surface-overlay" />
              <div className="h-32 rounded-xl bg-surface-overlay" />
            </>
          )}
        </div>
      </Layout>
    );
  }

  async function handleSave() {
    if (!title.trim() || !company.trim() || !description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await api.jobs.create({
        title: title.trim(),
        company: company.trim(),
        description: description.trim(),
        location: locationText.trim() || undefined,
        url: url.trim() || undefined,
        source: captureSource ?? undefined,
        raw_metadata: jobMetadata ?? undefined,
        profile_id: profile!.id,
      });
      navigate(`/jobs/${saved.id}`, {
        replace: true,
        state: {
          focusMatch: true,
          fromIntake: true,
          matchAnalysisId: saved.match_analysis_id ?? undefined,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save job");
      setSaving(false);
    }
  }

  const canSave = title.trim() && company.trim() && description.trim();

  return (
    <Layout title="Add job" subtitle="Confirm details — then we analyze your fit">
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/90 backdrop-blur-sm">
          <PageLoader variant="match-full" />
        </div>
      )}
      <div className={`mx-auto max-w-2xl ${embedded ? "pb-32" : "pb-24"}`}>
        <JobIntakeSteps current={2} />

        <div className="mt-6">
          <h2 className="text-2xl font-semibold">Does this look right?</h2>
          <p className="mt-2 text-text-muted">
            Edit anything that looks off. We&apos;ll compare this role against{" "}
            <span className="font-medium text-text">{profile.name}</span>&apos;s profile.
          </p>
          {captureSource && (
            <div className="mt-3">
              <Badge variant="info">Captured from {captureSource}</Badge>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <section className="mt-6 space-y-5 rounded-xl border border-border bg-surface-raised p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Backend Engineer"
              />
            </Field>
            <Field label="Company">
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
              />
            </Field>
          </div>

          <Field label="Location" hint="Optional">
            <Input
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="Remote · Berlin"
            />
          </Field>

          {(workMode || employmentType) && (
            <div className="flex flex-wrap gap-2">
              {workMode && <Badge variant="info">{workModeLabel(workMode)}</Badge>}
              {employmentType && <Badge variant="default">{employmentType}</Badge>}
            </div>
          )}

          {matchSummary && (
            <p className="rounded-lg bg-surface px-3 py-2 text-sm leading-relaxed text-text-muted">
              {matchSummary}
            </p>
          )}

          {requirements.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                Key requirements ({requirements.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {requirements.map((req) => (
                  <Badge key={req} variant="info">
                    {req}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Field label="Job URL" hint="Optional — your reference only">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </Field>

          <div>
            <button
              type="button"
              onClick={() => setShowDescription((v) => !v)}
              className="text-sm font-medium text-text-muted hover:text-text"
            >
              {showDescription ? "Hide" : "Show"} full description
            </button>
            {showDescription && (
              <div className="mt-3">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={10}
                />
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-accent/20 bg-accent/5 px-5 py-4">
          <ol className="space-y-2 text-sm text-text-muted">
            <li className="flex gap-2">
              <span className="text-accent">1.</span>
              Explainable match analysis — score, strengths, gaps, evidence
            </li>
            <li className="flex gap-2">
              <span className="text-accent">2.</span>
              Company research, resume tweaks, cover letter
            </li>
          </ol>
        </section>

        <div
          className={`fixed inset-x-0 z-40 border-t border-border bg-surface/95 px-4 py-4 backdrop-blur-sm ${
            embedded ? "bottom-14" : "bottom-0 lg:left-64"
          }`}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/jobs/new", { state: { pasteText: parsed.job_text } })}
            >
              ← Back
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!canSave} className="min-w-[200px]">
              Save & analyze match
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
