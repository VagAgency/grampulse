from __future__ import annotations

import hashlib
import random
from datetime import date, datetime, timedelta, timezone
from typing import Any

import database as db


def build_mock_insights(handle: str, *, force_refresh: bool = False) -> dict[str, Any]:
    """Génère des données Instagram fictives mais cohérentes pour le dev local."""
    handle = handle.lstrip("@").strip().lower()
    if not handle:
        raise ValueError("Handle Instagram invalide")
    if handle in {"private", "prive", "hidden"}:
        raise MockPrivateProfileError(f"@{handle} est privé (simulation)")

    seed = int(hashlib.sha256(handle.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)

    followers = rng.randint(8_000, 850_000)
    following = rng.randint(120, min(2_500, followers // 20))
    posts_count = rng.randint(45, 420)

    if force_refresh:
        followers += rng.randint(-120, 350)

    avg_likes = int(followers * rng.uniform(0.008, 0.045))
    avg_comments = max(8, int(avg_likes * rng.uniform(0.04, 0.12)))
    avg_engagement_rate = round(((avg_likes + avg_comments) / followers) * 100, 2)

    top_posts = []
    for i in range(10):
        is_reel = i < 6
        likes = int(avg_likes * rng.uniform(0.7, 2.8))
        comments = max(5, int(avg_comments * rng.uniform(0.6, 2.2)))
        views = int(likes * rng.uniform(8, 25)) if is_reel else None
        days_ago = rng.randint(1, 90)
        top_posts.append(
            {
                "url": f"https://www.instagram.com/reel/MOCK{handle[:4]}{i}/" if is_reel else f"https://www.instagram.com/p/MOCK{handle[:4]}{i}/",
                "type": "reel" if is_reel else "post",
                "likes": likes,
                "comments": comments,
                "shares": max(1, int(comments * rng.uniform(0.2, 1.5))) if is_reel else 0,
                "views": views,
                "engagement": round(((likes + comments) / followers) * 100, 2),
                "caption": _mock_caption(handle, i, is_reel),
                "timestamp": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat(),
                "code": f"MOCK{handle[:4]}{i}",
                "media_id": f"mock-{handle}-{i}",
                "video_url": f"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" if is_reel else None,
                "thumbnail_url": f"https://picsum.photos/seed/{handle}{i}/400/700",
            }
        )

    top_posts.sort(key=lambda p: (p.get("views") or 0, p.get("likes") or 0), reverse=True)
    hashtags = [f"#{tag}" for tag in ("fitness", "motivation", "reels", "viral", "lifestyle")[: rng.randint(3, 5)]]

    display_names = {
        "cristiano": "Cristiano Ronaldo",
        "nike": "Nike",
        "natgeo": "National Geographic",
        "psg": "Paris Saint-Germain",
        "lea.fit": "Léa Fitness",
        "sarah.style": "Sarah Style",
    }

    return {
        "profile": {
            "username": handle,
            "fullName": display_names.get(handle, handle.replace("_", " ").replace(".", " ").title()),
            "biography": f"Compte démo @{handle} — données simulées pour développement GramPulse.",
            "profilePicUrl": None,
            "externalUrl": f"https://example.com/{handle}",
            "verified": followers > 500_000,
            "isBusinessAccount": rng.random() > 0.4,
            "followers": followers,
            "following": following,
            "posts": posts_count,
        },
        "analysis": {
            "avgLikes": avg_likes,
            "avgComments": avg_comments,
            "avgEngagementRate": avg_engagement_rate,
            "medianEngagement": round(avg_engagement_rate * rng.uniform(0.85, 1.05), 2),
            "topPosts": top_posts,
            "topHashtags": hashtags,
            "countryDistribution": _mock_country_distribution(handle),
            "postsAnalyzed": min(25, posts_count),
        },
        "_mock": True,
    }


def seed_daily_views(
    tracked_account_id: int,
    handle: str,
    days: int = 30,
    *,
    profile: str | None = None,
) -> None:
    """Génère un historique de vues jour par jour pour les courbes."""
    seed = int(hashlib.sha256(f"{handle}-views".encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    base = rng.randint(3_000, 180_000)
    profile = profile or rng.choice(["rising", "falling", "steady", "volatile", "spike"])
    today = date.today()

    base_followers = rng.randint(1_500, 8_000)

    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        day_index = days - offset
        noise = rng.uniform(0.82, 1.18)
        weekend_boost = 1.18 if day.weekday() >= 5 else 1.0

        if profile == "banned":
            views = rng.randint(30, 280)
        else:
            if profile == "rising":
                growth = 1 + 0.012 * day_index
            elif profile == "falling":
                growth = 1.35 - 0.01 * day_index
            elif profile == "volatile":
                growth = 1 + 0.25 * (1 if day_index % 5 < 2 else -0.35)
            elif profile == "spike":
                growth = 2.8 if 22 <= day_index <= 26 else 1.0
            else:
                growth = 1 + rng.uniform(-0.02, 0.02)
            views = max(100, int(base * noise * growth * weekend_boost))

        follower_growth = int(base_followers * (0.003 * day_index + rng.uniform(-0.01, 0.02)))
        followers = max(100, base_followers + follower_growth)

        db.upsert_daily_view(
            tracked_account_id=tracked_account_id,
            day=day.isoformat(),
            views=views,
            followers=followers,
        )


def derive_status(
    health_score: int,
    views_7d: int,
    views_prev_7d: int,
    *,
    profile: str | None = None,
) -> str:
    if profile == "banned" or views_7d < 400:
        return "ban"
    if profile == "falling" or (
        views_prev_7d > 0 and views_7d < views_prev_7d * 0.6
    ):
        return "shadowban"
    return "actif"


def _mock_caption(handle: str, index: int, is_reel: bool) -> str:
    kind = "Reel" if is_reel else "Post"
    return f"{kind} #{index + 1} de @{handle} — contenu démo pour tester le dashboard."


def _mock_country_distribution(handle: str) -> list[dict[str, Any]]:
    seed = int(hashlib.sha256(f"{handle}-countries".encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    pool = ["France", "Belgique", "Canada", "Maroc", "Suisse", "États-Unis", "Espagne"]
    rng.shuffle(pool)
    weights = [rng.randint(8, 40) for _ in range(5)]
    total = sum(weights)
    return [
        {"country": pool[i], "percent": round((weights[i] / total) * 100, 1)}
        for i in range(5)
    ]


class MockPrivateProfileError(RuntimeError):
    pass
