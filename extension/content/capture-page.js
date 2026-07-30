function captureJobPage() {
  const capture = extractJobPage(window.location.href);
  return {
    ...capture,
    url: resolveCaptureUrl(window.location.href),
    pageTitle: document.title || "",
  };
}

function analyzeCurrentPage() {
  return detectJobPage();
}
