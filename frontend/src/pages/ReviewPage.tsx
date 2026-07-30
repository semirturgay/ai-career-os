import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { ResumeParseResult, ResumeStructuredData } from "../types";
import { Layout } from "../components/Layout";
import { OnboardingSteps } from "../components/OnboardingSteps";
import { PageLoader } from "../components/AiLoadingState";
import { StructuredProfileView } from "../components/StructuredProfileView";
import { Button, ErrorBanner, Field, Input, Textarea } from "../components/ui";
import {
  clearOnboardingResume,
  loadOnboardingResume,
  saveOnboardingResume,
} from "../lib/onboardingHandoff";
import { setActiveProfileId } from "../lib/profile";

interface ReviewLocationState {
  parsed?: ResumeParseResult;
  profileId?: string;
  mode?: "update";
  returnTo?: string;
}

function skillsToText(skills: string[]) {
  return skills.join("\n");
}

function textToSkills(value: string) {
  return value
    .split(/[\n,]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

export function ReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ReviewLocationState | null;
  const isUpdate = state?.mode === "update" && !!state.profileId;

  const [parsed, setParsed] = useState<ResumeParseResult | null>(state?.parsed ?? null);
  const [loadingHandoff, setLoadingHandoff] = useState(!isUpdate && !state?.parsed);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [structuredData, setStructuredData] = useState<ResumeStructuredData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isUpdate) {
      if (!state?.parsed) {
        navigate(state?.returnTo ?? "/profile", { replace: true });
      } else {
        setParsed(state.parsed);
        setLoadingHandoff(false);
      }
      return;
    }

    if (state?.parsed) {
      void saveOnboardingResume(state.parsed);
      setParsed(state.parsed);
      setLoadingHandoff(false);
      return;
    }

    let cancelled = false;
    void loadOnboardingResume().then((stored) => {
      if (cancelled) {
        return;
      }
      if (stored) {
        setParsed(stored);
        setLoadingHandoff(false);
        return;
      }
      navigate("/onboarding/upload", { replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [isUpdate, navigate, state?.parsed, state?.returnTo]);

  useEffect(() => {
    if (!parsed) {
      return;
    }
    const structured = parsed.structured_data;
    setName(parsed.name ?? structured?.name ?? "");
    setHeadline(parsed.headline ?? structured?.headline ?? "");
    setEmail(structured?.email ?? "");
    setPhone(structured?.phone ?? "");
    setSkillsText(skillsToText(structured?.skills ?? []));
    setResumeText(parsed.resume_text);
    setStructuredData(structured);
  }, [parsed]);

  if (loadingHandoff || !parsed) {
    return (
      <Layout showSidebar={false} showCaptureBar={false}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <PageLoader variant="page" />
        </div>
      </Layout>
    );
  }

  async function handleSave() {
    if (!name.trim() || !resumeText.trim()) return;
    setSaving(true);
    setError(null);

    const skills = textToSkills(skillsText);
    const payloadStructured: ResumeStructuredData | null = structuredData
      ? {
          ...structuredData,
          name: name.trim(),
          headline: headline.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          skills,
        }
      : null;

    try {
      if (isUpdate && state?.profileId) {
        await api.profiles.update(state.profileId, {
          name: name.trim(),
          headline: headline.trim() || undefined,
          resume_text: resumeText.trim(),
          structured_data: payloadStructured,
        });
        setActiveProfileId(state.profileId);
        navigate(state.returnTo ?? "/profile", { replace: true });
      } else {
        const profile = await api.profiles.create({
          name: name.trim(),
          headline: headline.trim() || undefined,
          resume_text: resumeText.trim(),
          structured_data: payloadStructured,
        });
        await clearOnboardingResume();
        setActiveProfileId(profile.id);
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout
      title={isUpdate ? "Review update" : "Review profile"}
      subtitle={isUpdate ? "Confirm changes before saving" : "Edit extracted fields before matching"}
      showSidebar={isUpdate}
      showCaptureBar={isUpdate}
    >
      <div className="space-y-6">
        {!isUpdate && <OnboardingSteps current={3} />}

        <div>
          <h2 className="text-xl font-semibold sm:text-2xl">Review & confirm</h2>
          <p className="mt-2 text-sm text-text-muted">
            We structured your resume with AI. Edit anything that looks wrong before saving.
          </p>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="space-y-4 rounded-xl border border-border bg-surface-raised p-5">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </Field>
          <Field label="Headline" hint="Optional">
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Senior Backend Engineer"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" hint="Optional">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Phone" hint="Optional">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 0100"
              />
            </Field>
          </div>
          <Field label="Skills" hint="One line per skill">
            <Textarea
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              rows={4}
              placeholder="Python&#10;FastAPI&#10;PostgreSQL"
            />
          </Field>
          <Field label="Resume text">
            <Textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              rows={12}
            />
          </Field>
        </div>

        {structuredData && (
          <section className="rounded-xl border border-border bg-surface-raised p-5">
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-text-muted">
              Extracted preview
            </h3>
            <StructuredProfileView
              data={{
                ...structuredData,
                name: name.trim() || structuredData.name,
                headline: headline.trim() || structuredData.headline,
                email: email.trim() || structuredData.email,
                phone: phone.trim() || structuredData.phone,
                skills: textToSkills(skillsText),
              }}
              compact
            />
          </section>
        )}

        <div className="flex justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() =>
              navigate(isUpdate ? (state?.returnTo ?? "/profile") : "/onboarding/upload")
            }
          >
            {isUpdate ? "Cancel" : "Re-upload"}
          </Button>
          <Button
            onClick={() => void handleSave()}
            loading={saving}
            disabled={!name.trim() || !resumeText.trim()}
            className="px-8"
          >
            {isUpdate ? "Update profile" : "Save & continue"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
