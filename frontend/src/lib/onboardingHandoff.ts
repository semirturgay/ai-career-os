/// <reference types="chrome" />

import type { ResumeParseResult } from "../types";
import { IS_EXTENSION } from "./extensionRuntime";

const SESSION_KEY = "onboardingResumeParse";

export async function saveOnboardingResume(parsed: ResumeParseResult): Promise<void> {
  const payload = JSON.stringify(parsed);
  if (IS_EXTENSION) {
    await chrome.storage.session.set({ [SESSION_KEY]: payload });
    return;
  }
  sessionStorage.setItem(SESSION_KEY, payload);
}

export async function loadOnboardingResume(): Promise<ResumeParseResult | null> {
  if (IS_EXTENSION) {
    const stored = await chrome.storage.session.get(SESSION_KEY);
    const raw = stored[SESSION_KEY];
    if (typeof raw !== "string") {
      return null;
    }
    try {
      return JSON.parse(raw) as ResumeParseResult;
    } catch {
      return null;
    }
  }

  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ResumeParseResult;
  } catch {
    return null;
  }
}

export async function clearOnboardingResume(): Promise<void> {
  if (IS_EXTENSION) {
    await chrome.storage.session.remove(SESSION_KEY);
    return;
  }
  sessionStorage.removeItem(SESSION_KEY);
}
