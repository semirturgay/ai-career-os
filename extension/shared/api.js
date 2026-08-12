// AI Career OS extension API client.
// ALLOWED: fetch() to our backend (apiBaseUrl) only.
// FORBIDDEN: fetch() to any third-party URL for job/resume content.
// Job text comes from DOM injection — see docs/intake-policy.md

// Read per request rather than cached at startup: the service worker outlives any
// single settings change, and a storage read is cheap next to the fetch that follows.
async function authHeader() {
  const { apiToken } = await chrome.storage.sync.get({ apiToken: "" });
  const token = (apiToken || "").trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest(apiBaseUrl, path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  for (const [name, value] of Object.entries(await authHeader())) {
    headers.set(name, value);
  }

  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    ...options,
    headers,
    signal: options.signal,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      if (body.detail) {
        message = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // ignore
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function parseJobText(apiBaseUrl, text) {
  return apiRequest(apiBaseUrl, "/jobs/parse-text", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

async function classifyJobCapture(apiBaseUrl, payload) {
  return apiRequest(apiBaseUrl, "/jobs/classify-capture", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function createIntakeHandoff(apiBaseUrl, payload) {
  return apiRequest(apiBaseUrl, "/jobs/intake-handoff", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function findJobByUrl(apiBaseUrl, url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const params = new URLSearchParams({ url });
    return await apiRequest(apiBaseUrl, `/jobs/by-url?${params.toString()}`, {
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Job lookup timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkApiHealth(apiBaseUrl) {
  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
