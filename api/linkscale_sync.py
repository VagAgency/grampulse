from __future__ import annotations

from typing import Optional

import database as db
from linkscale_provider import (
    LinkscaleApiError,
    LinkscaleNotConfiguredError,
    fetch_link_daily_clicks,
    fetch_project_stats,
    is_linkscale_configured,
    parse_linkscale_url,
)


def sync_account_linkscale_clicks(
    account: dict,
    *,
    days: int = 90,
    user_email: Optional[str] = None,
    stats: Optional[dict] = None,
) -> dict:
    url = (account.get("linkscale_url") or "").strip()
    if not url:
        return {"account_id": account["id"], "synced": False, "reason": "no_link"}

    parsed = parse_linkscale_url(url)
    host = account.get("linkscale_host") or parsed["host"]
    slug = account.get("linkscale_slug") or parsed["slug"]

    points, tracking_host = fetch_link_daily_clicks(
        host=host, slug=slug, days=days, stats=stats
    )
    if tracking_host and tracking_host != host and user_email:
        db.update_account_linkscale(
            user_email=user_email,
            account_id=account["id"],
            linkscale_url=url,
            linkscale_host=tracking_host,
            linkscale_slug=slug,
        )

    db.clear_account_daily_clicks(account["id"])
    for point in points:
        db.upsert_daily_click(
            tracked_account_id=account["id"],
            day=point["date"],
            clicks=point["clicks"],
        )

    return {
        "account_id": account["id"],
        "handle": account.get("handle"),
        "synced": True,
        "days": len(points),
        "clicks_total": sum(p["clicks"] for p in points),
    }


def sync_user_linkscale_clicks(user_email: str, *, days: int = 90) -> dict:
    if not is_linkscale_configured():
        raise LinkscaleNotConfiguredError(
            "LINKSCALE_API_KEY manquante. Ajoute ta clé API Linkscale dans .env"
        )

    accounts = db.list_accounts_with_linkscale(user_email)
    results: list[dict] = []
    errors: list[dict] = []
    project_stats = fetch_project_stats(days=days)

    for account in accounts:
        try:
            results.append(
                sync_account_linkscale_clicks(
                    account,
                    days=days,
                    user_email=user_email,
                    stats=project_stats,
                )
            )
        except (LinkscaleApiError, ValueError) as exc:
            errors.append(
                {
                    "account_id": account["id"],
                    "handle": account.get("handle"),
                    "error": str(exc),
                }
            )

    return {
        "synced": len([r for r in results if r.get("synced")]),
        "accounts": len(accounts),
        "results": results,
        "errors": errors,
    }
