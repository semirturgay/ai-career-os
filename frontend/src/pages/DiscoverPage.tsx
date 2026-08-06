import { useNavigate } from "react-router-dom";
import { DiscoverNewMonitorForm } from "../components/DiscoverNewRunForm";
import { DiscoverMonitorCard } from "../components/DiscoverRunCard";
import { Layout } from "../components/Layout";
import { PageLoader } from "../components/AiLoadingState";
import { useProfileRoute } from "../components/RequireProfileLayout";
import { ErrorBanner } from "../components/ui";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";
import { useDiscoveryMonitors } from "../hooks/useDiscover";
import { DISCOVERY_LOCAL_MODE } from "../lib/discoveryService";

export function DiscoverPage() {
  const navigate = useNavigate();
  const { profile } = useProfileRoute();
  const embedded = useEmbeddedMode();
  const {
    monitors,
    loading,
    error,
    starting,
    activeCount,
    defaultInterval,
    createMonitor,
    removeMonitor,
  } = useDiscoveryMonitors(profile.id);

  if (loading) {
    return (
      <Layout title="Discover" subtitle="Scheduled job searches">
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
          : "Scheduled job searches"
      }
      showCaptureBar={embedded ? true : undefined}
    >
      <div className={embedded ? "min-w-0 space-y-4" : "space-y-6"}>
        {DISCOVERY_LOCAL_MODE && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-text">
            Preview mode — schedules and results are simulated locally until the backend agent is
            connected.
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        <DiscoverNewMonitorForm
          compact={embedded}
          loading={starting}
          defaultInterval={defaultInterval}
          onSubmit={async (input) => {
            const monitor = await createMonitor(input);
            navigate(`/discover/${monitor.id}`);
          }}
        />

        <section className="min-w-0 space-y-3">
          <div>
            <h2 className={`font-semibold ${embedded ? "text-base" : "text-lg"}`}>
              Your discoveries
            </h2>
            <p className="text-xs text-text-muted sm:text-sm">
              {monitors.length === 0
                ? "Each discovery keeps its own criteria, interval, and candidate list."
                : `${monitors.length} active monitor${monitors.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {monitors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-raised px-5 py-8 text-center">
              <p className="text-sm font-medium text-text">No discoveries yet</p>
              <p className="mt-1 text-sm text-text-muted">
                Create a monitor for a role and location. It runs on your chosen interval and
                surfaces new links to open and capture.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {monitors.map((monitor) => (
                <DiscoverMonitorCard
                  key={monitor.id}
                  monitor={monitor}
                  defaultInterval={defaultInterval}
                  compact={embedded}
                  onDelete={() => void removeMonitor(monitor.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
}
