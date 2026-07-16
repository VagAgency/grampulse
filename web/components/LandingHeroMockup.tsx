"use client";

const BARS = [42, 58, 48, 72, 65, 88, 76, 94, 82, 100, 90, 96];

export function LandingHeroMockup() {
  return (
    <div className="landing-mockup-wrap animate-hero hero-delay-3">
      <div className="landing-mockup-glow" aria-hidden="true" />
      <div className="landing-mockup card">
        <div className="landing-mockup-top">
          <div className="landing-mockup-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="landing-mockup-title">Dashboard global</span>
          <span className="landing-mockup-live">Live</span>
        </div>

        <div className="landing-mockup-kpis">
          <div className="landing-mockup-kpi">
            <span>Vues 30j</span>
            <strong>2.4M</strong>
            <em className="up">+18%</em>
          </div>
          <div className="landing-mockup-kpi">
            <span>Abonnés</span>
            <strong>186K</strong>
            <em className="up">+6%</em>
          </div>
          <div className="landing-mockup-kpi">
            <span>Clics</span>
            <strong>12.8K</strong>
            <em className="up">+24%</em>
          </div>
        </div>

        <div className="landing-mockup-chart">
          <svg viewBox="0 0 320 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="mockup-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(236, 72, 153, 0.35)" />
                <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
              </linearGradient>
              <linearGradient id="mockup-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="50%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
            <path
              className="landing-mockup-area"
              d="M0,80 L29,68 L58,74 L87,52 L116,58 L145,38 L174,44 L203,28 L232,34 L261,18 L290,24 L320,12 L320,100 L0,100 Z"
              fill="url(#mockup-fill)"
            />
            <path
              className="landing-mockup-line"
              d="M0,80 L29,68 L58,74 L87,52 L116,58 L145,38 L174,44 L203,28 L232,34 L261,18 L290,24 L320,12"
              fill="none"
              stroke="url(#mockup-line)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="landing-mockup-bars" aria-hidden="true">
            {BARS.map((h, i) => (
              <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        </div>

        <div className="landing-mockup-models">
          <div className="landing-mockup-model">
            <span>🐆</span>
            <div>
              <strong>Aurélie</strong>
              <p>3 comptes · 842K vues</p>
            </div>
          </div>
          <div className="landing-mockup-model">
            <span>🔥</span>
            <div>
              <strong>Alice</strong>
              <p>2 comptes · 610K vues</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
