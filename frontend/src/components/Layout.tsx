import { Sidebar } from "./Sidebar";
import { EmbeddedNav } from "./EmbeddedNav";
import { CaptureFromTabBar } from "./CaptureFromTabBar";
import { Logo } from "./Logo";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showSidebar?: boolean;
  /** Show capture bar in extension side panel (default: true when embedded). */
  showCaptureBar?: boolean;
}

export function Layout({
  children,
  title,
  subtitle,
  showSidebar = true,
  showCaptureBar,
}: LayoutProps) {
  const embedded = useEmbeddedMode();
  const captureBar = showCaptureBar ?? embedded;

  if (embedded) {
    return (
      <div className="flex min-h-screen flex-col bg-surface pb-14">
        <div className="flex items-center justify-between border-b border-border bg-surface-raised px-3 py-2.5">
          <Logo compact linkTo="/" />
        </div>
        {captureBar && <CaptureFromTabBar />}
        {(title || subtitle) && (
          <header className="border-b border-border bg-surface/80 px-4 py-3 backdrop-blur-sm">
            {title && <h1 className="text-base font-semibold tracking-tight text-text">{title}</h1>}
            {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
          </header>
        )}
        <main className="flex-1 w-full px-3 py-4">{children}</main>
        <EmbeddedNav />
      </div>
    );
  }

  if (!showSidebar) {
    return (
      <div className="min-h-screen bg-surface">
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface lg:flex-row">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {(title || subtitle) && (
          <header className="hidden border-b border-border bg-surface/80 px-8 py-5 backdrop-blur-sm lg:block">
            {title && <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>}
            {subtitle && <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>}
          </header>
        )}
        <main className="flex-1 w-full px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
