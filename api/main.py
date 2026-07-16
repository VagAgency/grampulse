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
    init_db()


@app.get("/health")
def health():
    from instagram_provider import get_instagram_mode
    from linkscale_provider import is_linkscale_configured

    mode = get_instagram_mode()
    return {
        "status": "ok",
        "product": "GramPulse",
        "instagram_mode": mode,
        "hiker_configured": bool(os.getenv("HIKERAPI_ACCESS_KEY") or os.getenv("HIKER_API_TOKEN")),
        "apify_configured": bool(os.getenv("APIFY_API_TOKEN")),
        "mock_active": mode == "mock",
        "linkscale_configured": is_linkscale_configured(),
    }


@app.get("/")
def root():
    return {"product": "GramPulse API", "status": "ok", "health": "/health"}
