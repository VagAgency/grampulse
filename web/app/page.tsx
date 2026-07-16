"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Reveal } from "@/components/Reveal";
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
      <div className="landing-glows" aria-hidden="true">
        <div className="landing-glow landing-glow-1" />
        <div className="landing-glow landing-glow-2" />
        <div className="landing-glow landing-glow-3" />
      </div>

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
        <p className="hint animate-hero">Analytics Instagram — agences & créateurs</p>
        <h1 className="landing-title animate-hero hero-delay-1">
          Pilote tous tes comptes Instagram en <span className="gradient-text">un seul dashboard</span>
        </h1>
        <p className="landing-subtitle animate-hero hero-delay-2">
          Vues, abonnés, clics Linkscale, top vidéos et suivi d&apos;équipe —
          sans connexion Meta.
        </p>
        <div className="landing-hero-cta animate-hero hero-delay-3">
          <a href="#pricing" className="btn btn-primary">
            Commencer maintenant
          </a>
          <Link href="/login" className="btn btn-ghost">
            J&apos;ai déjà un compte
          </Link>
        </div>
      </section>

      <section id="features" className="landing-section container">
        <Reveal>
          <h2 className="landing-section-title">
            Tout ce qu&apos;il faut pour <span className="gradient-text">scaler</span>
          </h2>
        </Reveal>
        <div className="landing-features-grid">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="card landing-feature card-interactive">
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="pricing" className="landing-section container">
        <Reveal>
          <h2 className="landing-section-title">
            Un tarif <span className="gradient-text">simple</span>
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <div className="card landing-pricing-card card-interactive">
            <p className="hint">GramPulse Pro</p>
            <p className="landing-price">
              99 <span>€/mois</span>
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
              {loading ? "Redirection…" : "S'abonner — 99 €/mois"}
            </button>
            <p className="hint" style={{ marginTop: 12, textAlign: "center" }}>
              Paiement sécurisé via Whop · Annulation à tout moment
            </p>
          </div>
        </Reveal>
      </section>

      <section id="faq" className="landing-section container">
        <Reveal>
          <h2 className="landing-section-title">Questions fréquentes</h2>
        </Reveal>
        <div className="landing-faq">
          {FAQ.map((item, i) => (
            <Reveal key={item.q} delay={i * 70}>
              <div className={`card landing-faq-item${openFaq === i ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="landing-faq-q"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  {item.q}
                </button>
                <div className="landing-faq-panel">
                  <div className="landing-faq-panel-inner">
                    <p className="landing-faq-a">{item.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </main>
  );
}
