from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from starlette.concurrency import run_in_threadpool

from auth import require_access
from daily_refresh import daily_refresh_status_dict, get_daily_refresh_status
import database as db
from sync import sync_account

router = APIRouter(prefix="/refresh", tags=["refresh"])


def _user_email(x_user_email: Optional[str]) -> str:
    return require_access(x_user_email)


@router.get("/status")
def refresh_status(x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    return daily_refresh_status_dict(email)


@router.get("/targets")
def list_refresh_targets(x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    accounts = db.list_all_accounts_enriched(email)
    refresh = daily_refresh_status_dict(email)
    return {
        "accounts": [
            {
                "handle": acc["handle"],
                "model_id": acc["model_id"],
                "model_name": acc.get("model_name"),
            }
            for acc in accounts
            if acc.get("model_id") is not None
        ],
        "refresh": refresh,
    }


@router.post("/all")
async def refresh_all_accounts(x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    accounts = [
        acc
        for acc in db.list_all_accounts_enriched(email)
        if acc.get("model_id") is not None
    ]

    refresh_status = get_daily_refresh_status(email)
    if refresh_status.used_this_period:
        message = refresh_status.message_when_blocked()
        return {
            "total": len(accounts),
            "synced": 0,
            "skipped_count": len(accounts),
            "skipped": [
                {"handle": acc["handle"], "model_id": acc["model_id"], "ok": True, "skipped": True, "message": message}
                for acc in accounts
            ],
            "results": [],
            "errors": [],
            "refresh": daily_refresh_status_dict(email),
        }

    results: list[dict] = []
    errors: list[dict] = []

    for acc in accounts:
        handle = acc["handle"]
        model_id = acc["model_id"]
        try:
            payload = await run_in_threadpool(
                sync_account,
                email,
                model_id,
                handle,
                force_refresh=True,
                daily_batch=True,
            )
            results.append({"handle": handle, "model_id": model_id, "ok": True, **payload})
        except Exception as exc:
            errors.append({"handle": handle, "model_id": model_id, "error": str(exc)})

    return {
        "total": len(accounts),
        "synced": len(results),
        "skipped_count": 0,
        "skipped": [],
        "results": results,
        "errors": errors,
        "refresh": daily_refresh_status_dict(email),
    }
