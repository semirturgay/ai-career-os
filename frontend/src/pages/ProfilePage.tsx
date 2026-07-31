import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ResumeParseResult } from "../types";
import { Layout } from "../components/Layout";
import { parseStructuredData, StructuredProfileView } from "../components/StructuredProfileView";
import { ResumePasteZone } from "../components/ResumePasteZone";
import { ResumeUploadZone } from "../components/ResumeUploadZone";
import { useProfileRoute } from "../components/RequireProfileLayout";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";
import { api } from "../api/client";
import { Button, ErrorBanner } from "../components/ui";

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile } = useProfileRoute();
  const embedded = useEmbeddedMode();
  const [showReplace, setShowReplace] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  function handleParsed(parsed: ResumeParseResult) {
    if (!profile) return;
    navigate("/onboarding/review", {
      state: {
        parsed,
        profileId: profile.id,
        mode: "update",
        returnTo: "/profile",
      },
    });
  }

  async function handleDownloadPdf() {
    if (!profile) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await api.profiles.downloadResumePdf(profile.id);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Failed to download resume PDF");
    } finally {
      setDownloading(false);
    }
  }

  const structured = parseStructuredData(profile.structured_data);

  return (
    <Layout title="Profile" subtitle={profile.name}>
      <div className="space-y-8">
        {downloadError && <ErrorBanner message={downloadError} />}

        <section className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Primary profile
              </p>
              <h2 className="mt-1 text-2xl font-bold">{profile.name}</h2>
              {profile.headline && <p className="mt-2 text-text-muted">{profile.headline}</p>}
              <p className="mt-3 text-xs text-text-muted">
                Updated {new Date(profile.updated_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleDownloadPdf} loading={downloading}>
                Download PDF
              </Button>
              <Button variant="secondary" onClick={() => setShowReplace((v) => !v)}>
                {showReplace ? "Cancel" : "Update resume"}
              </Button>
            </div>
          </div>
        </section>

        {showReplace && (
          <section className="rounded-xl border border-accent/30 bg-accent/5 p-4 sm:p-6">
            <h3 className="font-semibold">Replace resume</h3>
            <p className="mt-2 mb-4 text-sm text-text-muted">
              Paste updated resume text or upload a PDF — we&apos;ll re-extract structured fields
              for you to review before saving.
            </p>
            <ResumePasteZone onParsed={handleParsed} compact={embedded} />
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-accent/5 px-3 text-xs font-medium uppercase tracking-wider text-text-muted">
                  or upload PDF
                </span>
              </div>
            </div>
            <ResumeUploadZone onParsed={handleParsed} compact={embedded} />
          </section>
        )}

        {structured ? (
          <section className="rounded-xl border border-border bg-surface-raised p-6">
            <StructuredProfileView data={structured} />
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-border bg-surface-raised p-8 text-center">
            <p className="text-text-muted">
              No structured resume data yet. Paste your resume or upload a PDF to extract skills,
              experience, and education.
            </p>
            <Button className="mt-4" onClick={() => setShowReplace(true)}>
              Add resume
            </Button>
          </section>
        )}

        <details className="rounded-xl border border-border bg-surface-raised">
          <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-text-muted">
            Raw resume text
          </summary>
          <pre className="max-h-96 overflow-auto border-t border-border px-5 py-4 text-xs whitespace-pre-wrap text-text-muted">
            {profile.resume_text}
          </pre>
        </details>
      </div>
    </Layout>
  );
}
