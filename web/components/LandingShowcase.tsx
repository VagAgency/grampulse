"use client";

import { useState } from "react";
import { LANDING_ACCOUNT_COUNT, LANDING_MODELS, LANDING_VAS } from "@/lib/landingDemo";

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
        <div><span>Modèles</span><strong>{LANDING_MODELS.length}</strong></div>
        <div><span>Comptes</span><strong>{LANDING_ACCOUNT_COUNT}</strong></div>
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
          {LANDING_MODELS.map((model, i) => {
            const colors = ["#8b5cf6", "#ec4899", "#f97316", "#22d3ee"];
            return (
              <span key={model.name}>
                <i style={{ background: colors[i % colors.length] }} /> {model.name}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ModelPanel() {
  const model = LANDING_MODELS.find((m) => m.name === "Alice") ?? LANDING_MODELS[2];
  const rows: [string, string, string, string][] = model.handles.map((handle, i) => [
    handle,
    i === 0 ? "184K" : "96K",
    i === 0 ? "+12%" : "+4%",
    i === 0 ? "actif" : "meilleur",
  ]);

  return (
    <div className="showcase-panel">
      <div className="showcase-model-head">
        <span className="showcase-emoji">{model.emoji}</span>
        <div>
          <strong>{model.name}</strong>
          <p>{model.handles.length} comptes · Actif</p>
        </div>
      </div>
      <div className="showcase-table">
        <div className="showcase-table-row head">
          <span>Compte</span><span>Vues 7j</span><span>Δ</span><span>Statut</span>
        </div>
        {rows.map(([handle, views, delta, status]) => (
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
        {LANDING_VAS.map((va) => (
          <div key={va.name} className="showcase-team-row">
            <span className="showcase-team-rank">{va.name === LANDING_VAS[0].name ? "94" : "87"}</span>
            <div>
              <strong>{va.name}</strong>
              <p>{va.accounts} comptes · @{va.handles[0]}…</p>
            </div>
            <span className="up">{va.name === LANDING_VAS[0].name ? "+18%" : "+9%"}</span>
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
          { rank: 1, handle: "alice.la.rousse", views: "842K", conv: "3.2%" },
          { rank: 2, handle: "lola.hotesse", views: "610K", conv: "2.8%" },
          { rank: 3, handle: "anais.volt", views: "445K", conv: "2.1%" },
        ].map((v) => (
          <div key={v.rank} className="showcase-lb-row">
            <span className="showcase-lb-rank">#{v.rank}</span>
            <div className="showcase-lb-thumb" />
            <div className="showcase-lb-meta">
              <strong>@{v.handle}</strong>
              <p>{v.views} vues · {v.conv} conv.</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
