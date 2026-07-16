from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from starlette.concurrency import run_in_threadpool

from auth import require_access
import database as db
from sync import sync_account

router = APIRouter(prefix="/refresh", tags=["refresh"])


def _user_email(x_user_email: Optional[str]) -> str:
    return require_access(x_user_email)


@router.get("/targets")
def list_refresh_targets(x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    accounts = db.list_all_accounts_enriched(email)
    return {
        "accounts": [
            {
                "handle": acc["handle"],
                "model_id": acc["model_id"],
                "model_name": acc.get("model_name"),
            }
            for acc in accounts
            if acc.get("model_id") is not None
        ]
    }


@router.post("/all")
async def refresh_all_accounts(x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    accounts = [
        acc
        for acc in db.list_all_accounts_enriched(email)
        if acc.get("model_id") is not None
    ]

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
            )
            results.append({"handle": handle, "model_id": model_id, "ok": True, **payload})
        except Exception as exc:
            errors.append({"handle": handle, "model_id": model_id, "error": str(exc)})

    return {
        "total": len(accounts),
        "synced": len(results),
        "results": results,
        "errors": errors,
    }
