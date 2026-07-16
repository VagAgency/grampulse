#!/usr/bin/env python3
"""Seed demo data: models, accounts, 30 days of views with varied curves."""
from __future__ import annotations

import database as db
from health import compute_health_score
from mock_provider import build_mock_insights, derive_status, seed_daily_views

EMAIL = "newvag.toulouse@gmail.com"

# profile contrôle la forme de la courbe : rising, falling, steady, volatile, spike
MODELS = [
    {
        "name": "Léa",
        "accounts": [
            ("lea.fit", "rising"),
            ("lea.daily", "steady"),
            ("lea.reels", "spike"),
        ],
    },
    {
        "name": "Sarah",
        "accounts": [
            ("sarah.style", "volatile"),
            ("sarah.looks", "rising"),
            ("sarah.ootd", "falling"),
            ("sarah.banned", "banned"),
        ],
    },
    {
        "name": "Emma",
        "accounts": [
            ("emma.life", "steady"),
            ("emma.travel", "rising"),
            ("emma.ig", "volatile"),
        ],
    },
    {
        "name": "Chloé",
        "accounts": [
            ("chloe.beauty", "spike"),
            ("chloe.glow", "rising"),
            ("chloe.daily", "steady"),
            ("chloe.reels", "falling"),
            ("chloe.old", "banned"),
        ],
    },
    {
        "name": "Mia",
        "accounts": [
            ("mia.fitness", "rising"),
            ("mia.workout", "volatile"),
        ],
    },
    {
        "name": "Zoé",
        "accounts": [
            ("zoe.mode", "falling"),
            ("zoe.paris", "steady"),
            ("zoe.story", "spike"),
        ],
    },
    {
        "name": "Luna",
        "accounts": [
            ("luna.art", "volatile"),
            ("luna.creative", "rising"),
            ("luna.studio", "steady"),
        ],
    },
    {
        "name": "Nina",
        "accounts": [
            ("nina.life", "steady"),
            ("nina.vlog", "rising"),
            ("nina.travel", "falling"),
            ("nina.dead", "banned"),
            ("nina.food", "spike"),
        ],
    },
]


def main() -> None:
    db.init_db()

    for model in db.list_models(EMAIL):
        db.delete_model(EMAIL, model["id"])

    total_accounts = 0
    for spec in MODELS:
        model = db.create_model(user_email=EMAIL, name=spec["name"])
        for i, (handle, profile) in enumerate(spec["accounts"]):
            raw = build_mock_insights(handle)
            normalized = {
                "handle": handle,
                "display_name": raw["profile"]["fullName"],
                "followers": raw["profile"]["followers"],
                "following": raw["profile"]["following"],
                "posts_count": raw["profile"]["posts"],
                "avg_likes": raw["analysis"]["avgLikes"],
                "avg_comments": raw["analysis"]["avgComments"],
                "avg_engagement_rate": raw["analysis"]["avgEngagementRate"],
                "top_posts": raw["analysis"]["topPosts"],
                "posts_analyzed": raw["analysis"]["postsAnalyzed"],
            }
            score, label, breakdown = compute_health_score(normalized)

            account = db.add_tracked_account(
                user_email=EMAIL,
                model_id=model["id"],
                handle=handle,
                display_name=normalized["display_name"],
                status="actif",
            )
            seed_daily_views(account["id"], handle, days=30, profile=profile)
            daily = db.get_account_daily_views(account["id"], days=14)
            views_7d = sum(d["views"] for d in daily[-7:])
            views_prev = sum(d["views"] for d in daily[-14:-7]) if len(daily) >= 14 else views_7d
            status = derive_status(score, views_7d, views_prev, profile=profile)

            db.save_snapshot(
                tracked_account_id=account["id"],
                followers=normalized["followers"],
                following=normalized["following"],
                posts_count=normalized["posts_count"],
                avg_engagement_rate=normalized["avg_engagement_rate"],
                avg_likes=normalized["avg_likes"],
                avg_comments=normalized["avg_comments"],
                health_score=score,
                health_label=label,
                top_posts=normalized["top_posts"],
                analysis={"breakdown": breakdown},
                raw=raw,
                status=status,
            )
            total_accounts += 1
            print(f"  @{handle} ({profile}) — {status}")
        print(f"OK modèle {spec['name']}")

    print(f"\nDone — {len(MODELS)} modèles, {total_accounts} comptes pour {EMAIL}")


if __name__ == "__main__":
    main()
