"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { createCheckout } from "@/lib/auth";

const FEATURES = [
  {
    title: "Modèles & comptes",
    desc: "Organise tes modèles et rattache plusieurs comptes Instagram à chacun.",
  },
  {
    title: "Vues, abonnés & clics",
    desc: "Courbes sur 7 à 90 jours, avec tracking Linkscale intégré.",
  },
  {
    title: "Rang équipe & suivi VA",
    desc: "Classe tes VAs par performance et suis l'activité jour par jour.",
  },
  {
    title: "Top vidéos",
    desc: "Leaderboard des meilleurs Reels par période, tri performance ou conversion.",
  },
];

const FAQ = [
  {
    q: "Faut-il connecter un compte Instagram ?",
    a: "Non. GramPulse analyse les comptes publics via une API tierce — tu entres juste le @handle.",
  },
  {
    q: "Combien de comptes puis-je suivre ?",
    a: "Jusqu'à 20 comptes par modèle. Ajoute autant de modèles que tu veux.",
  },
  {
    q: "Les clics Linkscale sont-ils inclus ?",
    a: "Oui. Assigne un lien par compte et synchronise les clics depuis ton dashboard Linkscale.",
  },
  {
    q: "Puis-je annuler ?",
    a: "Oui, à tout moment depuis ton espace membre Whop.",
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  async function subscribe() {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@") || !normalized.split("@")[1]?.includes(".")) {
      setError("Entre une adresse email valide.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const url = await createCheckout(normalized);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="landing">
      <div className="landing-glow landing-glow-1" />
      <div className="landing-glow landing-glow-2" />

      <header className="landing-nav">
        <div className="container landing-nav-inner">
          <BrandLogo href="/" size={36} />
          <nav className="landing-nav-links">
            <a href="#features">Fonctionnalités</a>
            <a href="#pricing">Tarifs</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="landing-nav-actions">
            <Link href="/login" className="btn btn-ghost btn-sm">
              Connexion
            </Link>
            <a href="#pricing" className="btn btn-primary btn-sm">
              S&apos;abonner
            </a>
          </div>
        </div>
      </header>

      <section className="landing-hero container">
        <p className="hint">Analytics Instagram — agences & créateurs</p>
        <h1 className="landing-title">
          Pilote tous tes comptes Instagram en <span className="gradient-text">un seul dashboard</span>
        </h1>
        <p className="landing-subtitle">
          Vues, abonnés, clics Linkscale, top vidéos et suivi d&apos;équipe —
          sans connexion Meta.
        </p>
        <div className="landing-hero-cta">
          <a href="#pricing" className="btn btn-primary">
            Commencer maintenant
          </a>
          <Link href="/login" className="btn btn-ghost">
            J&apos;ai déjà un compte
          </Link>
        </div>
      </section>

      <section id="features" className="landing-section container">
        <h2 className="landing-section-title">
          Tout ce qu&apos;il faut pour <span className="gradient-text">scaler</span>
        </h2>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="card landing-feature">
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="landing-section container">
        <h2 className="landing-section-title">
          Un tarif <span className="gradient-text">simple</span>
        </h2>
        <div className="card landing-pricing-card">
          <p className="hint">GramPulse Pro</p>
          <p className="landing-price">
            49 <span>€/mois</span>
          </p>
          <ul className="landing-pricing-list">
            <li>Dashboard global multi-modèles</li>
            <li>Refresh Instagram + Linkscale</li>
            <li>Rang équipe & suivi VA</li>
            <li>Top vidéos & analytics avancés</li>
            <li>Support par email</li>
          </ul>
          <input
            type="email"
            placeholder="ton@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          {error && <p className="status err">{error}</p>}
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={loading}
            onClick={() => void subscribe()}
          >
            {loading ? "Redirection…" : "S'abonner — 49 €/mois"}
          </button>
          <p className="hint" style={{ marginTop: 12, textAlign: "center" }}>
            Paiement sécurisé via Whop · Annulation à tout moment
          </p>
        </div>
      </section>

      <section id="faq" className="landing-section container">
        <h2 className="landing-section-title">Questions fréquentes</h2>
        <div className="landing-faq">
          {FAQ.map((item, i) => (
            <div key={item.q} className="card landing-faq-item">
              <button
                type="button"
                className="landing-faq-q"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                {item.q}
              </button>
              {openFaq === i && <p className="landing-faq-a">{item.a}</p>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
