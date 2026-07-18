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
  notice: string | null;
  refreshStatus: DailyRefreshStatus | null;
  overrideCode: string;
  setOverrideCode: (code: string) => void;
  refreshAccounts: (overrideCode?: string) => Promise<void>;
  refreshLinks: () => Promise<void>;
  reloadRefreshStatus: () => Promise<void>;
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

function formatLinkscaleErrors(errors: Array<{ handle?: string; error: string }>): string {
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
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<DailyRefreshStatus | null>(null);
  const [overrideCode, setOverrideCode] = useState("");
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
    const timer = window.setInterval(() => {
      void loadRefreshStatus();
    }, 60_000);
    return () => window.clearInterval(timer);
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

  const refreshAccounts = useCallback(
    async (codeOverride?: string) => {
      const email = getStoredEmail();
      if (!email || running) return;

      const code = (codeOverride ?? overrideCode).trim();
      const blocked = refreshStatus ? !refreshStatus.available_now : false;

      if (blocked && !code) {
        setError(
          refreshStatus?.message ||
            "Refresh du jour déjà utilisé — prochain refresh demain à 8h. Entre le code pour forcer."
        );
        setNotice(null);
        return;
      }

      setRunning(true);
      setKind("accounts");
      setError(null);
      setNotice(code ? "Refresh extra autorisé par code…" : null);
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

        const result = await refreshAllAccounts(email, code || undefined);
        clearProgressTimer();

        setCurrent(result.total);
        setCurrentHandle(null);

        if (result.errors?.length) {
          setError(formatRefreshErrors(result.errors));
          setNotice(null);
        } else if (result.skipped_count && result.synced === 0) {
          setError(
            result.refresh?.message ||
              result.skipped?.[0]?.message ||
              "Refresh du jour déjà utilisé — prochain refresh demain à 8h."
          );
          setNotice(null);
        } else {
          setError(null);
          setNotice(
            code
              ? "Refresh extra terminé."
              : `${result.synced} compte(s) synchronisé(s). Prochain refresh demain à 8h.`
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
        setNotice(null);
      } finally {
        setRunning(false);
        setKind(null);
        setCurrentHandle(null);
      }
    },
    [running, clearProgressTimer, refreshStatus, overrideCode, loadRefreshStatus]
  );

  const refreshLinks = useCallback(async () => {
    const email = getStoredEmail();
    if (!email || running) return;

    setRunning(true);
    setKind("links");
    setError(null);
    setNotice(null);
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
      } else {
        setNotice(`${result.synced} compte(s) Linkscale synchronisé(s).`);
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
      notice,
      refreshStatus,
      overrideCode,
      setOverrideCode,
      refreshAccounts,
      refreshLinks,
      reloadRefreshStatus: loadRefreshStatus,
    }),
    [
      running,
      kind,
      current,
      total,
      currentHandle,
      error,
      notice,
      refreshStatus,
      overrideCode,
      refreshAccounts,
      refreshLinks,
      loadRefreshStatus,
    ]
  );

  return <BulkRefreshContext.Provider value={value}>{children}</BulkRefreshContext.Provider>;
}

export function useBulkRefresh() {
  const ctx = useContext(BulkRefreshContext);
  if (!ctx) {
    throw new Error("useBulkRefresh must be used within BulkRefreshProvider");
  }
  return ctx;
}

export function RefreshDailyBanner() {
  const {
    refreshStatus,
    overrideCode,
    setOverrideCode,
    refreshAccounts,
    running,
    error,
    notice,
  } = useBulkRefresh();

  const blocked = refreshStatus ? !refreshStatus.available_now : false;
  if (!blocked && !error && !notice) return null;

  const message =
    refreshStatus?.message ||
    "Refresh du jour déjà utilisé — prochain refresh demain à 8h (Europe/Paris).";

  return (
    <div className="refresh-daily-banner" role="status" aria-live="polite">
      <div className="refresh-daily-banner-main">
        {blocked ? <p className="refresh-daily-banner-text">{message}</p> : null}
        {error ? <p className="refresh-daily-banner-error">{error}</p> : null}
        {notice ? <p className="refresh-daily-banner-ok">{notice}</p> : null}
      </div>
      {blocked && refreshStatus?.override_available !== false ? (
        <div className="refresh-daily-banner-override">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Code refresh extra"
            value={overrideCode}
            onChange={(e) => setOverrideCode(e.target.value)}
            disabled={running}
            onKeyDown={(e) => {
              if (e.key === "Enter") void refreshAccounts();
            }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={running || !overrideCode.trim()}
            onClick={() => void refreshAccounts()}
          >
            Forcer le refresh
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function HeaderRefreshActions() {
  const { running, kind, refreshStatus, refreshAccounts, refreshLinks } = useBulkRefresh();
  const refreshUsed = refreshStatus ? !refreshStatus.available_now : false;

  return (
    <div className="header-refresh-actions">
      <button
        type="button"
        className={`refresh-header-btn${running && kind === "accounts" ? " is-loading" : ""}${refreshUsed ? " is-locked" : ""}`}
        onClick={() => void refreshAccounts()}
        disabled={running}
        title={
          refreshUsed
            ? refreshStatus?.message || "Refresh du jour déjà utilisé — voir le bandeau jaune"
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
  const { running, kind, current, total, currentHandle } = useBulkRefresh();

  if (!running) return null;

  const pct = total > 0 ? Math.round((current / total) * 100) : 35;
  const label = kind === "links" ? "Synchronisation Linkscale…" : "Actualisation des comptes…";

  return (
    <div className="bulk-refresh-progress is-active" role="status" aria-live="polite">
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
    </div>
  );
}
