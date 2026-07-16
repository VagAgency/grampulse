"use client";

import { LandingBackground } from "@/components/LandingBackground";
import { AppHeader, NavKey } from "@/components/AppHeader";

type Props = {
  email: string | null;
  active?: NavKey;
  showNav?: boolean;
  children: React.ReactNode;
};

export function AppShell({ email, active, showNav = true, children }: Props) {
  return (
    <main className="app">
      <LandingBackground />
      <div className="container app-shell">
        {showNav && active ? <AppHeader email={email} active={active} /> : null}
        <div className="dashboard-main">{children}</div>
      </div>
    </main>
  );
}
