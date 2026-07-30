import { useLocation, useNavigate } from "react-router-dom";
import { IS_EXTENSION } from "../lib/extensionRuntime";
import { JobIntakeSteps } from "../components/JobIntakeSteps";
import { JobPasteZone } from "../components/JobPasteZone";
import { Layout } from "../components/Layout";
import { useProfileRoute } from "../components/RequireProfileLayout";
import type { JobParseResult } from "../types";

interface JobNewLocationState {
  pasteText?: string;
}

const NEXT_STEPS = [
  "AI extracts title, company, and requirements from your description",
  "You review and fix anything",
  "Match analysis runs automatically",
] as const;

export function JobNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const pasteText = (location.state as JobNewLocationState | null)?.pasteText;
  const { profile } = useProfileRoute();

  function handleParsed(result: JobParseResult) {
    navigate("/jobs/new/review", { state: { parsed: result } });
  }

  return (
    <Layout
      title="Add job"
      subtitle={
        IS_EXTENSION
          ? "Capture from the tab above, or paste a description below"
          : "Paste a job description — we extract fields and analyze your fit"
      }
    >
      <div className="mx-auto max-w-2xl space-y-8">
        <JobIntakeSteps current={1} />

        <div>
          <h2 className="text-2xl font-semibold">Paste any job description</h2>
          <p className="mt-2 text-text-muted">
            Include all details — we&apos;ll structure the role and compare it to{" "}
            <span className="font-medium text-text">{profile.name}</span>&apos;s profile.
          </p>
        </div>

        <JobPasteZone onParsed={handleParsed} initialText={pasteText} />

        <section className="rounded-xl border border-border bg-surface-raised px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">What happens next</p>
          <ol className="mt-3 space-y-2">
            {NEXT_STEPS.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm text-text-muted">
                <span className="font-medium text-accent">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Layout>
  );
}
