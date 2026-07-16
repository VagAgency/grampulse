from __future__ import annotations

import json
import os
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

import database as db

router = APIRouter(prefix="/restore", tags=["restore"])


class ImportAccount(BaseModel):
    handle: str
    model_name: str
    status: str = "actif"
    display_name: Optional[str] = None
    profile_pic_url: Optional[str] = None
    va_name: Optional[str] = None
    linkscale_url: Optional[str] = None
    linkscale_host: Optional[str] = None
    linkscale_slug: Optional[str] = None


class ImportVa(BaseModel):
    name: str
    emoji: Optional[str] = None


class ImportModel(BaseModel):
    name: str


class ImportDailyView(BaseModel):
    handle: str
    date: str
    views: int
    followers: Optional[int] = None


class ImportDailyClick(BaseModel):
    handle: str
    date: str
    clicks: int


class ImportSnapshot(BaseModel):
    handle: str
    followers: Optional[int] = None
    following: Optional[int] = None
    posts_count: Optional[int] = None
    avg_engagement_rate: Optional[float] = None
    avg_likes: Optional[float] = None
    avg_comments: Optional[float] = None
    health_score: int = 0
    health_label: str = "—"
    top_posts: list[dict[str, Any]] = Field(default_factory=list)
    analysis: dict[str, Any] = Field(default_factory=dict)
    raw: dict[str, Any] = Field(default_factory=dict)
    fetched_at: Optional[str] = None


class ImportBundle(BaseModel):
    user_email: str
    models: list[ImportModel] = Field(default_factory=list)
    vas: list[ImportVa] = Field(default_factory=list)
    accounts: list[ImportAccount] = Field(default_factory=list)
    daily_views: list[ImportDailyView] = Field(default_factory=list)
    daily_clicks: list[ImportDailyClick] = Field(default_factory=list)
    snapshots: list[ImportSnapshot] = Field(default_factory=list)


def _check_restore_secret(x_restore_secret: Optional[str]) -> None:
    secret = os.getenv("RESTORE_SECRET", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="RESTORE_SECRET non configuré sur le serveur.")
    if (x_restore_secret or "").strip() != secret:
        raise HTTPException(status_code=403, detail="Secret de restauration invalide.")


@router.post("/import")
def import_user_data(
    body: ImportBundle,
    x_restore_secret: Optional[str] = Header(default=None, alias="X-Restore-Secret"),
):
    _check_restore_secret(x_restore_secret)
    result = db.import_user_bundle(body.model_dump())
    return {"ok": True, **result}
