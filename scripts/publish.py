"""Публікує дописи, час яких настав. Запускається GitHub Actions щогодини.

Правила безпеки:
- Публікується лише те, що є в гілці main (тобто затверджене через Merge).
- Допис зі посиланням чекає, поки сама стаття з’явиться на сайті.
- У режимі dry-run нічого не йде в соцмережі: лише журнал і повідомлення в Telegram-адмінку.
- Прострочені більше ніж на max_late_hours дописи не публікуються автоматично.
- Кожен допис публікується щонайбільше один раз (журнал state/published.json).

Запуск: python scripts/publish.py [--dry-run]
"""
from __future__ import annotations

import os
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import channels  # noqa: E402
from common import (STATE_FILE, fmt_dt, is_live, load_articles, load_config, load_posts,  # noqa: E402
                    load_state, now, render_post_text, save_state, social_asset_dir,
                    social_asset_url)

MAX_ATTEMPTS = 3
NAMES = {"linkedin": "LinkedIn", "linkedinpage": "LinkedIn (сторінка Belyakov Consult)", "threads": "Threads", "telegram": "Telegram", "instagram": "Instagram"}


REPORT: list[str] = []


def admin(text: str, photos: list[Path] | None = None) -> None:
    REPORT.append(text + (f"\n\n(+ {len(photos)} картки для каруселі)" if photos else ""))
    chat = os.environ.get("TELEGRAM_ADMIN_CHAT_ID")
    if not (chat and os.environ.get("TELEGRAM_BOT_TOKEN")):
        print("[адмінка] " + text.replace("\n", "\n           "))
        return
    try:
        channels.telegram_send(chat, text[:4000], preview=False)
        if photos:
            channels.telegram_send_photos(chat, photos)
    except Exception as e:  # повідомлення адміну не повинно зупиняти публікацію
        print(f"Не вдалося написати в адмінку: {e}")


def manual_reason(post, cfg) -> str | None:
    if post.channel == "instagram" and not cfg["channels"]["instagram"].get("auto"):
        return "Instagram публікується вручну"
    if post.channel == "instagram" and not os.environ.get("INSTAGRAM_TOKEN"):
        return "немає секрету INSTAGRAM_TOKEN"
    need = {"linkedin": ["LINKEDIN_TOKEN"], "linkedinpage": ["LINKEDIN_ORG_ID"], "threads": ["THREADS_TOKEN"],
            "telegram": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHANNEL_ID"]}.get(post.channel, [])
    missing = [k for k in need if not os.environ.get(k)]
    if missing:
        return f"немає секретів {', '.join(missing)}"
    return None


def send(post, parts, cfg) -> dict:
    if post.channel == "telegram":
        return channels.publish_telegram(parts)
    if post.channel == "threads":
        return channels.publish_threads(parts)
    if post.channel == "linkedin":
        return channels.publish_linkedin(parts, cfg["channels"]["linkedin"]["api_version"])
    if post.channel == "instagram":
        slides = sorted(social_asset_dir(cfg, post.slug).glob("slide-*.jpg"), key=lambda p: int(p.stem.split("-")[1]))
        urls = [social_asset_url(cfg, post.slug, p.name) for p in slides]
        return channels.publish_instagram("\n\n".join(parts), urls, cfg["channels"]["instagram"].get("api_version", "v26.0"))
    if post.channel == "linkedinpage":
        return channels.publish_linkedin(parts, cfg["channels"]["linkedin"]["api_version"], as_page=True)
    raise channels.ChannelError(f"Невідомий канал {post.channel}")


def main() -> int:
    cfg = load_config()
    forced_dry = "--dry-run" in sys.argv
    live_channels = set(cfg.get("live_channels") or [])
    is_dry = lambda ch: forced_dry or (cfg.get("mode") != "live" and ch not in live_channels)  # noqa: E731
    dry = forced_dry or (cfg.get("mode") != "live" and not live_channels)
    t = now(cfg)
    state = load_state()
    live_articles = {(a.slug, a.lang) for a in load_articles(cfg, include_drafts=True) if is_live(a, cfg)}
    done = 0
    for post in sorted(load_posts(cfg), key=lambda p: p.publish_at):
        rec = state.get(post.key, {})
        status = rec.get("status")
        if status in ("published", "dry-run", "manual-sent"):
            continue
        # Пропущений чи невдалий допис повертається в чергу, якщо змінили його publish_at.
        if status in ("skipped-late", "failed") and rec.get("publish_at") == fmt_dt(post.publish_at):
            continue
        if status in ("skipped-late", "failed"):
            rec = {}
        if post.publish_at > t or not cfg["channels"].get(post.channel, {}).get("enabled", False):
            continue
        name = NAMES.get(post.channel, post.channel)
        if post.link and (post.slug, post.lang) not in live_articles:
            print(f"Чекає на статтю: {post.key}")
            continue
        late_h = (t - post.publish_at).total_seconds() / 3600
        if late_h > cfg.get("max_late_hours", 48):
            state[post.key] = {"status": "skipped-late", "at": fmt_dt(t), "publish_at": fmt_dt(post.publish_at)}
            admin(f"⏭ Пропущено прострочений допис ({late_h:.0f} год): {name}, {post.slug}. "
                  f"Змініть publish_at у {post.path.name}, якщо його треба опублікувати.")
            continue
        parts = [render_post_text(post, cfg, p) for p in post.parts()]
        photos = sorted(social_asset_dir(cfg, post.slug).glob("slide-*.png"), key=lambda p: int(p.stem.split("-")[1])) \
            if post.channel == "instagram" else []

        if is_dry(post.channel):
            state[post.key] = {"status": "dry-run", "at": fmt_dt(t)}
            admin(f"🧪 Тестовий режим. Зараз вийшов би допис у {name} ({post.slug}):\n\n" + "\n\n— — —\n\n".join(parts),
                  photos or None)
            done += 1
            continue

        reason = manual_reason(post, cfg)
        if reason:
            state[post.key] = {"status": "manual-sent", "at": fmt_dt(t), "reason": reason}
            admin(f"✋ Опублікуйте вручну в {name} ({reason}). Текст нижче:\n\n" + "\n\n— — —\n\n".join(parts),
                  photos or None)
            done += 1
            continue

        try:
            res = send(post, parts, cfg)
            state[post.key] = {"status": "published", "at": fmt_dt(t), **{k: v for k, v in res.items() if v}}
            admin(f"✅ Опубліковано в {name}: {post.slug}" + (f"\n{res['url']}" if res.get("url") else ""))
            done += 1
        except Exception as e:
            attempts = rec.get("attempts", 0) + 1
            traceback.print_exc()
            state[post.key] = {"status": "failed" if attempts >= MAX_ATTEMPTS else "retry",
                               "attempts": attempts, "error": str(e)[:300], "at": fmt_dt(t),
                               "publish_at": fmt_dt(post.publish_at)}
            admin(f"⚠️ Не вдалося опублікувати в {name} ({post.slug}), спроба {attempts}/{MAX_ATTEMPTS}:\n{str(e)[:500]}"
                  + ("\nБільше спроб не буде — перевірте токен або текст." if attempts >= MAX_ATTEMPTS else ""))

    save_state(state)
    mode_txt = "dry-run" if dry else ("live" if cfg.get("mode") == "live" else f"live лише для: {', '.join(sorted(live_channels))}")
    summary = f"Режим: {mode_txt}. Оброблено дописів: {done}. Час: {fmt_dt(t)}"
    print(summary)
    write_report(summary, dry)
    return 0


def write_report(summary: str, dry: bool) -> None:
    """Звіт про запуск: у підсумок GitHub Actions і, якщо щось сталося, у state/last-run.md."""
    if not REPORT:
        return
    tg = "так" if os.environ.get("TELEGRAM_ADMIN_CHAT_ID") and os.environ.get("TELEGRAM_BOT_TOKEN") else "ні (секрети не задані)"
    body = [f"# Останній запуск конвеєра", "", summary, f"Повідомлення в Telegram-адмінку: {tg}", ""]
    for i, item in enumerate(REPORT, 1):
        body += [f"## {i}", "", "```", item, "```", ""]
    text = "\n".join(body)
    (STATE_FILE.parent / "last-run.md").write_text(text, encoding="utf-8")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(text + "\n")


if __name__ == "__main__":
    sys.exit(main())
