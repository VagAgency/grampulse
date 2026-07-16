"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useOnGlobalRefresh } from "@/hooks/useOnGlobalRefresh";
import {
  TeamSuivi,
  fetchTeamSuivi,
  formatLocalDate,
  getStoredEmail,
} from "@/lib/api";

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return formatLocalDate(d);
}

export default function SuiviPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<TeamSuivi | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (userEmail: string, date: string) => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchTeamSuivi(userEmail, date));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredEmail();
    if (!stored) {
      router.replace("/login");
      return;
    }
    setEmail(stored);
    load(stored, selectedDate);
  }, [router, load, selectedDate]);

  useOnGlobalRefresh(useCallback(() => {
    if (email) void load(email, selectedDate);
  }, [email, selectedDate, load]));

  function shiftDay(offset: number) {
    if (!data) return;
    setSelectedDate(offset < 0 ? data.prev_date : data.next_date);
  }

  const formattedDate = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <main className="dashboard">
      <div className="container">
        <AppHeader email={email} active="suivi" />

        <section className="dashboard-main">
          <h1 style={{ margin: "0 0 4px" }}>Suivi</h1>
          <p className="hint" style={{ marginBottom: 24 }}>
            Publications du jour par VA — reels, posts et stories (stories via API bientôt).
          </p>

          {error && <p className="status err">{error}</p>}

          <div className="suivi-date-bar card" style={{ padding: 16, marginBottom: 20 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftDay(-1)} disabled={!data}>
              ← Jour préc.
            </button>
            <div className="suivi-date-center">
              <input
                type="date"
                className="suivi-date-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <p className="hint" style={{ margin: "6px 0 0", textTransform: "capitalize" }}>
                {formattedDate}
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => shiftDay(1)} disabled={!data}>
              Jour suiv. →
            </button>
          </div>

          {loading ? (
            <p className="hint">Chargement…</p>
          ) : data ? (
            <>
              {data.notes && <p className="hint" style={{ marginBottom: 16 }}>{data.notes}</p>}

              {data.vas.length === 0 && data.unassigned_accounts.length === 0 ? (
                <div className="card empty-state">
                  <p>Aucune publication détectée ce jour-là.</p>
                </div>
              ) : (
                <div className="suivi-grid">
                  {data.vas.map((block) => (
                    <article key={block.va_id} className="card suivi-va-card">
                      <div className="suivi-va-head">
                        <h2 style={{ margin: 0 }}>
                          {block.va_emoji ? `${block.va_emoji} ` : ""}{block.va_name}
                        </h2>
                        <div className="suivi-totals">
                          <span className="suivi-pill reels">{block.totals.reels} reels</span>
                          <span className="suivi-pill posts">{block.totals.posts} posts</span>
                          <span className="suivi-pill stories">{block.totals.stories} stories</span>
                          <strong>{block.totals.total} total</strong>
                        </div>
                      </div>
                      <table className="suivi-table">
                        <thead>
                          <tr>
                            <th>Compte</th>
                            <th>Modèle</th>
                            <th>Reels</th>
                            <th>Posts</th>
                            <th>Stories</th>
                          </tr>
                        </thead>
                        <tbody>
                          {block.accounts.map((acc) => (
                            <tr key={acc.account_id}>
                              <td>@{acc.handle}</td>
                              <td className="hint">{acc.model_name || "—"}</td>
                              <td>{acc.reels}</td>
                              <td>{acc.posts}</td>
                              <td>{acc.stories}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </article>
                  ))}

                  {data.unassigned_accounts.length > 0 && (
                    <article className="card suivi-va-card suivi-unassigned">
                      <h2 style={{ margin: "0 0 12px" }}>Sans VA assigné</h2>
                      <table className="suivi-table">
                        <thead>
                          <tr>
                            <th>Compte</th>
                            <th>Modèle</th>
                            <th>Reels</th>
                            <th>Posts</th>
                            <th>Stories</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.unassigned_accounts.map((acc) => (
                            <tr key={acc.account_id}>
                              <td>@{acc.handle}</td>
                              <td className="hint">{acc.model_name || "—"}</td>
                              <td>{acc.reels}</td>
                              <td>{acc.posts}</td>
                              <td>{acc.stories}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </article>
                  )}
                </div>
              )}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
