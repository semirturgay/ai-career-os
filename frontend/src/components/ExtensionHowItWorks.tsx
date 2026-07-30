const STEPS = [
  {
    title: "Browse job postings",
    description:
      "Open any role in a normal browser tab — Wellfound, LinkedIn, company careers pages, and more.",
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
      </svg>
    ),
  },
  {
    title: "Capture from this tab",
    description:
      "We read the visible page text only — never fetch the URL. You review and edit before anything is saved.",
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 8V6a2 2 0 012-2h3l2 2h7a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2v-2"
        />
      </svg>
    ),
  },
  {
    title: "Understand your fit",
    description:
      "Get explainable match scores with strengths, gaps, and evidence — not black-box auto-apply.",
    icon: (
      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
] as const;

export function ExtensionHowItWorks() {
  return (
    <ol className="space-y-3">
      {STEPS.map((step, index) => (
        <li
          key={step.title}
          className="flex gap-3 rounded-xl border border-border bg-surface-raised p-3"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            {step.icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
              Step {index + 1}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-text">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
