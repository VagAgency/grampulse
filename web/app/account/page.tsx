"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AppPageHeader } from "@/components/AppPageHeader";
import { clearSession, getStoredEmail, setStoredEmail } from "@/lib/api";
import {
  API,
  createCheckout,
  fetchSubscriptionStatus,
  formatMemberSince,
  SubscriptionStatus,
  syncSubscription,
} from "@/lib/auth";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromCheckout = params.get("email");
    const checkoutSuccess = params.get("checkout") === "success";

    async function init() {
      if (fromCheckout) {
        const normalized = fromCheckout.trim().toLowerCase();
        setStoredEmail(normalized);
        window.history.replaceState({}, "", "/account");
        setEmail(normalized);
        setLoading(true);
        if (checkoutSuccess) {
          setMessage("Activation de ton abonnement…");
        }
        try {
          await syncSubscription(normalized);
          if (checkoutSuccess) {
            setMessage("Paiement confirmé — accès activé.");
          }
        } catch {
          if (checkoutSuccess) {
            setMessage("Paiement reçu — synchronisation en cours. Réessaie dans quelques secondes.");
          }
        }
        await loadStatus(normalized);
        return;
      }

      const stored = getStoredEmail();
      if (!stored) {
        router.replace("/login");
        return;
      }
      setEmail(stored);
      loadStatus(stored);
    }

    init();
  }, [router]);

  async function loadStatus(userEmail: string) {
    setLoading(true);
    try {
      const data = await fetchSubscriptionStatus(userEmail);
      setStatus(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }

  async function openBillingPortal() {
    if (!email) return;
    setActionLoading(true);
    setMessage("");
    try {
      if (status?.manage_url) {
        window.location.href = status.manage_url;
        return;
      }
      const res = await fetch(`${API}/whop/portal`, {
        method: "POST",
        headers: { "X-User-Email": email },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Portail indisponible.");
      window.location.href = data.url;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur.");
      setActionLoading(false);
    }
  }

  async function subscribe() {
    if (!email) return;
    setActionLoading(true);
    setMessage("");
    try {
      const url = await createCheckout(email);
      window.location.href = url;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur.");
      setActionLoading(false);
    }
  }

  return (
    <AppShell email={email} active="dashboard">
          <AppPageHeader
            eyebrow="Espace membre"
            title="Mon compte"
            subtitle="Gère ton abonnement GramPulse et accède au dashboard."
          />

          {loading ? (
            <p className="hint">Chargement…</p>
          ) : status ? (
            <div className="card chart-card" style={{ maxWidth: 520 }}>
              <p className="hint">Email</p>
              <p style={{ margin: "4px 0 16px", fontWeight: 600 }}>{status.email}</p>

              {status.active ? (
                <>
                  <p className="status ok" style={{ marginBottom: 12 }}>
                    Abonnement actif — {status.plan}
                    {status.price_label ? ` · ${status.price_label}` : ""}
                  </p>
                  {status.member_since && (
                    <p className="hint" style={{ marginBottom: 16 }}>
                      Membre depuis {formatMemberSince(status.member_since)}
                    </p>
                  )}
                  {status.dev_account && (
                    <p className="hint" style={{ marginBottom: 16 }}>
                      Compte de test (DEV_BYPASS_EMAIL)
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Link href="/dashboard" className="btn btn-primary">
                      Ouvrir le dashboard
                    </Link>
                    {status.has_billing && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={actionLoading}
                        onClick={() => void openBillingPortal()}
                      >
                        {actionLoading ? "…" : "Gérer l'abonnement"}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="status err" style={{ marginBottom: 16 }}>
                    Aucun abonnement actif pour cet email.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={actionLoading || !status.whop_configured}
                    onClick={() => void subscribe()}
                  >
                    {actionLoading ? "Redirection…" : "S'abonner"}
                  </button>
                  {!status.whop_configured && (
                    <p className="hint" style={{ marginTop: 12 }}>
                      Paiement pas encore configuré sur le serveur.
                    </p>
                  )}
                </>
              )}

              {message && <p className="hint" style={{ marginTop: 16 }}>{message}</p>}

              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 24 }}
                onClick={() => {
                  clearSession();
                  router.push("/login");
                }}
              >
                Changer d&apos;email
              </button>
            </div>
          ) : null}
    </AppShell>
  );
}
