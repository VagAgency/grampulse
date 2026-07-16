from __future__ import annotations

import os
from typing import Any, Optional
from urllib.parse import urlencode, urlparse, urlunparse

import httpx
from fastapi import APIRouter, Header, HTTPException, Query, Request, Response

import database as db

router = APIRouter(prefix="/whop", tags=["whop"])

WHOP_API_KEY = os.getenv("WHOP_API_KEY", "")
WHOP_WEBHOOK_SECRET = os.getenv("WHOP_WEBHOOK_SECRET", "")
WHOP_PLAN_ID = os.getenv("WHOP_PLAN_ID", "")
WHOP_PRODUCT_ID = os.getenv("WHOP_PRODUCT_ID", "")
WHOP_CHECKOUT_URL = os.getenv("WHOP_CHECKOUT_URL", "")
WHOP_RETURN_URL = os.getenv("WHOP_RETURN_URL", "")
APP_URL = os.getenv("APP_URL", "http://localhost:3000")
WHOP_API_BASE = "https://api.whop.com/api/v1"
PLAN_LABEL = os.getenv("GRAMPULSE_PLAN_LABEL", "GramPulse Pro")
PRICE_LABEL = os.getenv("GRAMPULSE_PRICE_LABEL", "99 €/mois")

ACTIVE_STATUSES = {"active", "trialing"}


def _is_placeholder(value: str) -> bool:
    return not value or "..." in value or value.endswith("_")


def _whop_ready() -> bool:
    has_checkout = not _is_placeholder(WHOP_CHECKOUT_URL) or not _is_placeholder(WHOP_PLAN_ID)
    return not _is_placeholder(WHOP_API_KEY) and has_checkout


def _checkout_base_url() -> str:
    if WHOP_CHECKOUT_URL and not _is_placeholder(WHOP_CHECKOUT_URL):
        return WHOP_CHECKOUT_URL.rstrip("/")
    if WHOP_PLAN_ID and not _is_placeholder(WHOP_PLAN_ID):
        return f"https://whop.com/checkout/{WHOP_PLAN_ID}"
    raise HTTPException(503, "Checkout Whop non configuré (WHOP_PLAN_ID ou WHOP_CHECKOUT_URL).")


def _build_checkout_url(email: str) -> str:
    base = _checkout_base_url()
    parsed = urlparse(base)
    query = {
        "email": email,
        "email.disabled": "1",
    }
    return_url = WHOP_RETURN_URL or f"{APP_URL}/account?checkout=success&email={email}"
    if return_url and not _is_placeholder(return_url):
        query["redirect"] = return_url
    return urlunparse(parsed._replace(query=urlencode(query)))


def _membership_email(membership: dict[str, Any]) -> str | None:
    user = membership.get("user") or {}
    email = user.get("email")
    return email.strip().lower() if isinstance(email, str) and email else None


def _membership_active(membership: dict[str, Any]) -> bool:
    return membership.get("status") in ACTIVE_STATUSES


def _apply_membership(membership: dict[str, Any]) -> str | None:
    email = _membership_email(membership)
    if not email:
        return None
    user = membership.get("user") or {}
    db.upsert_subscriber(
        email=email,
        whop_membership_id=membership.get("id"),
        whop_user_id=user.get("id"),
        whop_manage_url=membership.get("manage_url"),
        active=_membership_active(membership),
    )
    return email


async def _whop_get(path: str, params: list[tuple[str, str]] | None = None) -> dict[str, Any]:
    if not WHOP_API_KEY or _is_placeholder(WHOP_API_KEY):
        raise HTTPException(503, "WHOP_API_KEY manquant.")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{WHOP_API_BASE}{path}",
            headers={"Authorization": f"Bearer {WHOP_API_KEY}"},
            params=params or [],
        )

    if response.status_code == 401:
        raise HTTPException(503, "Clé API Whop invalide.")
    if response.status_code >= 400:
        detail = response.text[:200] or "Erreur Whop."
        raise HTTPException(400, f"Whop: {detail}")

    return response.json()


async def _sync_whop_membership(email: str) -> dict[str, Any] | None:
    params: list[tuple[str, str]] = [
        ("query", email.strip().lower()),
        ("statuses", "active"),
        ("statuses", "trialing"),
    ]
    if WHOP_PRODUCT_ID and not _is_placeholder(WHOP_PRODUCT_ID):
        params.append(("product_ids", WHOP_PRODUCT_ID))
    if WHOP_PLAN_ID and not _is_placeholder(WHOP_PLAN_ID):
        params.append(("plan_ids", WHOP_PLAN_ID))

    payload = await _whop_get("/memberships", params)
    memberships = payload.get("data") or []
    for membership in memberships:
        if _membership_email(membership) == email.strip().lower() and _membership_active(membership):
            _apply_membership(membership)
            return membership
    return None


def _unwrap_webhook(body: str, headers: dict[str, str]) -> dict[str, Any]:
    if not WHOP_WEBHOOK_SECRET or _is_placeholder(WHOP_WEBHOOK_SECRET):
        raise HTTPException(503, "WHOP_WEBHOOK_SECRET manquant.")

    try:
        from whop_sdk import Whop

        client = Whop(api_key=WHOP_API_KEY or "unused", webhook_key=WHOP_WEBHOOK_SECRET)
        event = client.webhooks.unwrap(body, headers=headers)
        return {"type": event.type, "data": event.data}
    except ImportError as exc:
        raise HTTPException(503, "whop-sdk non installé sur le serveur.") from exc
    except Exception as exc:
        raise HTTPException(400, "Signature webhook Whop invalide.") from exc


@router.post("/checkout")
async def create_checkout(email: str = Query(...)):
    email = email.strip().lower()
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "Entre une adresse email valide.")

    if not _whop_ready():
        raise HTTPException(
            503,
            "Paiement Whop pas encore activé. Configure WHOP_API_KEY et WHOP_PLAN_ID sur Render.",
        )

    return {"url": _build_checkout_url(email)}


@router.get("/status")
async def subscription_status(x_user_email: Optional[str] = Header(default=None)):
    if not x_user_email:
        raise HTTPException(401, "Email requis.")

    dev = os.getenv("DEV_BYPASS_EMAIL", "").strip().lower()
    is_dev = bool(dev and x_user_email.strip().lower() == dev)
    subscriber = db.get_subscriber(x_user_email)
    active = db.has_active_access(x_user_email)

    return {
        "email": x_user_email,
        "active": active,
        "plan": PLAN_LABEL if active else None,
        "price_label": PRICE_LABEL if active else None,
        "dev_account": is_dev,
        "whop_configured": _whop_ready(),
        "member_since": subscriber["created_at"] if subscriber else None,
        "has_billing": bool(subscriber and subscriber.get("whop_membership_id")),
        "manage_url": subscriber.get("whop_manage_url") if subscriber else None,
    }


@router.post("/portal")
async def billing_portal(x_user_email: Optional[str] = Header(default=None)):
    if not x_user_email:
        raise HTTPException(401, "Email requis.")

    subscriber = db.get_subscriber(x_user_email)
    manage_url = subscriber.get("whop_manage_url") if subscriber else None

    if not manage_url:
        membership = await _sync_whop_membership(x_user_email.strip().lower())
        manage_url = membership.get("manage_url") if membership else None

    if not manage_url:
        raise HTTPException(404, "Aucun abonnement Whop lié à ce compte.")

    return {"url": manage_url}


@router.post("/webhook")
async def whop_webhook(request: Request):
    body = (await request.body()).decode()
    event = _unwrap_webhook(body, dict(request.headers))
    event_type = event.get("type")
    data = event.get("data") or {}

    if event_type in ("membership.activated", "membership.deactivated", "payment.succeeded"):
        membership = data if data.get("status") is not None or data.get("user") else data.get("membership") or data
        if isinstance(membership, dict) and membership.get("id"):
            _apply_membership(membership)

    return Response(status_code=200)


@router.get("/config-check")
async def whop_config_check():
    return {
        "whop_configured": _whop_ready(),
        "webhook_configured": bool(WHOP_WEBHOOK_SECRET and not _is_placeholder(WHOP_WEBHOOK_SECRET)),
        "app_url": APP_URL,
        "payment_provider": "whop",
        "plan_label": PLAN_LABEL,
        "price_label": PRICE_LABEL,
    }


@router.post("/sync-subscription")
async def sync_subscription(email: str = Query(...)):
    if not WHOP_API_KEY or _is_placeholder(WHOP_API_KEY):
        raise HTTPException(503, "Whop non configuré.")

    email = email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Email invalide.")

    membership = await _sync_whop_membership(email)
    if not membership:
        raise HTTPException(402, "Aucun abonnement actif trouvé sur Whop pour cet email.")

    return {"email": email, "active": True}
