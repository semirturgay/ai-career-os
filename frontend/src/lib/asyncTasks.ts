import { useEffect, useState } from "react";

export type AsyncTaskKind = "match" | "resume" | "cover" | "research";

export type AsyncTaskStatus = "running" | "completed" | "failed";

export interface AsyncTask {
  key: string;
  kind: AsyncTaskKind;
  jobId: string;
  label: string;
  status: AsyncTaskStatus;
  error?: string;
}

const tasks = new Map<string, AsyncTask>();
const listeners = new Set<() => void>();
const settledListeners = new Set<() => void>();

const EMPTY_TASKS: readonly AsyncTask[] = [];
let cachedSnapshot: readonly AsyncTask[] = EMPTY_TASKS;

function rebuildSnapshot() {
  cachedSnapshot = tasks.size === 0 ? EMPTY_TASKS : Array.from(tasks.values());
}

function emit() {
  rebuildSnapshot();
  listeners.forEach((listener) => listener());
}

function emitSettled() {
  settledListeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function onAsyncTaskSettled(listener: () => void): () => void {
  settledListeners.add(listener);
  return () => {
    settledListeners.delete(listener);
  };
}


export function getAsyncTasksSnapshot(): readonly AsyncTask[] {
  return cachedSnapshot;
}

export function subscribeAsyncTasks(listener: () => void): () => void {
  return subscribe(listener);
}

export function getRunningAsyncTasks(): AsyncTask[] {
  return cachedSnapshot.filter((task) => task.status === "running");
}

export function isAsyncTaskRunning(key: string): boolean {
  return tasks.get(key)?.status === "running";
}

export function trackAsyncTask<T>(
  task: Pick<AsyncTask, "key" | "kind" | "jobId" | "label">,
  run: () => Promise<T>,
): Promise<T> {
  tasks.set(task.key, { ...task, status: "running" });
  emit();

  return run()
    .then((result) => {
      tasks.set(task.key, { ...task, status: "completed" });
      emit();
      emitSettled();
      window.setTimeout(() => {
        if (tasks.get(task.key)?.status === "completed") {
          tasks.delete(task.key);
          emit();
        }
      }, 4000);
      return result;
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Task failed";
      tasks.set(task.key, { ...task, status: "failed", error: message });
      emit();
      emitSettled();
      window.setTimeout(() => {
        if (tasks.get(task.key)?.status === "failed") {
          tasks.delete(task.key);
          emit();
        }
      }, 8000);
      throw err;
    });
}

export function useAsyncTasks(): readonly AsyncTask[] {
  const [tasks, setTasks] = useState<readonly AsyncTask[]>(() => cachedSnapshot);

  useEffect(() => {
    return subscribeAsyncTasks(() => {
      setTasks(cachedSnapshot);
    });
  }, []);

  return tasks;
}

export function useAsyncTask(key: string | undefined) {
  const tasksList = useAsyncTasks();
  if (!key) return null;
  return tasksList.find((task) => task.key === key) ?? null;
}

export function taskKey(kind: AsyncTaskKind, jobId: string, analysisId?: string): string {
  if (analysisId) return `${kind}:${jobId}:${analysisId}`;
  return `${kind}:${jobId}`;
}
