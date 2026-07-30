import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { OnboardingSteps } from "../components/OnboardingSteps";
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
              ? "Upload a PDF — we'll extract and structure it with AI so you can review before saving."
              : "We'll extract and structure your resume with AI so you can review it before saving."}
          </p>
        </div>

        <ResumeUploadZone
          onParsed={(parsed) => void handleParsed(parsed)}
          compact={IS_EXTENSION}
        />

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
