"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { BulkRefreshProgress } from "@/components/BulkRefreshProvider";
import { HeaderActions } from "@/components/HeaderActions";
import { clearSession } from "@/lib/api";

type NavKey = "dashboard" | "leaderboard" | "equipe" | "suivi";

type Props = {
  email: string | null;
  active: NavKey;
};

const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard" },
  { key: "leaderboard", href: "/leaderboard", label: "Top vidéos" },
  { key: "equipe", href: "/equipe", label: "Rang équipe" },
  { key: "suivi", href: "/suivi", label: "Suivi" },
];

export function AppHeader({ email, active }: Props) {
  const router = useRouter();

  return (
    <>
      <header className="dashboard-header">
        <div>
          <BrandLogo href="/" size={34} />
          {email && <p className="hint" style={{ margin: "4px 0 0" }}>{email}</p>}
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
        <HeaderActions>
          <Link href="/account" className="btn btn-ghost btn-sm">
            Mon compte
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              clearSession();
              router.push("/login");
            }}
          >
            Déconnexion
          </button>
        </HeaderActions>
      </header>
      <BulkRefreshProgress />
    </>
  );
}
