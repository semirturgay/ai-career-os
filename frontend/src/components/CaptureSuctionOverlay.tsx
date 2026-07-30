import { useEffect, useState } from "react";
import {
  CAPTURE_PHASE_MESSAGES,
  captureAnimationStore,
  type CaptureAnimationState,
} from "../lib/captureAnimationStore";
import { IS_EXTENSION } from "../lib/extensionRuntime";

export function CaptureSuctionOverlay() {
  const [anim, setAnim] = useState<CaptureAnimationState>(() => captureAnimationStore.getState());

  useEffect(() => {
    if (!IS_EXTENSION) {
      return undefined;
    }
    return captureAnimationStore.subscribe(setAnim);
  }, []);

  if (!IS_EXTENSION || !anim.active) {
    return null;
  }

  const message = CAPTURE_PHASE_MESSAGES[anim.phase] ?? CAPTURE_PHASE_MESSAGES[0];

  return (
    <div
      className="capture-suction-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-surface/88 backdrop-blur-md"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="capture-suction-beam pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-accent/25 via-accent/5 to-transparent" />

      <div className="capture-suction-portal relative flex size-28 items-center justify-center">
        <span className="capture-suction-ring absolute inset-0 rounded-full border-2 border-accent/30" />
        <span className="capture-suction-ring capture-suction-ring-delay absolute inset-2 rounded-full border border-accent/20" />
        <span className="relative size-16 rounded-full bg-gradient-to-br from-teal-200 via-accent to-teal-800 shadow-[0_0_40px_12px_rgba(15,118,110,0.35)]" />
      </div>

      <div className="capture-suction-particles pointer-events-none absolute inset-0">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className="capture-suction-particle absolute block size-1 rounded-full bg-accent"
            style={{
              left: `${4 + (i * 5.2) % 46}%`,
              top: `${10 + ((i * 13) % 78)}%`,
              animationDelay: `${(i % 6) * 0.18}s`,
              animationDuration: `${0.95 + (i % 4) * 0.15}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mt-8 max-w-[88%] text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
          Capturing from tab
        </p>
        <p className="capture-suction-message mt-2 text-sm font-semibold text-text">{message}</p>
        {anim.tabHint && (
          <p className="mt-2 truncate text-xs text-text-muted">
            Source · <span className="font-medium text-text">{anim.tabHint}</span>
          </p>
        )}
      </div>
    </div>
  );
}
