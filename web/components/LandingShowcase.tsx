"use client";

import { useState } from "react";

type TabId = "dashboard" | "model" | "team" | "leaderboard";

const TABS: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard global" },
  { id: "model", label: "Vue modèle" },
  { id: "team", label: "Équipe & VAs" },
  { id: "leaderboard", label: "Top vidéos" },
];

export function LandingShowcase() {
  const [tab, setTab] = useState<TabId>("dashboard");

  return (
    <div className="landing-showcase animate-hero hero-delay-4">
      <div className="landing-showcase-glow" aria-hidden="true" />
      <div className="landing-showcase-window card">
        <div className="landing-showcase-chrome">
          <div className="landing-mockup-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="landing-showcase-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`landing-showcase-tab${tab === t.id ? " active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="landing-mockup-live">Live</span>
        </div>

        <div className="landing-showcase-body" role="tabpanel">
          {tab === "dashboard" && <DashboardPanel />}
          {tab === "model" && <ModelPanel />}
          {tab === "team" && <TeamPanel />}
          {tab === "leaderboard" && <LeaderboardPanel />}
        </div>
      </div>
    </div>
  );
}

function DashboardPanel() {
  return (
    <div className="showcase-panel">
      <div className="showcase-kpis">
        <div><span>Modèles</span><strong>4</strong></div>
        <div><span>Comptes</span><strong>8</strong></div>
        <div><span>Vues 30j</span><strong className="gradient-text">2.4M</strong></div>
        <div><span>Clics</span><strong className="gradient-text">12.8K</strong></div>
      </div>
      <div className="showcase-chart">
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="sc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(236,72,153,0.3)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0)" />
            </linearGradient>
            <linearGradient id="sc-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>
          <path d="M0,75 L40,62 L80,68 L120,48 L160,55 L200,35 L240,42 L280,28 L320,32 L360,18 L400,22 L400,100 L0,100 Z" fill="url(#sc-fill)" />
          <path d="M0,75 L40,62 L80,68 L120,48 L160,55 L200,35 L240,42 L280,28 L320,32 L360,18 L400,22" fill="none" stroke="url(#sc-line)" strokeWidth="2.5" />
        </svg>
        <div className="showcase-legend">
          <span><i style={{ background: "#8b5cf6" }} /> Aurélie</span>
          <span><i style={{ background: "#ec4899" }} /> Alice</span>
          <span><i style={{ background: "#f97316" }} /> Lola</span>
        </div>
      </div>
    </div>
  );
}

function ModelPanel() {
  return (
    <div className="showcase-panel">
      <div className="showcase-model-head">
        <span className="showcase-emoji">🔥</span>
        <div>
          <strong>Alice</strong>
          <p>2 comptes · Actif</p>
        </div>
      </div>
      <div className="showcase-table">
        <div className="showcase-table-row head">
          <span>Compte</span><span>Vues 7j</span><span>Δ</span><span>Statut</span>
        </div>
        {[
          ["alice.la.rousse", "184K", "+12%", "actif"],
          ["alice.ton.bebe", "96K", "+4%", "attention"],
        ].map(([handle, views, delta, status]) => (
          <div key={handle} className="showcase-table-row">
            <span>@{handle}</span>
            <span>{views}</span>
            <span className="up">{delta}</span>
            <span className={`pill pill-${status}`}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamPanel() {
  return (
    <div className="showcase-panel">
      <div className="showcase-team-list">
        {[
          { name: "Alexandra 🇷🇺", score: "94", accounts: 4, trend: "+18%" },
          { name: "Callie 🐤", score: "87", accounts: 3, trend: "+9%" },
        ].map((va) => (
          <div key={va.name} className="showcase-team-row">
            <span className="showcase-team-rank">{va.score}</span>
            <div>
              <strong>{va.name}</strong>
              <p>{va.accounts} comptes assignés</p>
            </div>
            <span className="up">{va.trend}</span>
          </div>
        ))}
      </div>
      <p className="showcase-hint">Classe tes VAs par performance sur la période choisie.</p>
    </div>
  );
}

function LeaderboardPanel() {
  return (
    <div className="showcase-panel">
      <div className="showcase-lb">
        {[
          { rank: 1, caption: "Reel du lundi 🔥", views: "842K", conv: "3.2%" },
          { rank: 2, caption: "Story promo", views: "610K", conv: "2.8%" },
          { rank: 3, caption: "Nouveau post", views: "445K", conv: "2.1%" },
        ].map((v) => (
          <div key={v.rank} className="showcase-lb-row">
            <span className="showcase-lb-rank">#{v.rank}</span>
            <div className="showcase-lb-thumb" />
            <div className="showcase-lb-meta">
              <strong>{v.caption}</strong>
              <p>{v.views} vues · {v.conv} conv.</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
