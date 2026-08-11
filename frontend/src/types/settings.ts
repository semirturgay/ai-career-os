export type LLMProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "mistral"
  | "together"
  | "azure_openai"
  | "nvidia"
  | "local";

export type LocalPreset = "ollama" | "lmstudio" | "custom";

export type ProviderCategory = "cloud" | "local";

export interface LocalPresetMeta {
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
}

export interface ProviderMeta {
  label: string;
  description: string;
  category: ProviderCategory;
  defaultModel: string;
  defaultBaseUrl: string | null;
  requiresApiKey: boolean;
  showBaseUrl: boolean;
}

export interface AppSettings {
  llm_provider: LLMProvider | null;
  llm_model: string | null;
  llm_base_url: string | null;
  api_key_set: boolean;
  configured: boolean;
  radar_poll_interval?: import("./radar").RadarPollInterval | null;
}

export interface SettingsUpdate {
  llm_provider: LLMProvider;
  llm_model?: string;
  llm_base_url?: string;
  llm_api_key?: string;
}

export interface ModelListResponse {
  models: string[];
}

export interface ListModelsRequest {
  llm_provider: LLMProvider;
  llm_api_key?: string;
  llm_base_url?: string;
  use_saved_credentials?: boolean;
}

export const LOCAL_PRESETS: Record<LocalPreset, LocalPresetMeta> = {
  ollama: {
    label: "Ollama",
    defaultModel: "llama3.2",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
  },
  lmstudio: {
    label: "LM Studio",
    defaultModel: "local-model",
    defaultBaseUrl: "http://127.0.0.1:1234/v1",
  },
  custom: {
    label: "Custom",
    defaultModel: "local-model",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
  },
};

export const PROVIDER_REGISTRY: Record<LLMProvider, ProviderMeta> = {
  local: {
    label: "Local / Self-hosted",
    description: "Ollama, LM Studio, or any OpenAI-compatible server",
    category: "local",
    defaultModel: LOCAL_PRESETS.ollama.defaultModel,
    defaultBaseUrl: LOCAL_PRESETS.ollama.defaultBaseUrl,
    requiresApiKey: false,
    showBaseUrl: true,
  },
  openai: {
    label: "OpenAI",
    description: "GPT-4o mini — strong structured outputs",
    category: "cloud",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: null,
    requiresApiKey: true,
    showBaseUrl: false,
  },
  anthropic: {
    label: "Anthropic",
    description: "Claude Haiku — efficient reasoning",
    category: "cloud",
    defaultModel: "claude-haiku-4-5",
    defaultBaseUrl: null,
    requiresApiKey: true,
    showBaseUrl: false,
  },
  google: {
    label: "Google Gemini",
    description: "Gemini Flash — fast multimodal models",
    category: "cloud",
    defaultModel: "gemini-2.0-flash",
    defaultBaseUrl: null,
    requiresApiKey: true,
    showBaseUrl: false,
  },
  groq: {
    label: "Groq",
    description: "Ultra-fast inference — OpenAI-compatible API",
    category: "cloud",
    defaultModel: "llama-3.3-70b-versatile",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    requiresApiKey: true,
    showBaseUrl: true,
  },
  mistral: {
    label: "Mistral",
    description: "Mistral Small — European frontier models",
    category: "cloud",
    defaultModel: "mistral-small-latest",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    requiresApiKey: true,
    showBaseUrl: true,
  },
  together: {
    label: "Together AI",
    description: "Open-source models at scale",
    category: "cloud",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    defaultBaseUrl: "https://api.together.xyz/v1",
    requiresApiKey: true,
    showBaseUrl: true,
  },
  azure_openai: {
    label: "Azure OpenAI",
    description: "Enterprise OpenAI deployments",
    category: "cloud",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: null,
    requiresApiKey: true,
    showBaseUrl: true,
  },
  nvidia: {
    label: "NVIDIA NIM",
    description: "Hosted models via build.nvidia.com — Nemotron, Llama, Qwen, and more",
    category: "cloud",
    defaultModel: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
    requiresApiKey: true,
    showBaseUrl: true,
  },
};

export const CLOUD_PROVIDERS = (Object.keys(PROVIDER_REGISTRY) as LLMProvider[]).filter(
  (p) => PROVIDER_REGISTRY[p].category === "cloud",
);

const LEGACY_LOCAL = new Set(["ollama", "lmstudio"]);

export function normalizeProvider(provider: string | null | undefined): LLMProvider | null {
  if (!provider) return null;
  if (LEGACY_LOCAL.has(provider)) return "local";
  if (provider in PROVIDER_REGISTRY) return provider as LLMProvider;
  return null;
}

export function inferLocalPreset(baseUrl: string | null | undefined): LocalPreset {
  if (!baseUrl) return "ollama";
  if (baseUrl.includes("1234")) return "lmstudio";
  if (baseUrl.includes("11434")) return "ollama";
  return "custom";
}

/** @deprecated use PROVIDER_REGISTRY */
export const PROVIDER_META = PROVIDER_REGISTRY;
