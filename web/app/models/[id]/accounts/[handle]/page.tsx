"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOnGlobalRefresh } from "@/hooks/useOnGlobalRefresh";
import { ChartSeries, MultiViewsChart } from "@/components/MultiViewsChart";
import { ChangeBadge } from "@/components/ChangeBadge";
import { CHART_RANGES, PeriodBar } from "@/components/PeriodBar";
import { ReelGallery } from "@/components/ReelGallery";
import { AppShell } from "@/components/AppShell";
import { AppSubHeader } from "@/components/AppSubHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AccountDetail,
  buildPeriodSummary,
  fetchAccountDetail,
  filterDailyByDays,
  filterLeaderboardByDays,
  formatNumber,
  formatPercent,
  formatPeriodInsight,
  formatPeriodLabel,
  getAccountPosts,
  getStoredEmail,
  listPeriodDates,
  refreshAccount,
  VideoSortMode,
  DEFAULT_CHART_DAYS,
} from "@/lib/api";

type ChartMode = "views" | "followers";
const MAX_FETCH_DAYS = 90;

export default function AccountPage() {
  const params = useParams<{ id: string; handle: string }>();
  const modelId = Number(params.id);
  const handle = params.handle;
  const router = useRouter();
  const [data, setData] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<"metrics" | "videos" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [chartMode, setChartMode] = useState<ChartMode>("views");
  const [chartDays, setChartDays] = useState<number>(DEFAULT_CHART_DAYS);
  const [videoMode, setVideoMode] = useState<VideoSortMode>("performance");

  const loadDetail = useCallback(async () => {
    const email = getStoredEmail();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      setData(await fetchAccountDetail(email, modelId, handle, MAX_FETCH_DAYS));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [modelId, handle]);

  useEffect(() => {
    const email = getStoredEmail();
    if (!email) {
      router.replace("/login");
      return;
    }
    void loadDetail();
  }, [router, loadDetail]);

  useOnGlobalRefresh(loadDetail);

  const allPosts = useMemo(() => getAccountPosts(data?.snapshot ?? null), [data]);

  const period = useMemo(() => {
    const followers = data?.snapshot?.followers ?? data?.account.followers ?? null;
    return buildPeriodSummary(allPosts, chartDays, followers);
  }, [allPosts, chartDays, data]);

  const shorterPeriod = useMemo(() => {
    const shorter = CHART_RANGES.filter((d) => d < chartDays).at(-1);
    if (!shorter) return null;
    const followers = data?.snapshot?.followers ?? data?.account.followers ?? null;
    const s = buildPeriodSummary(allPosts, shorter, followers);
    if (s.views === period.views && s.posts.length === period.posts.length) {
      return shorter;
    }
    return null;
  }, [allPosts, chartDays, data, period.posts.length, period.views]);

  const chartSeries: ChartSeries[] = useMemo(() => {
    if (!data) return [];

    if (chartMode === "followers") {
      const byDate = new Map(
        filterDailyByDays(data.daily_followers || [], chartDays).map((d) => [d.date, d.followers])
      );
      const points = listPeriodDates(chartDays).map((date) => ({
        date,
        views: byDate.get(date) ?? 0,
      }));
      return [{
        id: `${handle}-followers-${chartDays}`,
        label: "Abonnés",
        color: "#06b6d4",
        data: points,
      }];
    }

    return [{
      id: `${handle}-views-${chartDays}`,
      label: `@${handle}`,
      color: "#8b5cf6",
      data: period.chartViews,
    }];
  }, [chartMode, chartDays, data, handle, period.chartViews]);

  const videoSource = useMemo(() => {
    if (data?.video_leaderboard?.length) {
      return filterLeaderboardByDays(data.video_leaderboard, chartDays);
    }
    return period.posts;
  }, [data, period.posts, chartDays]);

  async function onRefresh(scope: "metrics" | "videos") {
    const email = getStoredEmail();
    if (!email) return;
    setRefreshing(scope);
    setError("");
    setNotice("");
    try {
      const result = await refreshAccount(email, modelId, handle, undefined, scope);
      await loadDetail();
      if (result.skipped && result.message) {
        setNotice(result.message);
      } else if (scope === "videos") {
        setNotice("Top vidéos et analyse mises à jour.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setRefreshing(null);
    }
  }

  return (
    <AppShell email={null} showNav={false}>
        <AppSubHeader backHref={`/models/${modelId}`} backLabel="Retour au modèle">
          {data ? (
            <div className="header-refresh-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={refreshing !== null}
                onClick={() => void onRefresh("metrics")}
              >
                {refreshing === "metrics" ? "Vues…" : "↻ Vues (1×/j)"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={refreshing !== null}
                onClick={() => void onRefresh("videos")}
              >
                {refreshing === "videos" ? "Vidéos…" : "↻ Vidéos"}
              </button>
            </div>
          ) : null}
        </AppSubHeader>

        {loading ? (
          <p className="hint">Chargement…</p>
        ) : error ? (
          <p className="status err">{error}</p>
        ) : data ? (
          <>
            {notice ? <p className="status ok app-inline-notice">{notice}</p> : null}
            <PeriodBar days={chartDays} onChangeDays={setChartDays} note={shorterPeriod ? `Tous les reels ont été publiés dans les ${shorterPeriod} derniers jours — stats identiques à ${shorterPeriod}j.` : null}>
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
              </div>
            </PeriodBar>

            <section className="card detail-hero" key={`hero-${chartDays}`}>
              <div className="detail-hero-top">
                <div>
                  <h1 style={{ margin: 0 }}>@{data.account.handle}</h1>
                  {data.account.display_name && (
                    <p className="hint" style={{ marginTop: 6 }}>{data.account.display_name}</p>
                  )}
                </div>
                <StatusBadge status={data.account.status} />
              </div>
              <div className="detail-stats">
                <div className="stat-box">
                  <span>Abonnés (actuel)</span>
                  <strong>{formatNumber(data.snapshot?.followers ?? data.account.followers)}</strong>
                </div>
                <div className="stat-box">
                  <span>Vues ({chartDays}j)</span>
                  <strong>{formatNumber(period.views)}</strong>
                </div>
                <div className="stat-box">
                  <span>Reels ({chartDays}j)</span>
                  <strong>{period.posts.length}</strong>
                </div>
                <div className="stat-box">
                  <span>Jours actifs ({chartDays}j)</span>
                  <strong>{period.activeDays}</strong>
                </div>
                <div className="stat-box">
                  <span>Évol. vs période préc.</span>
                  <strong><ChangeBadge pct={period.viewsChange} /></strong>
                </div>
                <div className="stat-box">
                  <span>Engagement ({chartDays}j)</span>
                  <strong>{formatPercent(period.engagement)}</strong>
                </div>
              </div>
            </section>

            <div className="card chart-card" key={`chart-${chartMode}-${chartDays}`}>
              <MultiViewsChart
                series={chartSeries}
                title={
                  chartMode === "followers"
                    ? `Abonnés — ${chartDays} derniers jours`
                    : `Vues — ${chartDays} derniers jours`
                }
                height={240}
                valueUnit={chartMode === "followers" ? "abonnés" : "vues"}
                hint={formatPeriodInsight(period, chartDays)}
              />
            </div>

            <section className="card" style={{ padding: 20 }} key={`top-videos-${videoMode}-${chartDays}`}>
              <ReelGallery
                posts={videoSource}
                days={chartDays}
                title={`Top vidéos — ${chartDays}j`}
                hint={`${formatPeriodLabel(chartDays)} · abonnés estimés par vidéo (non fournis par Instagram).`}
                emptyHint={`Aucun reel publié entre le ${formatPeriodLabel(chartDays)}.`}
                mode={videoMode}
                onModeChange={setVideoMode}
                showModeToggle
              />
            </section>
          </>
        ) : null}
    </AppShell>
  );
}
