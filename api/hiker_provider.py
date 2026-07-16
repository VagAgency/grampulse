from __future__ import annotations

import os
import re
from statistics import median
from typing import Any

import httpx

HIKER_API_KEY = os.getenv("HIKERAPI_ACCESS_KEY", "").strip() or os.getenv("HIKER_API_TOKEN", "").strip()
HIKER_BASE_URL = os.getenv("HIKER_API_BASE_URL", "https://api.hikerapi.com").rstrip("/")
HIKER_POSTS_LIMIT = int(os.getenv("HIKER_POSTS_LIMIT", "25"))
HIKER_TIMEOUT = float(os.getenv("HIKER_TIMEOUT", "60"))
HIKER_COUNTRY_REELS = int(os.getenv("HIKER_COUNTRY_REELS", "5"))

# Drapeaux emoji → pays (audience estimée via commentaires)
_FLAG_COUNTRIES: dict[str, str] = {
    "🇫🇷": "France",
    "🇧🇪": "Belgique",
    "🇨🇭": "Suisse",
    "🇨🇦": "Canada",
    "🇺🇸": "États-Unis",
    "🇬🇧": "Royaume-Uni",
    "🇩🇪": "Allemagne",
    "🇪🇸": "Espagne",
    "🇮🇹": "Italie",
    "🇵🇹": "Portugal",
    "🇲🇦": "Maroc",
    "🇩🇿": "Algérie",
    "🇹🇳": "Tunisie",
    "🇧🇷": "Brésil",
    "🇲🇽": "Mexique",
    "🇯🇵": "Japon",
    "🇰🇷": "Corée du Sud",
    "🇮🇳": "Inde",
    "🇦🇪": "Émirats arabes unis",
    "🇸🇦": "Arabie saoudite",
    "🇬🇵": "Guadeloupe",
    "🇲🇶": "Martinique",
    "🇷🇪": "La Réunion",
    "🇨🇮": "Côte d'Ivoire",
    "🇸🇳": "Sénégal",
    "🇨🇲": "Cameroun",
}

_PHONE_COUNTRIES: dict[str, str] = {
    "33": "France",
    "32": "Belgique",
    "41": "Suisse",
    "1": "États-Unis / Canada",
    "44": "Royaume-Uni",
    "49": "Allemagne",
    "34": "Espagne",
    "39": "Italie",
    "351": "Portugal",
    "212": "Maroc",
    "213": "Algérie",
    "216": "Tunisie",
    "55": "Brésil",
    "52": "Mexique",
    "81": "Japon",
    "82": "Corée du Sud",
    "91": "Inde",
    "971": "Émirats arabes unis",
}


class HikerNotConfiguredError(RuntimeError):
    pass


class HikerProfileNotFoundError(RuntimeError):
    pass


def fetch_hiker_insights(handle: str) -> dict[str, Any]:
    api_key = os.getenv("HIKERAPI_ACCESS_KEY", "").strip() or os.getenv("HIKER_API_TOKEN", "").strip()
    if not api_key:
        raise HikerNotConfiguredError(
            "HIKERAPI_ACCESS_KEY manquant. Crée un compte sur hikerapi.com et ajoute la clé dans .env"
        )

    handle = handle.lstrip("@").strip().lower()
    user_resp = _get("/v2/user/by/username", {"username": handle})
    user = user_resp.get("user") or user_resp
    if not user:
        raise HikerProfileNotFoundError(f"Profil @{handle} introuvable")

    if user.get("is_private"):
        raise HikerProfileNotFoundError(f"@{handle} est un compte privé")

    user_id = str(user.get("pk") or user.get("id") or "")
    if not user_id:
        raise HikerProfileNotFoundError(f"Impossible de lire l'ID du profil @{handle}")

    clips = _extract_clips(user_id)
    medias = _extract_medias(user_id)
    posts = _merge_posts(clips, medias)[:HIKER_POSTS_LIMIT]
    analysis = _compute_analysis(posts, user)
    analysis["countryDistribution"] = _estimate_country_distribution(posts)

    return {
        "profile": {
            "username": user.get("username") or handle,
            "fullName": user.get("full_name") or user.get("fullName"),
            "biography": user.get("biography") or "",
            "profilePicUrl": user.get("profile_pic_url") or user.get("profile_pic_url_hd"),
            "externalUrl": _external_url(user),
            "verified": bool(user.get("is_verified")),
            "isBusinessAccount": bool(user.get("is_business") or user.get("account_type") == 2),
            "followers": user.get("follower_count") or user.get("edge_followed_by", {}).get("count"),
            "following": user.get("following_count") or user.get("edge_follow", {}).get("count"),
            "posts": user.get("media_count") or user.get("edge_owner_to_timeline_media", {}).get("count"),
        },
        "analysis": analysis,
        "posts": posts,
        "_source": "hiker",
    }


def _get(path: str, params: dict[str, Any]) -> dict[str, Any]:
    api_key = os.getenv("HIKERAPI_ACCESS_KEY", "").strip() or os.getenv("HIKER_API_TOKEN", "").strip()
    if not api_key:
        raise HikerNotConfiguredError(
            "HIKERAPI_ACCESS_KEY manquant. Crée un compte sur hikerapi.com et ajoute la clé dans .env"
        )
    url = f"{HIKER_BASE_URL}{path}"
    headers = {"x-access-key": api_key}
    with httpx.Client(timeout=HIKER_TIMEOUT) as client:
        resp = client.get(url, params=params, headers=headers)

    if resp.status_code == 404:
        raise HikerProfileNotFoundError("Profil introuvable ou privé")
    if resp.status_code in (401, 403):
        raise HikerNotConfiguredError("Clé HikerAPI invalide ou crédit épuisé")
    if resp.status_code >= 400:
        detail = resp.text[:200]
        raise RuntimeError(f"HikerAPI erreur {resp.status_code}: {detail}")

    data = resp.json()
    if isinstance(data, dict) and data.get("status") == "fail":
        raise HikerProfileNotFoundError(data.get("message") or "Requête HikerAPI échouée")
    return data if isinstance(data, dict) else {"data": data}


def _extract_clips(user_id: str) -> list[dict[str, Any]]:
    try:
        data = _get("/v2/user/clips", {"user_id": user_id})
    except Exception:
        return []

    response = data.get("response") or data
    items = response.get("items") or data.get("items") or []
    posts: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        media = item.get("media") or item
        if isinstance(media, dict):
            posts.append(_normalize_media(media, default_type="reel"))
    return posts


def _extract_medias(user_id: str) -> list[dict[str, Any]]:
    try:
        data = _get("/gql/user/medias", {"user_id": user_id})
    except Exception:
        return []

    items = _collect_media_items(data)
    return [_normalize_media(item, default_type="post") for item in items if isinstance(item, dict)]


def _collect_media_items(data: Any) -> list[dict[str, Any]]:
    """Extrait les médias depuis les réponses GQL (stream_rows, listes, etc.)."""
    found: list[dict[str, Any]] = []
    seen: set[str] = set()

    def is_media(node: dict[str, Any]) -> bool:
        return bool(node.get("code") or node.get("pk") or node.get("id")) and any(
            k in node
            for k in ("like_count", "comment_count", "play_count", "media_type", "caption", "caption_text")
        )

    def walk(node: Any) -> None:
        if isinstance(node, list):
            for child in node:
                walk(child)
            return
        if not isinstance(node, dict):
            return
        if is_media(node):
            key = str(node.get("pk") or node.get("code") or node.get("id"))
            if key not in seen:
                seen.add(key)
                found.append(node)
        for value in node.values():
            if isinstance(value, (dict, list)):
                walk(value)

    walk(data)
    return found


def _normalize_media(item: dict[str, Any], *, default_type: str) -> dict[str, Any]:
    code = item.get("code") or item.get("shortcode")
    product = (item.get("product_type") or "").lower()
    media_type = default_type
    if product in {"clips", "reels", "igtv"} or item.get("play_count") or item.get("view_count"):
        media_type = "reel"

    likes = item.get("like_count") or item.get("likes") or 0
    comments = item.get("comment_count") or item.get("comments") or 0
    views = item.get("play_count") or item.get("view_count") or item.get("video_view_count") or 0
    ts = item.get("taken_at") or item.get("taken_at_ts") or item.get("timestamp")
    caption = item.get("caption_text") or item.get("caption") or ""
    if isinstance(caption, dict):
        caption = caption.get("text") or ""

    video_url = _video_url(item)
    thumbnail_url = _thumbnail_url(item)
    media_id = str(item.get("pk") or item.get("id") or "")
    shares = int(item.get("reshare_count") or item.get("share_count") or 0)
    reel_url = f"https://www.instagram.com/reel/{code}/" if code and media_type == "reel" else (
        f"https://www.instagram.com/p/{code}/" if code else None
    )

    return {
        "url": reel_url or (f"https://www.instagram.com/p/{code}/" if code else None),
        "type": media_type,
        "likes": likes,
        "comments": comments,
        "views": views,
        "shares": shares,
        "engagement": None,
        "caption": str(caption)[:200],
        "timestamp": ts,
        "code": code,
        "media_id": media_id or None,
        "video_url": video_url,
        "thumbnail_url": thumbnail_url,
    }


def _merge_posts(clips: list[dict], medias: list[dict]) -> list[dict]:
    seen: set[str] = set()
    merged: list[dict] = []
    for post in clips + medias:
        key = post.get("code") or post.get("url") or str(post.get("timestamp"))
        if key in seen:
            continue
        seen.add(key)
        merged.append(post)
    return merged


def _compute_analysis(posts: list[dict], user: dict) -> dict[str, Any]:
    followers = int(user.get("follower_count") or user.get("edge_followed_by", {}).get("count") or 0)
    likes = [int(p.get("likes") or 0) for p in posts]
    comments = [int(p.get("comments") or 0) for p in posts]

    avg_likes = sum(likes) / len(likes) if likes else 0
    avg_comments = sum(comments) / len(comments) if comments else 0
    engagements = []
    for p in posts:
        eng = (int(p.get("likes") or 0) + int(p.get("comments") or 0))
        if followers > 0:
            p["engagement"] = round((eng / followers) * 100, 2)
        engagements.append(eng)

    avg_engagement_rate = round(((avg_likes + avg_comments) / followers) * 100, 2) if followers else 0
    median_engagement = 0.0
    if engagements and followers:
        median_engagement = round((median(engagements) / followers) * 100, 2)

    top_posts = sorted(
        posts,
        key=lambda p: (int(p.get("views") or 0), int(p.get("likes") or 0)),
        reverse=True,
    )[:10]

    hashtags: dict[str, int] = {}
    for post in posts:
        for tag in re.findall(r"#(\w+)", post.get("caption") or "", flags=re.I):
            hashtags[tag.lower()] = hashtags.get(tag.lower(), 0) + 1
    top_hashtags = [f"#{k}" for k, _ in sorted(hashtags.items(), key=lambda x: x[1], reverse=True)[:10]]

    return {
        "avgLikes": round(avg_likes, 1),
        "avgComments": round(avg_comments, 1),
        "avgEngagementRate": avg_engagement_rate,
        "medianEngagement": median_engagement,
        "topPosts": top_posts,
        "topHashtags": top_hashtags,
        "postsAnalyzed": len(posts),
    }


def _external_url(user: dict[str, Any]) -> str | None:
    links = user.get("bio_links") or user.get("external_url") or []
    if isinstance(links, str):
        return links
    if isinstance(links, list) and links:
        first = links[0]
        if isinstance(first, dict):
            return first.get("url") or first.get("link")
        return str(first)
    return user.get("external_url")


def _video_url(item: dict[str, Any]) -> str | None:
    versions = item.get("video_versions") or []
    if not versions:
        return None
    best = max(versions, key=lambda v: int(v.get("width") or 0))
    return best.get("url")


def _thumbnail_url(item: dict[str, Any]) -> str | None:
    candidates = (item.get("image_versions2") or {}).get("candidates") or []
    if candidates:
        return candidates[0].get("url")
    return item.get("thumbnail_url")


def _estimate_country_distribution(posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Estime la répartition des vues par pays via l'audience des commentaires sur les top reels."""
    country_views: dict[str, float] = {}
    top_reels = sorted(
        [p for p in posts if p.get("type") == "reel" and int(p.get("views") or 0) > 0],
        key=lambda p: int(p.get("views") or 0),
        reverse=True,
    )[:HIKER_COUNTRY_REELS]

    for reel in top_reels:
        media_id = reel.get("media_id")
        views = int(reel.get("views") or 0)
        if not media_id or views <= 0:
            continue
        weights = _country_weights_from_comments(str(media_id))
        if not weights:
            continue
        for country, weight in weights.items():
            country_views[country] = country_views.get(country, 0) + views * weight

    if not country_views:
        return []

    total = sum(country_views.values()) or 1
    ranked = sorted(country_views.items(), key=lambda x: x[1], reverse=True)[:5]
    return [
        {"country": country, "percent": round((value / total) * 100, 1)}
        for country, value in ranked
    ]


def _country_weights_from_comments(media_id: str) -> dict[str, float]:
    try:
        data = _get("/v1/media/comments/chunk", {"id": media_id})
    except Exception:
        return {}

    chunks = data.get("data") or []
    comments = chunks[0] if chunks and isinstance(chunks[0], list) else []
    if not comments:
        return {}

    counts: dict[str, int] = {}
    for comment in comments:
        if not isinstance(comment, dict):
            continue
        user = comment.get("user") or {}
        country = _detect_country(user, comment.get("text") or "")
        counts[country] = counts.get(country, 0) + 1

    total = sum(counts.values()) or 1
    return {country: count / total for country, count in counts.items()}


def _detect_country(user: dict[str, Any], comment_text: str = "") -> str:
    full_name = user.get("full_name") or ""
    for flag, country in _FLAG_COUNTRIES.items():
        if flag in full_name:
            return country

    phone_code = str(user.get("public_phone_country_code") or "").strip()
    if phone_code and phone_code in _PHONE_COUNTRIES:
        return _PHONE_COUNTRIES[phone_code]

    city = user.get("city_name")
    if city:
        return str(city)

    text = f"{full_name} {comment_text}".lower()
    if any(w in text for w in ("france", "paris", "lyon", "marseille", "🇫🇷")):
        return "France"
    if any(w in text for w in ("belgique", "bruxelles", "🇧🇪")):
        return "Belgique"
    if any(w in text for w in ("canada", "montréal", "quebec", "🇨🇦")):
        return "Canada"
    if any(w in text for w in ("maroc", "casablanca", "🇲🇦")):
        return "Maroc"

    return "Autre"
