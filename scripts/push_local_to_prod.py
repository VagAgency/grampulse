#!/usr/bin/env python3
"""Exporte les données locales et les restaure sur l'API de production."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))

from backup_io import export_bundle  # noqa: E402

DEFAULT_DB = ROOT / "api" / "grampulse.db"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", default="newvag.toulouse@gmail.com")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--api", default="https://api.grampulse.app")
    parser.add_argument("--secret", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"Base introuvable: {db_path}", file=sys.stderr)
        return 1

    bundle = export_bundle(db_path, args.email.strip().lower())
    print(
        f"Export: {len(bundle['models'])} modèles, {len(bundle['accounts'])} comptes, "
        f"{len(bundle['vas'])} VAs, {len(bundle['daily_views'])} vues/j, "
        f"{len(bundle['daily_clicks'])} clics/j, {len(bundle['snapshots'])} snapshots"
    )

    if args.dry_run:
        print(json.dumps(bundle, indent=2, ensure_ascii=False)[:2000])
        return 0

    with httpx.Client(timeout=120.0) as client:
        response = client.post(
            f"{args.api.rstrip('/')}/restore/import",
            headers={"X-Restore-Secret": args.secret},
            json=bundle,
        )

    if response.status_code >= 400:
        print(f"Erreur {response.status_code}: {response.text}", file=sys.stderr)
        return 1

    print("Restauration OK:", response.json())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
