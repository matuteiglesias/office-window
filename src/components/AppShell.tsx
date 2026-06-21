import Link from "next/link";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "Today" },
  { href: "/queues", label: "Queues" },
  { href: "/briefs", label: "Briefs" },
  { href: "/evidence", label: "Evidence" },
  { href: "/runs", label: "Runs" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OW</div>
          <div>
            <div className="brand-title">Office Window</div>
            <div className="brand-subtitle">read-only local cockpit</div>
          </div>
        </div>

        <nav className="nav">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-note">
          Backend artifacts remain the source of truth. This UI only reads.
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
