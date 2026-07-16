from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from auth import require_access
import database as db
from linkscale_provider import parse_linkscale_url, resolve_tracking_host, fetch_project_stats
from linkscale_sync import sync_account_linkscale_clicks
from video_metrics import build_leaderboard, collect_account_posts, enrich_posts, sort_posts

router = APIRouter(prefix="/models", tags=["models"])

MAX_ACCOUNTS_PER_MODEL = int(os.getenv("MAX_ACCOUNTS_PER_MODEL", "20"))


class CreateModelBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)


class UpdateModelBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)


class AddAccountBody(BaseModel):
    handle: str = Field(..., min_length=1, max_length=64)


class AssignVaBody(BaseModel):
    va_id: Optional[int] = None


class AssignLinkscaleBody(BaseModel):
    linkscale_url: Optional[str] = Field(default=None, max_length=500)


def _user_email(x_user_email: Optional[str]) -> str:
    return require_access(x_user_email)


def _assert_model(email: str, model_id: int) -> dict:
    model = db.get_model(email, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Modèle introuvable.")
    return model


@router.get("")
def list_models(x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    return {"models": db.list_models(email)}


@router.post("")
def create_model(body: CreateModelBody, x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    try:
        model = db.create_model(user_email=email, name=body.name)
    except Exception as exc:
        if "UNIQUE" in str(exc):
            raise HTTPException(status_code=400, detail="Ce modèle existe déjà.") from exc
        raise
    return {"model": model}


@router.patch("/{model_id}")
def update_model(
    model_id: int,
    body: UpdateModelBody,
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    _assert_model(email, model_id)
    try:
        model = db.update_model(user_email=email, model_id=model_id, name=body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not model:
        raise HTTPException(status_code=404, detail="Modèle introuvable.")
    return {"model": model}


@router.get("/{model_id}")
def get_model_detail(model_id: int, x_user_email: Optional[str] = Header(default=None), days: int = 30):
    email = _user_email(x_user_email)
    model = _assert_model(email, model_id)
    days = max(7, min(days, 90))
    accounts = db.list_accounts_for_model(email, model_id)
    account_series = []
    for acc in accounts:
        followers = db.get_account_follower_history(acc["id"], days=days)
        if not followers and acc.get("followers") is not None:
            from datetime import date

            followers = [{"date": date.today().isoformat(), "followers": int(acc["followers"])}]
        account_series.append(
            {
                "id": acc["id"],
                "handle": acc["handle"],
                "label": acc["display_name"] or f"@{acc['handle']}",
                "followers": acc.get("followers"),
                "daily_views": db.get_account_daily_views(acc["id"], days=days),
                "daily_followers": followers,
                "daily_clicks": db.get_account_daily_clicks(acc["id"], days=days),
            }
        )
    video_leaderboard = []
    for acc in accounts:
        snapshot = db.get_latest_snapshot(acc["id"])
        posts = collect_account_posts(snapshot)
        if not posts:
            continue
        followers = db.get_account_follower_history(acc["id"], days=days)
        if not followers and acc.get("followers") is not None:
            from datetime import date

            followers = [{"date": date.today().isoformat(), "followers": int(acc["followers"])}]
        for entry in build_leaderboard(posts, followers, days=days, sort="views", limit=50):
            video_leaderboard.append(
                {
                    **entry,
                    "account_id": acc["id"],
                    "account_handle": acc["handle"],
                    "model_id": model_id,
                    "model_name": model["name"],
                }
            )
    video_leaderboard = sorted(
        video_leaderboard,
        key=lambda p: (p.get("views") or 0, p.get("conversion_score") or 0),
        reverse=True,
    )[:15]

    return {
        "model": model,
        "accounts": accounts,
        "daily_views": db.get_model_daily_views(model_id, days=days),
        "daily_followers": db.get_model_daily_followers(model_id, days=days),
        "daily_clicks": db.get_model_daily_clicks(model_id, days=days),
        "account_series": account_series,
        "video_leaderboard": video_leaderboard,
        "summary": {
            "accounts_count": len(accounts),
            "assigned_vas": len({a.get("va_id") for a in accounts if a.get("va_id")}),
            "views_today": sum(a.get("views_today") or 0 for a in accounts),
            "views_7d": sum(a.get("views_7d") or 0 for a in accounts),
            "actif": sum(1 for a in accounts if a.get("status") == "actif"),
            "meilleur": sum(1 for a in accounts if a.get("status") == "meilleur"),
            "shadowban": sum(1 for a in accounts if a.get("status") == "shadowban"),
            "ban": sum(1 for a in accounts if a.get("status") == "ban"),
        },
    }


@router.delete("/{model_id}")
def delete_model(model_id: int, x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    if not db.delete_model(email, model_id):
        raise HTTPException(status_code=404, detail="Modèle introuvable.")
    return {"ok": True}


@router.get("/{model_id}/accounts")
def list_accounts(model_id: int, x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    _assert_model(email, model_id)
    return {"accounts": db.list_accounts_for_model(email, model_id)}


@router.post("/{model_id}/accounts")
def add_account(
    model_id: int,
    body: AddAccountBody,
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    _assert_model(email, model_id)
    accounts = db.list_accounts_for_model(email, model_id)
    if len(accounts) >= MAX_ACCOUNTS_PER_MODEL:
        raise HTTPException(status_code=400, detail=f"Limite : {MAX_ACCOUNTS_PER_MODEL} comptes par modèle.")
    result = sync_account(email, model_id, body.handle)
    return result


@router.post("/{model_id}/accounts/{handle}/refresh")
async def refresh_account(
    model_id: int,
    handle: str,
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    account = db.get_tracked_account(email, handle, model_id=model_id)
    if not account:
        raise HTTPException(status_code=404, detail="Compte introuvable.")
    return await run_in_threadpool(
        sync_account,
        email,
        model_id,
        handle,
        force_refresh=True,
    )


@router.patch("/{model_id}/accounts/{handle}/va")
def assign_account_va(
    model_id: int,
    handle: str,
    body: AssignVaBody,
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    _assert_model(email, model_id)
    account = db.get_tracked_account(email, handle, model_id=model_id)
    if not account:
        raise HTTPException(status_code=404, detail="Compte introuvable.")
    try:
        updated = db.assign_account_va(
            user_email=email,
            account_id=account["id"],
            va_id=body.va_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Compte introuvable.")
    return {"account": updated}


@router.patch("/{model_id}/accounts/{handle}/linkscale")
def assign_account_linkscale(
    model_id: int,
    handle: str,
    body: AssignLinkscaleBody,
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    _assert_model(email, model_id)
    account = db.get_tracked_account(email, handle, model_id=model_id)
    if not account:
        raise HTTPException(status_code=404, detail="Compte introuvable.")

    raw_url = (body.linkscale_url or "").strip() or None
    host = None
    slug = None
    if raw_url:
        try:
            parsed = parse_linkscale_url(raw_url)
            host = parsed["host"]
            slug = parsed["slug"]
            try:
                stats = fetch_project_stats(days=30)
                host = resolve_tracking_host(stats, slug, preferred_host=host) or host
            except Exception:
                pass
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    updated = db.update_account_linkscale(
        user_email=email,
        account_id=account["id"],
        linkscale_url=raw_url,
        linkscale_host=host,
        linkscale_slug=slug,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Compte introuvable.")

    sync_result = None
    if raw_url:
        try:
            sync_result = sync_account_linkscale_clicks(updated, days=90, user_email=email)
        except Exception:
            sync_result = {"synced": False}

    return {"account": updated, "linkscale_sync": sync_result}


@router.delete("/{model_id}/accounts/{handle}")
def delete_account(
    model_id: int,
    handle: str,
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    if not db.remove_tracked_account(email, handle, model_id=model_id):
        raise HTTPException(status_code=404, detail="Compte introuvable.")
    return {"ok": True}


@router.get("/{model_id}/accounts/{handle}")
def get_account_detail(
    model_id: int,
    handle: str,
    x_user_email: Optional[str] = Header(default=None),
    days: int = 30,
):
    email = _user_email(x_user_email)
    _assert_model(email, model_id)
    account = db.get_tracked_account(email, handle, model_id=model_id)
    if not account:
        raise HTTPException(status_code=404, detail="Compte introuvable.")
    days = max(7, min(days, 90))
    enriched = next(
        (a for a in db.list_accounts_for_model(email, model_id) if a["handle"] == handle.lstrip("@").lower()),
        account,
    )
    snapshot = db.get_latest_snapshot(account["id"])
    daily_views = db.get_account_daily_views(account["id"], days=days)
    daily_followers = db.get_account_follower_history(account["id"], days=days)
    if not daily_followers and snapshot and snapshot.get("followers") is not None:
        from datetime import date
        daily_followers = [{"date": date.today().isoformat(), "followers": int(snapshot["followers"])}]

    posts = collect_account_posts(snapshot)
    video_leaderboard = sort_posts(
        enrich_posts(posts, daily_followers, days=days),
        sort="views",
    )

    return {
        "account": enriched,
        "snapshot": _public_snapshot(snapshot) if snapshot else None,
        "daily_views": [{"date": row["date"], "views": row["views"]} for row in daily_views],
        "daily_followers": daily_followers,
        "daily_clicks": db.get_account_daily_clicks(account["id"], days=days),
        "video_leaderboard": video_leaderboard,
    }


def _public_snapshot(snapshot: dict) -> dict:
    top_posts = snapshot.get("top_posts_json")
    analysis = snapshot.get("analysis_json")
    if isinstance(top_posts, str):
        import json
        top_posts = json.loads(top_posts)
    if isinstance(analysis, str):
        import json
        analysis = json.loads(analysis)
    return {
        "followers": snapshot.get("followers"),
        "following": snapshot.get("following"),
        "posts_count": snapshot.get("posts_count"),
        "avg_engagement_rate": snapshot.get("avg_engagement_rate"),
        "avg_likes": snapshot.get("avg_likes"),
        "avg_comments": snapshot.get("avg_comments"),
        "health_score": snapshot.get("health_score"),
        "health_label": snapshot.get("health_label"),
        "top_posts": top_posts or [],
        "all_posts": (analysis or {}).get("all_posts") or top_posts or [],
        "analysis": analysis or {},
        "country_distribution": (analysis or {}).get("country_distribution") or [],
        "fetched_at": snapshot.get("fetched_at"),
    }
