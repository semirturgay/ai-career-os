/// <reference types="chrome" />

import { IS_EXTENSION } from "./extensionRuntime";

export interface ExtensionMessageResponse<T = unknown> {
  ok: boolean;
  error?: string;
  result?: T;
  healthy?: boolean;
}

export interface ExistingJobSummary {
  id: string;
  title: string;
  company: string;
}

export interface CapturePipelineResult {
  handoffId?: string;
  reviewRoute: string;
  duplicate?: boolean;
  existingJob?: ExistingJobSummary | null;
  preview?: {
    title: string;
    company: string;
    source?: string;
    url?: string;
  };
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

export async function runCaptureFromActiveTab(
  windowId?: number | null,
): Promise<CapturePipelineResult> {
  const response = await sendMessage<CapturePipelineResult>({
    type: "run-capture-active-tab",
    windowId: windowId ?? undefined,
  });
  if (!response.ok || !response.result) {
    throw new Error(response.error || "Capture failed");
  }
  return response.result;
}
