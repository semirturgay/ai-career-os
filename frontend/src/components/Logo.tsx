import { Link } from "react-router-dom";
import logoUrl from "/logo.svg";

interface LogoProps {
  compact?: boolean;
  className?: string;
  linkTo?: string;
}

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt=""
      className={className}
      aria-hidden
      draggable={false}
    />
  );
}

export function Logo({ compact = false, className = "", linkTo = "/" }: LogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="size-8 shrink-0" />
      {!compact && (
        <span className="min-w-0 text-left leading-tight">
          <span className="block text-sm font-semibold tracking-tight text-text">Career OS</span>
          <span className="block text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Career matching
          </span>
        </span>
      )}
    </span>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="rounded-lg outline-none ring-accent focus-visible:ring-2">
        {content}
      </Link>
    );
  }

  return content;
}
