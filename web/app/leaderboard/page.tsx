"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useOnGlobalRefresh } from "@/hooks/useOnGlobalRefresh";
import { PeriodBar } from "@/components/PeriodBar";
import { VideoLeaderboard } from "@/components/VideoLeaderboard";
import {
  GlobalDashboard,
  fetchDashboard,
  formatPeriodLabel,
  getStoredEmail,
  VideoSortMode,
} from "@/lib/api";

const MAX_FETCH_DAYS = 90;

export default function LeaderboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<GlobalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartDays, setChartDays] = useState(30);
  const [videoMode, setVideoMode] = useState<VideoSortMode>("performance");

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
  }, [router, load]);

  useOnGlobalRefresh(useCallback(() => {
    if (email) void load(email);
  }, [email, load]));

  return (
    <main className="dashboard">
      <div className="container">
        <AppHeader email={email} active="leaderboard" />

        <section className="dashboard-main">
          <h1 style={{ margin: "0 0 4px" }}>Top vidéos</h1>
          <p className="hint" style={{ marginBottom: 24 }}>
            Classement global de tes meilleurs reels — performance ou conversion.
          </p>

          {error && <p className="status err">{error}</p>}
          {loading ? (
            <p className="hint">Chargement…</p>
          ) : data ? (
            <>
              <PeriodBar days={chartDays} onChangeDays={setChartDays} />

              <section className="card" style={{ padding: 20 }} key={`videos-${videoMode}-${chartDays}`}>
                <VideoLeaderboard
                  videos={data.video_leaderboard || []}
                  days={chartDays}
                  title={`Leaderboard — ${chartDays}j`}
                  hint={`${formatPeriodLabel(chartDays)} · tous comptes · abonnés estimés par vidéo.`}
                  emptyHint="Aucune vidéo sur cette période — actualise tes comptes depuis le dashboard."
                  limit={20}
                  showAccount
                  mode={videoMode}
                  onModeChange={setVideoMode}
                />
              </section>

              <p className="hint" style={{ marginTop: 16 }}>
                Pour le détail par compte, ouvre un modèle puis un compte Instagram.
              </p>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
