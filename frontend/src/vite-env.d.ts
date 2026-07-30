/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXTENSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
