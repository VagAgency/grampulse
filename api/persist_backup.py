from __future__ import annotations

import json
import logging
import os
import shutil
import threading
from pathlib import Path

from backup_io import export_bundle, write_bundle_file

logger = logging.getLogger("grampulse.persist")

PERSIST_DIR = Path(os.getenv("GRAMPULSE_PERSIST_DIR", "/var/data"))
BACKUP_DIR = PERSIST_DIR / "backups"
_lock = threading.Lock()


def is_persistent_volume_mounted(path: Path = PERSIST_DIR) -> bool:
    try:
        with open("/proc/mounts", encoding="utf-8") as mounts:
            target = str(path.resolve())
            for line in mounts:
                parts = line.split()
                if len(parts) >= 2 and parts[1] == target:
                    return True
    except OSError:
        pass
    return False


def is_writable_dir(path: Path) -> bool:
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write-test"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


def backup_path_for_user(email: str) -> Path:
    safe = email.strip().lower().replace("@", "_at_").replace(".", "_")
    return BACKUP_DIR / f"{safe}.json"


def snapshot_sqlite_copy() -> bool:
    import database as db

    src = db.DB_PATH
    if not src.exists():
        return False
    dst = PERSIST_DIR / "grampulse.db"
    try:
        PERSIST_DIR.mkdir(parents=True, exist_ok=True)
        with _lock:
            shutil.copy2(src, dst)
        logger.info("Copie SQLite vers %s", dst)
        return True
    except OSError as exc:
        logger.warning("Copie SQLite échouée: %s", exc)
        return False


def restore_sqlite_if_available() -> bool:
    import database as db

    persist_db = PERSIST_DIR / "grampulse.db"
    target = db.DB_PATH
    if not persist_db.exists():
        return False
    if target.resolve() == persist_db.resolve():
        return True
    try:
        if not target.exists() or persist_db.stat().st_mtime >= target.stat().st_mtime:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(persist_db, target)
            logger.info("Base restaurée depuis %s vers %s", persist_db, target)
            return True
    except OSError as exc:
        logger.warning("Restauration SQLite échouée: %s", exc)
    return False


def _persist_user_data(email: str) -> Path | None:
    import database as db

    bundle = export_bundle(db.DB_PATH, email)
    path = write_bundle_file(bundle, backup_path_for_user(email))
    snapshot_sqlite_copy()
    logger.info(
        "Sauvegarde persistante %s (%s comptes)",
        path,
        len(bundle.get("accounts", [])),
    )
    return path


def schedule_user_backup(email: str) -> None:
    email = email.strip().lower()
    if not email:
        return

    def worker() -> None:
        try:
            _persist_user_data(email)
        except Exception as exc:
            logger.warning("Sauvegarde persistante échouée pour %s: %s", email, exc)

    threading.Thread(target=worker, name=f"persist-{email}", daemon=True).start()


def snapshot_user_now(email: str) -> Path | None:
    email = email.strip().lower()
    if not email:
        return None
    try:
        return _persist_user_data(email)
    except Exception as exc:
        logger.warning("Sauvegarde immédiate échouée pour %s: %s", email, exc)
        return None


def list_persistent_backups() -> list[Path]:
    if not BACKUP_DIR.is_dir():
        return []
    return sorted(BACKUP_DIR.glob("*.json"))


def load_bundle(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Impossible de lire %s: %s", path, exc)
        return None


def restore_users_from_persistent_backups() -> list[dict]:
    import database as db

    restored: list[dict] = []
    for path in list_persistent_backups():
        bundle = load_bundle(path)
        if not bundle:
            continue
        email = str(bundle.get("user_email", "")).strip().lower()
        if not email:
            continue
        backup_count = len(bundle.get("accounts", []))
        db_count = db.count_user_accounts(email)
        if backup_count <= db_count:
            continue
        try:
            result = db.import_user_bundle(bundle)
            restored.append({"restored": True, "source_file": path.name, **result})
            logger.info(
                "Restauré depuis %s pour %s (%s → %s comptes)",
                path.name,
                email,
                db_count,
                backup_count,
            )
        except Exception as exc:
            logger.warning("Restauration depuis %s échouée: %s", path.name, exc)
    return restored


def maybe_migrate_tmp_db_to_persistent(persist_db: Path) -> bool:
    tmp_db = Path("/tmp/grampulse.db")
    if not tmp_db.exists() or persist_db.exists():
        return False
    if not is_persistent_volume_mounted(PERSIST_DIR):
        return False
    try:
        persist_db.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(tmp_db, persist_db)
        logger.info("Base migrée de %s vers %s", tmp_db, persist_db)
        return True
    except OSError as exc:
        logger.warning("Migration DB vers disque persistant échouée: %s", exc)
        return False


def persist_status() -> dict:
    import database as db

    backups = list_persistent_backups()
    return {
        "persist_dir": str(PERSIST_DIR),
        "volume_mounted": is_persistent_volume_mounted(PERSIST_DIR),
        "writable": is_writable_dir(PERSIST_DIR),
        "db_path": str(db.DB_PATH),
        "backup_files": len(backups),
        "latest_backups": [p.name for p in backups[-5:]],
    }
