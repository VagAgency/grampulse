"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AppPageHeader } from "@/components/AppPageHeader";
import { useOnGlobalRefresh } from "@/hooks/useOnGlobalRefresh";
import { PeriodBar } from "@/components/PeriodBar";
import {
  TeamRanking,
  VaMember,
  createVa,
  deleteVa,
  fetchTeamRanking,
  fetchVas,
  formatNumber,
  formatPercent,
  formatPeriodLabel,
  getStoredEmail,
} from "@/lib/api";

export default function EquipePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<TeamRanking | null>(null);
  const [vas, setVas] = useState<VaMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartDays, setChartDays] = useState(30);
  const [newVaName, setNewVaName] = useState("");
  const [newVaEmoji, setNewVaEmoji] = useState("✨");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (userEmail: string) => {
    setLoading(true);
    setError("");
    try {
      const [ranking, vaList] = await Promise.all([
        fetchTeamRanking(userEmail, chartDays),
        fetchVas(userEmail),
      ]);
      setData(ranking);
      setVas(vaList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [chartDays]);

  useEffect(() => {
    const stored = getStoredEmail();
    if (!stored) {
      router.replace("/login");
      return;
    }
    setEmail(stored);
    load(stored);
  }, [router, load]);

  useOnGlobalRefresh(useCallback(() => {
    if (email) void load(email);
  }, [email, load]));

  async function onCreateVa(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !newVaName.trim()) return;
    setCreating(true);
    setError("");
    try {
      await createVa(email, newVaName.trim(), newVaEmoji);
      setNewVaName("");
      await load(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteVa(vaId: number, name: string) {
    if (!email) return;
    if (!confirm(`Supprimer le VA « ${name} » ? Les comptes seront désassignés.`)) return;
    setError("");
    try {
      await deleteVa(email, vaId);
      await load(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <AppShell email={email} active="equipe">
          <AppPageHeader
            eyebrow="Gestion d'équipe"
            title={<>Rang <span className="gradient-text">équipe</span></>}
            subtitle="Classement des VA selon les performances de leurs comptes attitrés."
          />

          {error && <p className="status err">{error}</p>}

          <div className="card team-manage-card chart-card" style={{ marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "1.05rem" }}>Assistants virtuels</h2>
            <form className="team-va-form" onSubmit={onCreateVa}>
              <input
                type="text"
                className="model-emoji-input"
                value={newVaEmoji}
                onChange={(e) => setNewVaEmoji(e.target.value)}
                maxLength={4}
                aria-label="Émoji VA"
              />
              <input
                type="text"
                className="model-create-name-input"
                placeholder="Nom du VA (ex : Marie)"
                value={newVaName}
                onChange={(e) => setNewVaName(e.target.value)}
                maxLength={60}
              />
              <button type="submit" className="btn btn-primary" disabled={creating || !newVaName.trim()}>
                {creating ? "…" : "+ VA"}
              </button>
            </form>
            {vas.length > 0 && (
              <div className="va-chip-list">
                {vas.map((va) => (
                  <span key={va.id} className="va-chip">
                    {va.emoji ? `${va.emoji} ` : ""}{va.name}
                    <span className="hint"> · {va.accounts_count || 0} compte{(va.accounts_count || 0) > 1 ? "s" : ""}</span>
                    <button
                      type="button"
                      className="va-chip-remove"
                      title={`Supprimer ${va.name}`}
                      onClick={() => onDeleteVa(va.id, va.name)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <p className="hint">Chargement…</p>
          ) : data ? (
            <>
              <PeriodBar days={chartDays} onChangeDays={setChartDays} />

              {data.unassigned_accounts > 0 && (
                <p className="hint team-warning">
                  {data.unassigned_accounts} compte{data.unassigned_accounts > 1 ? "s" : ""} sans VA assigné — attribue-les depuis la page modèle.
                </p>
              )}

              <div className="card" style={{ padding: 0 }}>
                <table className="team-ranking-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>VA</th>
                      <th>Comptes</th>
                      <th>Vues ({chartDays}j)</th>
                      <th>Reels</th>
                      <th>Posts</th>
                      <th>Publi.</th>
                      <th>Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ranking.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="table-empty">
                          Aucun VA avec comptes assignés. Crée un VA et assigne-le depuis un modèle.
                        </td>
                      </tr>
                    ) : (
                      data.ranking.map((row) => (
                        <tr key={row.va_id}>
                          <td className="lb-rank">{row.rank}</td>
                          <td>
                            <strong>
                              {row.va_emoji ? `${row.va_emoji} ` : ""}{row.va_name}
                            </strong>
                          </td>
                          <td>{row.accounts_count}</td>
                          <td><strong>{formatNumber(row.views)}</strong></td>
                          <td>{row.reels}</td>
                          <td>{row.posts}</td>
                          <td>{row.publications}</td>
                          <td>{formatPercent(row.avg_engagement)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {data.ranking.length > 0 && (
                <div className="team-detail-grid">
                  {data.ranking.map((row) => (
                    <article key={`detail-${row.va_id}`} className="card team-va-card">
                      <h3 style={{ margin: "0 0 10px" }}>
                        #{row.rank} {row.va_emoji ? `${row.va_emoji} ` : ""}{row.va_name}
                      </h3>
                      <p className="hint" style={{ margin: "0 0 12px" }}>
                        {formatPeriodLabel(chartDays)} · {row.accounts_count} comptes · {formatNumber(row.views)} vues
                      </p>
                      <ul className="team-account-list">
                        {row.accounts.map((acc) => (
                          <li key={acc.handle}>
                            <span>@{acc.handle}</span>
                            <span className="hint">{acc.model_name}</span>
                            <span>{formatNumber(acc.views)} vues · {acc.reels} reels</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : null}
    </AppShell>
  );
}
