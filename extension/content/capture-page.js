function captureJobPage() {
  const capture = extractVisiblePageText();
  return {
    ...capture,
    url: window.location.href,
  };
}
