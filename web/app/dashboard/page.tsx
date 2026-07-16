"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AppPageHeader } from "@/components/AppPageHeader";
import { LoadingDots } from "@/components/LoadingDots";
import { Reveal } from "@/components/Reveal";
import { ChartSeries, MultiViewsChart, seriesColor } from "@/components/MultiViewsChart";
import { ModelCreateForm } from "@/components/ModelCreateForm";
import { ModelNameEditor } from "@/components/ModelNameEditor";
import { PeriodBar } from "@/components/PeriodBar";
import { DEFAULT_MODEL_EMOJI } from "@/lib/modelEmojis";
import { useOnGlobalRefresh } from "@/hooks/useOnGlobalRefresh";
import {
  GlobalDashboard,
  createModel,
  deleteModel,
  fetchDashboard,
  fetchHealth,
  fillFollowersSeriesForPeriod,
  fillClicksSeriesForPeriod,
  fillSeriesForPeriod,
  formatModelDisplayName,
  formatNumber,
  formatPeriodLabel,
  getStoredEmail,
  sumDailyViews,
  sumDailyClicks,
  sumLatestFollowers,
} from "@/lib/api";

type ChartMode = "views" | "followers" | "clicks";
const MAX_FETCH_DAYS = 90;

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<GlobalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newModelEmoji, setNewModelEmoji] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [apifyMode, setApifyMode] = useState(false);
  const [providerLabel, setProviderLabel] = useState("Mode démo");
  const [chartDays, setChartDays] = useState(30);
  const [chartMode, setChartMode] = useState<ChartMode>("views");

  const load = useCallback(async (userEmail: string) => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchDashboard(userEmail, MAX_FETCH_DAYS));
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
    load(stored);
    fetchHealth().then((h) => {
      setApifyMode(!h.mock_active);
      if (h.instagram_mode === "hiker") setProviderLabel("HikerAPI active");
      else if (h.instagram_mode === "apify") setProviderLabel("Apify active");
      else setProviderLabel("Mode démo");
    }).catch(() => {});
  }, [router, pathname, load]);

  useEffect(() => {
    if (!email) return;
    const userEmail = email;
    function onFocus() {
      load(userEmail);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [email, load]);

  useOnGlobalRefresh(useCallback(() => {
    if (email) void load(email);
  }, [email, load]));

  const periodViews = useMemo(
    () => sumDailyViews(data?.daily_views || [], chartDays),
    [data, chartDays]
  );

  const totalFollowers = useMemo(
    () => sumLatestFollowers(data?.account_series || []),
    [data]
  );

  const totalClicks = useMemo(() => {
    let total = 0;
    for (const m of data?.model_series || []) {
      total += sumDailyClicks(m.daily_clicks, chartDays);
    }
    return total;
  }, [data, chartDays]);

  const modelPeriodViews = useMemo(() => {
    const map = new Map<number, number>();
    for (const m of data?.model_series || []) {
      map.set(m.id, sumDailyViews(m.daily_views, chartDays));
    }
    return map;
  }, [data, chartDays]);

  const modelTotalFollowers = useMemo(() => {
    const map = new Map<number, number>();
    for (const acc of data?.account_series || []) {
      if (acc.model_id == null) continue;
      map.set(acc.model_id, (map.get(acc.model_id) || 0) + (acc.followers || 0));
    }
    return map;
  }, [data]);

  const modelPeriodClicks = useMemo(() => {
    const map = new Map<number, number>();
    for (const m of data?.model_series || []) {
      map.set(m.id, sumDailyClicks(m.daily_clicks, chartDays));
    }
    return map;
  }, [data, chartDays]);

  const chartSeries: ChartSeries[] = useMemo(() => {
    if (!data?.model_series) return [];
    return data.model_series.map((m, i) => ({
      id: `${m.id}-${chartMode}-${chartDays}`,
      label: m.name || `Modèle ${m.id}`,
      color: seriesColor(i),
      data:
        chartMode === "clicks"
          ? fillClicksSeriesForPeriod(m.daily_clicks || [], chartDays)
          : chartMode === "followers"
            ? fillFollowersSeriesForPeriod(m.daily_followers || [], chartDays)
            : fillSeriesForPeriod(m.daily_views, chartDays),
    }));
  }, [data, chartDays, chartMode]);

  async function onCreateModel() {
    if (!email || !newModel.trim()) return;
    setCreating(true);
    try {
      const name = formatModelDisplayName(newModelEmoji || DEFAULT_MODEL_EMOJI, newModel);
      await createModel(email, name);
      setNewModel("");
      setNewModelEmoji("");
      await load(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  }

  function onModelRenamed(modelId: number, name: string) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        models: prev.models.map((m) => (m.id === modelId ? { ...m, name } : m)),
        model_series: prev.model_series.map((m) => (m.id === modelId ? { ...m, name } : m)),
        account_series: prev.account_series.map((a) =>
          a.model_id === modelId ? { ...a, model_name: name } : a
        ),
      };
    });
  }

  async function onDeleteModel(modelId: number, name: string) {
    if (!email) return;
    if (!confirm(`Supprimer la créatrice « ${name} » et tous ses comptes ?`)) return;
    setDeletingId(modelId);
    setError("");
    try {
      await deleteModel(email, modelId);
      await load(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell email={email} active="dashboard">
          <AppPageHeader
            eyebrow="Vue globale"
            title={<>Dashboard <span className="gradient-text">global</span></>}
            subtitle={
              <>
                Courbe par modèle — clique sur une légende pour masquer / afficher.
                {apifyMode ? (
                  <span className="source-badge source-apify"> {providerLabel}</span>
                ) : (
                  <span className="source-badge source-mock"> Mode démo</span>
                )}
              </>
            }
          />

          {error && <p className="status err">{error}</p>}
          {loading ? (
            <LoadingDots />
          ) : data ? (
            <>
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

              <div className="kpi-grid" key={`kpi-${chartMode}-${chartDays}`}>
                <div className="card kpi-card card-interactive">
                  <span className="hint">Modèles</span>
                  <strong className="kpi-value">{data.summary.models_count}</strong>
                </div>
                <div className="card kpi-card card-interactive">
                  <span className="hint">Comptes IG</span>
                  <strong className="kpi-value">{data.summary.accounts_count}</strong>
                </div>
                <div className="card kpi-card card-interactive">
                  <span className="hint">
                    {chartMode === "followers"
                      ? "Abonnés (total)"
                      : chartMode === "clicks"
                        ? `Clics (${chartDays}j)`
                        : `Vues (${chartDays}j)`}
                  </span>
                  <strong className="kpi-value gradient-text">
                    {chartMode === "followers"
                      ? formatNumber(totalFollowers)
                      : chartMode === "clicks"
                        ? formatNumber(totalClicks)
                        : formatNumber(periodViews)}
                  </strong>
                </div>
                <div className="card kpi-card card-interactive">
                  <span className="hint">Période</span>
                  <strong className="kpi-value kpi-period">{formatPeriodLabel(chartDays)}</strong>
                </div>
              </div>

              <div className="card chart-card" key={`chart-${chartMode}-${chartDays}`}>
                <MultiViewsChart
                  series={chartSeries}
                  title={
                    chartMode === "clicks"
                      ? `Clics Linkscale par modèle — ${chartDays} derniers jours`
                      : chartMode === "followers"
                        ? `Abonnés par modèle — ${chartDays} derniers jours`
                        : `Vues par modèle — ${chartDays} derniers jours`
                  }
                  height={260}
                  valueUnit={chartMode === "clicks" ? "clics" : chartMode === "followers" ? "abonnés" : "vues"}
                  hint={
                    chartMode === "clicks"
                      ? `${formatPeriodLabel(chartDays)} · ${formatNumber(totalClicks)} clics au total · assigne un lien par compte sur la page modèle.`
                      : chartMode === "followers"
                        ? `${formatPeriodLabel(chartDays)} · ${formatNumber(totalFollowers)} abonnés au total.`
                        : `${formatPeriodLabel(chartDays)} · ${formatNumber(periodViews)} vues au total.`
                  }
                />
              </div>

              <div className="section-head section-head-models">
                <h2>Tes modèles</h2>
                <ModelCreateForm
                  name={newModel}
                  emoji={newModelEmoji}
                  onNameChange={setNewModel}
                  onEmojiChange={setNewModelEmoji}
                  onSubmit={onCreateModel}
                  submitting={creating}
                />
              </div>

              {data.models.length === 0 ? (
                <div className="card empty-state">
                  <p>Crée un modèle pour y rattacher des comptes Instagram.</p>
                </div>
              ) : (
                <div className="models-grid">
                  {data.models.map((model, index) => (
                    <Reveal key={model.id} delay={index * 60}>
                      <article className="card model-card card-interactive">
                      <div className="model-card-top">
                        <div className="model-card-main">
                          <ModelNameEditor
                            modelId={model.id}
                            name={model.name}
                            onUpdated={(name) => onModelRenamed(model.id, name)}
                          />
                          <Link href={`/models/${model.id}`} className="model-card-link">
                            <p className="hint">{model.accounts_count} compte{model.accounts_count > 1 ? "s" : ""}</p>
                            <div className="model-card-metric">
                              <span className="hint">
                                {chartMode === "followers"
                                  ? "Abonnés"
                                  : chartMode === "clicks"
                                    ? `Clics (${chartDays}j)`
                                    : `Vues (${chartDays}j)`}
                              </span>
                              <strong>
                                {chartMode === "followers"
                                  ? formatNumber(modelTotalFollowers.get(model.id) || 0)
                                  : chartMode === "clicks"
                                    ? formatNumber(modelPeriodClicks.get(model.id) || 0)
                                    : formatNumber(modelPeriodViews.get(model.id) || 0)}
                              </strong>
                            </div>
                            <span className="link-arrow">Voir le modèle →</span>
                          </Link>
                        </div>
                        <button
                          type="button"
                          className="btn btn-danger btn-icon"
                          title={`Supprimer ${model.name}`}
                          disabled={deletingId === model.id}
                          onClick={() => onDeleteModel(model.id, model.name)}
                        >
                          {deletingId === model.id ? "…" : "✕"}
                        </button>
                      </div>
                    </article>
                    </Reveal>
                  ))}
                </div>
              )}
            </>
          ) : null}
    </AppShell>
  );
}
