"""Щотижневий дайджест у Telegram-адмінку: що вийшло, що в черзі, що потребує уваги.

Запуск: python scripts/digest.py
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import channel_of, is_live, load_articles, load_config, load_posts, load_state, now, tz  # noqa: E402
from publish import NAMES, admin  # noqa: E402

TOKEN_DAYS = {"LINKEDIN_TOKEN_DATE": ("LinkedIn", 60), "THREADS_TOKEN_DATE": ("Threads", 60),
              "INSTAGRAM_TOKEN_DATE": ("Instagram", 60)}


def main() -> int:
    cfg = load_config()
    t = now(cfg)
    week_ago, week_ahead = t - timedelta(days=7), t + timedelta(days=7)
    state = load_state()
    posts = load_posts(cfg)
    articles = load_articles(cfg, include_drafts=True)

    out_last = []
    attention = []
    for key, rec in sorted(state.items()):
        try:
            at = datetime.strptime(rec.get("at", ""), "%Y-%m-%d %H:%M").replace(tzinfo=tz(cfg))
        except ValueError:
            continue
        if at < week_ago:
            continue
        slug, ch = key.split("/")
        name = NAMES.get(channel_of(key), ch)
        if rec["status"] == "published":
            out_last.append(f"• {name}: {slug}" + (f" — {rec['url']}" if rec.get("url") else ""))
        elif rec["status"] == "dry-run":
            out_last.append(f"• (тест) {name}: {slug}")
        elif rec["status"] in ("failed", "retry", "skipped-late", "manual-sent"):
            attention.append(f"• {name}, {slug}: {rec['status']} {rec.get('reason') or rec.get('error', '')}"[:200])

    queued = sorted((p for p in posts if p.key not in state and p.publish_at >= t), key=lambda p: p.publish_at)
    upcoming = [f"• {p.publish_at:%a %d.%m %H:%M} {NAMES.get(p.channel)}: {p.slug}" for p in queued if p.publish_at < week_ahead]
    last_planned = queued[-1].publish_at if queued else None
    live = [a for a in articles if a.lang == "uk" and is_live(a, cfg)]
    drafts = [a for a in articles if a.lang == "uk" and a.draft]

    if not last_planned or last_planned < t + timedelta(days=10):
        attention.append("• Черга закінчується менш ніж за 10 днів — час підготувати новий матеріал.")
    for var, (name, days) in TOKEN_DAYS.items():
        v = os.environ.get(var)
        if not v:
            continue
        try:
            issued = datetime.strptime(v, "%Y-%m-%d").replace(tzinfo=tz(cfg))
        except ValueError:
            continue
        left = days - (t - issued).days
        if left <= 14:
            attention.append(f"• Токен {name} спливає через {left} дн. — оновіть його (див. README).")

    lines = [f"📊 Тиждень до {t:%d.%m.%Y}", "",
             f"Статей на сайті: {len(live)} · чернеток: {len(drafts)} · дописів у черзі: {len(queued)}"
             + (f" (до {last_planned:%d.%m})" if last_planned else ""), "",
             "Вийшло за тиждень:", *(out_last or ["• нічого"]), "",
             "Наступні 7 днів:", *(upcoming or ["• нічого не заплановано"])]
    if attention:
        lines += ["", "Потребує уваги:", *attention]
    admin("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
