from __future__ import annotations

import json
import sqlite3
from pathlib import Path

DEFAULT_BUNDLE_PATH = Path(__file__).parent / "backups" / "restore-bundle.json"


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
    if id_to_handle:
        placeholders = ",".join("?" * len(id_to_handle))
        for row in conn.execute(
            f"""
            SELECT tracked_account_id, date, views, followers
            FROM daily_views
            WHERE tracked_account_id IN ({placeholders})
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
    if id_to_handle:
        placeholders = ",".join("?" * len(id_to_handle))
        for row in conn.execute(
            f"""
            SELECT tracked_account_id, date, clicks
            FROM daily_clicks
            WHERE tracked_account_id IN ({placeholders})
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
                "top_posts": json.loads(row["top_posts_json"] or "[]")[:8],
                "analysis": json.loads(row["analysis_json"] or "{}"),
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


def write_bundle_file(bundle: dict, path: Path = DEFAULT_BUNDLE_PATH) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
