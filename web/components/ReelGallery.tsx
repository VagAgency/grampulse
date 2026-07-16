"use client";

import { useMemo, useState } from "react";
import {
  ReelPost,
  VideoSortMode,
  filterLeaderboardByDays,
  formatNumber,
  formatPercent,
  formatPostDate,
  followersEstHint,
  sortVideoLeaderboard,
} from "@/lib/api";

type Props = {
  posts: ReelPost[];
  title?: string;
  hint?: string;
  emptyHint?: string;
  mode?: VideoSortMode;
  onModeChange?: (mode: VideoSortMode) => void;
  showModeToggle?: boolean;
  days?: number;
};

export function ReelGallery({
  posts,
  title = "Top vidéos",
  hint,
  emptyHint,
  mode: controlledMode,
  onModeChange,
  showModeToggle = false,
  days,
}: Props) {
  const [internalMode, setInternalMode] = useState<VideoSortMode>("performance");
  const mode = controlledMode ?? internalMode;

  function setMode(next: VideoSortMode) {
    if (onModeChange) onModeChange(next);
    else setInternalMode(next);
  }

  const reels = useMemo(() => {
    const inPeriod = days != null ? filterLeaderboardByDays(posts, days) : posts;
    const filtered = inPeriod.filter((p) => p.type === "reel" || (p.views && p.views > 0));
    return sortVideoLeaderboard(filtered, mode);
  }, [posts, mode, days]);

  return (
    <div className="reel-gallery-wrap">
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

      {mode === "conversion" && showModeToggle && (
        <p className="hint video-leaderboard-mode-hint">
          Classement par taux de conversion : (likes + commentaires + partages) ÷ vues.
        </p>
      )}

      {!reels.length ? (
        <p className="hint">{emptyHint || "Aucun reel à afficher pour cette période."}</p>
      ) : (
        <div className="reel-gallery">
          {reels.map((post, i) => (
            <ReelCard key={post.code || post.url || i} post={post} rank={i + 1} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReelCard({
  post,
  rank,
  mode,
}: {
  post: ReelPost;
  rank: number;
  mode: VideoSortMode;
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const hasVideo = Boolean(post.video_url) && !videoFailed;

  return (
    <article className="reel-card">
      <div className="reel-media">
        {hasVideo ? (
          <video
            src={post.video_url!}
            poster={post.thumbnail_url || undefined}
            controls
            playsInline
            preload="metadata"
            className="reel-video"
            onError={() => setVideoFailed(true)}
          />
        ) : post.thumbnail_url ? (
          <img src={post.thumbnail_url} alt="" className="reel-thumb" />
        ) : (
          <div className="reel-thumb-fallback">Reel #{rank}</div>
        )}
        <span className="reel-rank">#{rank}</span>
        {mode === "conversion" && post.conversion_score != null && (
          <span className="reel-rank-badge conv">{formatPercent(post.conversion_score)}</span>
        )}
      </div>

      <div className="reel-meta">
        <p className="reel-date">Publié le {formatPostDate(post.timestamp)}</p>
        <div className="reel-stats">
          <span title="Vues">👁 {formatNumber(post.views)}</span>
          <span title="Likes">♥ {formatNumber(post.likes)}</span>
          <span title="Commentaires">💬 {formatNumber(post.comments)}</span>
          <span title="Partages">↗ {formatNumber(post.shares)}</span>
        </div>
        <div className="reel-extra-stats">
          {post.conversion_score != null && (
            <span title={`Likes/vues ${formatPercent(post.like_rate)} · Com./vues ${formatPercent(post.comment_rate)}`}>
              Conv. {formatPercent(post.conversion_score)}
            </span>
          )}
          {post.followers_gained_est != null && (
            <span title={followersEstHint(post.followers_gained_source)}>
              +{formatNumber(post.followers_gained_est)} abonnés est.
            </span>
          )}
        </div>
        {post.caption && <p className="reel-caption">{post.caption}</p>}
        {post.url && (
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="reel-link">
            Voir sur Instagram →
          </a>
        )}
      </div>
    </article>
  );
}
