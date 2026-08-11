/// <reference types="chrome" />

import { Button } from "./ui";
import { getApiBase, IS_EXTENSION } from "../lib/extensionRuntime";

interface BackendUnreachableProps {
  onRetry: () => void;
}

/**
 * Shown when the API never answered — as opposed to answering "no profiles yet".
 *
 * Those two states used to look identical: the error was swallowed and the user was
 * redirected into onboarding, which then failed opaquely a few steps later. Anyone
 * installing the extension without the backend running hit that, and had no way to
 * tell what was wrong.
 */
export function BackendUnreachable({ onRetry }: BackendUnreachableProps) {
  const apiBase = getApiBase().replace(/\/api\/v1$/, "");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-5 py-10">
      <div>
        <p className="text-3xl" aria-hidden>
          🔌
        </p>
        <h1 className="mt-3 text-lg font-semibold text-text">Can't reach your backend</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          AI Career OS runs against a backend on your own machine — that's what keeps your
          resume off other people's servers. Nothing responded at:
        </p>
      </div>

      <code className="block break-all rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text">
        {apiBase}
      </code>

      <div className="space-y-2">
        <p className="text-sm font-medium text-text">Start it with:</p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs leading-relaxed text-text">
          <code>{"cd ai-career-os\ndocker compose up"}</code>
        </pre>
        <p className="text-xs text-text-muted">
          First run downloads dependencies and may take a few minutes. The API is ready when
          it logs <span className="font-medium text-text">Uvicorn running</span>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onRetry}>Try again</Button>
        {IS_EXTENSION && (
          <Button variant="secondary" onClick={() => chrome.runtime.openOptionsPage()}>
            Change API URL
          </Button>
        )}
        <a
          href="https://github.com/semirturgay/ai-career-os#quick-start"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-accent underline"
        >
          Setup guide
        </a>
      </div>

      <p className="text-xs text-text-muted">
        On macOS use <span className="font-medium text-text">127.0.0.1</span> rather than
        localhost — localhost can resolve to IPv6 and hang.
      </p>
    </div>
  );
}
