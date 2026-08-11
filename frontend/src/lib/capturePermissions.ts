/// <reference types="chrome" />

import { IS_EXTENSION } from "./extensionRuntime";

/** Thrown when the user declines access to the page they asked us to capture. */
export class CapturePermissionDeniedError extends Error {
  constructor(host: string) {
    super(
      `AI Career OS needs permission to read ${host} before it can capture from that tab. ` +
        `Click capture again and choose Allow.`,
    );
    this.name = "CapturePermissionDeniedError";
  }
}

/**
 * Host access is requested per site, at the moment of capture, rather than granted
 * for all sites at install time.
 *
 * The manifest ships `optional_host_permissions`, so a fresh install asks for nothing
 * beyond localhost. The first capture on a site produces a prompt naming that one site,
 * which is both a far smaller ask and what the Web Store review process expects.
 *
 * `chrome.permissions.request` only works inside a user gesture, which is why this
 * lives in the side panel and not in the background worker — by the time a message
 * reaches the worker the gesture is gone.
 */
export function originPatternFor(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return null;
  }
}

export async function hasCapturePermission(url: string): Promise<boolean> {
  const origin = originPatternFor(url);
  if (!IS_EXTENSION || !origin) {
    return true;
  }
  return chrome.permissions.contains({ origins: [origin] });
}

/** Ask for access to this one site. Must be called directly from a click handler. */
export async function ensureCapturePermission(url: string): Promise<void> {
  const origin = originPatternFor(url);
  if (!IS_EXTENSION || !origin) {
    return;
  }

  if (await chrome.permissions.contains({ origins: [origin] })) {
    return;
  }

  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    throw new CapturePermissionDeniedError(new URL(url).hostname);
  }
}
