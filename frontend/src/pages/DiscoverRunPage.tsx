import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AiLoadingState, PageLoader } from "../components/AiLoadingState";
import { DiscoverCandidateCard } from "../components/DiscoverCandidateCard";
import { Layout } from "../components/Layout";
import { useProfileRoute } from "../components/RequireProfileLayout";
import { Badge, ErrorBanner } from "../components/ui";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";
import { useDiscoveryRun } from "../hooks/useDiscover";
import { DISCOVERY_LOCAL_MODE, formatDiscoveryCriteria } from "../lib/discoveryService";

export function DiscoverRunPage() {
  const navigate = useNavigate();
  const { runId } = useParams<{ runId: string }>();
  const { profile } = useProfileRoute();
  const embedded = useEmbeddedMode();
  const { run, loading, error, dismissCandidate } = useDiscoveryRun(profile.id, runId);

  const visibleCandidates = useMemo(
    () => run?.candidates.filter((candidate) => !candidate.dismissed) ?? [],
    [run?.candidates],
  );

  if (loading) {
    return (
      <Layout title="Discovery" backTo="/discover" backLabel="Discover" showCaptureBar={false}>
        <PageLoader variant="page" />
      </Layout>
    );
  }

  if (!run) {
    return (
      <Layout title="Discovery" backTo="/discover" backLabel="Discover" showCaptureBar={false}>
        <ErrorBanner message={error ?? "Discovery run not found"} />
      </Layout>
    );
  }

  const criteriaText = formatDiscoveryCriteria(run.criteria);
  const isRunning = run.status === "running" || run.status === "pending";

  return (
    <Layout
      title={criteriaText}
      subtitle={
        isRunning
          ? "Searching for matching roles…"
          : `${visibleCandidates.length} candidate${visibleCandidates.length === 1 ? "" : "s"}`
      }
      backTo="/discover"
      backLabel="Discover"
      showCaptureBar={embedded ? true : undefined}
    >
      <div className={embedded ? "min-w-0 space-y-4" : "space-y-6"}>
        {DISCOVERY_LOCAL_MODE && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-text">
            Preview mode — simulated search results for UI development.
          </div>
        )}

        {error && run && <ErrorBanner message={error} />}

        <section className="rounded-xl border border-border bg-surface-raised p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isRunning ? "info" : run.status === "failed" ? "danger" : "success"}>
              {isRunning ? "Searching" : run.status === "failed" ? "Failed" : "Complete"}
            </Badge>
            {run.criteria.remote !== "any" && <Badge>{run.criteria.remote}</Badge>}
            {run.criteria.country && <Badge>{run.criteria.country}</Badge>}
            {run.criteria.city && <Badge>{run.criteria.city}</Badge>}
          </div>
          {run.criteria.notes && (
            <p className="mt-2 text-sm text-text-muted">{run.criteria.notes}</p>
          )}
          {run.status === "failed" && run.error && (
            <p className="mt-2 text-sm text-danger">{run.error}</p>
          )}
        </section>

        {isRunning ? (
          <AiLoadingState variant="job-discovery" size={embedded ? "sm" : "md"} />
        ) : visibleCandidates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-raised px-5 py-8 text-center">
            <p className="text-sm font-medium text-text">No candidates found</p>
            <p className="mt-1 text-sm text-text-muted">
              Try another title, location, or work mode — then start a new discovery.
            </p>
            <button
              type="button"
              className="mt-4 text-sm font-medium text-accent hover:underline"
              onClick={() => navigate("/discover")}
            >
              Back to Discover
            </button>
          </div>
        ) : (
          <section className="space-y-3">
            <p className="text-xs text-text-muted sm:text-sm">
              Open a posting in your browser, then capture it from the job page to run full match
              analysis.
            </p>
            <ul className="space-y-3">
              {visibleCandidates.map((candidate) => (
                <li key={candidate.id}>
                  <DiscoverCandidateCard
                    candidate={candidate}
                    compact={embedded}
                    onDismiss={() => void dismissCandidate(candidate.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Layout>
  );
}
