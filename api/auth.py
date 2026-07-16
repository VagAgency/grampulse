from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

import database as db


def require_access(x_user_email: Optional[str]) -> str:
    email = (x_user_email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=401, detail="Email requis (header X-User-Email).")
    if not db.has_active_access(email):
        raise HTTPException(
            status_code=402,
            detail="Abonnement actif requis. Souscris sur la page d'accueil ou connecte-toi avec ton email d'abonnement.",
        )
    return email
