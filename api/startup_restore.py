from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import database as db
from backup_io import DEFAULT_BUNDLE_PATH

logger = logging.getLogger("grampulse.startup_restore")


def maybe_restore_from_bundle(bundle_path: Path = DEFAULT_BUNDLE_PATH) -> dict | None:
    enabled = os.getenv("GRAMPULSE_AUTO_RESTORE", "").strip().lower()
    if enabled not in ("1", "true", "yes"):
        return None

    if not bundle_path.exists():
        logger.info("Auto-restore activé mais aucun fichier %s", bundle_path)
        return None

    try:
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Impossible de lire la sauvegarde embarquée: %s", exc)
        return None

    email = str(bundle.get("user_email", "")).strip().lower()
    if not email:
        return None

    existing = db.list_models(email)
    if existing:
        return {
            "skipped": True,
            "user_email": email,
            "models": len(existing),
        }

    result = db.import_user_bundle(bundle)
    logger.info(
        "Sauvegarde embarquée restaurée pour %s (%s modèles, %s comptes)",
        email,
        result.get("models", 0),
        result.get("accounts", 0),
    )
    return {"restored": True, **result}
