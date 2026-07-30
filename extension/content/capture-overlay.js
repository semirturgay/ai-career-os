/**
 * Full-page capture overlay — "data harvest" suction effect toward the side panel.
 * Injected on demand; exposed as window.__aiCareerCaptureOverlay.
 */
(function initCaptureOverlay() {
  if (window.__aiCareerCaptureOverlay) {
    return;
  }

  const OVERLAY_ID = "ai-career-capture-overlay";
  const STYLE_ID = "ai-career-capture-overlay-styles";
  const ROOT_CLASS = "ai-career-capturing";

  const STATUS_LINES = [
    "Scanning visible page…",
    "Harvesting job details…",
    "Pulling text into Career OS…",
    "Structuring fields…",
  ];

  let statusTimer = null;
  let statusIndex = 0;
  let lockedScrollY = 0;

  function lockPageScroll() {
    lockedScrollY = window.scrollY;
    document.documentElement.classList.add(ROOT_CLASS);
    document.body.classList.add(ROOT_CLASS);
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockPageScroll() {
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.documentElement.classList.remove(ROOT_CLASS);
    document.body.classList.remove(ROOT_CLASS);
    window.scrollTo(0, lockedScrollY);
  }

  function harvestSnippets() {
    const snippets = [];
    const push = (text) => {
      const trimmed = (text || "").trim().replace(/\s+/g, " ");
      if (trimmed.length >= 4) {
        snippets.push(trimmed.slice(0, 72));
      }
    };

    push(document.querySelector("h1")?.textContent);
    document.querySelectorAll("h2, h3").forEach((el, i) => {
      if (i < 4) {
        push(el.textContent);
      }
    });
    push(document.title);

    const meta = document.querySelector('meta[name="description"]')?.getAttribute("content");
    push(meta);

    return [...new Set(snippets)].slice(0, 7);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.${ROOT_CLASS},
      html.${ROOT_CLASS} body {
        overflow: hidden !important;
        overscroll-behavior: none;
      }

      html.${ROOT_CLASS} body {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        width: 100%;
      }

      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        pointer-events: none;
        overflow: hidden;
        font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      #${OVERLAY_ID} .ac-vignette {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(ellipse 85% 70% at 78% 50%, rgba(15, 118, 110, 0.28) 0%, transparent 55%),
          linear-gradient(90deg, rgba(15, 23, 42, 0.08) 0%, rgba(15, 118, 110, 0.18) 72%, rgba(15, 118, 110, 0.42) 100%);
        animation: ac-vignette-in 0.45s ease-out both;
      }

      #${OVERLAY_ID} .ac-scan {
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent 0%, rgba(45, 212, 191, 0.15) 20%, rgba(45, 212, 191, 0.95) 50%, rgba(45, 212, 191, 0.15) 80%, transparent 100%);
        box-shadow: 0 0 24px 4px rgba(45, 212, 191, 0.55);
        animation: ac-scan-pulse 2.4s ease-in-out infinite;
      }

      #${OVERLAY_ID} .ac-portal {
        position: absolute;
        right: -36px;
        top: 50%;
        width: 140px;
        height: 140px;
        margin-top: -70px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(153, 246, 228, 0.95) 0%, rgba(20, 184, 166, 0.85) 28%, rgba(15, 118, 110, 0.55) 52%, transparent 72%);
        box-shadow: 0 0 50px 16px rgba(20, 184, 166, 0.45);
        animation: ac-portal-pulse 1.15s ease-in-out infinite;
      }

      #${OVERLAY_ID} .ac-portal-ring {
        position: absolute;
        inset: -14px;
        border-radius: 50%;
        border: 2px solid rgba(153, 246, 228, 0.55);
        animation: ac-portal-spin 2.8s linear infinite;
      }

      #${OVERLAY_ID} .ac-portal-ring:nth-child(2) {
        inset: -28px;
        border-color: rgba(20, 184, 166, 0.35);
        animation-duration: 4.2s;
        animation-direction: reverse;
      }

      #${OVERLAY_ID} .ac-stream {
        position: absolute;
        width: 2px;
        height: 80px;
        background: linear-gradient(180deg, transparent, rgba(45, 212, 191, 0.9), transparent);
        opacity: 0;
        animation: ac-stream-suck 1.35s ease-in infinite;
      }

      #${OVERLAY_ID} .ac-chip {
        position: absolute;
        max-width: min(240px, 42vw);
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(20, 184, 166, 0.45);
        color: #134e4a;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 8px 24px rgba(15, 118, 110, 0.22);
        animation: ac-chip-suck 2.1s cubic-bezier(0.55, 0, 0.85, 0.36) infinite;
      }

      #${OVERLAY_ID} .ac-status {
        position: absolute;
        left: 50%;
        bottom: 28px;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid rgba(20, 184, 166, 0.35);
        box-shadow: 0 12px 40px rgba(15, 118, 110, 0.2);
        color: #134e4a;
        font-size: 13px;
        font-weight: 600;
        animation: ac-status-in 0.4s ease-out both;
      }

      #${OVERLAY_ID} .ac-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #14b8a6;
        box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.6);
        animation: ac-dot-pulse 1.4s ease-out infinite;
      }

      #${OVERLAY_ID}.ac-success .ac-portal {
        animation: ac-portal-success 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }

      #${OVERLAY_ID}.ac-success .ac-vignette {
        animation: ac-vignette-out 0.65s ease-in forwards;
      }

      #${OVERLAY_ID}.ac-error {
        animation: ac-shake 0.42s ease-in-out;
      }

      #${OVERLAY_ID}.ac-error .ac-status {
        border-color: rgba(185, 28, 28, 0.45);
        color: #991b1b;
      }

      #${OVERLAY_ID}.ac-error .ac-status-dot {
        background: #dc2626;
        animation: none;
      }

      @keyframes ac-vignette-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes ac-vignette-out {
        to { opacity: 0; }
      }

      @keyframes ac-scan-pulse {
        0%, 100% {
          top: 22%;
          opacity: 0.35;
        }
        50% {
          top: 78%;
          opacity: 1;
        }
      }

      @keyframes ac-portal-pulse {
        0%, 100% { transform: scale(1); filter: brightness(1); }
        50% { transform: scale(1.08); filter: brightness(1.12); }
      }

      @keyframes ac-portal-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes ac-portal-success {
        0% { transform: scale(1); opacity: 1; }
        100% { transform: scale(4.5); opacity: 0; }
      }

      @keyframes ac-stream-suck {
        0% { opacity: 0; transform: translate(0, 0) scaleY(0.4); }
        15% { opacity: 0.85; }
        100% { opacity: 0; transform: translate(42vw, -12px) scaleY(1.1); }
      }

      @keyframes ac-chip-suck {
        0% { opacity: 0; transform: translate(0, 0) scale(0.85); }
        12% { opacity: 1; }
        100% { opacity: 0; transform: translate(38vw, -24px) scale(0.55); }
      }

      @keyframes ac-status-in {
        from { opacity: 0; transform: translateX(-50%) translateY(8px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      @keyframes ac-dot-pulse {
        0% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.55); }
        70% { box-shadow: 0 0 0 10px rgba(20, 184, 166, 0); }
        100% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0); }
      }

      @keyframes ac-shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-6px); }
        40% { transform: translateX(6px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(4px); }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function clearStatusTimer() {
    if (statusTimer) {
      clearInterval(statusTimer);
      statusTimer = null;
    }
  }

  function buildStreams(container) {
    for (let i = 0; i < 14; i += 1) {
      const stream = document.createElement("div");
      stream.className = "ac-stream";
      stream.style.left = `${4 + Math.random() * 62}%`;
      stream.style.top = `${6 + Math.random() * 78}%`;
      stream.style.animationDelay = `${Math.random() * 1.2}s`;
      stream.style.animationDuration = `${1 + Math.random() * 0.8}s`;
      container.appendChild(stream);
    }
  }

  function buildChips(container, snippets) {
    snippets.forEach((text, index) => {
      const chip = document.createElement("div");
      chip.className = "ac-chip";
      chip.textContent = text;
      chip.style.left = `${8 + (index * 11) % 58}%`;
      chip.style.top = `${14 + ((index * 17) % 62)}%`;
      chip.style.animationDelay = `${0.2 + index * 0.28}s`;
      chip.style.animationDuration = `${1.8 + (index % 3) * 0.35}s`;
      container.appendChild(chip);
    });
  }

  function showCaptureOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      return;
    }

    injectStyles();
    lockPageScroll();

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;

    const vignette = document.createElement("div");
    vignette.className = "ac-vignette";
    overlay.appendChild(vignette);

    const scan = document.createElement("div");
    scan.className = "ac-scan";
    overlay.appendChild(scan);

    buildStreams(overlay);
    buildChips(overlay, harvestSnippets());

    const portal = document.createElement("div");
    portal.className = "ac-portal";
    portal.innerHTML = '<div class="ac-portal-ring"></div><div class="ac-portal-ring"></div>';
    overlay.appendChild(portal);

    const status = document.createElement("div");
    status.className = "ac-status";
    status.innerHTML = '<span class="ac-status-dot"></span><span class="ac-status-text"></span>';
    overlay.appendChild(status);

    document.body.appendChild(overlay);

    const statusText = status.querySelector(".ac-status-text");
    statusIndex = 0;
    if (statusText) {
      statusText.textContent = STATUS_LINES[0];
    }
    clearStatusTimer();
    statusTimer = setInterval(() => {
      statusIndex = (statusIndex + 1) % STATUS_LINES.length;
      if (statusText) {
        statusText.textContent = STATUS_LINES[statusIndex];
      }
    }, 1400);
  }

  function hideCaptureOverlay(outcome) {
    clearStatusTimer();

    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      unlockPageScroll();
      return;
    }

    if (outcome === "success") {
      overlay.classList.add("ac-success");
    } else if (outcome === "error") {
      overlay.classList.add("ac-error");
      const statusText = overlay.querySelector(".ac-status-text");
      if (statusText) {
        statusText.textContent = "Could not capture this page";
      }
    }

    const delay = outcome === "success" ? 620 : 480;
    window.setTimeout(() => {
      overlay.remove();
      unlockPageScroll();
      document.getElementById(STYLE_ID)?.remove();
    }, delay);
  }

  window.__aiCareerCaptureOverlay = {
    show: showCaptureOverlay,
    hide: hideCaptureOverlay,
  };
})();
