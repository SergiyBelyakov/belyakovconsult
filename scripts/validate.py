"""Перевіряє статті й дописи перед затвердженням (запускається на кожен запит на зміни).

Помилки (блокують Merge): немає обов’язкових полів, текст довший за ліміт мережі,
допис посилається на статтю, якої немає, невідомий канал чи напрям.
Попередження: слабкі title/description, допис раніше за статтю, немає каруселі для Instagram.

Запуск: python scripts/validate.py
"""
from __future__ import annotations

import os
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CHANNELS, load_articles, load_config, load_posts, media_kind, post_parts  # noqa: E402
import brand  # noqa: E402


def main() -> int:
    cfg = load_config()
    errors, warns = [], []
    try:
        articles = load_articles(cfg, include_drafts=True)
        posts = load_posts(cfg)
    except Exception as e:
        print(f"ПОМИЛКА: {e}")
        return 1

    idx = {(a.slug, a.lang): a for a in articles}
    errors += [f"бренд: {x}" for x in brand.check()]
    for a in articles:
        where = f"{a.slug}/{a.lang}.md"
        if not a.title:
            errors.append(f"{where}: немає title")
        elif len(a.title) > 75:
            warns.append(f"{where}: title {len(a.title)} симв. — пошуковик обріже після ~60–70")
        if not a.description:
            errors.append(f"{where}: немає description")
        elif not 70 <= len(a.description) <= 170:
            warns.append(f"{where}: description {len(a.description)} симв., краще 120–160")
        for s in a.services:
            if s not in cfg["services"]:
                errors.append(f"{where}: невідомий напрям «{s}» (див. services у config.yml)")
        if not a.services:
            warns.append(f"{where}: не вказано services — стаття не веде на сторінку послуги")
        if any(ch in a.body + a.title + a.description for ch in "\u2013\u2014"):
            warns.append(f"{where}: є тире «—» або «–». На сайті прийнято без них — замініть на двокрапку, кому чи крапку")
        if a.words < 300 and not a.draft:
            warns.append(f"{where}: лише {a.words} слів (менше 300) — для пошуку краще 800+")

    for k, n in Counter(p.key for p in posts).items():
        if n > 1:
            errors.append(f"{k}: дубль допису")

    for p in posts:
        where = str(p.path.relative_to(p.path.parents[3]))
        if p.channel not in CHANNELS:
            errors.append(f"{where}: невідомий канал «{p.channel}»")
            continue
        a = idx.get((p.slug, p.lang))
        if p.link and not a:
            errors.append(f"{where}: немає статті {p.slug}/{p.lang}.md, на яку веде допис")
        if a and p.publish_at.date() < a.date:
            warns.append(f"{where}: допис ({p.publish_at:%Y-%m-%d}) раніше за статтю ({a.date}) — він чекатиме на неї")
        if p.link and "{{link}}" not in p.body:
            warns.append(f"{where}: у тексті немає {{{{link}}}} — посилання на статтю не буде")
        if any(ch in p.body for ch in "\u2013\u2014"):
            warns.append(f"{where}: є тире «—» або «–»; за профілем голосу їх не використовуємо (список: «•» або 1., 2.)")
        limit = cfg["channels"][p.channel]["max_chars"]
        parts = post_parts(p, cfg)
        if p.channel == "threads":
            for i, x in enumerate(parts, 1):
                if len(x) > limit:
                    errors.append(f"{where}: частина {i} — {len(x)} симв., ліміт Threads {limit}")
        else:
            total = len("\n\n".join(parts))
            if total > limit:
                errors.append(f"{where}: {total} симв., ліміт {p.channel} {limit}")
            if len(parts) > 1:
                warns.append(f"{where}: розділювач частин має сенс лише для Threads, тут частини буде склеєно")
        has_motion = bool((idx.get((p.slug, "uk")) or a) and (idx.get((p.slug, "uk")) or a).carousel)
        if p.channel == "telegram" and media_kind(p, cfg) == "motion" and has_motion and len("\n\n".join(parts)) > 1000:
            warns.append(f"{where}: текст довший за підпис до відео (~1000 симв.), відео піде окремим повідомленням-відповіддю")
        if p.channel == "instagram":
            base = idx.get((p.slug, "uk")) or a
            if not (base and base.carousel):
                warns.append(f"{where}: у статті немає carousel — для Instagram не буде карток")

    lines = ["## Перевірка контенту", ""]
    lines += [f"- ❌ {e}" for e in errors] or ["- ✅ Помилок немає"]
    lines += [f"- ⚠️ {w}" for w in warns]
    lines += ["", "## Розклад", "", "| Коли | Канал | Матеріал |", "| --- | --- | --- |"]
    for p in sorted(posts, key=lambda p: p.publish_at):
        lines.append(f"| {p.publish_at:%Y-%m-%d %H:%M} | {p.channel}-{p.lang} | {p.slug} |")
    report = "\n".join(lines)
    print(report)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(report + "\n")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
