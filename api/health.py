from __future__ import annotations

from typing import Any


def compute_health_score(data: dict[str, Any]) -> tuple[int, str, dict[str, Any]]:
    """
    Score de santé 0-100 basé sur engagement, activité, audience et régularité.
    Retourne (score, label, breakdown).
    """
    followers = data.get("followers") or 0
    following = data.get("following") or 0
    posts_count = data.get("posts_count") or 0
    engagement_rate = data.get("avg_engagement_rate") or 0.0
    posts_analyzed = data.get("posts_analyzed") or 0
    top_posts = data.get("top_posts") or []

    engagement_score = _engagement_score(engagement_rate, followers)
    activity_score = _activity_score(posts_analyzed, posts_count)
    audience_score = _audience_score(followers, following)
    content_score = _content_score(top_posts, followers)

    total = round(engagement_score + activity_score + audience_score + content_score)
    total = max(0, min(100, total))
    label = _label(total)

    breakdown = {
        "engagement": round(engagement_score, 1),
        "activity": round(activity_score, 1),
        "audience": round(audience_score, 1),
        "content": round(content_score, 1),
    }
    return total, label, breakdown


def _engagement_score(rate: float, followers: int) -> float:
    """0-35 pts — taux d'engagement relatif à la taille du compte."""
    if rate <= 0:
        return 5.0
    # Benchmarks approximatifs par taille
    if followers < 10_000:
        benchmark = 3.0
    elif followers < 100_000:
        benchmark = 1.5
    elif followers < 1_000_000:
        benchmark = 0.8
    else:
        benchmark = 0.4

    ratio = rate / benchmark
    if ratio >= 2:
        return 35.0
    if ratio >= 1.5:
        return 30.0
    if ratio >= 1:
        return 24.0
    if ratio >= 0.6:
        return 16.0
    if ratio >= 0.3:
        return 10.0
    return 5.0


def _activity_score(posts_analyzed: int, total_posts: int) -> float:
    """0-25 pts — fréquence et volume de publication récent."""
    if posts_analyzed >= 20:
        score = 20.0
    elif posts_analyzed >= 10:
        score = 14.0
    elif posts_analyzed >= 5:
        score = 8.0
    else:
        score = 3.0

    if total_posts >= 100:
        score += 5.0
    elif total_posts >= 30:
        score += 3.0
    return min(25.0, score)


def _audience_score(followers: int, following: int) -> float:
    """0-20 pts — taille et ratio abonnés/abonnements."""
    if followers <= 0:
        return 2.0

    size_score = 0.0
    if followers >= 1_000_000:
        size_score = 12.0
    elif followers >= 100_000:
        size_score = 10.0
    elif followers >= 10_000:
        size_score = 8.0
    elif followers >= 1_000:
        size_score = 6.0
    else:
        size_score = 4.0

    ratio_score = 5.0
    if following > 0:
        ratio = followers / following
        if ratio >= 10:
            ratio_score = 8.0
        elif ratio >= 2:
            ratio_score = 6.0
        elif ratio < 0.5:
            ratio_score = 2.0

    return min(20.0, size_score + ratio_score * 0.5)


def _content_score(top_posts: list[dict], followers: int) -> float:
    """0-20 pts — performance des meilleurs contenus."""
    if not top_posts:
        return 3.0

    best = top_posts[0]
    likes = best.get("likes") or 0
    views = best.get("views") or 0
    metric = views if views > 0 else likes

    if followers <= 0:
        return 5.0

    performance_ratio = metric / followers
    if performance_ratio >= 0.5:
        return 20.0
    if performance_ratio >= 0.2:
        return 16.0
    if performance_ratio >= 0.1:
        return 12.0
    if performance_ratio >= 0.05:
        return 8.0
    return 4.0


def _label(score: int) -> str:
    if score >= 80:
        return "excellent"
    if score >= 65:
        return "bon"
    if score >= 45:
        return "moyen"
    if score >= 25:
        return "faible"
    return "critique"
