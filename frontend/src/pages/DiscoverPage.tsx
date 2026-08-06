import { useNavigate } from "react-router-dom";
import { DiscoverNewRunForm } from "../components/DiscoverNewRunForm";
import { DiscoverRunCard } from "../components/DiscoverRunCard";
import { Layout } from "../components/Layout";
import { PageLoader } from "../components/AiLoadingState";
import { useProfileRoute } from "../components/RequireProfileLayout";
import { ErrorBanner } from "../components/ui";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";
import { useDiscoveryRuns } from "../hooks/useDiscover";
import { DISCOVERY_LOCAL_MODE } from "../lib/discoveryService";

export function DiscoverPage() {
  const navigate = useNavigate();
  const { profile } = useProfileRoute();
  const embedded = useEmbeddedMode();
  const { runs, loading, error, starting, activeCount, startRun, removeRun } = useDiscoveryRuns(
    profile.id,
  );

  if (loading) {
    return (
      <Layout title="Discover" subtitle="Find jobs to explore">
        <PageLoader variant="page" />
      </Layout>
    );
  }

  return (
    <Layout
      title="Discover"
      subtitle={
        activeCount > 0
          ? `${activeCount} search${activeCount === 1 ? "" : "es"} in progress`
          : "Find jobs to explore"
      }
      showCaptureBar={embedded ? true : undefined}
    >
      <div className={embedded ? "min-w-0 space-y-4" : "space-y-6"}>
        {DISCOVERY_LOCAL_MODE && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-text">
            Preview mode — discovery results are simulated locally until the backend agent is connected.
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        <DiscoverNewRunForm
          compact={embedded}
          loading={starting}
          onSubmit={async (input) => {
            const run = await startRun(input);
            navigate(`/discover/${run.id}`);
          }}
        />

        <section className="min-w-0 space-y-3">
          <div>
            <h2 className={`font-semibold ${embedded ? "text-base" : "text-lg"}`}>Your discoveries</h2>
            <p className="text-xs text-text-muted sm:text-sm">
              {runs.length === 0
                ? "Start a search above — each run keeps its own criteria and results."
                : `${runs.length} discovery run${runs.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {runs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-raised px-5 py-8 text-center">
              <p className="text-sm font-medium text-text">No discoveries yet</p>
              <p className="mt-1 text-sm text-text-muted">
                Run a search for a role and location. We&apos;ll surface links worth opening — capture
                from the page when you find a fit.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {runs.map((run) => (
                <DiscoverRunCard
                  key={run.id}
                  run={run}
                  compact={embedded}
                  onDelete={() => void removeRun(run.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
}
