type CaptureAnimationListener = (state: CaptureAnimationState) => void;

export interface CaptureAnimationState {
  active: boolean;
  tabHint: string | null;
  phase: number;
}

const PHASE_COUNT = 4;

let state: CaptureAnimationState = {
  active: false,
  tabHint: null,
  phase: 0,
};

const listeners = new Set<CaptureAnimationListener>();
let phaseTimer: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const listener of listeners) {
    listener(state);
  }
}

function clearPhaseTimer() {
  if (phaseTimer) {
    clearInterval(phaseTimer);
    phaseTimer = null;
  }
}

export const captureAnimationStore = {
  subscribe(listener: CaptureAnimationListener) {
    listeners.add(listener);
    listener(state);
    return () => {
      listeners.delete(listener);
    };
  },

  start(tabHint: string | null) {
    clearPhaseTimer();
    state = { active: true, tabHint, phase: 0 };
    emit();
    phaseTimer = setInterval(() => {
      state = { ...state, phase: (state.phase + 1) % PHASE_COUNT };
      emit();
    }, 1200);
  },

  stop() {
    clearPhaseTimer();
    state = { active: false, tabHint: null, phase: 0 };
    emit();
  },

  getState() {
    return state;
  },
};

export const CAPTURE_PHASE_MESSAGES = [
  "Connecting to active tab…",
  "Scanning visible job text…",
  "Harvesting details…",
  "Structuring for review…",
] as const;
