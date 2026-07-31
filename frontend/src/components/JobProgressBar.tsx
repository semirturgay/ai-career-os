import type { ApplicationProgress, ApplicationStepStatus, JobDetailTab } from "../lib/applicationProgress";
import { applicationStepToTab, stepTooltip, tabToApplicationStepId } from "../lib/applicationProgress";

interface JobProgressBarProps {
  progress: ApplicationProgress;
  activeTab?: JobDetailTab;
  onStepSelect?: (tab: JobDetailTab) => void;
  isStepEnabled?: (tab: JobDetailTab) => boolean;
  compact?: boolean;
}

function segmentClass(status: ApplicationStepStatus, active: boolean, compact: boolean): string {
  const height = compact ? "h-1.5" : "h-2";
  if (active) return `${height} bg-accent`;
  switch (status) {
    case "done":
      return `${height} bg-accent/70`;
    case "skipped":
      return `${height} bg-accent/40`;
    case "pending":
      return `${height} bg-accent/60 animate-pulse`;
    default:
      return `${height} bg-border`;
  }
}

function dotClass(status: ApplicationStepStatus, active: boolean): string {
  if (active) return "bg-accent text-white ring-2 ring-accent/30";
  switch (status) {
    case "done":
      return "bg-accent text-white";
    case "skipped":
      return "bg-accent/20 text-accent";
    case "pending":
      return "bg-accent/15 text-accent animate-pulse";
    default:
      return "bg-surface-overlay text-text-muted";
  }
}

function dotLabel(status: ApplicationStepStatus): string {
  if (status === "done" || status === "skipped") return "✓";
  if (status === "pending") return "…";
  return "";
}

export function JobProgressBar({
  progress,
  activeTab = "match",
  onStepSelect,
  isStepEnabled,
  compact = false,
}: JobProgressBarProps) {
  const activeStepId = tabToApplicationStepId(activeTab);
  const interactive = !!onStepSelect;

  function stepDisabled(tab: JobDetailTab): boolean {
    if (!interactive) return false;
    if (isStepEnabled && !isStepEnabled(tab)) return true;
    return false;
  }

  return (
    <div
      className={`${compact ? "space-y-1.5" : "space-y-2"} ${interactive ? "" : "pointer-events-none"}`}
      role={interactive ? "tablist" : "group"}
      aria-label={`Application progress, ${progress.completedCount} of ${progress.totalCount} complete`}
    >
      <div className="flex items-center gap-1">
        {progress.steps.map((step) => {
          const active = step.id === activeStepId;
          const tab = applicationStepToTab(step.id);
          const disabled = stepDisabled(tab);
          const segment = segmentClass(step.status, active, compact);

          if (!interactive) {
            return (
              <div
                key={step.id}
                title={stepTooltip(step)}
                className={`flex-1 rounded-full ${segment}`}
              />
            );
          }

          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={disabled}
              title={stepTooltip(step)}
              disabled={disabled}
              onClick={() => !disabled && onStepSelect?.(tab)}
              className={`flex-1 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:opacity-90"
              } ${segment}`}
            />
          );
        })}
      </div>

      <div className="flex justify-between gap-1">
        {progress.steps.map((step) => {
          const active = step.id === activeStepId;
          const tab = applicationStepToTab(step.id);
          const disabled = stepDisabled(tab);
          const labelClass = `${
            compact ? "text-[9px]" : "text-[10px]"
          } ${
            active
              ? "font-semibold text-accent"
              : step.status === "done" || step.status === "skipped"
                ? "font-medium text-text"
                : step.status === "pending"
                  ? "text-accent"
                  : "text-text-muted"
          }`;

          if (!interactive) {
            return (
              <div
                key={step.id}
                title={stepTooltip(step)}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-1 ${active ? "bg-accent/5 rounded-md" : ""}`}
              >
                <span
                  className={`flex size-4 items-center justify-center rounded-full text-[9px] font-semibold ${dotClass(step.status, active)}`}
                  aria-hidden
                >
                  {dotLabel(step.status)}
                </span>
                <span className={`w-full truncate text-center ${labelClass}`}>{step.shortLabel}</span>
              </div>
            );
          }

          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={disabled}
              title={stepTooltip(step)}
              disabled={disabled}
              onClick={() => !disabled && onStepSelect?.(tab)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-0.5 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-surface-overlay/50"
              } ${active ? "bg-accent/5" : ""}`}
            >
              <span
                className={`flex size-4 items-center justify-center rounded-full text-[9px] font-semibold ${dotClass(step.status, active)}`}
                aria-hidden
              >
                {dotLabel(step.status)}
              </span>
              <span className={`w-full truncate text-center ${labelClass}`}>{step.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
