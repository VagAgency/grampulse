from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

def _resolve_db_path() -> Path:
    raw = os.getenv("GRAMPULSE_DB", "").strip()
    if raw:
        return Path(raw).expanduser()
    return Path(__file__).parent / "grampulse.db"


DB_PATH = _resolve_db_path()
STATUS_VALUES = ("actif", "meilleur", "shadowban", "ban")
STORED_STATUS_VALUES = ("actif", "shadowban", "ban")


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(user_email, name)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tracked_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                model_id INTEGER,
                handle TEXT NOT NULL,
                display_name TEXT,
                profile_pic_url TEXT,
                status TEXT DEFAULT 'actif',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(user_email, handle),
                FOREIGN KEY (model_id) REFERENCES models(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS account_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tracked_account_id INTEGER NOT NULL,
                followers INTEGER,
                following INTEGER,
                posts_count INTEGER,
                avg_engagement_rate REAL,
                avg_likes REAL,
                avg_comments REAL,
                health_score INTEGER,
                health_label TEXT,
                top_posts_json TEXT,
                analysis_json TEXT,
                raw_json TEXT,
                fetched_at TEXT NOT NULL,
                FOREIGN KEY (tracked_account_id) REFERENCES tracked_accounts(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tracked_account_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                views INTEGER NOT NULL DEFAULT 0,
                followers INTEGER,
                FOREIGN KEY (tracked_account_id) REFERENCES tracked_accounts(id),
                UNIQUE(tracked_account_id, date)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_clicks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tracked_account_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                clicks INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (tracked_account_id) REFERENCES tracked_accounts(id),
                UNIQUE(tracked_account_id, date)
            )
            """
        )
        _migrate(conn)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS vas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                name TEXT NOT NULL,
                emoji TEXT,
                created_at TEXT NOT NULL,
                UNIQUE(user_email, name)
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_daily_clicks_account_date ON daily_clicks(tracked_account_id, date)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_daily_views_account_date ON daily_views(tracked_account_id, date)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_snapshots_account_date ON account_snapshots(tracked_account_id, fetched_at DESC)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                whop_membership_id TEXT,
                whop_user_id TEXT,
                whop_manage_url TEXT,
                active INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )


def _migrate(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(tracked_accounts)").fetchall()}
    if "model_id" not in cols:
        conn.execute("ALTER TABLE tracked_accounts ADD COLUMN model_id INTEGER")
    if "status" not in cols:
        conn.execute("ALTER TABLE tracked_accounts ADD COLUMN status TEXT DEFAULT 'actif'")
    if "va_id" not in cols:
        conn.execute("ALTER TABLE tracked_accounts ADD COLUMN va_id INTEGER REFERENCES vas(id)")
    if "linkscale_url" not in cols:
        conn.execute("ALTER TABLE tracked_accounts ADD COLUMN linkscale_url TEXT")
    if "linkscale_host" not in cols:
        conn.execute("ALTER TABLE tracked_accounts ADD COLUMN linkscale_host TEXT")
    if "linkscale_slug" not in cols:
        conn.execute("ALTER TABLE tracked_accounts ADD COLUMN linkscale_slug TEXT")

    orphans = conn.execute(
        "SELECT DISTINCT user_email FROM tracked_accounts WHERE model_id IS NULL"
    ).fetchall()
    for row in orphans:
        email = row["user_email"]
        model = ensure_default_model(email)
        conn.execute(
            "UPDATE tracked_accounts SET model_id = ? WHERE user_email = ? AND model_id IS NULL",
            (model["id"], email),
        )


@contextmanager
def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_user(email: str) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO users (email, created_at) VALUES (?, ?)",
            (email, _now()),
        )


def ensure_default_model(user_email: str) -> dict:
    existing = list_models(user_email)
    if existing:
        return existing[0]
    return create_model(user_email=user_email, name="Portfolio principal")


def create_model(*, user_email: str, name: str) -> dict:
    name = name.strip()
    if not name:
        raise ValueError("Nom de modèle requis")
    ensure_user(user_email)
    now = _now()
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO models (user_email, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (user_email, name, now, now),
        )
        row = conn.execute(
            "SELECT * FROM models WHERE user_email = ? AND name = ?",
            (user_email, name),
        ).fetchone()
        return dict(row)


def update_model(*, user_email: str, model_id: int, name: str) -> Optional[dict]:
    name = name.strip()
    if not name:
        raise ValueError("Nom de modèle requis")
    now = _now()
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM models WHERE id = ? AND user_email = ?",
            (model_id, user_email),
        ).fetchone()
        if not row:
            return None
        duplicate = conn.execute(
            "SELECT id FROM models WHERE user_email = ? AND name = ? AND id != ?",
            (user_email, name, model_id),
        ).fetchone()
        if duplicate:
            raise ValueError("Ce modèle existe déjà.")
        conn.execute(
            "UPDATE models SET name = ?, updated_at = ? WHERE id = ?",
            (name, now, model_id),
        )
    return get_model(user_email, model_id)


def list_models(user_email: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT m.id, m.name, m.created_at, m.updated_at,
                   COUNT(ta.id) AS accounts_count,
                   COALESCE(SUM(dv.views), 0) AS views_today
            FROM models m
            LEFT JOIN tracked_accounts ta ON ta.model_id = m.id
            LEFT JOIN daily_views dv ON dv.tracked_account_id = ta.id
                AND dv.date = date('now')
            WHERE m.user_email = ?
            GROUP BY m.id
            ORDER BY m.updated_at DESC
            """,
            (user_email,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_model(user_email: str, model_id: int) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM models WHERE id = ? AND user_email = ?",
            (model_id, user_email),
        ).fetchone()
        return dict(row) if row else None


def delete_model(user_email: str, model_id: int) -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM models WHERE id = ? AND user_email = ?",
            (model_id, user_email),
        ).fetchone()
        if not row:
            return False
        accounts = conn.execute(
            "SELECT id FROM tracked_accounts WHERE model_id = ?",
            (model_id,),
        ).fetchall()
        for acc in accounts:
            aid = acc["id"]
            conn.execute("DELETE FROM daily_views WHERE tracked_account_id = ?", (aid,))
            conn.execute("DELETE FROM daily_clicks WHERE tracked_account_id = ?", (aid,))
            conn.execute("DELETE FROM account_snapshots WHERE tracked_account_id = ?", (aid,))
        conn.execute("DELETE FROM tracked_accounts WHERE model_id = ?", (model_id,))
        conn.execute("DELETE FROM models WHERE id = ?", (model_id,))
        return True


def list_accounts_for_model(user_email: str, model_id: int) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT
                ta.id, ta.handle, ta.display_name, ta.profile_pic_url, ta.status,
                ta.created_at, ta.updated_at, ta.va_id,
                ta.linkscale_url, ta.linkscale_host, ta.linkscale_slug,
                v.name AS va_name, v.emoji AS va_emoji,
                s.followers, s.following, s.posts_count,
                s.avg_engagement_rate, s.health_score, s.health_label,
                s.fetched_at AS last_synced_at,
                COALESCE(dv.views, 0) AS views_today,
                COALESCE(dv7.views_7d, 0) AS views_7d,
                COALESCE(dv_prev.views_prev_7d, 0) AS views_prev_7d
            FROM tracked_accounts ta
            LEFT JOIN account_snapshots s ON s.id = (
                SELECT id FROM account_snapshots
                WHERE tracked_account_id = ta.id ORDER BY fetched_at DESC LIMIT 1
            )
            LEFT JOIN daily_views dv ON dv.tracked_account_id = ta.id AND dv.date = date('now')
            LEFT JOIN (
                SELECT tracked_account_id, SUM(views) AS views_7d
                FROM daily_views
                WHERE date >= date('now', '-6 days')
                GROUP BY tracked_account_id
            ) dv7 ON dv7.tracked_account_id = ta.id
            LEFT JOIN (
                SELECT tracked_account_id, SUM(views) AS views_prev_7d
                FROM daily_views
                WHERE date >= date('now', '-13 days') AND date < date('now', '-6 days')
                GROUP BY tracked_account_id
            ) dv_prev ON dv_prev.tracked_account_id = ta.id
            LEFT JOIN vas v ON v.id = ta.va_id
            WHERE ta.user_email = ? AND ta.model_id = ?
            ORDER BY views_7d DESC, ta.handle ASC
            """,
            (user_email, model_id),
        ).fetchall()
        return enrich_accounts([dict(r) for r in rows])


def enrich_accounts(accounts: list[dict]) -> list[dict]:
    for acc in accounts:
        cur = acc.get("views_7d") or 0
        prev = acc.get("views_prev_7d") or 0
        if prev > 0:
            acc["views_change_pct"] = round(((cur - prev) / prev) * 100, 1)
        else:
            acc["views_change_pct"] = None
        if acc.get("status") == "meilleur":
            acc["status"] = "actif"

    healthy = [a for a in accounts if a.get("status") == "actif"]
    if healthy:
        best = max(healthy, key=lambda a: a.get("views_7d") or 0)
        best["status"] = "meilleur"

    return accounts


def get_tracked_account(user_email: str, handle: str, model_id: Optional[int] = None) -> Optional[dict]:
    handle = handle.lstrip("@").lower()
    with get_db() as conn:
        if model_id is not None:
            row = conn.execute(
                """
                SELECT * FROM tracked_accounts
                WHERE user_email = ? AND handle = ? AND model_id = ?
                """,
                (user_email, handle, model_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM tracked_accounts WHERE user_email = ? AND handle = ?",
                (user_email, handle),
            ).fetchone()
        return dict(row) if row else None


def add_tracked_account(
    *,
    user_email: str,
    model_id: int,
    handle: str,
    display_name: Optional[str] = None,
    profile_pic_url: Optional[str] = None,
    status: str = "actif",
) -> dict:
    handle = handle.lstrip("@").lower()
    if status not in STORED_STATUS_VALUES:
        status = "actif"
    now = _now()
    ensure_user(user_email)
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO tracked_accounts (
                user_email, model_id, handle, display_name, profile_pic_url,
                status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_email, handle) DO UPDATE SET
                model_id=excluded.model_id,
                display_name=COALESCE(excluded.display_name, display_name),
                profile_pic_url=COALESCE(excluded.profile_pic_url, profile_pic_url),
                status=excluded.status,
                updated_at=excluded.updated_at
            """,
            (user_email, model_id, handle, display_name, profile_pic_url, status, now, now),
        )
        conn.execute("UPDATE models SET updated_at = ? WHERE id = ?", (now, model_id))
        row = conn.execute(
            "SELECT * FROM tracked_accounts WHERE user_email = ? AND handle = ?",
            (user_email, handle),
        ).fetchone()
        return dict(row)


def remove_tracked_account(user_email: str, handle: str, model_id: Optional[int] = None) -> bool:
    handle = handle.lstrip("@").lower()
    with get_db() as conn:
        if model_id is not None:
            row = conn.execute(
                "SELECT id FROM tracked_accounts WHERE user_email = ? AND handle = ? AND model_id = ?",
                (user_email, handle, model_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id FROM tracked_accounts WHERE user_email = ? AND handle = ?",
                (user_email, handle),
            ).fetchone()
        if not row:
            return False
        account_id = row["id"]
        conn.execute("DELETE FROM daily_views WHERE tracked_account_id = ?", (account_id,))
        conn.execute("DELETE FROM daily_clicks WHERE tracked_account_id = ?", (account_id,))
        conn.execute("DELETE FROM account_snapshots WHERE tracked_account_id = ?", (account_id,))
        conn.execute("DELETE FROM tracked_accounts WHERE id = ?", (account_id,))
        return True


def update_account_status(tracked_account_id: int, status: str) -> None:
    if status not in STORED_STATUS_VALUES:
        return
    with get_db() as conn:
        conn.execute(
            "UPDATE tracked_accounts SET status = ?, updated_at = ? WHERE id = ?",
            (status, _now(), tracked_account_id),
        )


def save_snapshot(
    *,
    tracked_account_id: int,
    followers: Optional[int],
    following: Optional[int],
    posts_count: Optional[int],
    avg_engagement_rate: Optional[float],
    avg_likes: Optional[float],
    avg_comments: Optional[float],
    health_score: int,
    health_label: str,
    top_posts: list[dict],
    analysis: dict,
    raw: dict,
    status: Optional[str] = None,
) -> dict:
    now = _now()
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO account_snapshots (
                tracked_account_id, followers, following, posts_count,
                avg_engagement_rate, avg_likes, avg_comments,
                health_score, health_label, top_posts_json, analysis_json, raw_json, fetched_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tracked_account_id,
                followers,
                following,
                posts_count,
                avg_engagement_rate,
                avg_likes,
                avg_comments,
                health_score,
                health_label,
                json.dumps(top_posts, ensure_ascii=False),
                json.dumps(analysis, ensure_ascii=False),
                json.dumps(raw, ensure_ascii=False),
                now,
            ),
        )
        snapshot_id = cur.lastrowid
        updates = "updated_at = ?"
        params: list = [now]
        if status:
            updates += ", status = ?"
            params.append(status)
        params.append(tracked_account_id)
        conn.execute(f"UPDATE tracked_accounts SET {updates} WHERE id = ?", params)
        row = conn.execute("SELECT * FROM account_snapshots WHERE id = ?", (snapshot_id,)).fetchone()
        return dict(row)


def clear_account_daily_views(tracked_account_id: int) -> None:
    with get_db() as conn:
        conn.execute("DELETE FROM daily_views WHERE tracked_account_id = ?", (tracked_account_id,))


def upsert_daily_view(*, tracked_account_id: int, day: str, views: int, followers: Optional[int] = None) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO daily_views (tracked_account_id, date, views, followers)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(tracked_account_id, date) DO UPDATE SET
                views = excluded.views,
                followers = COALESCE(excluded.followers, followers)
            """,
            (tracked_account_id, day, views, followers),
        )


def upsert_daily_click(*, tracked_account_id: int, day: str, clicks: int) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO daily_clicks (tracked_account_id, date, clicks)
            VALUES (?, ?, ?)
            ON CONFLICT(tracked_account_id, date) DO UPDATE SET
                clicks = excluded.clicks
            """,
            (tracked_account_id, day, clicks),
        )


def clear_account_daily_clicks(tracked_account_id: int) -> None:
    with get_db() as conn:
        conn.execute("DELETE FROM daily_clicks WHERE tracked_account_id = ?", (tracked_account_id,))


def get_account_daily_clicks(tracked_account_id: int, days: int = 30) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT date, clicks
            FROM daily_clicks
            WHERE tracked_account_id = ?
              AND date >= date('now', ?)
            ORDER BY date ASC
            """,
            (tracked_account_id, f"-{days - 1} days"),
        ).fetchall()
        return [dict(r) for r in rows]


def get_model_daily_clicks(model_id: int, days: int = 30) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT dc.date, SUM(dc.clicks) AS clicks
            FROM daily_clicks dc
            JOIN tracked_accounts ta ON ta.id = dc.tracked_account_id
            WHERE ta.model_id = ?
              AND dc.date >= date('now', ?)
            GROUP BY dc.date
            ORDER BY dc.date ASC
            """,
            (model_id, f"-{days - 1} days"),
        ).fetchall()
        return [dict(r) for r in rows]


def list_accounts_with_linkscale(user_email: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, handle, model_id, linkscale_url, linkscale_host, linkscale_slug
            FROM tracked_accounts
            WHERE user_email = ?
              AND linkscale_url IS NOT NULL
              AND TRIM(linkscale_url) != ''
            ORDER BY handle ASC
            """,
            (user_email,),
        ).fetchall()
        return [dict(r) for r in rows]


def update_account_linkscale(
    *,
    user_email: str,
    account_id: int,
    linkscale_url: Optional[str],
    linkscale_host: Optional[str] = None,
    linkscale_slug: Optional[str] = None,
) -> Optional[dict]:
    with get_db() as conn:
        account = conn.execute(
            "SELECT id FROM tracked_accounts WHERE id = ? AND user_email = ?",
            (account_id, user_email),
        ).fetchone()
        if not account:
            return None
        conn.execute(
            """
            UPDATE tracked_accounts
            SET linkscale_url = ?, linkscale_host = ?, linkscale_slug = ?, updated_at = ?
            WHERE id = ?
            """,
            (linkscale_url, linkscale_host, linkscale_slug, _now(), account_id),
        )
        if not linkscale_url:
            conn.execute("DELETE FROM daily_clicks WHERE tracked_account_id = ?", (account_id,))
        row = conn.execute(
            "SELECT * FROM tracked_accounts WHERE id = ?",
            (account_id,),
        ).fetchone()
        return dict(row) if row else None


def get_account_daily_views(tracked_account_id: int, days: int = 30) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT date, views, followers
            FROM daily_views
            WHERE tracked_account_id = ?
              AND date >= date('now', ?)
            ORDER BY date ASC
            """,
            (tracked_account_id, f"-{days - 1} days"),
        ).fetchall()
        return [dict(r) for r in rows]


def get_model_daily_views(model_id: int, days: int = 30) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT dv.date, SUM(dv.views) AS views, COUNT(DISTINCT dv.tracked_account_id) AS accounts
            FROM daily_views dv
            JOIN tracked_accounts ta ON ta.id = dv.tracked_account_id
            WHERE ta.model_id = ?
              AND dv.date >= date('now', ?)
            GROUP BY dv.date
            ORDER BY dv.date ASC
            """,
            (model_id, f"-{days - 1} days"),
        ).fetchall()
        return [dict(r) for r in rows]


def get_model_daily_followers(model_id: int, days: int = 30) -> list[dict]:
    accounts = []
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id FROM tracked_accounts WHERE model_id = ?",
            (model_id,),
        ).fetchall()
        accounts = [r["id"] for r in rows]

    by_day: dict[str, int] = {}
    for account_id in accounts:
        for point in get_account_follower_history(account_id, days=days):
            by_day[point["date"]] = by_day.get(point["date"], 0) + point["followers"]

    return [{"date": d, "followers": v} for d, v in sorted(by_day.items())]


def get_global_daily_views(user_email: str, days: int = 30) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT dv.date, SUM(dv.views) AS views, COUNT(DISTINCT ta.model_id) AS models
            FROM daily_views dv
            JOIN tracked_accounts ta ON ta.id = dv.tracked_account_id
            WHERE ta.user_email = ?
              AND dv.date >= date('now', ?)
            GROUP BY dv.date
            ORDER BY dv.date ASC
            """,
            (user_email, f"-{days - 1} days"),
        ).fetchall()
        return [dict(r) for r in rows]


def get_global_summary(user_email: str) -> dict:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(DISTINCT m.id) AS models_count,
                COUNT(DISTINCT ta.id) AS accounts_count,
                COALESCE(SUM(CASE WHEN dv.date = date('now') THEN dv.views END), 0) AS views_today,
                COALESCE(SUM(CASE WHEN dv.date >= date('now', '-6 days') THEN dv.views END), 0) AS views_7d
            FROM models m
            LEFT JOIN tracked_accounts ta ON ta.model_id = m.id
            LEFT JOIN daily_views dv ON dv.tracked_account_id = ta.id
            WHERE m.user_email = ?
            """,
            (user_email,),
        ).fetchone()
        status_rows = conn.execute(
            """
            SELECT ta.status, COUNT(*) AS count
            FROM tracked_accounts ta
            WHERE ta.user_email = ?
            GROUP BY ta.status
            """,
            (user_email,),
        ).fetchall()
        return {
            **dict(row),
            "by_status": {r["status"]: r["count"] for r in status_rows},
        }


def get_account_follower_history(tracked_account_id: int, days: int = 30) -> list[dict]:
    """Historique abonnés depuis les snapshots (chaque sync = un point)."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT date(fetched_at) AS date, followers, fetched_at
            FROM account_snapshots
            WHERE tracked_account_id = ?
              AND followers IS NOT NULL
              AND date(fetched_at) >= date('now', ?)
            ORDER BY fetched_at ASC
            """,
            (tracked_account_id, f"-{days - 1} days"),
        ).fetchall()

    by_day: dict[str, int] = {}
    for row in rows:
        by_day[row["date"]] = int(row["followers"])

    # Compléter avec daily_views si des jours ont un followers enregistré
    for row in get_account_daily_views(tracked_account_id, days=days):
        if row.get("followers") is not None:
            by_day[row["date"]] = int(row["followers"])

    return [{"date": d, "followers": v} for d, v in sorted(by_day.items())]


def get_latest_snapshot(tracked_account_id: int) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT * FROM account_snapshots
            WHERE tracked_account_id = ?
            ORDER BY fetched_at DESC LIMIT 1
            """,
            (tracked_account_id,),
        ).fetchone()
        if not row:
            return None
        data = dict(row)
        for key in ("top_posts_json", "analysis_json", "raw_json"):
            if data.get(key):
                data[key] = json.loads(data[key])
        return data


def list_vas(user_email: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT v.id, v.name, v.emoji, v.created_at,
                   COUNT(ta.id) AS accounts_count
            FROM vas v
            LEFT JOIN tracked_accounts ta ON ta.va_id = v.id
            WHERE v.user_email = ?
            GROUP BY v.id
            ORDER BY v.name ASC
            """,
            (user_email,),
        ).fetchall()
        return [dict(r) for r in rows]


def create_va(*, user_email: str, name: str, emoji: Optional[str] = None) -> dict:
    name = name.strip()
    if not name:
        raise ValueError("Nom du VA requis")
    ensure_user(user_email)
    now = _now()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO vas (user_email, name, emoji, created_at) VALUES (?, ?, ?, ?)",
            (user_email, name, (emoji or "").strip() or None, now),
        )
        row = conn.execute(
            "SELECT * FROM vas WHERE user_email = ? AND name = ?",
            (user_email, name),
        ).fetchone()
        data = dict(row)
        data["accounts_count"] = 0
        return data


def get_va(user_email: str, va_id: int) -> Optional[dict]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM vas WHERE id = ? AND user_email = ?",
            (va_id, user_email),
        ).fetchone()
        return dict(row) if row else None


def delete_va(user_email: str, va_id: int) -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM vas WHERE id = ? AND user_email = ?",
            (va_id, user_email),
        ).fetchone()
        if not row:
            return False
        conn.execute(
            "UPDATE tracked_accounts SET va_id = NULL WHERE va_id = ?",
            (va_id,),
        )
        conn.execute("DELETE FROM vas WHERE id = ?", (va_id,))
        return True


def assign_account_va(
    *,
    user_email: str,
    account_id: int,
    va_id: Optional[int],
) -> Optional[dict]:
    with get_db() as conn:
        account = conn.execute(
            "SELECT id FROM tracked_accounts WHERE id = ? AND user_email = ?",
            (account_id, user_email),
        ).fetchone()
        if not account:
            return None
        if va_id is not None:
            va = conn.execute(
                "SELECT id FROM vas WHERE id = ? AND user_email = ?",
                (va_id, user_email),
            ).fetchone()
            if not va:
                raise ValueError("VA introuvable.")
        conn.execute(
            "UPDATE tracked_accounts SET va_id = ?, updated_at = ? WHERE id = ?",
            (va_id, _now(), account_id),
        )
    rows = list_all_accounts_enriched(user_email)
    return next((r for r in rows if r["id"] == account_id), None)


def list_all_accounts_enriched(user_email: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT
                ta.id, ta.handle, ta.display_name, ta.status, ta.model_id, ta.va_id,
                m.name AS model_name,
                v.name AS va_name, v.emoji AS va_emoji,
                s.followers, s.avg_engagement_rate, s.health_score,
                COALESCE(dv_period.views_period, 0) AS views
            FROM tracked_accounts ta
            LEFT JOIN models m ON m.id = ta.model_id
            LEFT JOIN vas v ON v.id = ta.va_id
            LEFT JOIN account_snapshots s ON s.id = (
                SELECT id FROM account_snapshots
                WHERE tracked_account_id = ta.id ORDER BY fetched_at DESC LIMIT 1
            )
            LEFT JOIN (
                SELECT tracked_account_id, SUM(views) AS views_period
                FROM daily_views
                WHERE date >= date('now', '-29 days')
                GROUP BY tracked_account_id
            ) dv_period ON dv_period.tracked_account_id = ta.id
            WHERE ta.user_email = ?
            ORDER BY m.name ASC, ta.handle ASC
            """,
            (user_email,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_model_accounts_count(model_id: int) -> int:
    with get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS count FROM tracked_accounts WHERE model_id = ?",
            (model_id,),
        ).fetchone()
        return int(row["count"]) if row else 0


def upsert_subscriber(
    *,
    email: str,
    whop_membership_id: str | None = None,
    whop_user_id: str | None = None,
    whop_manage_url: str | None = None,
    active: bool = False,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO subscribers (
                email, whop_membership_id, whop_user_id, whop_manage_url,
                active, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                whop_membership_id=COALESCE(excluded.whop_membership_id, whop_membership_id),
                whop_user_id=COALESCE(excluded.whop_user_id, whop_user_id),
                whop_manage_url=COALESCE(excluded.whop_manage_url, whop_manage_url),
                active=excluded.active,
                updated_at=excluded.updated_at
            """,
            (
                email.strip().lower(),
                whop_membership_id,
                whop_user_id,
                whop_manage_url,
                int(active),
                now,
                now,
            ),
        )


def get_subscriber(email: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT email, active, whop_membership_id, whop_user_id, whop_manage_url,
                   created_at, updated_at
            FROM subscribers WHERE email = ?
            """,
            (email.strip().lower(),),
        ).fetchone()
        return dict(row) if row else None


def is_active_subscriber(email: str) -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT active FROM subscribers WHERE email = ?",
            (email.strip().lower(),),
        ).fetchone()
        return bool(row and row["active"])


def has_active_access(email: str) -> bool:
    dev = os.getenv("DEV_BYPASS_EMAIL", "").strip().lower()
    if dev and email.strip().lower() == dev:
        return True
    return is_active_subscriber(email)


def clear_user_data(user_email: str) -> None:
    email = user_email.strip().lower()
    with get_db() as conn:
        account_ids = [
            row["id"]
            for row in conn.execute(
                "SELECT id FROM tracked_accounts WHERE user_email = ?",
                (email,),
            ).fetchall()
        ]
        for account_id in account_ids:
            conn.execute("DELETE FROM daily_views WHERE tracked_account_id = ?", (account_id,))
            conn.execute("DELETE FROM daily_clicks WHERE tracked_account_id = ?", (account_id,))
            conn.execute("DELETE FROM account_snapshots WHERE tracked_account_id = ?", (account_id,))
        conn.execute("DELETE FROM tracked_accounts WHERE user_email = ?", (email,))
        conn.execute("DELETE FROM models WHERE user_email = ?", (email,))
        conn.execute("DELETE FROM vas WHERE user_email = ?", (email,))


def import_user_bundle(payload: dict) -> dict:
    email = payload["user_email"].strip().lower()
    clear_user_data(email)
    ensure_user(email)

    va_by_name: dict[str, int] = {}
    for va in payload.get("vas", []):
        created = create_va(user_email=email, name=va["name"], emoji=va.get("emoji"))
        va_by_name[va["name"]] = created["id"]

    model_by_name: dict[str, int] = {}
    for model in payload.get("models", []):
        created = create_model(user_email=email, name=model["name"])
        model_by_name[model["name"]] = created["id"]

    handle_to_id: dict[str, int] = {}
    for acc in payload.get("accounts", []):
        model_name = acc["model_name"]
        if model_name not in model_by_name:
            raise ValueError(f"Modèle inconnu pour @{acc['handle']}: {model_name}")
        created = add_tracked_account(
            user_email=email,
            model_id=model_by_name[model_name],
            handle=acc["handle"],
            display_name=acc.get("display_name"),
            profile_pic_url=acc.get("profile_pic_url"),
            status=acc.get("status") or "actif",
        )
        handle_to_id[acc["handle"]] = created["id"]

        if acc.get("linkscale_url"):
            update_account_linkscale(
                user_email=email,
                account_id=created["id"],
                linkscale_url=acc.get("linkscale_url"),
                linkscale_host=acc.get("linkscale_host"),
                linkscale_slug=acc.get("linkscale_slug"),
            )

        va_name = acc.get("va_name")
        if va_name and va_name in va_by_name:
            assign_account_va(
                user_email=email,
                account_id=created["id"],
                va_id=va_by_name[va_name],
            )

    for point in payload.get("daily_views", []):
        account_id = handle_to_id.get(point["handle"])
        if account_id:
            upsert_daily_view(
                tracked_account_id=account_id,
                day=point["date"],
                views=int(point["views"]),
                followers=point.get("followers"),
            )

    for point in payload.get("daily_clicks", []):
        account_id = handle_to_id.get(point["handle"])
        if account_id:
            upsert_daily_click(
                tracked_account_id=account_id,
                day=point["date"],
                clicks=int(point["clicks"]),
            )

    for snap in payload.get("snapshots", []):
        account_id = handle_to_id.get(snap["handle"])
        if not account_id:
            continue
        save_snapshot(
            tracked_account_id=account_id,
            followers=snap.get("followers"),
            following=snap.get("following"),
            posts_count=snap.get("posts_count"),
            avg_engagement_rate=snap.get("avg_engagement_rate"),
            avg_likes=snap.get("avg_likes"),
            avg_comments=snap.get("avg_comments"),
            health_score=int(snap.get("health_score") or 0),
            health_label=str(snap.get("health_label") or "—"),
            top_posts=snap.get("top_posts") or [],
            analysis=snap.get("analysis") or {},
            raw=snap.get("raw") or {},
        )

    return {
        "user_email": email,
        "models": len(model_by_name),
        "vas": len(va_by_name),
        "accounts": len(handle_to_id),
        "daily_views": len(payload.get("daily_views", [])),
        "daily_clicks": len(payload.get("daily_clicks", [])),
        "snapshots": len(payload.get("snapshots", [])),
    }
