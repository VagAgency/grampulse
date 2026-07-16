from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from instagram_provider import _post_date
from video_metrics import collect_account_posts, filter_posts_by_days


def classify_post_type(post: dict) -> str:
    post_type = (post.get("type") or "post").lower()
    if post_type == "story":
        return "stories"
    if post_type == "reel" or int(post.get("views") or 0) > 0:
        return "reels"
    return "posts"


def count_posts_on_date(posts: list[dict], day: str) -> dict[str, int]:
    counts = {"reels": 0, "posts": 0, "stories": 0}
    for post in posts:
        if _post_date(post) != day:
            continue
        key = classify_post_type(post)
        counts[key] += 1
    return counts


def count_posts_in_period(posts: list[dict], days: int) -> dict[str, int]:
    period_posts = filter_posts_by_days(posts, days)
    counts = {"reels": 0, "posts": 0, "stories": 0}
    for post in period_posts:
        counts[classify_post_type(post)] += 1
    return counts


def build_account_activity_row(
    account: dict,
    snapshot: dict | None,
    *,
    day: str | None = None,
    days: int | None = None,
) -> dict[str, Any]:
    posts = collect_account_posts(snapshot)
    if day:
        counts = count_posts_on_date(posts, day)
    else:
        counts = count_posts_in_period(posts, days or 30)

    return {
        "account_id": account["id"],
        "handle": account["handle"],
        "model_id": account.get("model_id"),
        "model_name": account.get("model_name"),
        "va_id": account.get("va_id"),
        "va_name": account.get("va_name"),
        "va_emoji": account.get("va_emoji"),
        "reels": counts["reels"],
        "posts": counts["posts"],
        "stories": counts["stories"],
        "total": counts["reels"] + counts["posts"] + counts["stories"],
    }


def aggregate_va_stats(
    rows: list[dict],
    *,
    metric: str = "views",
) -> list[dict]:
    by_va: dict[int | None, dict] = {}

    for row in rows:
        va_id = row.get("va_id")
        if va_id is None:
            continue
        bucket = by_va.setdefault(
            va_id,
            {
                "va_id": va_id,
                "va_name": row.get("va_name"),
                "va_emoji": row.get("va_emoji"),
                "accounts_count": 0,
                "views": 0,
                "followers": 0,
                "reels": 0,
                "posts": 0,
                "stories": 0,
                "publications": 0,
                "engagement_sum": 0.0,
                "engagement_count": 0,
                "accounts": [],
            },
        )
        bucket["accounts_count"] += 1
        bucket["views"] += int(row.get("views") or 0)
        bucket["followers"] += int(row.get("followers") or 0)
        bucket["reels"] += int(row.get("reels") or 0)
        bucket["posts"] += int(row.get("posts") or 0)
        bucket["stories"] += int(row.get("stories") or 0)
        bucket["publications"] += int(row.get("reels") or 0) + int(row.get("posts") or 0) + int(row.get("stories") or 0)
        if row.get("avg_engagement_rate") is not None:
            bucket["engagement_sum"] += float(row["avg_engagement_rate"])
            bucket["engagement_count"] += 1
        bucket["accounts"].append(
            {
                "id": row.get("account_id"),
                "handle": row.get("handle"),
                "model_name": row.get("model_name"),
                "views": row.get("views"),
                "reels": row.get("reels"),
                "posts": row.get("posts"),
                "stories": row.get("stories"),
            }
        )

    ranking = []
    for bucket in by_va.values():
        bucket["avg_engagement"] = (
            round(bucket["engagement_sum"] / bucket["engagement_count"], 2)
            if bucket["engagement_count"]
            else None
        )
        del bucket["engagement_sum"]
        del bucket["engagement_count"]
        ranking.append(bucket)

    sort_key = {
        "views": lambda v: (v["views"], v["publications"], v["followers"]),
        "publications": lambda v: (v["publications"], v["views"], v["reels"]),
        "reels": lambda v: (v["reels"], v["views"], v["publications"]),
    }.get(metric, lambda v: (v["views"], v["publications"]))

    ranking.sort(key=sort_key, reverse=True)
    for i, item in enumerate(ranking, start=1):
        item["rank"] = i
    return ranking


def default_suivi_date() -> str:
    return date.today().isoformat()


def shift_date(day: str, offset: int) -> str:
    base = date.fromisoformat(day)
    return (base + timedelta(days=offset)).isoformat()
