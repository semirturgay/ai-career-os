export function ExtensionEmptyPipeline() {
  return (
    <div className="rounded-xl border border-accent/20 bg-gradient-to-b from-accent/5 to-surface-raised px-4 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Next step</p>
      <h3 className="mt-1 text-base font-semibold text-text">Capture a job from your browser</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Use the bar above to capture from your active tab, or paste a description if you don&apos;t
        have a posting open. You review before saving — then we run explainable match analysis.
      </p>

      <ol className="mt-4 space-y-2.5">
        <li className="flex gap-2.5 text-xs text-text-muted">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
            1
          </span>
          <span>Browse to a job posting (Wellfound, LinkedIn, company careers page…)</span>
        </li>
        <li className="flex gap-2.5 text-xs text-text-muted">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
            2
          </span>
          <span>Hit Capture tab — we read the visible page, not the URL</span>
        </li>
        <li className="flex gap-2.5 text-xs text-text-muted">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
            3
          </span>
          <span>Review fields, save, and see your match score</span>
        </li>
      </ol>
    </div>
  );
}
