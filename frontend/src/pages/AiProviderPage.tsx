import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { LLMProvider } from "../types/settings";
import { normalizeProvider } from "../types/settings";
import { AiLoadingState } from "../components/AiLoadingState";
import { Layout } from "../components/Layout";
import { OnboardingSteps } from "../components/OnboardingSteps";
import { ProviderForm } from "../components/ProviderForm";
import { Button } from "../components/ui";
import { IS_EXTENSION } from "../lib/extensionRuntime";

export function AiProviderPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialProvider, setInitialProvider] = useState<LLMProvider>("openai");
  const [initialModel, setInitialModel] = useState<string>();
  const [initialBaseUrl, setInitialBaseUrl] = useState<string>();
  const [apiKeySet, setApiKeySet] = useState(false);

  useEffect(() => {
    api.settings
      .get()
      .then((s) => {
        const provider = normalizeProvider(s.llm_provider) ?? "openai";
        setInitialProvider(provider);
        if (s.llm_model) setInitialModel(s.llm_model);
        if (s.llm_base_url) setInitialBaseUrl(s.llm_base_url);
        setApiKeySet(s.api_key_set);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout showSidebar={false} showCaptureBar={false}>
      <div className="mx-auto max-w-2xl space-y-8 px-3 py-6 sm:px-6 sm:py-12">
        <OnboardingSteps current={1} />

        <div>
          <h2 className="text-xl font-semibold sm:text-2xl">Choose your AI provider</h2>
          <p className="mt-2 text-sm text-text-muted">
            Bring your own API key. We use structured LLM outputs for resume parsing and job
            matching — provider-agnostic by design.
          </p>
        </div>

        {loading ? (
          <AiLoadingState variant="page" size="md" />
        ) : (
          <ProviderForm
            initialProvider={initialProvider}
            initialModel={initialModel}
            initialBaseUrl={initialBaseUrl}
            apiKeySet={apiKeySet}
            loading={saving}
            submitLabel={IS_EXTENSION ? "Continue" : "Continue to upload"}
            onSubmit={async (data) => {
              setSaving(true);
              try {
                await api.settings.update(data);
                navigate("/onboarding/upload");
              } finally {
                setSaving(false);
              }
            }}
          />
        )}

        <div className="flex justify-between border-t border-border pt-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Back
          </Button>
        </div>
      </div>
    </Layout>
  );
}
