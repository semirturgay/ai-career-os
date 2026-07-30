import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  analyzeActiveTabPage,
  runCaptureFromActiveTab,
  type JobPageAnalysis,
} from "../lib/extensionMessaging";
import { parseExtensionRoute } from "../lib/extensionNavigation";
import { IS_EXTENSION } from "../lib/extensionRuntime";
import { Badge, Button, ErrorBanner } from "./ui";

function pageTypeLabel(pageType?: string): string | null {
  if (pageType === "list") return "Job search results";
  if (pageType === "careers") return "Careers page";
  if (pageType === "other") return "Other page";
  return null;
}

function analysisHeadline(analysis: JobPageAnalysis): string {
  if (analysis.isLikelyJobPost) {
    const parts = ["Job posting detected"];
    if (analysis.title) parts.push(`— ${analysis.title}`);
    if (analysis.company) parts.push(`at ${analysis.company}`);
    return parts.join(" ");
  }
  const typeLabel = pageTypeLabel(analysis.pageType ?? analysis.classification?.page_type);
  if (typeLabel) return typeLabel;
  return "Doesn't look like a single job posting";
}

export function CaptureFromTabBar() {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<JobPageAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabBlocked, setTabBlocked] = useState(false);

  const refreshAnalysis = useCallback(async () => {
    if (!IS_EXTENSION) {
      return;
    }
    setAnalyzing(true);
    setError(null);
    setTabBlocked(false);
    try {
      const result = await analyzeActiveTabPage();
      if (result === null) {
        setTabBlocked(true);
        setAnalysis(null);
      } else {
        setAnalysis(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read active tab");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    void refreshAnalysis();
  }, [refreshAnalysis]);

  async function handleCapture() {
    setCapturing(true);
    setError(null);
    try {
      const result = await runCaptureFromActiveTab();
      navigate(parseExtensionRoute(result.reviewRoute));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setCapturing(false);
    }
  }

  if (!IS_EXTENSION) {
    return null;
  }

  const reason = analysis?.classification?.reason;
  const showReason = reason && !analyzing;
  const lowSample = analysis && analysis.textLength < 100 && !analysis.isLikelyJobPost;

  return (
    <section className="border-b border-border bg-surface-raised px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-accent">
            Browser tab
          </p>
          {tabBlocked ? (
            <p className="mt-1 text-sm text-text-muted">
              Open a job posting in this window, then capture here.
            </p>
          ) : analyzing ? (
            <p className="mt-1 text-sm text-text-muted">Reading tab and checking if it&apos;s a job post…</p>
          ) : analysis ? (
            <p className="mt-1 text-sm text-text">{analysisHeadline(analysis)}</p>
          ) : null}
          {showReason && (
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{reason}</p>
          )}
          {analysis?.classificationError && !analyzing && (
            <p className="mt-1 text-xs text-text-muted">
              Heuristics only — {analysis.classificationError}
            </p>
          )}
          {lowSample && (
            <p className="mt-1 text-xs text-text-muted">
              Expand the full job description on the page, then refresh.
            </p>
          )}
          {analysis && !analyzing && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={analysis.isLikelyJobPost ? "success" : "default"}>
                {analysis.confidence} confidence
              </Badge>
              {analysis.classification && (
                <Badge variant="info">AI checked</Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Button
            onClick={() => void handleCapture()}
            loading={capturing}
            disabled={tabBlocked || analyzing}
            className="whitespace-nowrap px-3 py-2 text-sm"
          >
            Capture & review
          </Button>
          <button
            type="button"
            onClick={() => void refreshAnalysis()}
            disabled={analyzing || capturing}
            className="text-xs font-medium text-text-muted hover:text-text disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}
    </section>
  );
}
