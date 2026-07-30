const STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "nav",
  "footer",
  "header",
  '[role="navigation"]',
  '[role="banner"]',
  '[aria-hidden="true"]',
];

function textFrom(element) {
  if (!element) {
    return "";
  }
  return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
}

function cloneMainContent() {
  const root =
    document.querySelector("main") ||
    document.querySelector('[role="main"]') ||
    document.querySelector("article") ||
    document.body;
  const clone = root.cloneNode(true);
  STRIP_SELECTORS.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  });
  return clone;
}

function detectJobSource(urlString) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    if (host.includes("greenhouse.io") || host.includes("boards.greenhouse.io")) {
      return "greenhouse";
    }
    if (host.includes("lever.co") || host.includes("jobs.lever.co")) {
      return "lever";
    }
    if (host.includes("linkedin.com")) {
      return "linkedin";
    }
    if (host.includes("ashbyhq.com") || host.includes("jobs.ashbyhq.com")) {
      return "ashby";
    }
  } catch {
    return "generic";
  }
  return "generic";
}

function extractGreenhouse() {
  const title =
    textFrom(document.querySelector("h1[data-qa='job-title'], .job-post-title, h1.app-title")) ||
    textFrom(document.querySelector("h1"));
  const company =
    textFrom(document.querySelector(".company-name, [data-qa='company-name'], .logo a")) ||
    textFrom(document.querySelector(".company-links a"));
  const location = textFrom(document.querySelector(".location, [data-qa='job-location']"));
  const content =
    document.querySelector("#content, .job-post-content, [data-qa='job-description']") ||
    cloneMainContent();
  const description = textFrom(content);

  const parts = [];
  if (title) parts.push(`Title: ${title}`);
  if (company) parts.push(`Company: ${company}`);
  if (location) parts.push(`Location: ${location}`);
  if (description) {
    parts.push("", "Description:", description);
  }

  return {
    source: "greenhouse",
    title,
    company,
    location,
    text: parts.join("\n"),
  };
}

function extractLever() {
  const title = textFrom(document.querySelector(".posting-headline h2, h2.posting-title, h1"));
  const company =
    textFrom(document.querySelector(".posting-header .posting-category, .main-header-logo img[alt]")) ||
    textFrom(document.querySelector(".posting-header a"));
  const location = textFrom(document.querySelector(".posting-categories .sort-by-time"));
  const content =
    document.querySelector(".content, .section-wrapper.page-full-width, .posting-page") ||
    cloneMainContent();
  const description = textFrom(content);

  const parts = [];
  if (title) parts.push(`Title: ${title}`);
  if (company) parts.push(`Company: ${company}`);
  if (location) parts.push(`Location: ${location}`);
  if (description) {
    parts.push("", "Description:", description);
  }

  return {
    source: "lever",
    title,
    company,
    location,
    text: parts.join("\n"),
  };
}

function extractGeneric() {
  const title = document.title || "";
  const description = textFrom(cloneMainContent());
  const parts = [];
  if (title) {
    parts.push(`Page title: ${title}`);
  }
  if (description) {
    parts.push("", "Page content:", description);
  }
  return {
    source: "generic",
    title,
    company: "",
    location: "",
    text: parts.join("\n"),
  };
}

function extractLinkedInJobId(urlString) {
  try {
    const url = new URL(urlString);
    const fromQuery = url.searchParams.get("currentJobId");
    if (fromQuery) {
      return fromQuery;
    }
    const fromPath = url.pathname.match(/\/jobs\/view\/(\d+)/);
    return fromPath ? fromPath[1] : null;
  } catch {
    return null;
  }
}

function resolveCaptureUrl(urlString) {
  const jobId = extractLinkedInJobId(urlString);
  if (jobId) {
    return `https://www.linkedin.com/jobs/view/${jobId}/`;
  }
  return urlString;
}

function extractLinkedIn() {
  const jobId = extractLinkedInJobId(window.location.href);
  const detailRoot =
    document.querySelector(".jobs-search__job-details") ||
    document.querySelector(".jobs-search__right-pane") ||
    document.querySelector(".job-view-layout") ||
    document.querySelector(".jobs-details") ||
    document.querySelector('[data-job-id]')?.closest("div") ||
    document.querySelector("main") ||
    document.body;

  const title = textFrom(
    detailRoot.querySelector(".job-details-jobs-unified-top-card__job-title") ||
      detailRoot.querySelector(".jobs-unified-top-card__job-title") ||
      detailRoot.querySelector(".jobs-details-top-card__job-title") ||
      detailRoot.querySelector("h1"),
  );

  const company = textFrom(
    detailRoot.querySelector(".job-details-jobs-unified-top-card__company-name") ||
      detailRoot.querySelector(".jobs-unified-top-card__company-name") ||
      detailRoot.querySelector(".jobs-details-top-card__company-name") ||
      detailRoot.querySelector('[data-test-job-company-name]') ||
      detailRoot.querySelector(".jobs-unified-top-card__subtitle-primary-grouping"),
  );

  const location = textFrom(
    detailRoot.querySelector(".job-details-jobs-unified-top-card__bullet") ||
      detailRoot.querySelector(".jobs-unified-top-card__bullet") ||
      detailRoot.querySelector(".jobs-details-top-card__bullet"),
  );

  const descriptionNode =
    detailRoot.querySelector(".jobs-description__content") ||
    detailRoot.querySelector(".jobs-description-content__text") ||
    detailRoot.querySelector("#job-details") ||
    detailRoot.querySelector(".jobs-box__html-content") ||
    detailRoot.querySelector('[class*="jobs-description"]');

  let description = textFrom(descriptionNode);
  if (!description || description.length < 120) {
    description = textFrom(detailRoot);
  }

  if (!title && !description) {
    throw new Error(
      "Could not find a LinkedIn job detail panel. Select a job in the list first, or open the full job page.",
    );
  }

  const parts = [];
  if (title) parts.push(`Title: ${title}`);
  if (company) parts.push(`Company: ${company}`);
  if (location) parts.push(`Location: ${location}`);
  if (jobId) parts.push(`LinkedIn job ID: ${jobId}`);
  if (description) {
    parts.push("", "Description:", description);
  }

  return {
    source: "linkedin",
    title,
    company,
    location,
    text: parts.join("\n"),
    jobId,
  };
}

function extractJobPage(url) {
  const source = detectJobSource(url);
  if (source === "greenhouse") {
    return extractGreenhouse();
  }
  if (source === "lever") {
    return extractLever();
  }
  if (source === "linkedin") {
    return extractLinkedIn();
  }
  return extractGeneric();
}

const JOB_URL_PATTERNS = [
  /\/jobs?\//i,
  /\/careers?\//i,
  /\/job-/i,
  /greenhouse\.io/i,
  /lever\.co/i,
  /ashbyhq\.com/i,
  /linkedin\.com\/jobs/i,
  /workday/i,
  /myworkdayjobs\.com/i,
];

function urlLooksLikeJobPosting(urlString) {
  return JOB_URL_PATTERNS.some((pattern) => pattern.test(urlString));
}

/**
 * Heuristic only — reads current DOM, never fetches URLs.
 * Used to guide the user before capture.
 */
const TEXT_SAMPLE_MAX = 3000;

function detectJobPage() {
  const url = window.location.href;
  const source = detectJobSource(url);
  const signals = [];
  let score = 0;

  if (source !== "generic") {
    score += 35;
    signals.push(`Known job board: ${source}`);
  }

  if (urlLooksLikeJobPosting(url)) {
    score += 20;
    signals.push("URL looks like a job or careers page");
  }

  if (extractLinkedInJobId(url)) {
    score += 25;
    signals.push("LinkedIn job id present in URL");
  }

  let title = "";
  let company = "";
  let textLength = 0;
  let textSample = "";

  try {
    const capture = extractJobPage(url);
    title = capture.title || "";
    company = capture.company || "";
    textLength = capture.text?.length || 0;
    textSample = capture.text ? capture.text.slice(0, TEXT_SAMPLE_MAX) : "";

    if (title) {
      score += 15;
      signals.push("Job title found in page");
    }
    if (company) {
      score += 10;
      signals.push("Company name found in page");
    }
    if (textLength >= 300) {
      score += 20;
      signals.push("Enough job description text on page");
    } else if (textLength >= 100) {
      score += 8;
      signals.push("Some job text found (may be incomplete)");
    }
  } catch (error) {
    signals.push(error instanceof Error ? error.message : "Could not read job content from DOM");
  }

  let confidence = "low";
  if (score >= 70) {
    confidence = "high";
  } else if (score >= 45) {
    confidence = "medium";
  }

  return {
    isLikelyJobPost: score >= 45,
    confidence,
    score,
    source,
    signals,
    title,
    company,
    textLength,
    textSample,
    pageTitle: document.title || "",
    url: resolveCaptureUrl(url),
  };
}
