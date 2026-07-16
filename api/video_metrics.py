from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from instagram_provider import _post_date


def period_cutoff(days: int) -> str:
    return (date.today() - timedelta(days=days - 1)).isoformat()


def filter_posts_by_days(posts: list[dict], days: int) -> list[dict]:
    cutoff = period_cutoff(days)
    end = date.today().isoformat()
    filtered = []
    for post in posts:
        day = _post_date(post)
        if day and cutoff <= day <= end:
            filtered.append(post)
    return filtered


def compute_conversion_score(post: dict) -> float | None:
    views = int(post.get("views") or 0)
    if views <= 0:
        return None
    interactions = (
        int(post.get("likes") or 0)
        + int(post.get("comments") or 0)
        + int(post.get("shares") or 0)
    )
    return round((interactions / views) * 100, 2)


def _follower_delta_on_day(day: str, daily_followers: list[dict]) -> int | None:
    by_date = {p["date"]: int(p["followers"]) for p in daily_followers if p.get("followers") is not None}
    dates = sorted(by_date.keys())
    if day not in by_date:
        return None
    idx = dates.index(day)
    if idx <= 0:
        return None
    delta = by_date[dates[idx]] - by_date[dates[idx - 1]]
    return delta if delta > 0 else 0


def _period_follower_growth(daily_followers: list[dict], days: int) -> int:
    cutoff = period_cutoff(days)
    points = sorted(
        [
            {"date": p["date"], "followers": int(p["followers"])}
            for p in daily_followers
            if p.get("followers") is not None and p["date"] >= cutoff
        ],
        key=lambda x: x["date"],
    )
    if len(points) < 2:
        return 0
    growth = points[-1]["followers"] - points[0]["followers"]
    return max(0, growth)


def _post_key(post: dict) -> str:
    return str(post.get("code") or post.get("url") or post.get("timestamp") or id(post))


def estimate_followers_gained(
    post: dict,
    posts_in_period: list[dict],
    daily_followers: list[dict],
    *,
    days: int,
) -> tuple[int | None, str]:
    day = _post_date(post)
    if day:
        delta = _follower_delta_on_day(day, daily_followers)
        if delta is not None and delta > 0:
            same_day = [p for p in posts_in_period if _post_date(p) == day]
            share = delta / max(len(same_day), 1)
            return round(share), "daily_delta"

    growth = _period_follower_growth(daily_followers, days)
    if growth > 0:
        interactions = int(post.get("likes") or 0) + int(post.get("comments") or 0)
        total = sum(int(p.get("likes") or 0) + int(p.get("comments") or 0) for p in posts_in_period)
        if total > 0 and interactions > 0:
            return round(growth * interactions / total), "period_share"

    engagers = int(post.get("likes") or 0) + int(post.get("comments") or 0)
    if engagers > 0:
        return round(engagers * 0.01), "heuristic"

    return None, "none"


def enrich_post(
    post: dict,
    posts_in_period: list[dict],
    daily_followers: list[dict],
    *,
    days: int,
) -> dict:
    conversion = compute_conversion_score(post)
    followers_est, followers_source = estimate_followers_gained(
        post, posts_in_period, daily_followers, days=days
    )
    enriched = dict(post)
    enriched["conversion_score"] = conversion
    enriched["followers_gained_est"] = followers_est
    enriched["followers_gained_source"] = followers_source
    if conversion is not None and int(post.get("views") or 0) > 0:
        views = int(post["views"])
        enriched["like_rate"] = round((int(post.get("likes") or 0) / views) * 100, 2)
        enriched["comment_rate"] = round((int(post.get("comments") or 0) / views) * 100, 2)
    else:
        enriched["like_rate"] = None
        enriched["comment_rate"] = None
    return enriched


def enrich_posts(
    posts: list[dict],
    daily_followers: list[dict],
    *,
    days: int,
) -> list[dict]:
    period_posts = filter_posts_by_days(posts, days)
    reels = [p for p in period_posts if p.get("type") == "reel" or int(p.get("views") or 0) > 0]
    return [enrich_post(p, reels, daily_followers, days=days) for p in reels]


def sort_posts(posts: list[dict], sort: str = "views") -> list[dict]:
    if sort == "conversion":
        return sorted(
            posts,
            key=lambda p: (
                p.get("conversion_score") or 0,
                p.get("views") or 0,
                p.get("likes") or 0,
            ),
            reverse=True,
        )
    return sorted(
        posts,
        key=lambda p: (
            p.get("views") or 0,
            p.get("conversion_score") or 0,
            p.get("likes") or 0,
        ),
        reverse=True,
    )


def build_leaderboard(
    posts: list[dict],
    daily_followers: list[dict],
    *,
    days: int,
    sort: str = "views",
    limit: int = 10,
) -> list[dict]:
    enriched = enrich_posts(posts, daily_followers, days=days)
    return sort_posts(enriched, sort)[:limit]


def collect_account_posts(snapshot: dict | None) -> list[dict]:
    if not snapshot:
        return []
    analysis = snapshot.get("analysis_json") or snapshot.get("analysis") or {}
    if isinstance(analysis, str):
        import json

        analysis = json.loads(analysis)
    top_posts = snapshot.get("top_posts_json") or snapshot.get("top_posts") or []
    if isinstance(top_posts, str):
        import json

        top_posts = json.loads(top_posts)
    return (analysis or {}).get("all_posts") or top_posts or []
