#!/usr/bin/env python3
"""Exporte les données locales et les restaure sur l'API de production."""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "api" / "grampulse.db"


def export_bundle(db_path: Path, email: str) -> dict:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    models = [
        {"name": row["name"]}
        for row in conn.execute(
            "SELECT name FROM models WHERE user_email = ? ORDER BY id",
            (email,),
        )
    ]

    vas = [
        {"name": row["name"], "emoji": row["emoji"]}
        for row in conn.execute(
            "SELECT name, emoji FROM vas WHERE user_email = ? ORDER BY id",
            (email,),
        )
    ]

    accounts = []
    for row in conn.execute(
        """
        SELECT ta.*, m.name AS model_name, v.name AS va_name
        FROM tracked_accounts ta
        JOIN models m ON m.id = ta.model_id
        LEFT JOIN vas v ON v.id = ta.va_id
        WHERE ta.user_email = ?
        ORDER BY ta.id
        """,
        (email,),
    ):
        accounts.append(
            {
                "handle": row["handle"],
                "model_name": row["model_name"],
                "status": row["status"],
                "display_name": row["display_name"],
                "profile_pic_url": row["profile_pic_url"],
                "va_name": row["va_name"],
                "linkscale_url": row["linkscale_url"],
                "linkscale_host": row["linkscale_host"],
                "linkscale_slug": row["linkscale_slug"],
            }
        )

    id_to_handle = {
        row["id"]: row["handle"]
        for row in conn.execute(
            "SELECT id, handle FROM tracked_accounts WHERE user_email = ?", (email,)
        )
    }

    daily_views = []
    for row in conn.execute(
        f"""
        SELECT tracked_account_id, date, views, followers
        FROM daily_views
        WHERE tracked_account_id IN ({",".join("?" * len(id_to_handle)) or "NULL"})
        """,
        list(id_to_handle.keys()),
    ):
        daily_views.append(
            {
                "handle": id_to_handle[row["tracked_account_id"]],
                "date": row["date"],
                "views": row["views"],
                "followers": row["followers"],
            }
        )

    daily_clicks = []
    for row in conn.execute(
        f"""
        SELECT tracked_account_id, date, clicks
        FROM daily_clicks
        WHERE tracked_account_id IN ({",".join("?" * len(id_to_handle)) or "NULL"})
        """,
        list(id_to_handle.keys()),
    ):
        daily_clicks.append(
            {
                "handle": id_to_handle[row["tracked_account_id"]],
                "date": row["date"],
                "clicks": row["clicks"],
            }
        )

    snapshots = []
    for account_id, handle in id_to_handle.items():
        row = conn.execute(
            """
            SELECT *
            FROM account_snapshots
            WHERE tracked_account_id = ?
            ORDER BY fetched_at DESC
            LIMIT 1
            """,
            (account_id,),
        ).fetchone()
        if not row:
            continue
        snapshots.append(
            {
                "handle": handle,
                "followers": row["followers"],
                "following": row["following"],
                "posts_count": row["posts_count"],
                "avg_engagement_rate": row["avg_engagement_rate"],
                "avg_likes": row["avg_likes"],
                "avg_comments": row["avg_comments"],
                "health_score": row["health_score"],
                "health_label": row["health_label"],
                "top_posts": json.loads(row["top_posts_json"] or "[]"),
                "analysis": json.loads(row["analysis_json"] or "{}"),
                "raw": json.loads(row["raw_json"] or "{}"),
                "fetched_at": row["fetched_at"],
            }
        )

    conn.close()
    return {
        "user_email": email,
        "models": models,
        "vas": vas,
        "accounts": accounts,
        "daily_views": daily_views,
        "daily_clicks": daily_clicks,
        "snapshots": snapshots,
    }


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
