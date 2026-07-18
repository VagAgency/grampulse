from __future__ import annotations

import json
from datetime import date, datetime, timedelta

import database as db
from daily_refresh import get_daily_refresh_status
from health import compute_health_score
from instagram_provider import (
    ApifyNotConfiguredError,
    InstagramProfileNotFoundError,
    SyncScope,
    compute_views_7d_from_posts,
    estimate_views_today,
    extract_daily_views_from_posts,
    fetch_instagram_insights,
    get_instagram_mode,
    normalize_insights,
)
from mock_provider import derive_status, seed_daily_views


def _cached_sync_result(account: dict, snapshot: dict, *, message: str, next_available_at: str | None = None) -> dict:
    analysis = snapshot.get("analysis_json") or {}
    if isinstance(analysis, str):
        analysis = {}
    daily = db.get_account_daily_views(account["id"], days=1)
    views_today = int(daily[-1]["views"]) if daily else 0
    return {
        "account": account,
        "status": snapshot.get("status") or account.get("status"),
        "views_today": views_today,
        "health_score": snapshot.get("health_score"),
        "source": analysis.get("source") or get_instagram_mode(),
        "cached": True,
        "skipped": True,
        "sync_scope": analysis.get("sync_scope") or "metrics",
        "last_synced_at": snapshot.get("fetched_at"),
        "message": message,
        "next_available_at": next_available_at,
    }


def _maybe_skip_daily_refresh(
    email: str,
    model_id: int,
    handle: str,
    *,
    force_refresh: bool,
    daily_batch: bool,
    override_daily_limit: bool = False,
    sync_scope: SyncScope = "metrics",
) -> dict | None:
    if sync_scope != "metrics":
        return None
    if not force_refresh or daily_batch or override_daily_limit or get_instagram_mode() == "mock":
        return None

    account = db.get_tracked_account(email, handle, model_id=model_id)
    if not account:
        return None
    snapshot = db.get_latest_snapshot(account["id"])
    if not snapshot:
        return None

    status = get_daily_refresh_status(email)
    if not status.used_this_period:
        return None

    return _cached_sync_result(
        account,
        snapshot,
        message=status.message_when_blocked(),
        next_available_at=status.next_available_at.isoformat(),
    )


def _snapshot_analysis(snapshot: dict | None) -> dict:
    if not snapshot:
        return {}
    analysis = snapshot.get("analysis_json") or {}
    if isinstance(analysis, str):
        try:
            analysis = json.loads(analysis)
        except json.JSONDecodeError:
            analysis = {}
    return analysis if isinstance(analysis, dict) else {}


def _snapshot_top_posts(snapshot: dict | None) -> list[dict]:
    if not snapshot:
        return []
    top_posts = snapshot.get("top_posts_json") or []
    if isinstance(top_posts, str):
        try:
            top_posts = json.loads(top_posts)
        except json.JSONDecodeError:
            top_posts = []
    return top_posts if isinstance(top_posts, list) else []


def _apply_metrics_snapshot_merge(
    normalized: dict,
    prev_snapshot: dict | None,
    *,
    score: int,
    label: str,
    breakdown: dict,
    top_posts: list[dict],
) -> tuple[int, str, dict, list[dict], float | None, float | None, float | None, dict]:
    """Conserve top vidéos / analyse lors d'un refresh métriques."""
    if not prev_snapshot:
        return score, label, breakdown, top_posts, None, None, None, normalized.get("raw") or {}

    prev_analysis = _snapshot_analysis(prev_snapshot)
    merged_top = _snapshot_top_posts(prev_snapshot) or top_posts
    merged_score = int(prev_snapshot.get("health_score") or score)
    merged_label = str(prev_snapshot.get("health_label") or label)
    merged_breakdown = prev_analysis.get("breakdown") or breakdown

    return (
        merged_score,
        merged_label,
        merged_breakdown,
        merged_top,
        prev_snapshot.get("avg_engagement_rate"),
        prev_snapshot.get("avg_likes"),
        prev_snapshot.get("avg_comments"),
        normalized.get("raw") or {},
    )


def sync_account(
    email: str,
    model_id: int,
    handle: str,
    *,
    force_refresh: bool = False,
    daily_batch: bool = False,
    override_daily_limit: bool = False,
    sync_scope: SyncScope = "metrics",
) -> dict:
    handle = handle.lstrip("@").lower()
    is_mock = get_instagram_mode() == "mock"

    cached = _maybe_skip_daily_refresh(
        email,
        model_id,
        handle,
        force_refresh=force_refresh,
        daily_batch=daily_batch,
        override_daily_limit=override_daily_limit,
        sync_scope=sync_scope,
    )
    if cached:
        return cached

    existing = db.get_tracked_account(email, handle, model_id=model_id)
    prev_snapshot = db.get_latest_snapshot(existing["id"]) if existing else None

    try:
        raw = fetch_instagram_insights(handle, force_refresh=force_refresh, sync_scope=sync_scope)
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

    avg_engagement_rate = normalized.get("avg_engagement_rate")
    avg_likes = normalized.get("avg_likes")
    avg_comments = normalized.get("avg_comments")
    raw_payload = normalized.get("raw") or {}

    if sync_scope == "metrics":
        (
            score,
            label,
            breakdown,
            top_posts,
            avg_engagement_rate,
            avg_likes,
            avg_comments,
            raw_payload,
        ) = _apply_metrics_snapshot_merge(
            normalized,
            prev_snapshot,
            score=score,
            label=label,
            breakdown=breakdown,
            top_posts=top_posts,
        )
        if avg_engagement_rate is None:
            avg_engagement_rate = normalized.get("avg_engagement_rate")
        if avg_likes is None:
            avg_likes = normalized.get("avg_likes")
        if avg_comments is None:
            avg_comments = normalized.get("avg_comments")

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
        db.clear_account_daily_views(account["id"])
        for point in extract_daily_views_from_posts(normalized, max_days=30):
            db.upsert_daily_view(
                tracked_account_id=account["id"],
                day=point["date"],
                views=point["views"],
            )

    db.upsert_daily_view(
        tracked_account_id=account["id"],
        day=date.today().isoformat(),
        views=views_today,
        followers=normalized.get("followers"),
    )

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

    prev_analysis = _snapshot_analysis(prev_snapshot)
    analysis_posts = (
        (prev_analysis.get("all_posts") or top_posts)
        if sync_scope == "metrics"
        else (normalized.get("all_posts") or top_posts)
    )

    db.save_snapshot(
        tracked_account_id=account["id"],
        followers=normalized.get("followers"),
        following=normalized.get("following"),
        posts_count=normalized.get("posts_count"),
        avg_engagement_rate=avg_engagement_rate,
        avg_likes=avg_likes,
        avg_comments=avg_comments,
        health_score=score,
        health_label=label,
        top_posts=top_posts,
        analysis={
            "breakdown": breakdown,
            "median_engagement": (
                prev_analysis.get("median_engagement")
                if sync_scope == "metrics" and prev_analysis.get("median_engagement") is not None
                else normalized.get("median_engagement")
            ),
            "top_hashtags": (
                prev_analysis.get("top_hashtags")
                if sync_scope == "metrics" and prev_analysis.get("top_hashtags")
                else normalized.get("top_hashtags")
            ),
            "country_distribution": (
                prev_analysis.get("country_distribution")
                if sync_scope == "metrics" and prev_analysis.get("country_distribution")
                else normalized.get("country_distribution")
            ),
            "all_posts": analysis_posts,
            "posts_analyzed": (
                prev_analysis.get("posts_analyzed")
                if sync_scope == "metrics" and prev_analysis.get("posts_analyzed")
                else normalized.get("posts_analyzed")
            ),
            "bio": normalized.get("bio"),
            "is_verified": normalized.get("is_verified"),
            "is_business": normalized.get("is_business"),
            "source": get_instagram_mode(),
            "sync_scope": sync_scope,
        },
        raw=raw_payload,
        status=status,
    )

    return {
        "account": account,
        "status": status,
        "views_today": views_today,
        "health_score": score,
        "source": get_instagram_mode(),
        "cached": False,
        "skipped": False,
        "sync_scope": sync_scope,
    }
