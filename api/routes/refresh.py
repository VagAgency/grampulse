from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from auth import require_access
from daily_refresh import daily_refresh_status_dict, get_daily_refresh_status, is_valid_override_code
import database as db
from sync import sync_account

router = APIRouter(prefix="/refresh", tags=["refresh"])


class RefreshAllBody(BaseModel):
    override_code: Optional[str] = Field(default=None, max_length=32)


def _user_email(x_user_email: Optional[str]) -> str:
    return require_access(x_user_email)


def _override_from(code: str | None, header: str | None) -> bool:
    return is_valid_override_code(code or header)


@router.get("/status")
def refresh_status(x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    data = daily_refresh_status_dict(email)
    data["override_available"] = bool(os.getenv("REFRESH_OVERRIDE_CODE", "1234").strip())
    return data


@router.get("/targets")
def list_refresh_targets(x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    accounts = db.list_all_accounts_enriched(email)
    refresh = daily_refresh_status_dict(email)
    refresh["override_available"] = bool(os.getenv("REFRESH_OVERRIDE_CODE", "1234").strip())
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
async def refresh_all_accounts(
    body: RefreshAllBody | None = None,
    x_user_email: Optional[str] = Header(default=None),
    x_refresh_override: Optional[str] = Header(default=None, alias="X-Refresh-Override"),
):
    email = _user_email(x_user_email)
    override = _override_from(body.override_code if body else None, x_refresh_override)
    accounts = [
        acc
        for acc in db.list_all_accounts_enriched(email)
        if acc.get("model_id") is not None
    ]

    refresh_status = get_daily_refresh_status(email)
    if refresh_status.used_this_period and not override:
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

    if override and refresh_status.used_this_period:
        pass  # code valide — refresh extra autorisé

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
                override_daily_limit=override,
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
        "overridden": override,
        "refresh": daily_refresh_status_dict(email),
    }
