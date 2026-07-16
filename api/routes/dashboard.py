from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from auth import require_access
import database as db
from video_metrics import build_leaderboard, collect_account_posts

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def global_dashboard(x_user_email: Optional[str] = Header(default=None), days: int = 30):
    email = require_access(x_user_email)
    days = max(7, min(days, 90))
    models = db.list_models(email)
    model_series = [
        {
            "id": m["id"],
            "name": m["name"],
            "daily_views": db.get_model_daily_views(m["id"], days=days),
            "daily_followers": db.get_model_daily_followers(m["id"], days=days),
            "daily_clicks": db.get_model_daily_clicks(m["id"], days=days),
        }
        for m in models
    ]
    account_series = []
    for m in models:
        for acc in db.list_accounts_for_model(email, m["id"]):
            followers = db.get_account_follower_history(acc["id"], days=days)
            if not followers and acc.get("followers") is not None:
                from datetime import date

                followers = [{"date": date.today().isoformat(), "followers": int(acc["followers"])}]
            account_series.append(
                {
                    "id": acc["id"],
                    "handle": acc["handle"],
                    "model_id": m["id"],
                    "model_name": m["name"],
                    "label": f"@{acc['handle']}",
                    "followers": acc.get("followers"),
                    "daily_views": db.get_account_daily_views(acc["id"], days=days),
                    "daily_followers": followers,
                    "daily_clicks": db.get_account_daily_clicks(acc["id"], days=days),
                }
            )
    video_leaderboard = []
    for m in models:
        for acc in db.list_accounts_for_model(email, m["id"]):
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
                        "model_id": m["id"],
                        "model_name": m["name"],
                    }
                )
    video_leaderboard = sorted(
        video_leaderboard,
        key=lambda p: (p.get("views") or 0, p.get("conversion_score") or 0),
        reverse=True,
    )[:15]

    return {
        "summary": db.get_global_summary(email),
        "models": models,
        "daily_views": db.get_global_daily_views(email, days=days),
        "model_series": model_series,
        "account_series": account_series,
        "video_leaderboard": video_leaderboard,
    }
