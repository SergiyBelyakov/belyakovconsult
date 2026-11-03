"""Найближчий кращий слот для позапланового допису.

Кандидати на день: час допису до статті для цього дня тижня (cadence.times + times_by_weekday), слоти нотаток
(notes.times + times_by_weekday) і додаткові слоти каналу (channel_rules.alt_times). Слот підходить, якщо він не
раніше ніж за cadence.adhoc.lead_minutes від зараз, не ближче ніж gap_minutes до вже запланованих дописів каналу
цією мовою і не у вихідний для каналів із weekdays_only. Якщо всі кращі слоти дня зайняті, береться найближче вільне
півгодинне вікно в cadence.adhoc.active_hours того самого дня, щоб допис не відкладався на тижні.

Запуск: python scripts/next_slot.py <канал> <мова> [<канал> <мова> ...]
Друкує «канал мова РРРР-ММ-ДД ГГ:ХХ». Кілька пар плануються по черзі й не накладаються одна на одну.
"""
from __future__ import annotations

import sys
from datetime import datetime, time, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DAY_NAMES, load_config, load_posts, now  # noqa: E402


def candidates(cfg, channel, lang, day):
    cad, notes = cfg.get("cadence") or {}, cfg.get("notes") or {}
    wd = DAY_NAMES[day.weekday()]
    out = []
    t = (((cad.get("times_by_weekday") or {}).get(channel) or {}).get(wd) or {}).get(lang) \
        or ((cad.get("times") or {}).get(channel) or {}).get(lang)
    if t:
        out.append(t)
    out += (((notes.get("times_by_weekday") or {}).get(channel) or {}).get(wd) or {}).get(lang) \
        or ((notes.get("times") or {}).get(channel) or {}).get(lang) or []
    out += (((cad.get("channel_rules") or {}).get(channel) or {}).get("alt_times") or {}).get(lang) or []
    return sorted({datetime.strptime(str(x), "%H:%M").time() for x in out})


def next_slot(cfg, channel, lang, taken, start=None):
    cad = cfg.get("cadence") or {}
    ad = cad.get("adhoc") or {}
    lead = timedelta(minutes=int(ad.get("lead_minutes", 60)))
    gap = timedelta(minutes=int(ad.get("gap_minutes", 90)))
    weekdays_only = bool(((cad.get("channel_rules") or {}).get(channel) or {}).get("weekdays_only"))
    t0 = (start or now(cfg)) + lead
    day = t0.date()
    for _ in range(21):
        if not (weekdays_only and day.weekday() >= 5):
            # спершу найкращі слоти дня; якщо всі зайняті, то вільне півгодинне вікно в активні години цього дня
            grid = [time(h, m) for h in range(*ad.get("active_hours", [8, 22])) for m in (0, 30)]
            for pool in (candidates(cfg, channel, lang, day), grid):
                for tm in pool:
                    dt = datetime.combine(day, tm, tzinfo=t0.tzinfo)
                    if dt >= t0 and all(abs(dt - x) >= gap for x in taken):
                        return dt
        day += timedelta(days=1)
    return None


def main() -> int:
    cfg = load_config()
    args = sys.argv[1:]
    if not args or len(args) % 2:
        print(__doc__)
        return 1
    posts = load_posts(cfg)
    for ch, lang in zip(args[::2], args[1::2]):
        taken = [p.publish_at for p in posts if p.channel == ch and p.lang == lang]
        dt = next_slot(cfg, ch, lang, taken)
        print(f"{ch} {lang} {dt:%Y-%m-%d %H:%M}" if dt else f"{ch} {lang} немає слота")
    return 0


if __name__ == "__main__":
    sys.exit(main())
