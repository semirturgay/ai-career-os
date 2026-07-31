import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { OnboardingSteps } from "../components/OnboardingSteps";
import { ResumePasteZone } from "../components/ResumePasteZone";
import { ResumeUploadZone } from "../components/ResumeUploadZone";
import { Button } from "../components/ui";
import { IS_EXTENSION } from "../lib/extensionRuntime";
import { saveOnboardingResume } from "../lib/onboardingHandoff";
import type { ResumeParseResult } from "../types";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [navigating, setNavigating] = useState(false);

  async function handleParsed(parsed: ResumeParseResult) {
    setNavigating(true);
    try {
      await saveOnboardingResume(parsed);
      navigate("/onboarding/review");
    } finally {
      setNavigating(false);
    }
  }

  return (
    <Layout showSidebar={false} showCaptureBar={false}>
      <div className="mx-auto max-w-xl space-y-6 px-3 py-6 sm:px-6 sm:py-12">
        <OnboardingSteps current={2} />

        <div>
          <h2 className="text-xl font-semibold sm:text-2xl">Add your resume</h2>
          <p className="mt-2 text-sm text-text-muted">
            {IS_EXTENSION
              ? "Paste your resume text — we'll structure it with AI so you can review before saving."
              : "Paste your resume or upload a PDF. We'll structure it with AI so you can review before saving."}
          </p>
        </div>

        <ResumePasteZone onParsed={(parsed) => void handleParsed(parsed)} compact={IS_EXTENSION} />

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-surface px-3 text-xs font-medium uppercase tracking-wider text-text-muted">
              or upload PDF
            </span>
          </div>
        </div>

        <ResumeUploadZone onParsed={(parsed) => void handleParsed(parsed)} compact={IS_EXTENSION} />

        {navigating && (
          <p className="text-center text-xs text-text-muted">Preparing review…</p>
        )}

        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => navigate("/onboarding/ai")}>
            Back
          </Button>
        </div>
      </div>
    </Layout>
  );
}
