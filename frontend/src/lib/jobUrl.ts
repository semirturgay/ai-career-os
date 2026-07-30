/** Mirror backend `normalize_job_url` for client-side duplicate checks. */

const LINKEDIN_JOB_PATH = /\/jobs\/view\/(\d+)/;
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "refid",
  "trackingid",
  "src",
  "gh_src",
  "lever-source",
]);

function linkedInJobId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(LINKEDIN_JOB_PATH);
    if (pathMatch?.[1]) {
      return pathMatch[1];
    }
    return parsed.searchParams.get("currentJobId");
  } catch {
    return null;
  }
}

export function normalizeJobUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  const raw = url.trim();
  if (!raw) {
    return null;
  }

  const linkedinId = linkedInJobId(raw);
  if (linkedinId) {
    return `https://www.linkedin.com/jobs/view/${linkedinId}/`;
  }

  try {
    const parsed = new URL(raw);
    if (!parsed.hostname) {
      return raw;
    }
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/$/, "") || "/";
    const params = new URLSearchParams();
    parsed.searchParams.forEach((value, key) => {
      if (!TRACKING_PARAMS.has(key.toLowerCase())) {
        params.set(key, value);
      }
    });
    const query = params.toString();
    return `${parsed.protocol}//${host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return raw;
  }
}

export interface DuplicateJobInfo {
  id: string;
  title: string;
  company: string;
}

export function duplicateJobFromApiDetail(detail: unknown): DuplicateJobInfo | null {
  if (!detail || typeof detail !== "object") {
    return null;
  }
  const record = detail as Record<string, unknown>;
  if (typeof record.job_id !== "string") {
    return null;
  }
  return {
    id: record.job_id,
    title: typeof record.title === "string" ? record.title : "Existing job",
    company: typeof record.company === "string" ? record.company : "",
  };
}

export function duplicateJobFromErrorMessage(message: string): DuplicateJobInfo | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    return duplicateJobFromApiDetail(JSON.parse(trimmed));
  } catch {
    return null;
  }
}
