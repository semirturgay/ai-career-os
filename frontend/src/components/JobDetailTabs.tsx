import { useEffect, useRef, useState } from "react";
import type { CompanyBrief, Job, MatchAnalysis } from "../types";
import {
  getApplicationProgress,
  nextApplicationTab,
  type JobDetailTab as ApplicationJobDetailTab,
} from "../lib/applicationProgress";
import { isFullMatch } from "../lib/matches";
import { CompanyResearchPanel } from "./CompanyResearchPanel";
import { CoverLetterPanel } from "./CoverLetterPanel";
import { JobProgressBar } from "./JobProgressBar";
import { MatchResultPanel } from "./MatchResultPanel";
import { MatchAnalysisProgress } from "./MatchAnalysisProgress";
import { ResumeOptimizationPanel } from "./ResumeOptimizationPanel";

export type JobDetailTab = "match" | "company" | "resume" | "cover";

interface JobDetailTabsProps {
  job: Job;
  analysis: MatchAnalysis | null;
  profileName: string;
  showProgress?: boolean;
  initialTab?: JobDetailTab;
  focusNextStep?: boolean;
  onJobUpdated: (job: Job) => void;
  onRefreshJob?: () => void | Promise<void>;
  onReAnalyze: () => void;
  analyzing?: boolean;
  jobAnalyses: MatchAnalysis[];
  profileId: string;
}

const TAB_COPY: Record<JobDetailTab, { title: string; description: string }> = {
  match: {
    title: "Match analysis",
    description: "Explainable fit score, strengths, and gaps",
  },
  company: {
    title: "Company research",
    description: "Culture, news, and interview signals from the web",
  },
  resume: {
    title: "Resume improvements",
    description: "AI suggestions tailored to this job's gaps",
  },
  cover: {
    title: "Cover letter",
    description: "Short, targeted draft you can copy and edit",
  },
};

function tabUnlocked(tab: JobDetailTab, analysis: MatchAnalysis | null): boolean {
  if (tab === "match") return true;
  return isFullMatch(analysis);
}

function tabEnabled(tab: JobDetailTab, analysis: MatchAnalysis | null): boolean {
  return tabUnlocked(tab, analysis);
}

export function JobDetailTabs({
  job,
  analysis,
  profileName,
  showProgress = false,
  initialTab = "match",
  focusNextStep = false,
  onJobUpdated,
  onRefreshJob,
  onReAnalyze,
  analyzing = false,
  jobAnalyses,
  profileId,
}: JobDetailTabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef(analysis?.status);
  const tailoredRef = useRef(false);
  const [activeTab, setActiveTab] = useState<JobDetailTab>(initialTab);

  const analysisComplete = isFullMatch(analysis);
  const applicationProgress = getApplicationProgress(job, analysis);
  const tabCopy = TAB_COPY[activeTab];

  useEffect(() => {
    if (!analysisComplete && activeTab !== "match") {
      setActiveTab("match");
    }
  }, [analysisComplete, activeTab]);

  useEffect(() => {
    if (initialTab !== "match" && tabUnlocked(initialTab, analysis)) {
      setActiveTab(initialTab);
      tailoredRef.current = true;
    }
  }, [initialTab, analysis]);

  useEffect(() => {
    if (tailoredRef.current || !focusNextStep || !analysisComplete) return;
    const nextTab = nextApplicationTab(job, analysis);
    if (nextTab !== "match") {
      setActiveTab(nextTab);
      tailoredRef.current = true;
    }
  }, [focusNextStep, analysisComplete, job, analysis]);

  useEffect(() => {
    const wasPending = prevStatusRef.current === "pending";
    const nowComplete = analysis?.status === "completed";
    if (wasPending && nowComplete && isFullMatch(analysis)) {
      if (focusNextStep && !tailoredRef.current) {
        const nextTab = nextApplicationTab(job, analysis);
        if (nextTab !== "match") {
          setActiveTab(nextTab);
          tailoredRef.current = true;
        }
      }
    }
    prevStatusRef.current = analysis?.status;
  }, [analysis, focusNextStep, job]);

  function handleStepSelect(tab: JobDetailTab) {
    if (!tabUnlocked(tab, analysis)) return;
    setActiveTab(tab);
  }

  return (
    <div ref={tabsRef} id="job-tools" className="scroll-mt-4 space-y-4">
      {analysis && (
        <section className="rounded-xl border border-border bg-surface-raised px-3 py-3">
          <JobProgressBar
            progress={applicationProgress}
            activeTab={activeTab}
            onStepSelect={handleStepSelect}
            isStepEnabled={(tab: ApplicationJobDetailTab) => tabEnabled(tab, analysis)}
            compact
          />
        </section>
      )}

      {showProgress && <MatchAnalysisProgress analysis={analysis} showUnlocks={analysisComplete} />}

      {!analysisComplete && analysis?.status === "pending" && (
        <p className="text-sm text-text-muted">
          Match analysis running — follow-up steps unlock when full analysis completes.
        </p>
      )}

      <div role="tabpanel" className="min-h-[200px] space-y-3">
        {activeTab !== "match" && (
          <div>
            <h3 className="text-base font-semibold">{tabCopy.title}</h3>
            <p className="text-sm text-text-muted">{tabCopy.description}</p>
          </div>
        )}

        {activeTab === "match" && (
          <MatchResultPanel
            analysis={analysis}
            job={job}
            profileId={profileId}
            jobAnalyses={jobAnalyses}
            profileName={profileName}
            jobTitle={`${job.title} @ ${job.company}`}
            onAnalyze={onReAnalyze}
            analyzing={analyzing}
          />
        )}

        {activeTab === "company" && (
          <CompanyResearchPanel
            job={job}
            onUpdated={(brief: CompanyBrief) => onJobUpdated({ ...job, company_brief: brief })}
          />
        )}

        {activeTab === "resume" && analysis && (
          <ResumeOptimizationPanel
            job={job}
            analysis={analysis}
            profileId={profileId}
            jobAnalyses={jobAnalyses}
            onApplied={() => onRefreshJob?.()}
            onGenerated={() => void onRefreshJob?.()}
            onReAnalyze={onReAnalyze}
            analyzing={analyzing}
          />
        )}

        {activeTab === "cover" && analysis && (
          <CoverLetterPanel analysis={analysis} onGenerated={() => void onRefreshJob?.()} />
        )}
      </div>
    </div>
  );
}
