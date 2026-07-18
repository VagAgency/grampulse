from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal

from hiker_provider import (
    HikerNotConfiguredError,
    HikerProfileNotFoundError,
    fetch_hiker_insights,
    fetch_hiker_metrics,
)
from mock_provider import MockPrivateProfileError, build_mock_insights

APIFY_TOKEN = os.getenv("APIFY_API_TOKEN", "").strip()
ACTOR_ID = os.getenv(
    "APIFY_INSTAGRAM_ACTOR",
    "aurican/instagram-creator-insights-api",
)
DEFAULT_POSTS_LIMIT = int(os.getenv("APIFY_POSTS_LIMIT", "25"))
MOCK_MODE = os.getenv("MOCK_INSTAGRAM", "auto").strip().lower()
PROVIDER = os.getenv("INSTAGRAM_PROVIDER", "auto").strip().lower()
HIKER_API_KEY = os.getenv("HIKERAPI_ACCESS_KEY", "").strip() or os.getenv("HIKER_API_TOKEN", "").strip()


class ApifyNotConfiguredError(RuntimeError):
    pass


class InstagramProfileNotFoundError(RuntimeError):
    pass


InstagramMode = Literal["mock", "hiker", "apify"]
SyncScope = Literal["metrics", "videos"]


def _hiker_key() -> str:
    return os.getenv("HIKERAPI_ACCESS_KEY", "").strip() or os.getenv("HIKER_API_TOKEN", "").strip()


def _apify_token() -> str:
    return os.getenv("APIFY_API_TOKEN", "").strip()


def get_instagram_mode() -> InstagramMode:
    if _use_mock():
        return "mock"
    provider = _resolve_provider()
    if provider == "hiker":
        return "hiker"
    return "apify"


def _use_mock() -> bool:
    if MOCK_MODE in {"1", "true", "yes", "on"}:
        return True
    if MOCK_MODE in {"0", "false", "no", "off"}:
        return False
    return not (_hiker_key() or _apify_token())


def _resolve_provider() -> str:
    if PROVIDER == "hiker":
        return "hiker"
    if PROVIDER == "apify":
        return "apify"
    if PROVIDER == "mock":
        return "mock"
    if _hiker_key():
        return "hiker"
    if _apify_token():
        return "apify"
    return "mock"


def fetch_instagram_insights(
    handle: str,
    *,
    force_refresh: bool = False,
    sync_scope: SyncScope = "videos",
) -> dict[str, Any]:
    handle = handle.lstrip("@").strip()
    if not handle:
        raise ValueError("Handle Instagram invalide")

    if _use_mock():
        try:
            return build_mock_insights(handle, force_refresh=force_refresh)
        except MockPrivateProfileError as exc:
            raise InstagramProfileNotFoundError(str(exc)) from exc

    provider = _resolve_provider()
    if provider == "hiker":
        try:
            if sync_scope == "metrics":
                return fetch_hiker_metrics(handle)
            return fetch_hiker_insights(handle)
        except HikerNotConfiguredError as exc:
            raise ApifyNotConfiguredError(str(exc)) from exc
        except HikerProfileNotFoundError as exc:
            raise InstagramProfileNotFoundError(str(exc)) from exc

    return _fetch_from_apify(handle, force_refresh=force_refresh)


def _fetch_from_apify(handle: str, *, force_refresh: bool = False) -> dict[str, Any]:
    token = _apify_token()
    if not token:
        raise ApifyNotConfiguredError(
            "Aucune API configurée. Ajoute HIKERAPI_ACCESS_KEY ou APIFY_API_TOKEN dans .env"
        )

    from apify_client import ApifyClient

    client = ApifyClient(token)
    run_input = {
        "handle": handle,
        "postsLimit": DEFAULT_POSTS_LIMIT,
        "enableAnalysis": True,
        "forceRefresh": force_refresh,
        "topPostsLimit": 10,
        "topHashtagsLimit": 10,
        "includeRaw": False,
    }

    run = client.actor(ACTOR_ID).call(run_input=run_input)
    items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
    if not items:
        raise InstagramProfileNotFoundError(f"Aucune donnée pour @{handle}")

    item = items[0]
    if item.get("error") or item.get("status") == "failed":
        message = item.get("error") or item.get("message") or "Profil introuvable ou privé"
        raise InstagramProfileNotFoundError(message)

    return item


def normalize_insights(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalise la réponse Hiker / Apify / mock vers un format stable."""
    profile = raw.get("profile") or raw.get("profileSummary") or {}
    analysis = raw.get("analysis") or raw.get("analytics") or {}

    followers = _int(profile.get("followers") or profile.get("followersCount") or profile.get("follower_count"))
    following = _int(profile.get("following") or profile.get("followsCount") or profile.get("following_count"))
    posts_count = _int(profile.get("posts") or profile.get("postsCount") or profile.get("media_count"))

    avg_likes = _float(analysis.get("avgLikes") or analysis.get("averageLikes"))
    avg_comments = _float(analysis.get("avgComments") or analysis.get("averageComments"))
    avg_engagement_rate = _float(
        analysis.get("avgEngagementRate")
        or analysis.get("averageEngagementRate")
        or analysis.get("engagementRate")
    )

    top_posts = (
        analysis.get("topPosts")
        or analysis.get("top_posts")
        or raw.get("topPosts")
        or raw.get("posts")
        or []
    )

    all_posts_source = raw.get("posts") or top_posts
    normalized_all_posts = _normalize_posts(all_posts_source)
    normalized_top_posts = sorted(
        normalized_all_posts,
        key=lambda p: (p.get("views") or 0, p.get("likes") or 0),
        reverse=True,
    )[:10]

    source = raw.get("_source") or ("mock" if raw.get("_mock") else get_instagram_mode())

    return {
        "handle": (profile.get("username") or raw.get("handle") or "").lstrip("@").lower(),
        "display_name": profile.get("fullName") or profile.get("name") or profile.get("full_name"),
        "bio": profile.get("biography") or profile.get("bio"),
        "profile_pic_url": profile.get("profilePicUrl") or profile.get("profilePictureUrl") or profile.get("profile_pic_url"),
        "website": profile.get("externalUrl") or profile.get("website"),
        "is_verified": bool(profile.get("verified") or profile.get("isVerified") or profile.get("is_verified")),
        "is_business": bool(profile.get("isBusinessAccount") or profile.get("businessCategory") or profile.get("is_business")),
        "followers": followers,
        "following": following,
        "posts_count": posts_count,
        "avg_likes": avg_likes,
        "avg_comments": avg_comments,
        "avg_engagement_rate": avg_engagement_rate,
        "median_engagement": _float(analysis.get("medianEngagement")),
        "top_hashtags": analysis.get("topHashtags") or [],
        "country_distribution": analysis.get("countryDistribution") or analysis.get("country_distribution") or [],
        "all_posts": normalized_all_posts,
        "top_posts": normalized_top_posts,
        "posts_analyzed": _int(analysis.get("postsAnalyzed") or analysis.get("sampleSize")),
        "is_mock": bool(raw.get("_mock")),
        "source": source,
        "raw": raw,
    }


def _normalize_posts(posts: list[Any]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for post in posts:
        if not isinstance(post, dict):
            continue
        normalized.append(
            {
                "url": post.get("url") or post.get("postUrl"),
                "type": post.get("type") or post.get("mediaType") or "post",
                "likes": _int(post.get("likes") or post.get("likesCount") or post.get("like_count")),
                "comments": _int(post.get("comments") or post.get("commentsCount") or post.get("comment_count")),
                "shares": _int(post.get("shares") or post.get("reshare_count") or post.get("share_count")),
                "views": _int(post.get("views") or post.get("videoViewCount") or post.get("playCount") or post.get("play_count")),
                "engagement": _float(post.get("engagement") or post.get("engagementRate")),
                "caption": (post.get("caption") or post.get("caption_text") or "")[:200],
                "timestamp": post.get("timestamp") or post.get("takenAt") or post.get("taken_at"),
                "code": post.get("code"),
                "media_id": post.get("media_id"),
                "video_url": post.get("video_url"),
                "thumbnail_url": post.get("thumbnail_url"),
            }
        )
    return normalized


def extract_daily_views_from_posts(
    normalized: dict[str, Any],
    *,
    max_days: int = 30,
) -> list[dict[str, Any]]:
    posts = list(normalized.get("top_posts") or [])
    raw = normalized.get("raw") or {}
    analysis = raw.get("analysis") or raw.get("analytics") or {}
    extra = analysis.get("topPosts") or analysis.get("posts") or raw.get("posts") or raw.get("topPosts") or []
    posts.extend(extra if isinstance(extra, list) else [])

    cutoff = date.today() - timedelta(days=max_days)
    by_day: dict[str, int] = {}
    for post in posts:
        if not isinstance(post, dict):
            continue
        day = _post_date(post)
        if not day or day < cutoff.isoformat():
            continue
        views = _int(
            post.get("views")
            or post.get("videoViewCount")
            or post.get("playCount")
            or post.get("play_count")
            or post.get("likes")
            or post.get("likesCount")
            or post.get("like_count")
        )
        if views is None or views <= 0:
            continue
        by_day[day] = by_day.get(day, 0) + views

    return [{"date": d, "views": v} for d, v in sorted(by_day.items())]


def estimate_views_today(normalized: dict[str, Any]) -> int:
    """Vues des posts publiés aujourd'hui (pas le total d'une vieille reel)."""
    today = date.today().isoformat()
    for point in extract_daily_views_from_posts(normalized, max_days=1):
        if point["date"] == today:
            return point["views"]

    if normalized.get("is_mock"):
        top_posts = normalized.get("top_posts") or []
        reel_views = [p.get("views") or 0 for p in top_posts if p.get("views")]
        if reel_views:
            return max(reel_views)
        avg_likes = normalized.get("avg_likes") or 0
        return max(100, int(avg_likes * 3))

    return 0


def compute_views_7d_from_posts(normalized: dict[str, Any]) -> int:
    """Somme des vues sur les posts publiés dans les 7 derniers jours."""
    cutoff = (date.today() - timedelta(days=6)).isoformat()
    return sum(
        point["views"]
        for point in extract_daily_views_from_posts(normalized, max_days=7)
        if point["date"] >= cutoff
    )


def _post_date(post: dict[str, Any]) -> str | None:
    ts = post.get("timestamp") or post.get("takenAt") or post.get("taken_at") or post.get("taken_at_ts")
    if not ts:
        return None
    if isinstance(ts, (int, float)):
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
        except (OSError, ValueError):
            return None
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).date().isoformat()
        except ValueError:
            return ts[:10] if len(ts) >= 10 else None
    return None


def _int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
