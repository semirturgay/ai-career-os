import type { PipelineStatusFilter } from "../lib/applicationStatus";
import { PIPELINE_STATUS_FILTERS } from "../lib/applicationStatus";

interface PipelineStatusFiltersProps {
  value: PipelineStatusFilter;
  counts: Record<PipelineStatusFilter, number>;
  onChange: (value: PipelineStatusFilter) => void;
  compact?: boolean;
}

export function PipelineStatusFilters({
  value,
  counts,
  onChange,
  compact = false,
}: PipelineStatusFiltersProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "sm:gap-2.5"}`}>
      {PIPELINE_STATUS_FILTERS.map((option) => {
        const active = value === option.value;
        const count = counts[option.value];
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              active
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface text-text-muted hover:border-accent/30 hover:text-text"
            } ${compact ? "py-0.5" : ""}`}
          >
            {option.label}
            <span className="ml-1 tabular-nums text-[11px] opacity-80">({count})</span>
          </button>
        );
      })}
    </div>
  );
}
