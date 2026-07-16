"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { LandingBackground } from "@/components/LandingBackground";
import { LandingFooter } from "@/components/LandingFooter";
import { LandingShowcase } from "@/components/LandingShowcase";
import { LandingHeroMockup } from "@/components/LandingHeroMockup";
import { LandingVaSection } from "@/components/LandingVaSection";
import { Reveal } from "@/components/Reveal";
import { TestimonialsMarquee } from "@/components/TestimonialsMarquee";
import { createCheckout } from "@/lib/auth";

const WHY = [
  {
    icon: "↗",
    title: "Dashboard global multi-modèles",
    desc: "Vues, abonnés et clics agrégés sur 7 à 90 jours. Chaque modèle sur la même courbe.",
  },
  {
    icon: "◎",
    title: "Suivi VA & rang équipe",
    desc: "Assigne des VAs à tes comptes et classe-les par performance sur la période.",
  },
  {
    icon: "▶",
    title: "Top vidéos & conversion",
    desc: "Leaderboard des meilleurs Reels — tri par vues ou par taux de conversion Linkscale.",
  },
  {
    icon: "⟁",
    title: "Linkscale intégré",
    desc: "Un lien par compte, sync des clics en un clic. Vues + clics au même endroit.",
  },
];

const TOOLKIT = [
  {
    title: "Dashboard global",
    desc: "Vue d'ensemble de tous tes modèles avec courbes interactives et légende cliquable.",
    bullets: ["Courbes vues / abonnés / clics", "Période 7 à 90 jours", "KPIs en temps réel"],
  },
  {
    title: "Vue par modèle",
    desc: "Détaille chaque modèle : comptes, statuts, historique et refresh ciblé.",
    bullets: ["Statut actif / attention / inactif", "Δ vues sur la période", "Top Reels du modèle"],
  },
  {
    title: "Tracking Linkscale",
    desc: "Assigne un lien Linkscale par compte et synchronise les clics depuis ton dashboard.",
    bullets: ["Lien par compte IG", "Sync en un clic", "Courbe clics sur 90j"],
  },
  {
    title: "Rang équipe",
    desc: "Classe tes VAs par score de performance et vois leurs comptes assignés.",
    bullets: ["Score agrégé par VA", "Comptes assignés", "Historique d'activité"],
  },
  {
    title: "Suivi journalier",
    desc: "Combien de Reels, posts et stories publiés par VA et par compte chaque jour.",
    bullets: ["Vue par date", "Reels / posts / stories", "Filtrage par VA"],
  },
  {
    title: "Leaderboard vidéos",
    desc: "Les meilleurs contenus sur la période — performance ou conversion.",
    bullets: ["Tri vues ou conversion", "Aperçu + lien direct", "Par modèle ou global"],
  },
];

const STEPS = [
  {
    n: "1",
    icon: "＋",
    title: "Ajoute tes comptes",
    desc: "Crée un modèle, entre les @handles publics. Pas de connexion Meta.",
    bullets: ["Jusqu'à 20 comptes / modèle", "Modèles illimités", "Import rapide"],
  },
  {
    n: "2",
    icon: "⟳",
    title: "Refresh",
    desc: "Synchronise Instagram + Linkscale en un clic depuis le header.",
    bullets: ["Refresh global ou par modèle", "Données HikerAPI", "Clics Linkscale"],
  },
  {
    n: "3",
    icon: "◆",
    title: "Analyse & scale",
    desc: "Vues, top vidéos, rang équipe — prends les bonnes décisions.",
    bullets: ["Dashboard + détail compte", "Top Reels", "Export mental → action"],
  },
];

const FAQ = [
  { q: "Faut-il connecter un compte Instagram ?", a: "Non. GramPulse analyse les comptes publics — tu entres juste le @handle." },
  { q: "Combien de comptes puis-je suivre ?", a: "Jusqu'à 20 comptes par modèle. Ajoute autant de modèles que tu veux." },
  { q: "Les clics Linkscale sont-ils inclus ?", a: "Oui. Assigne un lien par compte et synchronise depuis le dashboard." },
  { q: "Puis-je annuler ?", a: "Oui, à tout moment depuis ton espace membre Whop." },
  { q: "Mes données sont-elles sécurisées ?", a: "Oui. Chaque compte est isolé par email. Paiement sécurisé via Whop." },
];

const WITHOUT = [
  { label: "Suivi des vues", value: "Tableur Excel", bad: true },
  { label: "Clics Linkscale", value: "Dashboard séparé", bad: true },
  { label: "Top vidéos", value: "Scroll manuel IG", bad: true },
  { label: "Suivi VA", value: "Messages WhatsApp", bad: true },
  { label: "Historique", value: "Perdu chaque mois", bad: true },
];

const WITH = [
  { label: "Suivi des vues", value: "Courbes 90 jours", good: true },
  { label: "Clics Linkscale", value: "Sync intégrée", good: true },
  { label: "Top vidéos", value: "Leaderboard auto", good: true },
  { label: "Suivi VA", value: "Rang équipe live", good: true },
  { label: "Historique", value: "Snapshots quotidiens", good: true },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [toolkitOpen, setToolkitOpen] = useState(0);

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
      <LandingBackground />

      <header className="landing-nav">
        <div className="landing-nav-pill">
          <BrandLogo href="/" size={32} />
          <nav className="landing-nav-links">
            <a href="#features">Fonctionnalités</a>
            <a href="#equipe-va">Équipe & VAs</a>
            <a href="#how">Comment ça marche</a>
            <a href="#pricing">Tarifs</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="landing-nav-actions">
            <Link href="/login" className="btn btn-ghost btn-sm">Connexion</Link>
            <a href="#pricing" className="btn btn-primary btn-sm">S&apos;abonner</a>
          </div>
        </div>
      </header>

      <section className="landing-hero container">
        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-badge animate-hero">
              <span className="landing-badge-dot" />
              Analytics Instagram — agences & créateurs
            </span>
            <h1 className="landing-title animate-hero hero-delay-1">
              Pilote tous tes comptes Instagram en{" "}
              <span className="gradient-text">un seul dashboard</span>
            </h1>
            <p className="landing-subtitle animate-hero hero-delay-2">
              Vues, abonnés, clics Linkscale, top vidéos et suivi d&apos;équipe —
              sans connexion Meta.
            </p>
            <div className="landing-hero-cta animate-hero hero-delay-3">
              <a href="#pricing" className="btn btn-primary btn-lg">Commencer maintenant</a>
              <Link href="/login" className="btn btn-ghost btn-lg">J&apos;ai déjà un compte</Link>
            </div>
            <div className="landing-hero-stats animate-hero hero-delay-4">
              <div>
                <strong>20</strong>
                <span>comptes / modèle</span>
              </div>
              <div>
                <strong>90j</strong>
                <span>d&apos;historique</span>
              </div>
              <div>
                <strong>Linkscale</strong>
                <span>clics intégrés</span>
              </div>
            </div>
          </div>
          <LandingHeroMockup />
        </div>
      </section>

      {/* Showcase interactif */}
      <section id="showcase" className="landing-showcase-section container">
        <LandingShowcase />
      </section>

      <TestimonialsMarquee />

      {/* Pourquoi GramPulse */}
      <section id="features" className="landing-section container">
        <Reveal>
          <p className="landing-eyebrow">Fonctionnalités</p>
          <h2 className="landing-section-title landing-section-title-center">
            Pourquoi choisir <span className="gradient-text">GramPulse</span>
          </h2>
        </Reveal>
        <div className="landing-why-grid">
          {WHY.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <article className="card landing-why-card card-interactive">
                <span className="landing-why-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <LandingVaSection />

      {/* Comparaison avant/après */}
      <section className="landing-section container">
        <Reveal>
          <h2 className="landing-section-title landing-section-title-center">
            Pourquoi un <span className="gradient-text">dashboard dédié</span>
          </h2>
          <p className="landing-section-sub landing-section-sub-center">
            Les tableurs et les allers-retours entre outils te font perdre du temps et de la visibilité.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="landing-compare">
            <div className="card landing-compare-col landing-compare-bad">
              <h4><span className="compare-icon bad">⚠</span> Sans GramPulse</h4>
              <ul>
                {WITHOUT.map((row) => (
                  <li key={row.label}>
                    <span>{row.label}</span>
                    <em className="bad">{row.value}</em>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card landing-compare-col landing-compare-good">
              <h4><span className="compare-icon good">✓</span> Avec GramPulse</h4>
              <ul>
                {WITH.map((row) => (
                  <li key={row.label}>
                    <span>{row.label}</span>
                    <em className="good">{row.value}</em>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="landing-compare-note">
            GramPulse centralise vues, clics, top vidéos et suivi VA — un seul outil pour scaler tes comptes.
          </p>
        </Reveal>
      </section>

      {/* Boîte à outils interactive */}
      <section className="landing-section container">
        <Reveal>
          <p className="landing-eyebrow">Boîte à outils</p>
          <h2 className="landing-section-title landing-section-title-center">
            Tout ce qu&apos;il faut pour <span className="gradient-text">analyser</span>
          </h2>
        </Reveal>
        <div className="landing-toolkit">
          <div className="landing-toolkit-nav">
            {TOOLKIT.map((t, i) => (
              <button
                key={t.title}
                type="button"
                className={`landing-toolkit-btn${toolkitOpen === i ? " active" : ""}`}
                onClick={() => setToolkitOpen(i)}
              >
                {t.title}
              </button>
            ))}
          </div>
          <Reveal delay={60}>
            <article className="card landing-toolkit-panel card-interactive">
              <h3>{TOOLKIT[toolkitOpen].title}</h3>
              <p>{TOOLKIT[toolkitOpen].desc}</p>
              <ul>
                {TOOLKIT[toolkitOpen].bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="how" className="landing-section container">
        <Reveal>
          <p className="landing-eyebrow landing-eyebrow-center">Comment ça marche</p>
          <h2 className="landing-section-title landing-section-title-center">
            Analyse tes comptes <span className="gradient-text">sans limites</span>
          </h2>
          <p className="landing-section-sub landing-section-sub-center">
            De l&apos;ajout du @handle au dashboard complet en quelques minutes.
          </p>
        </Reveal>

        <div className="landing-problem-solution">
          <Reveal delay={60}>
            <div className="card landing-ps-card landing-ps-problem">
              <h3><span>⚠</span> Le problème</h3>
              <p>
                Gérer 10, 20, 50 comptes IG à la main = tableurs, screenshots, données éparpillées.
                Tu perds la visibilité sur ce qui performe vraiment.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="card landing-ps-card landing-ps-solution">
              <h3><span>✓</span> La solution</h3>
              <p>
                GramPulse centralise vues, abonnés, clics et top vidéos par modèle.
                Un refresh et tu as tout — sans connexion Meta.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <div className="landing-result-banner">
            Résultat : <strong className="accent-a">10x moins de temps</strong> sur le reporting ={" "}
            <strong className="accent-b">10x plus de focus</strong> sur le contenu.
          </div>
        </Reveal>

        <div className="landing-steps landing-steps-numbered">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 90}>
              <div className="card landing-step landing-step-rich card-interactive">
                <span className="landing-step-badge">{step.n}</span>
                <span className="landing-step-icon">{step.icon}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                <ul>
                  {step.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="landing-section container">
        <Reveal>
          <p className="landing-eyebrow landing-eyebrow-center">Tarifs</p>
          <h2 className="landing-section-title landing-section-title-center">Tarif simple</h2>
          <p className="landing-section-sub landing-section-sub-center">
            Un seul plan avec toutes les fonctionnalités. Résiliable à tout moment.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <div className="card landing-pricing-card card-interactive">
            <div className="landing-pricing-glow" aria-hidden="true" />
            <p className="landing-pricing-label">GramPulse Pro</p>
            <p className="landing-price">99 <span>€/mois</span></p>
            <ul className="landing-pricing-list">
              <li>Dashboard global multi-modèles</li>
              <li>Refresh Instagram + Linkscale</li>
              <li>Rang équipe & suivi VA</li>
              <li>Top vidéos & analytics avancés</li>
              <li>Support par email</li>
            </ul>
            <input type="email" placeholder="ton@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <p className="status err">{error}</p>}
            <button type="button" className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={loading} onClick={() => void subscribe()}>
              {loading ? "Redirection…" : "Commencer"}
            </button>
            <div className="landing-pricing-badges">
              <span>Résiliable à tout moment</span>
              <span>Accès immédiat</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section id="faq" className="landing-section container">
        <Reveal>
          <h2 className="landing-section-title landing-section-title-center">Questions fréquentes</h2>
        </Reveal>
        <div className="landing-faq">
          {FAQ.map((item, i) => (
            <Reveal key={item.q} delay={i * 60}>
              <div className={`card landing-faq-item${openFaq === i ? " is-open" : ""}`}>
                <button type="button" className="landing-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
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

      {/* Partenaire Linkscale */}
      <section className="landing-section container">
        <Reveal>
          <h2 className="landing-section-title landing-section-title-center">Nos partenaires</h2>
        </Reveal>
        <Reveal delay={80}>
          <a href="https://linkscale.to" target="_blank" rel="noreferrer" className="card landing-partner card-interactive">
            <h3>LinkScale.to</h3>
            <ul>
              <li>📊 Analytics & tracking de liens pour créateurs</li>
              <li>🔗 Assigne un lien par compte IG dans GramPulse</li>
              <li>⚡ Sync des clics en un clic depuis ton dashboard</li>
            </ul>
            <span className="landing-partner-cta">Découvrir Linkscale →</span>
          </a>
        </Reveal>
      </section>

      {/* CTA final */}
      <section className="landing-cta-final container">
        <Reveal>
          <div className="card landing-cta-final-card">
            <h2>Prêt à commencer ?</h2>
            <p>Pilote tous tes comptes Instagram depuis un seul endroit. Sans tableur, sans prise de tête.</p>
            <a href="#pricing" className="btn btn-primary btn-lg">Commencer — 99 €/mois</a>
          </div>
        </Reveal>
      </section>

      <LandingFooter />
    </main>
  );
}
