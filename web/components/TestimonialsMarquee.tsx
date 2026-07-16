"use client";

import { Reveal } from "@/components/Reveal";

const TESTIMONIALS = [
  {
    name: "Ryan",
    role: "Agence OFM",
    text: "On gère 40+ comptes IG. GramPulse nous fait gagner 2h par jour sur le reporting.",
  },
  {
    name: "Maxime",
    role: "Monétisation TikTok",
    text: "Les clics Linkscale + les vues au même endroit, c'est exactement ce qu'il nous fallait.",
  },
  {
    name: "Lucas",
    role: "Content Manager",
    text: "Le top vidéos par modèle nous aide à savoir quoi reposter chaque semaine.",
  },
  {
    name: "Alex",
    role: "Social Media Manager",
    text: "Fini les tableurs Excel. Le dashboard global est clair en 5 secondes.",
  },
  {
    name: "Sarah",
    role: "Agence créateurs",
    text: "Le suivi VA est top — on voit qui performe et sur quels comptes.",
  },
];

export function TestimonialsMarquee() {
  const items = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <section className="landing-marquee-section">
      <div className="container">
        <Reveal>
          <h2 className="landing-section-title landing-section-title-center">
            Ce que disent nos <span className="gradient-text">utilisateurs</span>
          </h2>
          <p className="landing-section-sub landing-section-sub-center">
            Des agences et créateurs qui pilotent leurs comptes Instagram avec GramPulse.
          </p>
        </Reveal>
      </div>
      <div className="landing-marquee" aria-hidden="true">
        <div className="landing-marquee-track">
          {items.map((t, i) => (
            <article key={`${t.name}-${i}`} className="card landing-marquee-card">
              <p className="landing-marquee-text">&ldquo;{t.text}&rdquo;</p>
              <div className="landing-marquee-author">
                <span className="landing-marquee-avatar">{t.name[0]}</span>
                <div>
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
