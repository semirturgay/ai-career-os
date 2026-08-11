import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Logo } from "./Logo";

const navItems = [
  {
    to: "/",
    end: true,
    label: "Pipeline",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0">
        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
      </svg>
    ),
  },
  {
    to: "/radar",
    label: "Radar",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0">
        <path
          fillRule="evenodd"
          d="M10 1.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM3 10a7 7 0 1114 0 7 7 0 01-14 0z"
          clipRule="evenodd"
          opacity=".5"
        />
        <path
          fillRule="evenodd"
          d="M10 5.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM7 10a3 3 0 116 0 3 3 0 01-6 0z"
          clipRule="evenodd"
          opacity=".8"
        />
        <circle cx="10" cy="10" r="1.4" />
        <circle cx="14.4" cy="5.6" r="1.7" />
      </svg>
    ),
  },
  {
    to: "/profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0">
        <path
          fillRule="evenodd"
          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0">
        <path
          fillRule="evenodd"
          d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.885.06 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      <NavLink
        to="/jobs/new"
        onClick={onNavigate}
        className={({ isActive }) =>
          `mb-3 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            isActive
              ? "bg-accent-hover text-white"
              : "bg-accent text-white hover:bg-accent-hover"
          }`
        }
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0">
          <path
            fillRule="evenodd"
            d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
            clipRule="evenodd"
          />
        </svg>
        Add job
      </NavLink>

      <div className="mb-2 h-px bg-border" aria-hidden />

      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? "bg-accent/15 text-accent shadow-sm shadow-accent/5"
                : "text-text-muted hover:bg-surface-overlay hover:text-text"
            }`
          }
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface-raised/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <Logo linkTo="/" />
        <div className="flex items-center gap-2">
          <NavLink
            to="/jobs/new"
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white"
          >
            + Add job
          </NavLink>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-text-muted hover:bg-surface-overlay hover:text-text"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-6">
              <path strokeLinecap="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close menu overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-surface-raised transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-5">
          <Logo linkTo="/" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-overlay lg:hidden"
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-5">
              <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col py-4">
          <NavContent onNavigate={() => setMobileOpen(false)} />
        </div>

        <div className="border-t border-border px-4 py-4">
          <p className="text-xs text-text-muted">Evidence-based matching · Human in the loop</p>
        </div>
      </aside>
    </>
  );
}
