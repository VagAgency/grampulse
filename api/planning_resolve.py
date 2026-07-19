from __future__ import annotations

import logging
import subprocess
from pathlib import Path

from planning_storage import ALLOWED_EXTENSIONS, ensure_plan_dir
from snapinsta_provider import download_instagram_video, is_instagram_url

logger = logging.getLogger("grampulse.planning.resolve")


def _clear_existing_sources(directory: Path) -> None:
    for existing in directory.glob("source.*"):
        if existing.suffix.lower() in ALLOWED_EXTENSIONS:
            existing.unlink()


def _download_via_snapinsta(url: str, directory: Path) -> Path:
    destination = directory / "source.mp4"
    download_instagram_video(url, destination)
    if not destination.is_file() or destination.stat().st_size <= 0:
        raise RuntimeError("SnapInsta n'a pas produit de fichier vidéo valide.")
    return destination


def _download_via_ytdlp(url: str, directory: Path, plan_id: int) -> Path:
    out_template = str(directory / "source.%(ext)s")
    cmd = [
        "yt-dlp",
        "-f",
        "best[ext=mp4]/best[height<=1080]/best",
        "--no-playlist",
        "--no-warnings",
        "-o",
        out_template,
        url.strip(),
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
    except FileNotFoundError as exc:
        raise RuntimeError("yt-dlp n'est pas installé sur le serveur.") from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Téléchargement trop long — réessaie avec un lien plus court.") from exc

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        logger.warning("yt-dlp failed for plan %s: %s", plan_id, detail[:500])
        raise RuntimeError(detail or "Impossible de télécharger cette vidéo.")

    for path in sorted(directory.glob("source.*")):
        if path.suffix.lower() in ALLOWED_EXTENSIONS and path.is_file() and path.stat().st_size > 0:
            return path

    raise RuntimeError("Vidéo téléchargée introuvable sur le disque.")


def download_source_video(url: str, email: str, plan_id: int) -> Path:
    directory = ensure_plan_dir(email, plan_id)
    _clear_existing_sources(directory)

    clean_url = url.strip()
    if is_instagram_url(clean_url):
        try:
            return _download_via_snapinsta(clean_url, directory)
        except Exception as exc:
            logger.warning("SnapInsta failed for plan %s: %s", plan_id, exc)
            message = str(exc).strip()
            if "yt-dlp" in message or "Instagram sent an empty media" in message:
                message = "SnapInsta n'a pas pu récupérer cette vidéo Instagram."
            raise RuntimeError(message or "SnapInsta n'a pas pu télécharger cette vidéo Instagram.") from exc

    return _download_via_ytdlp(clean_url, directory, plan_id)
