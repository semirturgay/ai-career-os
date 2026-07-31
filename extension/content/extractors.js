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

function collapseWhitespace(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractVisiblePageText() {
  const root =
    document.querySelector("main") ||
    document.querySelector('[role="main"]') ||
    document.querySelector("article") ||
    document.body;

  const clone = root.cloneNode(true);
  STRIP_SELECTORS.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  });

  const text = collapseWhitespace(clone.innerText || clone.textContent || "");
  return {
    text,
    pageTitle: document.title || "",
  };
}

/** @deprecated Use extractVisiblePageText — kept for injected script compatibility. */
function extractJobPage(_url) {
  return extractVisiblePageText();
}
