from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path

import database as db
from backup_io import DEFAULT_BUNDLE_PATH
from persist_backup import restore_users_from_persistent_backups

logger = logging.getLogger("grampulse.startup_restore")

_restore_lock = threading.Lock()
_restore_state: dict = {"status": "idle"}


def get_restore_state() -> dict:
    return dict(_restore_state)


def maybe_restore_from_bundle(bundle_path: Path = DEFAULT_BUNDLE_PATH) -> dict | None:
    disabled = os.getenv("GRAMPULSE_AUTO_RESTORE", "true").strip().lower()
    if disabled in ("0", "false", "no", "off"):
        return None

    persistent = restore_users_from_persistent_backups()
    if persistent:
        first = persistent[0]
        return {
            "source": "persistent_disk",
            "restored": True,
            **first,
            "users_restored": len(persistent),
        }

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

    backup_count = len(bundle.get("accounts", []))
    db_count = db.count_user_accounts(email)
    if db_count >= backup_count:
        return {
            "skipped": True,
            "user_email": email,
            "models": len(db.list_models(email)),
            "accounts": db_count,
            "reason": "db_has_same_or_more_accounts",
        }

    result = db.import_user_bundle(bundle)
    logger.info(
        "Sauvegarde embarquée restaurée pour %s (%s modèles, %s comptes)",
        email,
        result.get("models", 0),
        result.get("accounts", 0),
    )
    return {"source": "embedded_bundle", "restored": True, **result}


def _restore_worker() -> None:
    global _restore_state
    with _restore_lock:
        if _restore_state["status"] == "running":
            return
        _restore_state = {"status": "running"}

    try:
        result = maybe_restore_from_bundle()
        if result:
            _restore_state = {"status": "done", **result}
            logger.info("Startup restore: %s", result)
        elif DEFAULT_BUNDLE_PATH.exists():
            _restore_state = {"status": "skipped", "reason": "not_needed_or_disabled"}
        else:
            _restore_state = {"status": "skipped", "reason": "no_bundle"}
    except Exception as exc:
        logger.exception("Échec auto-restore: %s", exc)
        _restore_state = {"status": "error", "error": str(exc)}


def schedule_restore_in_background() -> None:
    thread = threading.Thread(target=_restore_worker, name="grampulse-restore", daemon=True)
    thread.start()
