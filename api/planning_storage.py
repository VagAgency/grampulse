from __future__ import annotations

import os
import shutil
from pathlib import Path

CONTENT_ROOT = Path(os.getenv("GRAMPULSE_CONTENT_DIR", "/var/data/content"))
MAX_UPLOAD_BYTES = int(os.getenv("PLANNING_MAX_UPLOAD_MB", "150")) * 1024 * 1024
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".webm", ".m4v", ".mkv"}


def _safe_email(email: str) -> str:
    return email.strip().lower().replace("@", "_at_").replace(".", "_")


def user_dir(email: str) -> Path:
    return CONTENT_ROOT / _safe_email(email)


def plan_dir(email: str, plan_id: int) -> Path:
    return user_dir(email) / str(plan_id)


def source_video_path(email: str, plan_id: int) -> Path | None:
    directory = plan_dir(email, plan_id)
    if not directory.is_dir():
        return None
    for path in sorted(directory.glob("source.*")):
        if path.suffix.lower() in ALLOWED_EXTENSIONS and path.is_file():
            return path
    return None


def model_video_path(email: str, plan_id: int) -> Path | None:
    path = plan_dir(email, plan_id) / "model.mp4"
    if path.is_file():
        return path
    for candidate in plan_dir(email, plan_id).glob("model.*"):
        if candidate.suffix.lower() in ALLOWED_EXTENSIONS and candidate.is_file():
            return candidate
    return None


def ensure_plan_dir(email: str, plan_id: int) -> Path:
    path = plan_dir(email, plan_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def delete_plan_files(email: str, plan_id: int) -> None:
    directory = plan_dir(email, plan_id)
    if directory.is_dir():
        shutil.rmtree(directory, ignore_errors=True)


def write_model_video(email: str, plan_id: int, src: Path) -> Path:
    directory = ensure_plan_dir(email, plan_id)
    dest = directory / "model.mp4"
    if dest.exists():
        dest.unlink()
    shutil.copy2(src, dest)
    return dest
