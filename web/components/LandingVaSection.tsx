"use client";

import { useState } from "react";

type VaView = "suivi" | "ranking";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const ACTIVITY = [3, 5, 4, 7, 6, 2, 4];

export function LandingVaSection() {
  const [view, setView] = useState<VaView>("suivi");
  const [selectedDay, setSelectedDay] = useState(3);

  return (
    <section id="equipe-va" className="landing-section container landing-va-section">
      <div className="landing-va-copy">
        <p className="landing-eyebrow">Gestion d&apos;équipe</p>
        <h2 className="landing-section-title">
          Suis ce que font tes <span className="gradient-text">VAs</span>
        </h2>
        <p className="landing-section-sub">
          Assigne chaque compte à un assistant virtuel, puis vois <strong>qui a posté quoi et quand</strong> —
          reels, posts, stories — avec un classement par performance sur la période.
        </p>
        <ul className="landing-va-benefits">
          <li>
            <span className="landing-va-benefit-icon">📅</span>
            <div>
              <strong>Suivi journalier</strong>
              <p>Publications du jour par VA et par compte — fini les « tu as posté ? » sur WhatsApp.</p>
            </div>
          </li>
          <li>
            <span className="landing-va-benefit-icon">◎</span>
            <div>
              <strong>Rang équipe</strong>
              <p>Classement auto selon vues, engagement et volume de publication sur 7 à 90 jours.</p>
            </div>
          </li>
          <li>
            <span className="landing-va-benefit-icon">🔗</span>
            <div>
              <strong>Assignation par compte</strong>
              <p>Chaque @handle est rattaché à un VA depuis la page modèle — visibilité totale sur l&apos;équipe.</p>
            </div>
          </li>
        </ul>
      </div>

      <div className="landing-va-demo card">
        <div className="landing-va-demo-head">
          <div className="landing-va-view-toggle">
            <button
              type="button"
              className={view === "suivi" ? "active" : ""}
              onClick={() => setView("suivi")}
            >
              Suivi du jour
            </button>
            <button
              type="button"
              className={view === "ranking" ? "active" : ""}
              onClick={() => setView("ranking")}
            >
              Rang équipe
            </button>
          </div>
          {view === "suivi" && (
            <span className="landing-va-date-pill">Jeudi 16 juillet</span>
          )}
          {view === "ranking" && (
            <span className="landing-va-date-pill">30 derniers jours</span>
          )}
        </div>

        {view === "suivi" ? (
          <div className="landing-va-suivi">
            <div className="landing-va-week" role="tablist" aria-label="Jours de la semaine">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={selectedDay === i}
                  className={`landing-va-day${selectedDay === i ? " active" : ""}`}
                  onClick={() => setSelectedDay(i)}
                >
                  <span>{day}</span>
                  <strong>{ACTIVITY[i]}</strong>
                  <em>posts</em>
                </button>
              ))}
            </div>

            <article className="landing-va-va-card">
              <div className="landing-va-va-head">
                <h3>🇷🇺 Alexandra</h3>
                <div className="landing-va-pills">
                  <span className="suivi-pill reels">4 reels</span>
                  <span className="suivi-pill posts">2 posts</span>
                  <span className="suivi-pill stories">1 story</span>
                </div>
              </div>
              <table className="landing-va-table">
                <thead>
                  <tr>
                    <th>Compte</th>
                    <th>Modèle</th>
                    <th>Reels</th>
                    <th>Posts</th>
                    <th>Heure</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>@alice.la.rousse</td>
                    <td>🔥 Alice</td>
                    <td>2</td>
                    <td>1</td>
                    <td className="landing-va-time">09:14</td>
                  </tr>
                  <tr>
                    <td>@anais.volt</td>
                    <td>💎 Anais</td>
                    <td>2</td>
                    <td>1</td>
                    <td className="landing-va-time">14:32</td>
                  </tr>
                </tbody>
              </table>
            </article>

            <article className="landing-va-va-card">
              <div className="landing-va-va-head">
                <h3>🐤 Callie</h3>
                <div className="landing-va-pills">
                  <span className="suivi-pill reels">2 reels</span>
                  <span className="suivi-pill posts">1 post</span>
                </div>
              </div>
              <table className="landing-va-table">
                <thead>
                  <tr>
                    <th>Compte</th>
                    <th>Modèle</th>
                    <th>Reels</th>
                    <th>Posts</th>
                    <th>Heure</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>@lola.hotesse</td>
                    <td>🦋 Lola</td>
                    <td>2</td>
                    <td>1</td>
                    <td className="landing-va-time">11:08</td>
                  </tr>
                </tbody>
              </table>
            </article>
          </div>
        ) : (
          <div className="landing-va-ranking">
            <table className="landing-va-rank-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>VA</th>
                  <th>Comptes</th>
                  <th>Vues 30j</th>
                  <th>Reels</th>
                  <th>Engagement</th>
                </tr>
              </thead>
              <tbody>
                <tr className="landing-va-rank-top">
                  <td><span className="landing-va-rank-badge">1</span></td>
                  <td>🇷🇺 Alexandra</td>
                  <td>4</td>
                  <td className="up">842K</td>
                  <td>38</td>
                  <td><span className="landing-va-score">94</span></td>
                </tr>
                <tr>
                  <td><span className="landing-va-rank-badge">2</span></td>
                  <td>🐤 Callie</td>
                  <td>3</td>
                  <td className="up">610K</td>
                  <td>27</td>
                  <td><span className="landing-va-score">87</span></td>
                </tr>
                <tr>
                  <td><span className="landing-va-rank-badge dim">3</span></td>
                  <td>✨ Nouveau VA</td>
                  <td>1</td>
                  <td>124K</td>
                  <td>8</td>
                  <td><span className="landing-va-score dim">72</span></td>
                </tr>
              </tbody>
            </table>
            <p className="landing-va-rank-note">
              Score calculé sur vues, volume de publication et engagement des comptes assignés.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
