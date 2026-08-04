import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AiLoadingState } from "../components/AiLoadingState";
import { Layout } from "../components/Layout";
import { ProviderForm } from "../components/ProviderForm";
import { Badge } from "../components/ui";
import type { LLMProvider } from "../types/settings";
import { normalizeProvider, PROVIDER_REGISTRY } from "../types/settings";

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [initialProvider, setInitialProvider] = useState<LLMProvider>("openai");
  const [initialModel, setInitialModel] = useState<string>();
  const [initialBaseUrl, setInitialBaseUrl] = useState<string>();
  const [apiKeySet, setApiKeySet] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    api.settings
      .get()
      .then((s) => {
        const provider = normalizeProvider(s.llm_provider) ?? "openai";
        setInitialProvider(provider);
        if (s.llm_model) setInitialModel(s.llm_model);
        if (s.llm_base_url) setInitialBaseUrl(s.llm_base_url);
        setApiKeySet(s.api_key_set);
        setConfigured(s.configured);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout title="Settings" subtitle="AI provider and credentials" backTo="/" backLabel="Pipeline">
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 lg:hidden">
          <p className="text-sm text-text-muted">
            Update your LLM provider and credentials. Keys stay on the server only.
          </p>
          <Badge variant={configured ? "success" : "warning"}>
            {configured ? "Connected" : "Not configured"}
          </Badge>
        </div>

        {loading ? (
          <AiLoadingState variant="page" size="md" />
        ) : (
          <>
            {saved && (
              <p className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                Settings saved.
              </p>
            )}
            <ProviderForm
              initialProvider={initialProvider}
              initialModel={initialModel}
              initialBaseUrl={initialBaseUrl}
              apiKeySet={apiKeySet}
              loading={saving}
              submitLabel="Save settings"
              onSubmit={async (data) => {
                setSaving(true);
                setSaved(false);
                try {
                  const updated = await api.settings.update(data);
                  setApiKeySet(updated.api_key_set);
                  setConfigured(updated.configured);
                  setSaved(true);
                } finally {
                  setSaving(false);
                }
              }}
            />
          </>
        )}

        <p className="text-xs text-text-muted">
          Current provider: {PROVIDER_REGISTRY[initialProvider].label}
          {initialModel ? ` · ${initialModel}` : ""}
        </p>
      </div>
    </Layout>
  );
}
