"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { getStoredEmail, setStoredEmail } from "@/lib/api";
import {
  fetchSubscriptionStatus,
  syncSubscription,
} from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = getStoredEmail();
    if (stored) {
      router.replace("/account");
    }
  }, [router]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Entre une adresse email valide.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const normalized = email.trim().toLowerCase();
      let status = await fetchSubscriptionStatus(normalized);
      if (!status.active) {
        try {
          await syncSubscription(normalized);
          status = await fetchSubscriptionStatus(normalized);
        } catch {
          // pas d'abonnement Whop actif
        }
      }
      setStoredEmail(normalized);
      router.push(status.active ? "/dashboard" : "/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="card auth-card">
        <BrandLogo href="/" size={48} className="brand-logo-centered" />
        <h1>Connexion</h1>
        <p className="hint">
          Entre l&apos;email utilisé lors de ton abonnement GramPulse.
        </p>
        <form onSubmit={connect} style={{ marginTop: 20, display: "grid", gap: 12 }}>
          <input
            type="email"
            placeholder="toi@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {error && <p className="status err">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Vérification…" : "Se connecter"}
          </button>
        </form>
        <p className="hint" style={{ marginTop: 16 }}>
          Pas encore abonné ?{" "}
          <Link href="/#pricing" className="link-accent">
            Voir les offres
          </Link>
        </p>
      </div>
    </main>
  );
}
