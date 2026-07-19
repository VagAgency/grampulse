"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { BulkRefreshProgress, RefreshDailyBanner } from "@/components/BulkRefreshProvider";
import { HeaderActions } from "@/components/HeaderActions";
import { clearSession } from "@/lib/api";

export type NavKey = "dashboard" | "leaderboard" | "equipe" | "suivi" | "planning";

type Props = {
  email: string | null;
  active: NavKey;
};

const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard" },
  { key: "leaderboard", href: "/leaderboard", label: "Top vidéos" },
  { key: "equipe", href: "/equipe", label: "Rang équipe" },
  { key: "suivi", href: "/suivi", label: "Suivi" },
  { key: "planning", href: "/planning", label: "Planning" },
];

export function AppHeader({ email, active }: Props) {
  const router = useRouter();

  return (
    <header className="app-header">
      <div className="app-header-card">
        <div className="app-header-top">
          <BrandLogo href="/dashboard" size={32} className="app-header-brand" />
          <HeaderActions className="app-header-tools">
            <Link
              href="/account"
              className="btn btn-ghost btn-sm"
              title={email || "Mon compte"}
            >
              Compte
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                clearSession();
                router.push("/login");
              }}
            >
              Déconnexion
            </button>
          </HeaderActions>
        </div>

        <nav className="app-nav" aria-label="Navigation principale">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`app-nav-link${active === item.key ? " active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <RefreshDailyBanner />
      <BulkRefreshProgress />
    </header>
  );
}
