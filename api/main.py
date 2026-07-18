from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

env_file = Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    load_dotenv(env_file)

from database import init_db
from routes.dashboard import router as dashboard_router
from routes.models import router as models_router
from routes.linkscale import router as linkscale_router
from routes.refresh import router as refresh_router
from routes.team import router as team_router
from routes.whop import router as whop_router
from routes.restore import router as restore_router

APP_URL = os.getenv("APP_URL", "http://localhost:3000")
_extra_origins = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [
    APP_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if _extra_origins:
    ALLOWED_ORIGINS.extend(o.strip() for o in _extra_origins.split(",") if o.strip())
ALLOWED_ORIGINS = list(dict.fromkeys(ALLOWED_ORIGINS))

app = FastAPI(title="GramPulse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_router)
app.include_router(models_router)
app.include_router(refresh_router)
app.include_router(linkscale_router)
app.include_router(team_router)
app.include_router(whop_router)
app.include_router(restore_router)


@app.on_event("startup")
def startup() -> None:
    import logging

    from persist_backup import maybe_migrate_tmp_db_to_persistent, restore_sqlite_if_available

    logging.basicConfig(level=logging.INFO)
    import database as db

    restore_sqlite_if_available()
    maybe_migrate_tmp_db_to_persistent(db.DB_PATH)
    init_db()
    from startup_restore import schedule_restore_in_background

    schedule_restore_in_background()


@app.get("/health")
def health():
    from instagram_provider import get_instagram_mode
    from linkscale_provider import is_linkscale_configured
    from backup_io import DEFAULT_BUNDLE_PATH
    from startup_restore import get_restore_state
    from persist_backup import persist_status
    from daily_refresh import REFRESH_RESET_HOUR, REFRESH_TIMEZONE
    import database as db

    mode = get_instagram_mode()
    bypass = os.getenv("DEV_BYPASS_EMAIL", "").strip().lower()
    model_count = len(db.list_models(bypass)) if bypass else 0
    return {
        "status": "ok",
        "product": "GramPulse",
        "instagram_mode": mode,
        "hiker_configured": bool(os.getenv("HIKERAPI_ACCESS_KEY") or os.getenv("HIKER_API_TOKEN")),
        "apify_configured": bool(os.getenv("APIFY_API_TOKEN")),
        "mock_active": mode == "mock",
        "linkscale_configured": is_linkscale_configured(),
        "db_path": str(db.DB_PATH),
        "auto_restore": os.getenv("GRAMPULSE_AUTO_RESTORE", "true"),
        "backup_bundle_present": DEFAULT_BUNDLE_PATH.exists(),
        "dev_models_count": model_count,
        "restore_status": get_restore_state(),
        "persist": persist_status(),
        "daily_refresh_reset_hour": REFRESH_RESET_HOUR,
        "daily_refresh_timezone": REFRESH_TIMEZONE,
        "hiker_country_reels": int(os.getenv("HIKER_COUNTRY_REELS", "0")),
        "hiker_posts_limit": int(os.getenv("HIKER_POSTS_LIMIT", "25")),
    }


@app.get("/")
def root():
    return {"product": "GramPulse API", "status": "ok", "health": "/health"}
