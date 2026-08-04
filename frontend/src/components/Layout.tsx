import { Sidebar } from "./Sidebar";
import { EmbeddedNav } from "./EmbeddedNav";
import { FloatingCaptureDock } from "./FloatingCaptureDock";
import { PageBackNav } from "./PageBackNav";
import { GlobalTaskIndicator } from "./GlobalTaskIndicator";
import { useEmbeddedMode } from "../hooks/useEmbeddedMode";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showSidebar?: boolean;
  /** Show floating capture dock in extension side panel (default: true when embedded). */
  showCaptureBar?: boolean;
  /** Back link in a sticky bar at the top of the embedded panel. */
  backTo?: string;
  backLabel?: string;
}

export function Layout({
  children,
  title,
  subtitle,
  showSidebar = true,
  showCaptureBar,
  backTo,
  backLabel,
}: LayoutProps) {
  const embedded = useEmbeddedMode();
  const captureDock = showCaptureBar ?? embedded;

  if (embedded) {
    return (
      <div
        className={`flex min-h-screen flex-col overflow-x-clip bg-surface ${
          captureDock
            ? "pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]"
            : "pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))]"
        }`}
      >
        {backTo && (
          <div className="sticky top-0 z-50 border-b border-border bg-surface/95 px-3 py-2 backdrop-blur-sm">
            <PageBackNav to={backTo} label={backLabel} />
          </div>
        )}
        <GlobalTaskIndicator />
        {(title || subtitle) && (
          <header className="border-b border-border bg-surface/80 px-4 py-3 backdrop-blur-sm">
            {title && <h1 className="text-base font-semibold tracking-tight text-text">{title}</h1>}
            {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
          </header>
        )}
        <main className="min-w-0 flex-1 w-full px-3 py-4">{children}</main>
        {captureDock && <FloatingCaptureDock />}
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
        <GlobalTaskIndicator />
        {(title || subtitle) && (
          <header className="hidden border-b border-border bg-surface/80 px-8 py-5 backdrop-blur-sm lg:block">
            {title && <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>}
            {subtitle && <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>}
          </header>
        )}
        <main className="w-full flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
