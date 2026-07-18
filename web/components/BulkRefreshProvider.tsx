"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DailyRefreshStatus,
  fetchRefreshStatus,
  fetchRefreshTargets,
  getStoredEmail,
  refreshAllAccounts,
  syncLinkscaleClicks,
} from "@/lib/api";

export const GRAMPULSE_REFRESHED_EVENT = "grampulse-refreshed";

type RefreshKind = "accounts" | "links" | null;

type BulkRefreshContextValue = {
  running: boolean;
  kind: RefreshKind;
  current: number;
  total: number;
  currentHandle: string | null;
  error: string | null;
  refreshStatus: DailyRefreshStatus | null;
  refreshAccounts: () => Promise<void>;
  refreshLinks: () => Promise<void>;
};

const BulkRefreshContext = createContext<BulkRefreshContextValue | null>(null);

function formatRefreshErrors(errors: Array<{ handle: string; error: string }>): string {
  if (!errors.length) return "";
  const uniqueMessages = Array.from(new Set(errors.map((e) => e.error)));
  if (uniqueMessages.length === 1 && errors.length > 1) {
    return `${errors.length} comptes en échec : ${uniqueMessages[0]}`;
  }
  return errors.map((e) => `@${e.handle} : ${e.error}`).join(" · ");
}

function formatLinkscaleErrors(
  errors: Array<{ handle?: string; error: string }>
): string {
  if (!errors.length) return "";
  return errors
    .map((e) => (e.handle ? `@${e.handle} : ${e.error}` : e.error))
    .join(" · ");
}

export function BulkRefreshProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const [kind, setKind] = useState<RefreshKind>(null);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentHandle, setCurrentHandle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<DailyRefreshStatus | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRefreshStatus = useCallback(async () => {
    const email = getStoredEmail();
    if (!email) return;
    try {
      setRefreshStatus(await fetchRefreshStatus(email));
    } catch {
      setRefreshStatus(null);
    }
  }, []);

  useEffect(() => {
    void loadRefreshStatus();
  }, [loadRefreshStatus]);

  useEffect(() => {
    const onRefreshed = () => {
      void loadRefreshStatus();
    };
    window.addEventListener(GRAMPULSE_REFRESHED_EVENT, onRefreshed);
    return () => window.removeEventListener(GRAMPULSE_REFRESHED_EVENT, onRefreshed);
  }, [loadRefreshStatus]);

  const clearProgressTimer = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  const refreshAccounts = useCallback(async () => {
    const email = getStoredEmail();
    if (!email || running) return;
    if (refreshStatus && !refreshStatus.available_now) {
      setError(refreshStatus.message || "Refresh du jour déjà utilisé — repasse demain à 8h.");
      return;
    }

    setRunning(true);
    setKind("accounts");
    setError(null);
    setCurrent(0);
    setCurrentHandle(null);
    clearProgressTimer();

    try {
      const { accounts } = await fetchRefreshTargets(email);
      const count = accounts.length;
      setTotal(count);

      if (count === 0) return;

      let simulated = 0;
      progressTimer.current = setInterval(() => {
        simulated = Math.min(simulated + 1, Math.max(count - 1, 1));
        setCurrent(simulated);
        const acc = accounts[simulated - 1];
        if (acc) setCurrentHandle(acc.handle);
      }, 8000);

      const result = await refreshAllAccounts(email);
      clearProgressTimer();

      setCurrent(result.total);
      setCurrentHandle(null);

      if (result.errors?.length) {
        setError(formatRefreshErrors(result.errors));
      } else if (result.skipped_count && result.synced === 0) {
        setError(
          result.refresh?.message ||
            result.skipped?.[0]?.message ||
            "Refresh du jour déjà utilisé — prochain refresh demain à 8h."
        );
      }

      if (result.refresh) {
        setRefreshStatus(result.refresh);
      } else {
        await loadRefreshStatus();
      }

      window.dispatchEvent(new CustomEvent(GRAMPULSE_REFRESHED_EVENT));
    } catch (err) {
      clearProgressTimer();
      setError(err instanceof Error ? err.message : "Actualisation impossible.");
    } finally {
      setRunning(false);
      setKind(null);
      setCurrentHandle(null);
    }
  }, [running, clearProgressTimer, refreshStatus, loadRefreshStatus]);
    const email = getStoredEmail();
    if (!email || running) return;

    setRunning(true);
    setKind("links");
    setError(null);
    setCurrent(0);
    setCurrentHandle(null);
    setTotal(0);
    clearProgressTimer();

    try {
      const result = await syncLinkscaleClicks(email, 90);
      setTotal(result.accounts);
      setCurrent(result.synced);

      if (result.errors?.length) {
        setError(formatLinkscaleErrors(result.errors));
      } else if (result.accounts === 0) {
        setError("Aucun lien Linkscale assigné — ajoute une URL sur la page modèle.");
      }

      window.dispatchEvent(new CustomEvent(GRAMPULSE_REFRESHED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync Linkscale impossible.");
    } finally {
      setRunning(false);
      setKind(null);
      setCurrentHandle(null);
    }
  }, [running, clearProgressTimer]);

  const value = useMemo(
    () => ({
      running,
      kind,
      current,
      total,
      currentHandle,
      error,
      refreshStatus,
      refreshAccounts,
      refreshLinks,
    }),
    [running, kind, current, total, currentHandle, error, refreshStatus, refreshAccounts, refreshLinks]
  );

  return (
    <BulkRefreshContext.Provider value={value}>{children}</BulkRefreshContext.Provider>
  );
}

export function useBulkRefresh() {
  const ctx = useContext(BulkRefreshContext);
  if (!ctx) {
    throw new Error("useBulkRefresh must be used within BulkRefreshProvider");
  }
  return ctx;
}

export function HeaderRefreshActions() {
  const { running, kind, refreshStatus, refreshAccounts, refreshLinks } = useBulkRefresh();
  const refreshUsed = refreshStatus ? !refreshStatus.available_now : false;

  return (
    <div className="header-refresh-actions">
      {refreshUsed && refreshStatus?.message ? (
        <span className="refresh-status-hint" title={refreshStatus.message}>
          Prochain refresh demain 8h
        </span>
      ) : null}
      <button
        type="button"
        className={`refresh-header-btn${running && kind === "accounts" ? " is-loading" : ""}${refreshUsed ? " is-locked" : ""}`}
        onClick={() => void refreshAccounts()}
        disabled={running}
        title={
          refreshUsed
            ? refreshStatus?.message || "Refresh du jour déjà utilisé — prochain refresh demain à 8h"
            : "Refresh quotidien Instagram — 1× par jour, reset à 8h (Europe/Paris)"
        }
      >
        {running && kind === "accounts"
          ? "Actualisation…"
          : refreshUsed
            ? "↻ Comptes (8h demain)"
            : "↻ Comptes (1×/jour)"}
      </button>
      <button
        type="button"
        className={`refresh-header-btn refresh-header-btn-links${
          running && kind === "links" ? " is-loading" : ""
        }`}
        onClick={() => void refreshLinks()}
        disabled={running}
        title="Synchroniser les clics Linkscale sans toucher aux comptes Instagram"
      >
        {running && kind === "links" ? "Sync…" : "↻ Liens"}
      </button>
    </div>
  );
}

export function BulkRefreshProgress() {
  const { running, kind, current, total, currentHandle, error, refreshStatus } = useBulkRefresh();
  const refreshBlocked = refreshStatus ? !refreshStatus.available_now : false;
  const blockedMessage =
    refreshStatus?.message ||
    "Refresh du jour déjà utilisé — prochain refresh demain à 8h (Europe/Paris).";

  if (!running && !error && !refreshBlocked) return null;

  const pct = total > 0 ? Math.round((current / total) * 100) : running ? 35 : 0;
  const label =
    kind === "links"
      ? "Synchronisation Linkscale…"
      : "Actualisation des comptes…";

  return (
    <div
      className={`bulk-refresh-progress${running ? " is-active" : ""}`}
      role="status"
      aria-live="polite"
    >
      {running ? (
        <>
          <div className="bulk-refresh-progress-head">
            <span>
              {label}
              {kind === "accounts" && total > 0 ? " (peut prendre plusieurs minutes)" : ""}
            </span>
            <span className="bulk-refresh-progress-count">
              {total > 0 ? `${current}/${total}` : "…"}
              {currentHandle ? ` · @${currentHandle}` : ""}
            </span>
          </div>
          <div className="bulk-refresh-track" aria-hidden>
            <div className="bulk-refresh-fill" style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : error ? (
        <p className="bulk-refresh-error">{error}</p>
      ) : refreshBlocked ? (
        <p className="bulk-refresh-notice">{blockedMessage}</p>
      ) : null}
    </div>
  );
}
