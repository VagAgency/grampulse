"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  LeaderboardVideo,
  VideoSortMode,
  filterLeaderboardByDays,
  followersEstHint,
  formatNumber,
  formatPercent,
  formatPostDate,
  sortVideoLeaderboard,
} from "@/lib/api";

type Props = {
  videos: LeaderboardVideo[];
  title?: string;
  hint?: string;
  emptyHint?: string;
  limit?: number;
  showAccount?: boolean;
  modelId?: number;
  mode?: VideoSortMode;
  onModeChange?: (mode: VideoSortMode) => void;
  defaultMode?: VideoSortMode;
  showModeToggle?: boolean;
  days?: number;
};

export function VideoLeaderboard({
  videos,
  title = "Top vidéos",
  hint,
  emptyHint = "Aucune vidéo sur cette période.",
  limit = 10,
  showAccount = false,
  modelId,
  mode: controlledMode,
  onModeChange,
  defaultMode = "performance",
  showModeToggle = true,
  days,
}: Props) {
  const [internalMode, setInternalMode] = useState<VideoSortMode>(defaultMode);
  const mode = controlledMode ?? internalMode;

  function setMode(next: VideoSortMode) {
    if (onModeChange) onModeChange(next);
    else setInternalMode(next);
  }

  const ranked = useMemo(() => {
    const pool = days != null ? filterLeaderboardByDays(videos, days) : videos;
    return sortVideoLeaderboard(pool, mode).slice(0, limit);
  }, [videos, mode, limit, days]);

  return (
    <div className="video-leaderboard-wrap">
      <div className="video-leaderboard-head">
        <div>
          {title && <h2 style={{ margin: 0 }}>{title}</h2>}
          {hint && <p className="hint" style={{ margin: "6px 0 0" }}>{hint}</p>}
        </div>
        {showModeToggle && (
          <div className="chart-mode-toggle">
            <button
              type="button"
              className={`chart-mode-btn${mode === "performance" ? " active" : ""}`}
              onClick={() => setMode("performance")}
            >
              Performance
            </button>
            <button
              type="button"
              className={`chart-mode-btn${mode === "conversion" ? " active" : ""}`}
              onClick={() => setMode("conversion")}
            >
              Conversion
            </button>
          </div>
        )}
      </div>

      {mode === "conversion" && (
        <p className="hint video-leaderboard-mode-hint">
          Classement par taux de conversion : (likes + commentaires + partages) ÷ vues.
        </p>
      )}

      {!ranked.length ? (
        <p className="hint" style={{ marginTop: 12 }}>{emptyHint}</p>
      ) : (
        <div className="video-leaderboard-table-wrap">
          <table className="video-leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Vidéo</th>
                {showAccount && <th>Compte</th>}
                <th>Publié</th>
                <th>Vues</th>
                <th>Likes</th>
                <th>Com.</th>
                <th>Conv.</th>
                <th title="Estimation — non fournie par Instagram">Abonnés est.</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((video, i) => (
                <tr key={video.code || video.url || `${video.account_handle}-${i}`}>
                  <td className="lb-rank">{i + 1}</td>
                  <td>
                    <div className="lb-video-cell">
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt="" className="lb-thumb" />
                      ) : (
                        <div className="lb-thumb-fallback">▶</div>
                      )}
                      <div className="lb-video-info">
                        {video.caption ? (
                          <span className="lb-caption">{video.caption}</span>
                        ) : (
                          <span className="hint">Reel</span>
                        )}
                        {video.url && (
                          <a href={video.url} target="_blank" rel="noopener noreferrer" className="lb-link">
                            Instagram →
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  {showAccount && (
                    <td>
                      {(video.model_id || modelId) && video.account_handle ? (
                        <Link
                          href={`/models/${video.model_id || modelId}/accounts/${video.account_handle}`}
                          className="lb-account-link"
                        >
                          @{video.account_handle}
                        </Link>
                      ) : (
                        <span>@{video.account_handle}</span>
                      )}
                    </td>
                  )}
                  <td className="lb-date">{formatPostDate(video.timestamp)}</td>
                  <td><strong>{formatNumber(video.views)}</strong></td>
                  <td>{formatNumber(video.likes)}</td>
                  <td>{formatNumber(video.comments)}</td>
                  <td>
                    <span className="lb-conv" title={`Likes/vues ${formatPercent(video.like_rate)} · Com./vues ${formatPercent(video.comment_rate)}`}>
                      {formatPercent(video.conversion_score)}
                    </span>
                  </td>
                  <td>
                    <span
                      className="lb-followers-est"
                      title={followersEstHint(video.followers_gained_source)}
                    >
                      {video.followers_gained_est != null
                        ? `+${formatNumber(video.followers_gained_est)}`
                        : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
