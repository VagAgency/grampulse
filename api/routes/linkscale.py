from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from starlette.concurrency import run_in_threadpool

from auth import require_access
import database as db
from linkscale_provider import LinkscaleNotConfiguredError, is_linkscale_configured
from linkscale_sync import sync_user_linkscale_clicks

router = APIRouter(prefix="/linkscale", tags=["linkscale"])


def _user_email(x_user_email: Optional[str]) -> str:
    return require_access(x_user_email)


@router.get("/status")
def linkscale_status():
    return {"configured": is_linkscale_configured()}


@router.post("/sync")
async def sync_linkscale(
    x_user_email: Optional[str] = Header(default=None),
    days: int = 90,
):
    email = _user_email(x_user_email)
    days = max(7, min(days, 90))
    try:
        return await run_in_threadpool(sync_user_linkscale_clicks, email, days=days)
    except LinkscaleNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
