"use client";

import { useState } from "react";
import { LANDING_VAS, modelForHandle } from "@/lib/landingDemo";

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

            {LANDING_VAS.map((va, vaIndex) => (
              <article key={va.name} className="landing-va-va-card">
                <div className="landing-va-va-head">
                  <h3>{va.name}</h3>
                  <div className="landing-va-pills">
                    <span className="suivi-pill reels">{vaIndex === 0 ? "4" : "3"} reels</span>
                    <span className="suivi-pill posts">{vaIndex === 0 ? "2" : "2"} posts</span>
                    {vaIndex === 0 ? <span className="suivi-pill stories">1 story</span> : null}
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
                    {va.handles.map((handle, i) => {
                      const model = modelForHandle(handle);
                      const times = ["09:14", "14:32", "11:08", "16:45"];
                      return (
                        <tr key={handle}>
                          <td>@{handle}</td>
                          <td>{model ? `${model.emoji} ${model.name}` : "—"}</td>
                          <td>{i % 2 === 0 ? 2 : 1}</td>
                          <td>{i === 0 ? 1 : 0}</td>
                          <td className="landing-va-time">{times[i] ?? "12:00"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </article>
            ))}
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
                  <td>{LANDING_VAS[0].name}</td>
                  <td>{LANDING_VAS[0].accounts}</td>
                  <td className="up">842K</td>
                  <td>38</td>
                  <td><span className="landing-va-score">94</span></td>
                </tr>
                <tr>
                  <td><span className="landing-va-rank-badge">2</span></td>
                  <td>{LANDING_VAS[1].name}</td>
                  <td>{LANDING_VAS[1].accounts}</td>
                  <td className="up">610K</td>
                  <td>27</td>
                  <td><span className="landing-va-score">87</span></td>
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
