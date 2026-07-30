import { IS_EXTENSION } from "../lib/extensionRuntime";

/** Compact side-panel layout — always on in the bundled extension build. */
export function useEmbeddedMode(): boolean {
  return IS_EXTENSION;
}
