import type { ReactNode } from "react";

interface CollapsibleSectionProps {
  title: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}

export function CollapsibleSection({
  title,
  trailing,
  children,
  contentClassName = "space-y-4 border-t border-border px-5 py-4",
}: CollapsibleSectionProps) {
  return (
    <details className="group rounded-xl border border-border bg-surface-raised">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-medium text-text hover:bg-surface-overlay/50 marker:content-none [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-90"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <span className="min-w-0 flex-1">{title}</span>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </summary>
      <div className={contentClassName}>{children}</div>
    </details>
  );
}
