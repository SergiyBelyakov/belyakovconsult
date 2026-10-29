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
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import channels  # noqa: E402
from common import (STATE_FILE, fmt_dt, is_live, load_articles, load_config, load_posts,  # noqa: E402
                    episode_sub, load_state, media_kind, note_asset_dir, note_asset_url, now, post_parts, save_state, social_asset_dir,
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


def is_auth_error(e: Exception) -> bool:
    t = str(e)
    return any(x in t for x in ('"code":190', "OAuthException", "Invalid OAuth", "HTTP 401", "expired"))


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


def _asset_lang(post, cfg) -> str:
    """Мова візуалів для допису: своя, якщо для неї зібрано відео чи картки, інакше українська."""
    d = social_asset_dir(cfg, post.slug, post.lang)
    return post.lang if d.exists() and (any(d.glob("slide-*.jpg")) or (d / "motion.mp4").exists()) else "uk"


def _asset_dir(post, cfg):
    return social_asset_dir(cfg, post.slug, _asset_lang(post, cfg))


def video_file(post, cfg) -> tuple[str, str] | None:
    """(мова, шлях від папки статті) для відео допису: своє відео допису N, інакше основне відео статті.
    Англійські Reels в Instagram беруть промо-відео (promo.mp4), якщо воно зібране."""
    if post.channel == "instagram" and post.lang == "en":
        for sub in dict.fromkeys([episode_sub(post.n), ""]):
            if (social_asset_dir(cfg, post.slug, "en") / sub / "promo.mp4").exists():
                return "en", sub + "promo.mp4"
    for sub in dict.fromkeys([episode_sub(post.n), ""]):
        for lang in dict.fromkeys([post.lang, "uk"]):
            if (social_asset_dir(cfg, post.slug, lang) / sub / "motion.mp4").exists():
                return lang, sub + "motion.mp4"
    return None


def video_url(post, cfg) -> str | None:
    """Адреса моушн-відео допису, якщо для каналу обрано motion і відео зібране."""
    if media_kind(post, cfg) != "motion":
        return None
    found = video_file(post, cfg)
    return social_asset_url(cfg, post.slug, found[1], found[0]) if found else None


def local_video(post, cfg):
    found = video_file(post, cfg)
    return social_asset_dir(cfg, post.slug, found[0]) / found[1] if found else None


def deployed(url: str, local) -> bool:
    """Сайт уже віддає саме цю версію файлу (розмір збігається)? Інакше соцмережа забере стару."""
    import requests
    try:
        want = local.stat().st_size
        h = requests.head(url, timeout=30, allow_redirects=True, headers={"Accept-Encoding": "identity"})
        if h.ok and h.headers.get("content-length") and not h.headers.get("content-encoding"):
            return int(h.headers["content-length"]) == want
        # запасний шлях: перший байт і повний розмір із Content-Range
        g = requests.get(url, timeout=30, headers={"Range": "bytes=0-0", "Accept-Encoding": "identity"}, stream=True)
        total = (g.headers.get("content-range") or "").rsplit("/", 1)[-1]
        g.close()
        if total.isdigit():
            return int(total) == want
        print(f"Сайт не повідомив розмір {url}; публікую без перевірки")
        return g.ok
    except Exception:  # noqa: BLE001
        return False


def cover_url(post, cfg) -> str | None:
    v = local_video(post, cfg)
    name = "promo-cover.jpg" if v and v.name == "promo.mp4" else "cover.jpg"
    if v and (v.parent / name).exists():
        return video_url(post, cfg).rsplit("/", 1)[0] + "/" + name
    return None


def send(post, parts, cfg) -> dict:
    video = video_url(post, cfg)
    if post.channel == "telegram":
        return channels.publish_telegram(parts, video)
    if post.channel == "threads":
        return channels.publish_threads(parts, video)
    if post.channel == "linkedin":
        return channels.publish_linkedin(parts, cfg["channels"]["linkedin"]["api_version"])
    if post.channel == "instagram" and video and not post.images:
        return channels.publish_instagram_reel("\n\n".join(parts), video, cfg["channels"]["instagram"].get("api_version", "v26.0"),
                                               cover_url(post, cfg))
    if post.channel == "instagram" and post.kind == "note":
        slides = sorted(note_asset_dir(cfg, post).glob("slide-*.jpg"), key=lambda p: int(p.stem.split("-")[1]))
        urls = list(post.images) or [note_asset_url(cfg, post, p.name) for p in slides]
        return channels.publish_instagram("\n\n".join(parts), urls, cfg["channels"]["instagram"].get("api_version", "v26.0"))
    if post.channel == "instagram":
        slides = sorted(_asset_dir(post, cfg).glob("slide-*.jpg"), key=lambda p: int(p.stem.split("-")[1]))
        urls = list(post.images) or [social_asset_url(cfg, post.slug, p.name, _asset_lang(post, cfg)) for p in slides]
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
    blocked: set[str] = set()     # мережі з недійсним ключем у цьому запуску
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
        if post.channel in blocked:
            continue
        ch_cfg = cfg["channels"].get(post.channel, {})
        if post.publish_at > t or not ch_cfg.get("enabled", False):
            continue
        if ch_cfg.get("languages") and post.lang not in ch_cfg["languages"]:
            continue   # мова не для цього каналу (див. channels.<канал>.languages у config.yml)
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
        parts = post_parts(post, cfg)
        vid = video_url(post, cfg)
        card_dir = note_asset_dir(cfg, post) if post.kind == "note" else _asset_dir(post, cfg)
        photos = [] if vid else (sorted(card_dir.glob("slide-*.png"), key=lambda p: int(p.stem.split("-")[1]))
                                 if post.channel == "instagram" else [])
        media_note = f"\n\n🎬 Моушн-відео до допису: {vid}" if vid else ""

        if vid and not is_dry(post.channel) and not manual_reason(post, cfg):
            lv = local_video(post, cfg)
            cv = cover_url(post, cfg)
            if not deployed(vid, lv) or (post.channel == "instagram" and cv and not deployed(cv, lv.parent / cv.rsplit("/", 1)[1])):
                print(f"Чекає, поки сайт оновить відео: {post.key}")   # вийде наступним запуском
                continue

        if is_dry(post.channel):
            state[post.key] = {"status": "dry-run", "at": fmt_dt(t)}
            admin(f"🧪 Тестовий режим. Зараз вийшов би допис у {name} ({post.slug}):\n\n" + "\n\n— — —\n\n".join(parts) + media_note,
                  photos or None)
            done += 1
            continue

        reason = manual_reason(post, cfg)
        if reason:
            state[post.key] = {"status": "manual-sent", "at": fmt_dt(t), "reason": reason}
            admin(f"✋ Опублікуйте вручну в {name} ({reason}). Текст нижче:\n\n" + "\n\n— — —\n\n".join(parts) + media_note,
                  photos or None)
            done += 1
            continue

        try:
            res = send(post, parts, cfg)
            state[post.key] = {"status": "published", "at": fmt_dt(t), **{k: v for k, v in res.items() if v}}
            admin(f"✅ Опубліковано в {name}: {post.slug}" + (f"\n{res['url']}" if res.get("url") else ""))
            done += 1
        except Exception as e:
            traceback.print_exc()
            if is_auth_error(e):
                # Ключ відкликано або прострочено: спроби не витрачаємо, допис чекає нового ключа.
                blocked.add(post.channel)
                state[post.key] = {**rec, "status": "retry", "error": str(e)[:300], "at": fmt_dt(t),
                                   "publish_at": fmt_dt(post.publish_at), "auth_error": True}
                last = state.setdefault("_auth_alerts", {}).get(post.channel)
                if not last or (t - datetime.strptime(last, "%Y-%m-%d %H:%M").replace(tzinfo=t.tzinfo)).total_seconds() > 6 * 3600:
                    state["_auth_alerts"][post.channel] = fmt_dt(t)
                    admin(f"🔑 {name}: ключ доступу недійсний, публікації в цю мережу стоять. "
                          f"Згенеруйте новий токен і оновіть секрет у GitHub. Дописи вийдуть самі, щойно ключ запрацює.\n{str(e)[:300]}")
                continue
            attempts = rec.get("attempts", 0) + 1
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
