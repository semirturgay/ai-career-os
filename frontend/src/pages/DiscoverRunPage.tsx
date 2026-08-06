import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AiLoadingState, PageLoader } from "../components/AiLoadingState";
import { DiscoverCandidateCard } from "../components/DiscoverCandidateCard";
import { Layout } from "../components/Layout";
import { useProfileRoute } from "../components/RequireProfileLayout";
import { Badge, Button, ErrorBanner, Field, Select } from "../components/ui";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";
import { useDiscovery } from "../hooks/useDiscover";
import {
  countNewCandidates,
  formatNextRun,
  intervalLabel,
} from "../lib/discoveryIntervals";
import { DISCOVERY_LOCAL_MODE, formatDiscoveryCriteria } from "../lib/discoveryService";
import { DISCOVERY_INTERVAL_OPTIONS, type DiscoveryInterval } from "../types/discovery";

export function DiscoverRunPage() {
  const navigate = useNavigate();
  const { runId: discoveryId } = useParams<{ runId: string }>();
  const { profile } = useProfileRoute();
  const embedded = useEmbeddedMode();
  const {
    monitor,
    loading,
    error,
    defaultInterval,
    actionLoading,
    dismissCandidate,
    updateMonitor,
    runNow,
  } = useDiscovery(profile.id, discoveryId);

  const visibleCandidates = useMemo(
    () => monitor?.candidates.filter((candidate) => !candidate.dismissed) ?? [],
    [monitor?.candidates],
  );

  const newCount = monitor ? countNewCandidates(monitor, defaultInterval) : 0;

  if (loading) {
    return (
      <Layout title="Discovery" backTo="/discover" backLabel="Discover" showCaptureBar={false}>
        <PageLoader variant="page" />
      </Layout>
    );
  }

  if (!monitor) {
    return (
      <Layout title="Discovery" backTo="/discover" backLabel="Discover" showCaptureBar={false}>
        <ErrorBanner message={error ?? "Discovery not found"} />
      </Layout>
    );
  }

  const criteriaText = formatDiscoveryCriteria(monitor.criteria);
  const isRunning = monitor.status === "running" || monitor.status === "pending";

  return (
    <Layout
      title={criteriaText}
      subtitle={
        isRunning
          ? "Searching for matching roles…"
          : `${visibleCandidates.length} candidate${visibleCandidates.length === 1 ? "" : "s"}${newCount > 0 ? ` · ${newCount} new` : ""}`
      }
      backTo="/discover"
      backLabel="Discover"
      showCaptureBar={embedded ? true : undefined}
    >
      <div className={embedded ? "min-w-0 space-y-4" : "space-y-6"}>
        {DISCOVERY_LOCAL_MODE && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-text">
            Preview mode — simulated schedule and search results for UI development.
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        <section className="space-y-4 rounded-xl border border-border bg-surface-raised p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={monitor.enabled ? "success" : "warning"}>
              {monitor.enabled ? "Active" : "Paused"}
            </Badge>
            <Badge variant="default">{intervalLabel(monitor.interval, defaultInterval)}</Badge>
            {monitor.criteria.remote !== "any" && <Badge>{monitor.criteria.remote}</Badge>}
            {monitor.criteria.country && <Badge>{monitor.criteria.country}</Badge>}
            {monitor.criteria.city && <Badge>{monitor.criteria.city}</Badge>}
          </div>

          {monitor.criteria.notes && (
            <p className="text-sm text-text-muted">{monitor.criteria.notes}</p>
          )}

          <p className="text-xs text-text-muted">
            {monitor.enabled
              ? formatNextRun(monitor.next_run_at)
              : "Paused — no scheduled runs"}
            {monitor.last_run_at &&
              ` · Last run ${new Date(monitor.last_run_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}`}
          </p>

          {monitor.status === "failed" && monitor.error && (
            <p className="text-sm text-danger">{monitor.error}</p>
          )}

          <div className={`grid gap-3 ${embedded ? "" : "sm:grid-cols-2"}`}>
            <Field label="Interval">
              <Select
                value={monitor.interval}
                disabled={actionLoading}
                onChange={(event) =>
                  void updateMonitor({ interval: event.target.value as DiscoveryInterval })
                }
              >
                {DISCOVERY_INTERVAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value === "default"
                      ? intervalLabel("default", defaultInterval)
                      : option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex flex-wrap items-end gap-2">
              <Button
                type="button"
                variant="secondary"
                loading={actionLoading || isRunning}
                disabled={isRunning || actionLoading}
                onClick={() => void runNow()}
              >
                Run now
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={actionLoading}
                onClick={() => void updateMonitor({ enabled: !monitor.enabled })}
              >
                {monitor.enabled ? "Pause" : "Resume"}
              </Button>
            </div>
          </div>
        </section>

        {isRunning ? (
          <AiLoadingState variant="job-discovery" size={embedded ? "sm" : "md"} />
        ) : visibleCandidates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-raised px-5 py-8 text-center">
            <p className="text-sm font-medium text-text">No candidates found</p>
            <p className="mt-1 text-sm text-text-muted">
              Web search returned no usable listings for this run. Try broader title/location, a
              different work mode, or Run now again — ATS boards (Greenhouse, Lever) work best.
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
