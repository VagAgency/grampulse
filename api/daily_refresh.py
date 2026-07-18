from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import database as db

REFRESH_RESET_HOUR = int(os.getenv("REFRESH_RESET_HOUR", "8"))
REFRESH_TIMEZONE = os.getenv(
    "REFRESH_TIMEZONE",
    os.getenv("LINKSCALE_TIMEZONE", "Europe/Paris"),
)


def _tz() -> ZoneInfo:
    try:
        return ZoneInfo(REFRESH_TIMEZONE)
    except Exception:
        return ZoneInfo("Europe/Paris")


def _parse_fetched_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def current_period_start(now: datetime | None = None) -> datetime:
    """Début de la période de refresh en cours (dernier reset à REFRESH_RESET_HOUR)."""
    now = now or datetime.now(_tz())
    local = now.astimezone(_tz())
    start = local.replace(
        hour=REFRESH_RESET_HOUR, minute=0, second=0, microsecond=0
    )
    if local < start:
        start -= timedelta(days=1)
    return start


def next_period_start(now: datetime | None = None) -> datetime:
    return current_period_start(now) + timedelta(days=1)


@dataclass
class DailyRefreshStatus:
    used_this_period: bool
    period_start: datetime
    next_available_at: datetime
    timezone: str
    reset_hour: int

    @property
    def available_now(self) -> bool:
        return not self.used_this_period

    def message_when_blocked(self) -> str:
        nxt = self.next_available_at.astimezone(_tz())
        day_label = "aujourd'hui" if nxt.date() == datetime.now(_tz()).date() else "demain"
        return (
            f"Refresh du jour déjà utilisé — prochain refresh {day_label} à "
            f"{nxt.strftime('%H')}h ({REFRESH_TIMEZONE})."
        )


def _user_synced_since(email: str, since: datetime) -> bool:
    for acc in db.list_all_accounts_enriched(email):
        account_id = acc.get("id")
        if not account_id:
            continue
        snapshot = db.get_latest_snapshot(account_id)
        if not snapshot:
            continue
        fetched = _parse_fetched_at(snapshot.get("fetched_at"))
        if fetched and fetched.astimezone(_tz()) >= since.astimezone(_tz()):
            return True
    return False


def get_daily_refresh_status(email: str, now: datetime | None = None) -> DailyRefreshStatus:
    period_start = current_period_start(now)
    used = _user_synced_since(email, period_start)
    next_at = next_period_start(now) if used else (now or datetime.now(_tz()))
    return DailyRefreshStatus(
        used_this_period=used,
        period_start=period_start,
        next_available_at=next_at,
        timezone=REFRESH_TIMEZONE,
        reset_hour=REFRESH_RESET_HOUR,
    )


def daily_refresh_status_dict(email: str) -> dict:
    status = get_daily_refresh_status(email)
    return {
        "used_this_period": status.used_this_period,
        "available_now": status.available_now,
        "period_start": status.period_start.isoformat(),
        "next_available_at": status.next_available_at.isoformat(),
        "reset_hour": status.reset_hour,
        "timezone": status.timezone,
        "message": status.message_when_blocked() if status.used_this_period else None,
    }
