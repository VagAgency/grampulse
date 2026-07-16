from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

LINKSCALE_API_BASE = os.getenv("LINKSCALE_API_BASE", "https://dashboard.linkscale.to/api/v1").rstrip("/")
LINKSCALE_TIMEZONE = os.getenv("LINKSCALE_TIMEZONE", "Europe/Paris")
MAX_LINKSCALE_DAYS_PER_REQUEST = 31


class LinkscaleNotConfiguredError(RuntimeError):
    pass


class LinkscaleApiError(RuntimeError):
    pass


def is_linkscale_configured() -> bool:
    key = os.getenv("LINKSCALE_API_KEY", "").strip()
    return bool(key and key.startswith("lk_"))


def _api_key() -> str:
    key = os.getenv("LINKSCALE_API_KEY", "").strip()
    if not key:
        raise LinkscaleNotConfiguredError(
            "LINKSCALE_API_KEY manquante. Ajoute ta clé API Linkscale dans .env"
        )
    return key


def parse_linkscale_url(url: str) -> dict[str, str]:
    raw = (url or "").strip()
    if not raw:
        raise ValueError("URL Linkscale requise.")
    normalized = raw if "://" in raw else f"https://{raw}"
    parsed = urlparse(normalized)
    host = (parsed.netloc or "").lower().strip()
    path = (parsed.path or "").strip("/")
    if not host:
        raise ValueError("URL Linkscale invalide.")
    slug = path.split("/")[-1] if path else ""
    if not slug:
        raise ValueError("Impossible d'extraire le slug du lien Linkscale.")
    return {"url": raw, "host": host, "slug": slug}


def _period_bounds(days: int) -> tuple[str, str]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=max(1, days) - 1)
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.isoformat().replace("+00:00", "Z"), end.isoformat().replace("+00:00", "Z")


def _period_windows(days: int) -> list[tuple[str, str]]:
    """Découpe une période en fenêtres de ≤31 jours (limite API Linkscale)."""
    end = datetime.now(timezone.utc)
    start_boundary = (end - timedelta(days=max(1, days) - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    windows: list[tuple[datetime, datetime]] = []
    chunk_end = end
    while chunk_end > start_boundary:
        chunk_start = max(
            start_boundary,
            chunk_end - timedelta(days=MAX_LINKSCALE_DAYS_PER_REQUEST - 1),
        )
        chunk_start = chunk_start.replace(hour=0, minute=0, second=0, microsecond=0)
        windows.append((chunk_start, chunk_end))
        chunk_end = chunk_start - timedelta(microseconds=1)

    return [
        (
            start.isoformat().replace("+00:00", "Z"),
            end_dt.isoformat().replace("+00:00", "Z"),
        )
        for start, end_dt in windows
    ]


def _parse_api_error(response: httpx.Response) -> str:
    detail = response.text[:300]
    try:
        payload = response.json()
        if isinstance(payload, dict):
            details = payload.get("details")
            if isinstance(details, list) and details:
                first = details[0]
                if isinstance(first, dict) and first.get("message"):
                    return str(first["message"])
            detail = payload.get("error") or payload.get("message") or detail
    except Exception:
        pass
    return str(detail)


def _merge_stats(chunks: list[dict[str, Any]]) -> dict[str, Any]:
    if not chunks:
        return {}
    if len(chunks) == 1:
        return chunks[0]

    merged: dict[str, Any] = {}
    for key in ("trafficByLinks", "trafficByUrls"):
        merged[key] = []
        for chunk in chunks:
            entries = chunk.get(key)
            if isinstance(entries, list):
                merged[key].extend(entries)
    return merged


def _unwrap_stats(payload: dict[str, Any]) -> dict[str, Any]:
    stats = payload.get("stats")
    if isinstance(stats, dict):
        return stats
    return payload


def _entry_day(entry: dict[str, Any]) -> Optional[str]:
    for key in ("date", "day", "created_at", "timestamp"):
        value = entry.get(key)
        if not value:
            continue
        if isinstance(value, str):
            return value[:10]
    return None


def _slug_matches(entry: dict[str, Any], slug: str) -> bool:
    entry_slug = str(entry.get("u") or entry.get("slug") or "").lower()
    return entry_slug == slug.lower()


def _matches_link(entry: dict[str, Any], *, host: str, slug: str) -> bool:
    entry_host = str(entry.get("host") or "").lower()
    if not _slug_matches(entry, slug):
        return False
    if entry_host == host.lower():
        return True
    entry_url = str(entry.get("url") or entry.get("link") or "").lower()
    if entry_url and host.lower() in entry_url and slug.lower() in entry_url:
        return True
    return False


def resolve_tracking_host(
    stats: dict[str, Any],
    slug: str,
    *,
    preferred_host: Optional[str] = None,
) -> Optional[str]:
    """Linkscale peut tracker sur un domaine différent de l'URL publique (ex: heyliiink.com vs heylink.me)."""
    hosts_clicks: dict[str, int] = {}
    for entry in stats.get("trafficByLinks") or []:
        if not isinstance(entry, dict) or not _slug_matches(entry, slug):
            continue
        host = str(entry.get("host") or "").lower()
        if not host:
            continue
        hosts_clicks[host] = hosts_clicks.get(host, 0) + int(entry.get("clicks") or entry.get("count") or 0)

    if not hosts_clicks:
        return preferred_host

    if preferred_host and preferred_host.lower() in hosts_clicks:
        return preferred_host.lower()

    return max(hosts_clicks, key=hosts_clicks.get)


def _fetch_stats_window(from_iso: str, to_iso: str) -> dict[str, Any]:
    params = {
        "from": from_iso,
        "to": to_iso,
        "timezone": LINKSCALE_TIMEZONE,
        "traffic_data_type": "links",
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(
                f"{LINKSCALE_API_BASE}/stats",
                params=params,
                headers={"Authorization": f"Bearer {_api_key()}"},
            )
    except httpx.RequestError as exc:
        raise LinkscaleApiError(f"Linkscale injoignable : {exc}") from exc

    if response.status_code >= 400:
        detail = _parse_api_error(response)
        raise LinkscaleApiError(f"Linkscale API ({response.status_code}) : {detail}")

    payload = response.json()
    if not isinstance(payload, dict):
        raise LinkscaleApiError("Réponse Linkscale invalide.")
    return _unwrap_stats(payload)


def fetch_project_stats(*, days: int = 90) -> dict[str, Any]:
    windows = _period_windows(days)
    chunks = [_fetch_stats_window(from_iso, to_iso) for from_iso, to_iso in windows]
    return _merge_stats(chunks)


def extract_daily_clicks(
    stats: dict[str, Any],
    *,
    host: str,
    slug: str,
    days: int = 90,
) -> list[dict[str, Any]]:
    cutoff = (date.today() - timedelta(days=max(1, days) - 1)).isoformat()
    by_day: dict[str, int] = {}
    tracking_host = resolve_tracking_host(stats, slug, preferred_host=host) or host

    def _accumulate(match_host: str, *, slug_only: bool = False) -> None:
        for entry in stats.get("trafficByLinks") or []:
            if not isinstance(entry, dict):
                continue
            if slug_only:
                if not _slug_matches(entry, slug):
                    continue
            elif not _matches_link(entry, host=match_host, slug=slug):
                continue
            day = _entry_day(entry)
            if not day or day < cutoff:
                continue
            by_day[day] = by_day.get(day, 0) + int(entry.get("clicks") or entry.get("count") or 0)

    _accumulate(host)
    if not by_day and tracking_host != host:
        _accumulate(tracking_host)
    if not by_day:
        _accumulate(host, slug_only=True)

    # Fallback: aggregate URL stats without per-day breakdown
    if not by_day:
        total = 0
        for entry in stats.get("trafficByUrls") or []:
            if not isinstance(entry, dict):
                continue
            if not _matches_link(entry, host=tracking_host, slug=slug) and not _slug_matches(entry, slug):
                continue
            total += int(entry.get("clicks") or entry.get("count") or 0)
        if total > 0:
            by_day[date.today().isoformat()] = total

    return [{"date": day, "clicks": clicks} for day, clicks in sorted(by_day.items())]


def fetch_link_daily_clicks(
    *,
    host: str,
    slug: str,
    days: int = 90,
    stats: Optional[dict[str, Any]] = None,
) -> tuple[list[dict[str, Any]], Optional[str]]:
    project_stats = stats if stats is not None else fetch_project_stats(days=days)
    tracking_host = resolve_tracking_host(project_stats, slug, preferred_host=host)
    points = extract_daily_clicks(project_stats, host=host, slug=slug, days=days)
    return points, tracking_host
