import { useAsyncTasks } from "../lib/asyncTasks";
import { usePipelineSync } from "../hooks/PipelineSyncContext";

export function GlobalTaskIndicator() {
  const tasks = useAsyncTasks();
  const { pendingMatchCount } = usePipelineSync();

  const running = tasks.filter((task) => task.status === "running");
  const failed = tasks.filter((task) => task.status === "failed");

  if (running.length === 0 && failed.length === 0 && pendingMatchCount === 0) {
    return null;
  }

  const primary =
    running[0]?.label ??
    (pendingMatchCount > 0
      ? `Match analysis running (${pendingMatchCount})`
      : failed[0]?.label);

  return (
    <div
      className="border-b border-accent/20 bg-accent/5 px-4 py-2 text-xs text-text"
      role="status"
      aria-live="polite"
    >
      {running.length > 0 || pendingMatchCount > 0 ? (
        <p className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden />
          <span>
            {primary}
            {running.length + pendingMatchCount > 1
              ? ` · ${running.length + pendingMatchCount} tasks in progress`
              : " — safe to switch pages, we keep tracking"}
          </span>
        </p>
      ) : (
        <p className="text-danger">{failed[0]?.error ?? "A background task failed"}</p>
      )}
    </div>
  );
}

export function useBackgroundWorkCount(): number {
  const tasks = useAsyncTasks();
  const { pendingMatchCount } = usePipelineSync();
  return pendingMatchCount + tasks.filter((task) => task.status === "running").length;
}
