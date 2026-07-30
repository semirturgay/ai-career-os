import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { AiLoadingState } from "../components/AiLoadingState";
import { ExtensionHowItWorks } from "../components/ExtensionHowItWorks";
import { Layout } from "../components/Layout";
import { LogoMark } from "../components/Logo";
import { Button } from "../components/ui";
import { IS_EXTENSION } from "../lib/extensionRuntime";

export function WelcomePage() {
  const [hasProfiles, setHasProfiles] = useState<boolean | null>(null);

  useEffect(() => {
    api.profiles
      .list()
      .then((profiles) => setHasProfiles(profiles.length > 0))
      .catch(() => setHasProfiles(false));
  }, []);

  if (hasProfiles === true) {
    return <Navigate to="/" replace />;
  }

  if (hasProfiles === null) {
    return (
      <Layout showSidebar={false} showCaptureBar={false}>
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <AiLoadingState variant="page" size="lg" />
        </div>
      </Layout>
    );
  }

  if (IS_EXTENSION) {
    return (
      <Layout showSidebar={false} showCaptureBar={false}>
        <main className="mx-auto max-w-md space-y-6 px-3 py-6">
          <div className="text-center">
            <LogoMark className="mx-auto size-12" />
            <h1 className="mt-4 text-xl font-bold tracking-tight text-text">
              Match jobs with evidence, not guesswork
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              Capture roles from the page you&apos;re viewing, then see explainable fit scores —
              strengths, gaps, and proof. You stay in control.
            </p>
          </div>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              How it works
            </h2>
            <ExtensionHowItWorks />
          </section>

          <section className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-4">
            <p className="text-sm font-medium text-text">First-time setup</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Connect your AI provider and add your resume once (~2 min). After that, capture jobs
              from any tab and review matches here.
            </p>
            <Link to="/onboarding/ai" className="mt-4 block">
              <Button className="w-full py-2.5 text-sm font-semibold">Set up your profile</Button>
            </Link>
          </section>

          <p className="text-center text-[11px] leading-relaxed text-text-muted">
            DOM-only capture — we never fetch job board URLs or auto-apply.
          </p>
        </main>
      </Layout>
    );
  }

  return (
    <Layout showSidebar={false} showCaptureBar={false}>
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
        <LogoMark className="mb-8 size-16" />
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Understand why a job fits
        </h2>
        <p className="mt-4 text-lg text-text-muted">
          Evidence-based career matching — not auto-apply. Add jobs, upload your resume, and get
          explainable match scores with strengths, gaps, and evidence.
        </p>
        <div className="mt-10">
          <Link to="/onboarding/ai">
            <Button className="min-w-44 px-8 py-3 text-base">Get started</Button>
          </Link>
        </div>
        <p className="mt-12 text-sm text-text-muted">
          Connect your AI provider, upload your resume as a PDF, and review before matching.
        </p>
      </main>
    </Layout>
  );
}
