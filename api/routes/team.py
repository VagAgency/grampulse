from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from auth import require_access
import database as db
from team_metrics import (
    aggregate_va_stats,
    build_account_activity_row,
    default_suivi_date,
    shift_date,
)

router = APIRouter(prefix="/team", tags=["team"])


class CreateVaBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    emoji: Optional[str] = Field(default=None, max_length=8)


class AssignVaBody(BaseModel):
    va_id: Optional[int] = None


def _user_email(x_user_email: Optional[str]) -> str:
    return require_access(x_user_email)


@router.get("/vas")
def list_vas(x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    return {"vas": db.list_vas(email)}


@router.post("/vas")
def create_va(body: CreateVaBody, x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    try:
        va = db.create_va(user_email=email, name=body.name, emoji=body.emoji)
    except Exception as exc:
        if "UNIQUE" in str(exc):
            raise HTTPException(status_code=400, detail="Ce VA existe déjà.") from exc
        if isinstance(exc, ValueError):
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        raise
    return {"va": va}


@router.delete("/vas/{va_id}")
def delete_va(va_id: int, x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    if not db.delete_va(email, va_id):
        raise HTTPException(status_code=404, detail="VA introuvable.")
    return {"ok": True}


@router.get("/ranking")
def team_ranking(x_user_email: Optional[str] = Header(default=None), days: int = 30):
    email = _user_email(x_user_email)
    days = max(7, min(days, 90))
    rows = _build_team_account_rows(email, days=days)
    ranking = aggregate_va_stats(rows, metric="views")
    unassigned = [r for r in rows if r.get("va_id") is None]
    return {
        "days": days,
        "ranking": ranking,
        "unassigned_accounts": len(unassigned),
        "vas": db.list_vas(email),
    }


@router.get("/suivi")
def team_suivi(
    x_user_email: Optional[str] = Header(default=None),
    date: Optional[str] = None,
):
    email = _user_email(x_user_email)
    day = (date or default_suivi_date()).strip()
    try:
        from datetime import date as date_cls

        date_cls.fromisoformat(day)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Date invalide (YYYY-MM-DD).") from exc

    accounts = db.list_all_accounts_enriched(email)
    va_map: dict[int, dict] = {}
    unassigned_accounts: list[dict] = []

    for acc in accounts:
        snapshot = db.get_latest_snapshot(acc["id"])
        activity = build_account_activity_row(
            {**acc, "account_id": acc["id"]},
            snapshot,
            day=day,
        )
        entry = {
            "account_id": acc["id"],
            "handle": acc["handle"],
            "model_id": acc.get("model_id"),
            "model_name": acc.get("model_name"),
            "reels": activity["reels"],
            "posts": activity["posts"],
            "stories": activity["stories"],
            "total": activity["total"],
        }
        va_id = acc.get("va_id")
        if va_id is None:
            unassigned_accounts.append(entry)
            continue

        bucket = va_map.setdefault(
            va_id,
            {
                "va_id": va_id,
                "va_name": acc.get("va_name"),
                "va_emoji": acc.get("va_emoji"),
                "totals": {"reels": 0, "posts": 0, "stories": 0, "total": 0},
                "accounts": [],
            },
        )
        bucket["accounts"].append(entry)
        bucket["totals"]["reels"] += entry["reels"]
        bucket["totals"]["posts"] += entry["posts"]
        bucket["totals"]["stories"] += entry["stories"]
        bucket["totals"]["total"] += entry["total"]

    vas = sorted(
        va_map.values(),
        key=lambda v: (v["totals"]["total"], v["totals"]["reels"], v["va_name"] or ""),
        reverse=True,
    )

    return {
        "date": day,
        "prev_date": shift_date(day, -1),
        "next_date": shift_date(day, 1),
        "vas": vas,
        "unassigned_accounts": unassigned_accounts,
        "notes": "Stories non disponibles via l'API Instagram — compteur à 0 pour l'instant.",
    }


def _build_team_account_rows(email: str, *, days: int) -> list[dict]:
    rows: list[dict] = []
    for acc in db.list_all_accounts_enriched(email):
        snapshot = db.get_latest_snapshot(acc["id"])
        views = sum(
            point["views"]
            for point in db.get_account_daily_views(acc["id"], days=days)
        )
        activity = build_account_activity_row(
            {**acc, "account_id": acc["id"]},
            snapshot,
            days=days,
        )
        rows.append(
            {
                "account_id": acc["id"],
                "handle": acc["handle"],
                "model_id": acc.get("model_id"),
                "model_name": acc.get("model_name"),
                "va_id": acc.get("va_id"),
                "va_name": acc.get("va_name"),
                "va_emoji": acc.get("va_emoji"),
                "followers": acc.get("followers"),
                "avg_engagement_rate": acc.get("avg_engagement_rate"),
                "views": views,
                "reels": activity["reels"],
                "posts": activity["posts"],
                "stories": activity["stories"],
            }
        )
    return rows
