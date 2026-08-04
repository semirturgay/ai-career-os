import { Link } from "react-router-dom";

interface PageBackNavProps {
  to: string;
  label?: string;
  className?: string;
}

export function PageBackNav({ to, label = "Back", className = "" }: PageBackNavProps) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1 rounded-lg py-1.5 pl-1 pr-2.5 text-sm font-medium text-text-muted transition hover:bg-surface-overlay hover:text-text ${className}`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0" aria-hidden>
        <path
          fillRule="evenodd"
          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </Link>
  );
}
