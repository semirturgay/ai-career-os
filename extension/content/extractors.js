const STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "nav",
  "footer",
  '[role="navigation"]',
  '[aria-hidden="true"]',
];

function collapseWhitespace(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function visibleTextLength(element) {
  return (element.innerText || element.textContent || "").trim().length;
}

function findContentRoot() {
  const candidates = [
    document.querySelector("main"),
    document.querySelector('[role="main"]'),
    document.querySelector("article"),
    document.body,
  ].filter(Boolean);

  if (candidates.length === 0) {
    return document.body;
  }

  // Prefer the node with the most visible text — SPAs often expose an empty <main>.
  return candidates.reduce((best, candidate) =>
    visibleTextLength(candidate) > visibleTextLength(best) ? candidate : best,
  );
}

function prependPageTitle(text, pageTitle) {
  const title = pageTitle.trim();
  if (!title) {
    return text;
  }
  const preview = title.slice(0, Math.min(title.length, 48));
  if (text.includes(preview)) {
    return text;
  }
  return `Page title: ${title}\n\n${text}`;
}

function extractVisiblePageText() {
  const root = findContentRoot();
  const pageTitle = document.title || "";

  const clone = root.cloneNode(true);
  STRIP_SELECTORS.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  });

  const bodyText = collapseWhitespace(clone.innerText || clone.textContent || "");
  const text = prependPageTitle(bodyText, pageTitle);

  return {
    text,
    pageTitle,
  };
}

/** @deprecated Use extractVisiblePageText — kept for injected script compatibility. */
function extractJobPage(_url) {
  return extractVisiblePageText();
}
