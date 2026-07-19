from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from auth import require_access
import database as db
from planning_resolve import download_source_video
from planning_storage import (
    MAX_UPLOAD_BYTES,
    delete_plan_files,
    model_video_path,
    source_video_path,
    write_model_video,
    write_source_video,
)

router = APIRouter(prefix="/planning", tags=["planning"])
logger = logging.getLogger("grampulse.planning")


class CreatePlanBody(BaseModel):
    source_url: str = Field(..., min_length=8, max_length=2048)
    title: Optional[str] = Field(default=None, max_length=120)
    video_text: Optional[str] = Field(default=None, max_length=8000)
    model_id: Optional[int] = None
    scheduled_at: Optional[str] = Field(default=None, max_length=32)


class UpdatePlanBody(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)
    video_text: Optional[str] = Field(default=None, max_length=8000)
    model_id: Optional[int] = None
    scheduled_at: Optional[str] = None


def _user_email(x_user_email: Optional[str]) -> str:
    return require_access(x_user_email)


def _assert_model(email: str, model_id: int | None) -> None:
    if model_id is None:
        return
    if not db.get_model(email, model_id):
        raise HTTPException(status_code=404, detail="Modèle introuvable.")


def _get_plan_or_404(email: str, plan_id: int) -> dict:
    plan = db.get_content_plan(email, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable.")
    return plan


def _verify_token(plan: dict, token: str | None) -> None:
    if not token or token.strip() != plan.get("access_token"):
        raise HTTPException(status_code=403, detail="Accès refusé.")


def _is_instagram_url(url: str) -> bool:
    host = urlparse(url.strip()).netloc.lower()
    return host.endswith("instagram.com") or host.endswith("instagr.am")


def _enrich_plan(plan: dict) -> dict:
    email = plan["user_email"]
    plan_id = plan["id"]
    model = db.get_model(email, plan["model_id"]) if plan.get("model_id") else None
    return {
        **plan,
        "model_name": model["name"] if model else None,
        "source_ready": plan.get("source_status") == "ready" and source_video_path(email, plan_id) is not None,
        "model_ready": plan.get("model_status") == "ready" and model_video_path(email, plan_id) is not None,
    }


def _fetch_source_background(email: str, plan_id: int) -> None:
    plan = db.get_content_plan(email, plan_id)
    if not plan:
        return
    if _is_instagram_url(plan["source_url"]):
        db.update_content_plan(email, plan_id, source_status="link", source_error=None)
        return
    db.update_content_plan(email, plan_id, source_status="downloading", source_error=None)
    try:
        download_source_video(plan["source_url"], email, plan_id)
        db.update_content_plan(email, plan_id, source_status="ready", source_error=None)
    except Exception as exc:
        logger.exception("Source download failed for plan %s", plan_id)
        db.update_content_plan(email, plan_id, source_status="failed", source_error=str(exc)[:500])


@router.get("")
def list_plans(
    q: Optional[str] = Query(default=None, max_length=200),
    model_id: Optional[int] = Query(default=None),
    unassigned: bool = Query(default=False),
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    plans = db.list_content_plans(email, query=q, model_id=model_id, unassigned_only=unassigned)
    return {"plans": [_enrich_plan(p) for p in plans], "count": len(plans)}


@router.post("")
def create_plan(
    body: CreatePlanBody,
    background_tasks: BackgroundTasks,
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    _assert_model(email, body.model_id)
    url = body.source_url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL invalide.")

    plan = db.create_content_plan(
        user_email=email,
        source_url=url,
        title=body.title,
        model_id=body.model_id,
        scheduled_at=body.scheduled_at,
        video_text=body.video_text,
    )
    if _is_instagram_url(url):
        plan = db.update_content_plan(email, plan["id"], source_status="link", source_error=None)
        return {"plan": _enrich_plan(plan), "fetching": False}

    background_tasks.add_task(_fetch_source_background, email, plan["id"])
    return {"plan": _enrich_plan(plan), "fetching": True}


@router.get("/{plan_id}")
def get_plan(plan_id: int, x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    return {"plan": _enrich_plan(_get_plan_or_404(email, plan_id))}


@router.patch("/{plan_id}")
def update_plan(
    plan_id: int,
    body: UpdatePlanBody,
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    _get_plan_or_404(email, plan_id)
    payload = body.model_dump(exclude_unset=True)
    if payload.get("model_id") is not None:
        _assert_model(email, payload["model_id"])
    updated = db.update_content_plan(email, plan_id, **payload)
    return {"plan": _enrich_plan(updated)}


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, x_user_email: Optional[str] = Header(default=None)):
    email = _user_email(x_user_email)
    _get_plan_or_404(email, plan_id)
    delete_plan_files(email, plan_id)
    db.delete_content_plan(email, plan_id)
    return {"ok": True}


@router.post("/{plan_id}/refetch")
def refetch_source(
    plan_id: int,
    background_tasks: BackgroundTasks,
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    plan = _get_plan_or_404(email, plan_id)
    if _is_instagram_url(plan["source_url"]):
        updated = db.update_content_plan(email, plan_id, source_status="link", source_error=None)
        return {"ok": True, "fetching": False, "plan": _enrich_plan(updated)}

    background_tasks.add_task(_fetch_source_background, email, plan["id"])
    return {"ok": True, "fetching": True}


@router.post("/{plan_id}/source-video")
async def upload_source_video(
    plan_id: int,
    file: UploadFile = File(...),
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    _get_plan_or_404(email, plan_id)

    filename = (file.filename or "").lower()
    is_video = (file.content_type or "").startswith("video/") or filename.endswith(
        (".mp4", ".mov", ".webm", ".m4v", ".mkv")
    )
    if not is_video:
        raise HTTPException(status_code=400, detail="Fichier vidéo requis (MP4, MOV, WebM).")

    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".upload") as tmp:
            tmp_path = Path(tmp.name)
            total = 0
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Vidéo trop lourde (max {MAX_UPLOAD_BYTES // (1024 * 1024)} Mo).",
                    )
                tmp.write(chunk)

        write_source_video(email, plan_id, tmp_path)
        updated = db.update_content_plan(
            email,
            plan_id,
            source_status="ready",
            source_error=None,
        )
        return {"plan": _enrich_plan(updated)}
    finally:
        if tmp_path and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


@router.post("/{plan_id}/model-video")
async def upload_model_video(
    plan_id: int,
    file: UploadFile = File(...),
    x_user_email: Optional[str] = Header(default=None),
):
    email = _user_email(x_user_email)
    _get_plan_or_404(email, plan_id)

    filename = (file.filename or "").lower()
    is_video = (file.content_type or "").startswith("video/") or filename.endswith(
        (".mp4", ".mov", ".webm", ".m4v", ".mkv")
    )
    if not is_video:
        raise HTTPException(status_code=400, detail="Fichier vidéo requis (MP4, MOV, WebM).")

    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".upload") as tmp:
            tmp_path = Path(tmp.name)
            total = 0
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Vidéo trop lourde (max {MAX_UPLOAD_BYTES // (1024 * 1024)} Mo).",
                    )
                tmp.write(chunk)

        write_model_video(email, plan_id, tmp_path)
        updated = db.update_content_plan(email, plan_id, model_status="ready")
        return {"plan": _enrich_plan(updated)}
    finally:
        if tmp_path and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


def _media_response(path: Path, download_name: str, *, attachment: bool) -> FileResponse:
    media_type = "video/mp4" if path.suffix.lower() == ".mp4" else "application/octet-stream"
    return FileResponse(
        path,
        media_type=media_type,
        filename=download_name,
        content_disposition_type="attachment" if attachment else "inline",
    )


@router.get("/{plan_id}/media/source")
def stream_source(
    plan_id: int,
    token: str = Query(...),
    download: bool = Query(default=False),
):
    plan = db.get_content_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable.")
    _verify_token(plan, token)
    path = source_video_path(plan["user_email"], plan_id)
    if not path:
        raise HTTPException(status_code=404, detail="Vidéo source pas encore prête.")
    name = f"original-{plan_id}{path.suffix.lower()}"
    return _media_response(path, name, attachment=download)


@router.get("/{plan_id}/media/model")
def stream_model(
    plan_id: int,
    token: str = Query(...),
    download: bool = Query(default=False),
):
    plan = db.get_content_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable.")
    _verify_token(plan, token)
    path = model_video_path(plan["user_email"], plan_id)
    if not path:
        raise HTTPException(status_code=404, detail="Vidéo modèle manquante.")
    name = f"modele-{plan_id}.mp4"
    return _media_response(path, name, attachment=download)
