/// <reference types="chrome" />

import { IS_EXTENSION } from "./extensionRuntime";

export interface ExtensionMessageResponse<T = unknown> {
  ok: boolean;
  error?: string;
  result?: T;
  healthy?: boolean;
}

export interface CapturePipelineResult {
  handoffId: string;
  reviewRoute: string;
  existingJob?: { title: string } | null;
  preview: {
    title: string;
    company: string;
    source?: string;
    url?: string;
  };
}

export interface JobPageClassification {
  is_job_post: boolean;
  confidence: "high" | "medium" | "low";
  page_type: "detail" | "list" | "careers" | "other";
  reason: string;
}

export interface JobPageAnalysis {
  isLikelyJobPost: boolean;
  confidence: string;
  title?: string;
  company?: string;
  textLength: number;
  pageType?: string;
  classification?: JobPageClassification;
  classificationError?: string;
}

function sendMessage<T>(message: Record<string, unknown>): Promise<ExtensionMessageResponse<T>> {
  return new Promise((resolve) => {
    if (!IS_EXTENSION) {
      resolve({ ok: false, error: "Not running in the extension" });
      return;
    }
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve((response as ExtensionMessageResponse<T>) ?? { ok: false });
    });
  });
}

export async function analyzeActiveTabPage(): Promise<JobPageAnalysis | null> {
  const response = await sendMessage<JobPageAnalysis>({ type: "analyze-active-tab" });
  return response.ok ? (response.result ?? null) : null;
}

export async function runCaptureFromActiveTab(): Promise<CapturePipelineResult> {
  const response = await sendMessage<CapturePipelineResult>({ type: "run-capture-active-tab" });
  if (!response.ok || !response.result) {
    throw new Error(response.error || "Capture failed");
  }
  return response.result;
}

export async function syncPanelRoute(route: string): Promise<void> {
  if (!IS_EXTENSION) {
    return;
  }
  await chrome.storage.session.set({ panelRoute: route });
}

export async function checkExtensionApiHealth(): Promise<boolean> {
  const stored = await chrome.storage.sync.get({ apiBaseUrl: "http://127.0.0.1:8000" });
  const response = await sendMessage<boolean>({
    type: "check-api-health",
    apiBaseUrl: stored.apiBaseUrl,
  });
  return Boolean(response.healthy);
}
