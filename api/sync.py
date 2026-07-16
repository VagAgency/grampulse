from __future__ import annotations

from datetime import date, timedelta

import database as db
from health import compute_health_score
from instagram_provider import (
    ApifyNotConfiguredError,
    InstagramProfileNotFoundError,
    compute_views_7d_from_posts,
    estimate_views_today,
    extract_daily_views_from_posts,
    fetch_instagram_insights,
    get_instagram_mode,
    normalize_insights,
)
from mock_provider import derive_status, seed_daily_views


def sync_account(email: str, model_id: int, handle: str, *, force_refresh: bool = False) -> dict:
    handle = handle.lstrip("@").lower()
    is_mock = get_instagram_mode() == "mock"

    try:
        raw = fetch_instagram_insights(handle, force_refresh=force_refresh)
        normalized = normalize_insights(raw)
    except ApifyNotConfiguredError as exc:
        raise exc
    except InstagramProfileNotFoundError as exc:
        raise exc
    except Exception as exc:
        raise RuntimeError(f"Erreur sync : {exc}") from exc

    score, label, breakdown = compute_health_score(normalized)
    top_posts = normalized.get("top_posts") or []
    views_today = estimate_views_today(normalized)

    account = db.add_tracked_account(
        user_email=email,
        model_id=model_id,
        handle=normalized["handle"] or handle,
        display_name=normalized.get("display_name"),
        profile_pic_url=normalized.get("profile_pic_url"),
    )

    if is_mock:
        for point in extract_daily_views_from_posts(normalized):
            db.upsert_daily_view(
                tracked_account_id=account["id"],
                day=point["date"],
                views=point["views"],
                followers=normalized.get("followers") if point["date"] == date.today().isoformat() else None,
            )
    else:
        # Données réelles : reconstruire l'historique depuis les posts (30j max)
        db.clear_account_daily_views(account["id"])
        for point in extract_daily_views_from_posts(normalized, max_days=30):
            db.upsert_daily_view(
                tracked_account_id=account["id"],
                day=point["date"],
                views=point["views"],
            )

    # Point du jour (0 si aucun post publié aujourd'hui en mode réel)
    db.upsert_daily_view(
        tracked_account_id=account["id"],
        day=date.today().isoformat(),
        views=views_today,
        followers=normalized.get("followers"),
    )

    # Mock uniquement : générer 30j de courbes si pas assez d'historique
    if is_mock and len(db.get_account_daily_views(account["id"], days=30)) < 7:
        seed_daily_views(account["id"], handle, days=30)

    daily = db.get_account_daily_views(account["id"], days=14)
    if is_mock:
        views_7d = sum(d["views"] for d in daily[-7:]) if daily else views_today * 7
        views_prev = sum(d["views"] for d in daily[-14:-7]) if len(daily) >= 14 else views_7d
    else:
        views_7d = compute_views_7d_from_posts(normalized)
        views_prev = sum(
            point["views"]
            for point in extract_daily_views_from_posts(normalized, max_days=14)
            if point["date"] < (date.today() - timedelta(days=6)).isoformat()
            and point["date"] >= (date.today() - timedelta(days=13)).isoformat()
        )
    status = derive_status(score, views_7d, views_prev, profile=None)

    db.save_snapshot(
        tracked_account_id=account["id"],
        followers=normalized.get("followers"),
        following=normalized.get("following"),
        posts_count=normalized.get("posts_count"),
        avg_engagement_rate=normalized.get("avg_engagement_rate"),
        avg_likes=normalized.get("avg_likes"),
        avg_comments=normalized.get("avg_comments"),
        health_score=score,
        health_label=label,
        top_posts=top_posts,
        analysis={
            "breakdown": breakdown,
            "median_engagement": normalized.get("median_engagement"),
            "top_hashtags": normalized.get("top_hashtags"),
            "country_distribution": normalized.get("country_distribution"),
            "all_posts": normalized.get("all_posts") or top_posts,
            "posts_analyzed": normalized.get("posts_analyzed"),
            "bio": normalized.get("bio"),
            "is_verified": normalized.get("is_verified"),
            "is_business": normalized.get("is_business"),
            "source": get_instagram_mode(),
        },
        raw=normalized.get("raw") or {},
        status=status,
    )

    return {
        "account": account,
        "status": status,
        "views_today": views_today,
        "health_score": score,
        "source": get_instagram_mode(),
    }
