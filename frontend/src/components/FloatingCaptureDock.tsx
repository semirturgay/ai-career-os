/// <reference types="chrome" />

import { useState } from "react";
import { Link } from "react-router-dom";
import { useCaptureFromActiveTab } from "../hooks/useCaptureFromActiveTab";
import { IS_EXTENSION } from "../lib/extensionRuntime";
import { Button } from "./ui";

const COLLAPSED_WIDTH = "6rem";
const DOCK_BOTTOM = "calc(4.75rem + env(safe-area-inset-bottom, 0px))";

function CaptureIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M3 4a1 1 0 011-1h3a1 1 0 011 1v1h4V4a1 1 0 011-1h3a1 1 0 011 1v2.586l-1.293 1.293A1 1 0 0114 11v5a1 1 0 01-1 1H7a1 1 0 01-1-1v-5a1 1 0 01-.293-.707L4.414 8.586 3 7.172V4z" />
    </svg>
  );
}

function PasteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.379 6H4.5z" />
    </svg>
  );
}

function CaptureErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      className="pointer-events-auto fixed inset-x-3 top-3 z-[60]"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3 rounded-xl border border-danger/50 bg-surface-raised px-4 py-3 shadow-lg">
        <span
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-danger/15 text-xs font-bold text-danger"
          aria-hidden
        >
          !
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-text">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-lg leading-none text-text-muted transition hover:bg-surface-overlay hover:text-text"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function FloatingCaptureDock() {
  const { capturing, error, tabHint, tabBlocked, capture, clearError } = useCaptureFromActiveTab();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  if (!IS_EXTENSION) {
    return null;
  }

  const hint = tabBlocked
    ? "Open a job posting in a browser tab"
    : tabHint
      ? tabHint
      : "Capture from active tab";

  const expanded = hovered || focused || capturing;

  return (
    <>
      {error && <CaptureErrorToast message={error} onDismiss={clearError} />}

      <div
        className="pointer-events-none fixed inset-x-3 z-40 flex justify-end"
        style={{ bottom: DOCK_BOTTOM }}
      >
        <div
          className="pointer-events-auto w-full max-w-full"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setFocused(false);
            }
          }}
        >
          <div
            className={`ml-auto overflow-hidden border border-border/80 bg-surface-raised/95 shadow-lg shadow-black/15 backdrop-blur-md transition-[width,border-radius] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              expanded ? "rounded-2xl" : "rounded-full"
            }`}
            style={{ width: expanded ? "100%" : COLLAPSED_WIDTH }}
          >
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="truncate px-3 pb-1 pt-2 text-[10px] font-medium text-text-muted">
                  {tabBlocked ? hint : `Active tab · ${hint}`}
                </p>
              </div>
            </div>

            <div className={`flex items-center ${expanded ? "gap-1.5 p-1.5 pt-0" : "gap-1.5 p-1"}`}>
              <Link
                to="/jobs/new"
                aria-label="Paste job description"
                title="Paste job"
                className={`inline-flex shrink-0 items-center justify-center text-text transition-colors hover:bg-surface-overlay ${
                  expanded
                    ? "h-9 gap-1.5 rounded-xl border border-border bg-surface-raised px-3 text-xs font-semibold"
                    : "size-10 rounded-full bg-surface-overlay/80"
                }`}
              >
                <PasteIcon className="size-4 shrink-0" />
                {expanded && <span>Paste</span>}
              </Link>

              {expanded ? (
                <Button
                  onClick={() => void capture()}
                  loading={capturing}
                  disabled={tabBlocked}
                  className="h-9 min-w-0 flex-1 rounded-xl px-3 text-xs font-semibold"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    {!capturing && <CaptureIcon className="size-3.5 shrink-0" />}
                    <span>{capturing ? "Reading tab…" : "Capture tab"}</span>
                  </span>
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={() => void capture()}
                  disabled={tabBlocked || capturing}
                  aria-label={capturing ? "Reading tab" : "Capture tab"}
                  title="Capture tab"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {capturing ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <CaptureIcon className="size-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
