#!/usr/bin/env python3
"""Exporte les données locales vers api/backups/restore-bundle.json."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from backup_io import DEFAULT_BUNDLE_PATH, export_bundle, write_bundle_file  # noqa: E402

DEFAULT_DB = ROOT / "api" / "grampulse.db"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", default="newvag.toulouse@gmail.com")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--out", default=str(DEFAULT_BUNDLE_PATH))
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"Base introuvable: {db_path}", file=sys.stderr)
        return 1

    bundle = export_bundle(db_path, args.email.strip().lower())
    out = write_bundle_file(bundle, Path(args.out))
    print(
        f"Sauvegarde écrite: {out}\n"
        f"{len(bundle['models'])} modèles, {len(bundle['accounts'])} comptes, "
        f"{len(bundle['vas'])} VAs, {len(bundle['daily_views'])} vues/j, "
        f"{len(bundle['daily_clicks'])} clics/j, {len(bundle['snapshots'])} snapshots"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
