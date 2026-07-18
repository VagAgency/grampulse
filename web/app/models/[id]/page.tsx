"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOnGlobalRefresh } from "@/hooks/useOnGlobalRefresh";
import { ChangeBadge } from "@/components/ChangeBadge";
import { ChartSeries, MultiViewsChart, seriesColor } from "@/components/MultiViewsChart";
import { ModelNameEditor } from "@/components/ModelNameEditor";
import { AppShell } from "@/components/AppShell";
import { AppSubHeader } from "@/components/AppSubHeader";
import { PeriodBar } from "@/components/PeriodBar";
import { StatusBadge } from "@/components/StatusBadge";
import { VideoLeaderboard } from "@/components/VideoLeaderboard";
import { LinkscaleLinkField } from "@/components/LinkscaleLinkField";
import { VaSelect } from "@/components/VaSelect";
import {
  ModelDetail,
  VaMember,
  addAccountToModel,
  assignAccountLinkscale,
  assignAccountVa,
  deleteAccount,
  deleteModel,
  fetchModel,
  fetchVas,
  fillFollowersSeriesForPeriod,
  fillClicksSeriesForPeriod,
  fillSeriesForPeriod,
  formatNumber,
  formatPercent,
  formatPeriodLabel,
  getStoredEmail,
  refreshAccount,
  sumDailyViews,
  sumDailyClicks,
  sumLatestFollowers,
  DEFAULT_CHART_DAYS,
  VideoSortMode,
} from "@/lib/api";

type ChartMode = "views" | "followers" | "clicks";
const MAX_FETCH_DAYS = 90;

export default function ModelPage() {
  const params = useParams<{ id: string }>();
  const modelId = Number(params.id);
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<ModelDetail | null>(null);
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingModel, setDeletingModel] = useState(false);
  const [deletingHandle, setDeletingHandle] = useState<string | null>(null);
  const [refreshingHandle, setRefreshingHandle] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [chartDays, setChartDays] = useState(DEFAULT_CHART_DAYS);
  const [chartMode, setChartMode] = useState<ChartMode>("views");
  const [videoMode, setVideoMode] = useState<VideoSortMode>("performance");
  const [vas, setVas] = useState<VaMember[]>([]);
  const [assigningHandle, setAssigningHandle] = useState<string | null>(null);
  const [linkscaleHandle, setLinkscaleHandle] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const stored = getStoredEmail();
    if (!stored) {
      router.replace("/login");
      return;
    }
    setEmail(stored);
    load(stored);
  }, [modelId, router]);

  const periodViews = useMemo(
    () => sumDailyViews(data?.daily_views || [], chartDays),
    [data, chartDays]
  );

  const totalFollowers = useMemo(
    () => sumLatestFollowers(data?.accounts || []),
    [data]
  );

  const accountPeriodViews = useMemo(() => {
    const map = new Map<number, number>();
    for (const acc of data?.account_series || []) {
      map.set(acc.id, sumDailyViews(acc.daily_views, chartDays));
    }
    return map;
  }, [data, chartDays]);

  const accountPeriodClicks = useMemo(() => {
    const map = new Map<number, number>();
    for (const acc of data?.account_series || []) {
      map.set(acc.id, sumDailyClicks(acc.daily_clicks, chartDays));
    }
    return map;
  }, [data, chartDays]);

  const chartSeries: ChartSeries[] = useMemo(() => {
    if (!data?.account_series) return [];
    return data.account_series.map((acc, i) => ({
      id: `${acc.id}-${chartMode}-${chartDays}`,
      label: acc.label || `@${acc.handle}`,
      color: seriesColor(i),
      data:
        chartMode === "clicks"
          ? fillClicksSeriesForPeriod(acc.daily_clicks || [], chartDays)
          : chartMode === "followers"
            ? fillFollowersSeriesForPeriod(acc.daily_followers || [], chartDays)
            : fillSeriesForPeriod(acc.daily_views, chartDays),
    }));
  }, [data, chartDays, chartMode]);

  async function load(userEmail: string) {
    setLoading(true);
    setError("");
    try {
      const [modelData, vaList] = await Promise.all([
        fetchModel(userEmail, modelId, MAX_FETCH_DAYS),
        fetchVas(userEmail),
      ]);
      setData(modelData);
      setVas(vaList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useOnGlobalRefresh(useCallback(() => {
    if (email) void load(email);
  }, [email, modelId]));

  async function onAssignVa(handleToAssign: string, vaId: number | null) {
    if (!email) return;
    setAssigningHandle(handleToAssign);
    setError("");
    try {
      await assignAccountVa(email, modelId, handleToAssign, vaId);
      await load(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setAssigningHandle(null);
    }
  }

  async function onRefresh(handleToRefresh: string) {
    if (!email) return;
    setRefreshingHandle(handleToRefresh);
    setError("");
    setNotice("");
    try {
      const result = await refreshAccount(email, modelId, handleToRefresh);
      await load(email);
      if (result.skipped && result.message) {
        setNotice(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setRefreshingHandle(null);
    }
  }

  async function onAssignLinkscale(handleToAssign: string, linkscaleUrl: string | null) {
    if (!email) return;
    setLinkscaleHandle(handleToAssign);
    setError("");
    try {
      await assignAccountLinkscale(email, modelId, handleToAssign, linkscaleUrl);
      await load(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLinkscaleHandle(null);
    }
  }

  async function onAdd(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = handle.trim().replace(/^@+/, "");
    if (!trimmed) {
      setError("Entre un @username Instagram.");
      return;
    }
    if (!email) {
      setError("Session expirée — reconnecte-toi.");
      router.replace("/login");
      return;
    }
    setAdding(true);
    setError("");
    setNotice("Ajout de @" + trimmed + " en cours…");
    try {
      const result = await addAccountToModel(email, modelId, trimmed);
      setHandle("");
      setNotice(result.message || "Compte ajouté — synchronisation en cours…");
      await load(email);
      window.setTimeout(() => {
        void load(email);
      }, 12000);
    } catch (err) {
      setNotice("");
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setAdding(false);
    }
  }

  async function onDeleteModel() {
    if (!email || !data) return;
    if (!confirm(`Supprimer « ${data.model.name} » et tous ses comptes ?`)) return;
    setDeletingModel(true);
    setError("");
    try {
      await deleteModel(email, modelId);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setDeletingModel(false);
    }
  }

  async function onDeleteAccount(handle: string) {
    if (!email) return;
    if (!confirm(`Supprimer @${handle} ?`)) return;
    setDeletingHandle(handle);
    setError("");
    try {
      await deleteAccount(email, modelId, handle);
      await load(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeletingHandle(null);
    }
  }

  return (
    <AppShell email={email} showNav={false}>
        <AppSubHeader backHref="/dashboard" backLabel="Dashboard">
          {data ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={onDeleteModel}
              disabled={deletingModel}
            >
              {deletingModel ? "Suppression…" : "Supprimer la créatrice"}
            </button>
          ) : null}
        </AppSubHeader>

        {error ? <p className="status err app-inline-error">{error}</p> : null}
        {notice ? <p className="status ok app-inline-notice">{notice}</p> : null}

        {loading ? (
          <p className="hint">Chargement…</p>
        ) : data ? (
          <>
            <ModelNameEditor
              modelId={modelId}
              name={data.model.name}
              as="h1"
              className="app-page-title"
              onUpdated={(name) =>
                setData((prev) => (prev ? { ...prev, model: { ...prev.model, name } } : prev))
              }
            />

            <PeriodBar days={chartDays} onChangeDays={setChartDays}>
              <div className="chart-mode-toggle">
                <button
                  type="button"
                  className={`chart-mode-btn${chartMode === "views" ? " active" : ""}`}
                  onClick={() => setChartMode("views")}
                >
                  Vues
                </button>
                <button
                  type="button"
                  className={`chart-mode-btn${chartMode === "followers" ? " active" : ""}`}
                  onClick={() => setChartMode("followers")}
                >
                  Abonnés
                </button>
                <button
                  type="button"
                  className={`chart-mode-btn${chartMode === "clicks" ? " active" : ""}`}
                  onClick={() => setChartMode("clicks")}
                >
                  Clics
                </button>
              </div>
            </PeriodBar>

            <div className="kpi-grid model-kpi-grid" style={{ marginBottom: 20 }}>
              <div className="card kpi-card">
                <span className="hint">Comptes IG</span>
                <strong className="kpi-value">{data.summary.accounts_count}</strong>
              </div>
              <div className="card kpi-card">
                <span className="hint">VA assignés</span>
                <strong className="kpi-value">{data.summary.assigned_vas ?? 0}</strong>
              </div>
              <div className="card kpi-card">
                <span className="hint">
                  {chartMode === "clicks"
                    ? `Clics (${chartDays}j)`
                    : chartMode === "followers"
                      ? "Abonnés"
                      : `Vues (${chartDays}j)`}
                </span>
                <strong className="kpi-value gradient-text">
                  {chartMode === "clicks"
                    ? formatNumber(
                        (data.account_series || []).reduce(
                          (sum, acc) => sum + sumDailyClicks(acc.daily_clicks, chartDays),
                          0
                        )
                      )
                    : chartMode === "followers"
                      ? formatNumber(totalFollowers)
                      : formatNumber(periodViews)}
                </strong>
              </div>
              <div className="card kpi-card">
                <span className="hint">Période</span>
                <strong className="kpi-value kpi-period">{formatPeriodLabel(chartDays)}</strong>
              </div>
            </div>

            <p className="hint" style={{ marginBottom: 16 }}>
              {vas.length === 0 ? (
                <>
                  Aucun VA créé —{" "}
                  <Link href="/equipe" className="link-arrow">crée-en un dans Rang équipe</Link>
                </>
              ) : (
                "Assigne un VA à chaque compte pour le classement et le suivi quotidien."
              )}
              {" "}Colonne Linkscale : colle l’URL publique du lien (le slug suffit, ex. heylink.me/la.belle.lolaa).
            </p>

            <div className="status-pills">
              <span className="pill pill-meilleur">{data.summary.meilleur} meilleur</span>
              <span className="pill pill-actif">{data.summary.actif} actifs</span>
              <span className="pill pill-shadowban">{data.summary.shadowban} shadowban</span>
              <span className="pill pill-ban">{data.summary.ban} ban</span>
            </div>

            <div className="card chart-card" style={{ marginTop: 20 }} key={`chart-${chartMode}-${chartDays}`}>
              <MultiViewsChart
                series={chartSeries}
                title={
                  chartMode === "clicks"
                    ? `Clics Linkscale par compte — ${chartDays} derniers jours`
                    : chartMode === "followers"
                      ? `Abonnés par compte — ${chartDays} derniers jours`
                      : `Vues par compte — ${chartDays} derniers jours`
                }
                height={260}
                valueUnit={chartMode === "clicks" ? "clics" : chartMode === "followers" ? "abonnés" : "vues"}
                hint={
                  chartMode === "clicks"
                    ? `${formatPeriodLabel(chartDays)} · clics agrégés depuis Linkscale.`
                    : chartMode === "followers"
                      ? `${formatPeriodLabel(chartDays)} · ${formatNumber(totalFollowers)} abonnés sur la période.`
                      : `${formatPeriodLabel(chartDays)} · ${formatNumber(periodViews)} vues sur la période.`
                }
              />
            </div>

            <section className="card" style={{ padding: 20, marginTop: 20 }} key={`videos-${videoMode}-${chartDays}`}>
              <VideoLeaderboard
                videos={data.video_leaderboard || []}
                days={chartDays}
                title={`Top vidéos — ${chartDays}j`}
                hint="Classement cross-comptes pour ce modèle."
                emptyHint="Aucune vidéo sur cette période."
                limit={10}
                showAccount
                modelId={modelId}
                mode={videoMode}
                onModeChange={setVideoMode}
              />
            </section>

            <form className="add-form" onSubmit={onAdd} style={{ marginTop: 24 }}>
              <input
                type="text"
                placeholder="@username Instagram"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                disabled={adding}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={adding || !handle.trim()}
              >
                {adding ? "Ajout…" : "Ajouter un compte"}
              </button>
            </form>

            <div className="card table-card">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Compte</th>
                    <th>Linkscale</th>
                    <th>VA</th>
                    <th>Statut</th>
                    <th>Évol. 7j</th>
                    <th>Abonnés</th>
                    <th>Vues ({chartDays}j)</th>
                    <th>Clics ({chartDays}j)</th>
                    <th>Engagement</th>
                    <th>Score</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="table-empty">Aucun compte — ajoute un @username ci-dessus.</td>
                    </tr>
                  ) : (
                    data.accounts.map((acc) => (
                      <tr key={acc.id}>
                        <td>
                          <strong>@{acc.handle}</strong>
                          {acc.display_name && <span className="hint table-sub">{acc.display_name}</span>}
                        </td>
                        <td>
                          <LinkscaleLinkField
                            value={acc.linkscale_url}
                            disabled={linkscaleHandle === acc.handle}
                            onSave={(url) => onAssignLinkscale(acc.handle, url)}
                          />
                        </td>
                        <td>
                          <VaSelect
                            vas={vas}
                            value={acc.va_id}
                            disabled={assigningHandle === acc.handle}
                            onChange={(vaId) => onAssignVa(acc.handle, vaId)}
                          />
                        </td>
                        <td><StatusBadge status={acc.status} /></td>
                        <td><ChangeBadge pct={acc.views_change_pct} /></td>
                        <td>{formatNumber(acc.followers)}</td>
                        <td>{formatNumber(accountPeriodViews.get(acc.id) || 0)}</td>
                        <td>{formatNumber(accountPeriodClicks.get(acc.id) || 0)}</td>
                        <td>{formatPercent(acc.avg_engagement_rate)}</td>
                        <td>{acc.health_score ?? "—"}</td>
                        <td>
                          <div className="table-actions">
                            <Link
                              href={`/models/${modelId}/accounts/${acc.handle}`}
                              className="btn btn-ghost btn-sm"
                            >
                              Détail
                            </Link>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={refreshingHandle === acc.handle}
                              onClick={() => onRefresh(acc.handle)}
                            >
                              {refreshingHandle === acc.handle ? "…" : "Vues (1×/j)"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={deletingHandle === acc.handle}
                              onClick={() => onDeleteAccount(acc.handle)}
                            >
                              {deletingHandle === acc.handle ? "…" : "Suppr."}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="hint">Modèle introuvable.</p>
        )}
    </AppShell>
  );
}
