"""Видаляє опубліковані дописи з черги state/delete-queue.json і ставить їх на повторну публікацію.

Навіщо: замінити відео чи текст у вже опублікованому дописі. API соцмереж не дозволяють
поміняти відео в наявному дописі, тому старий видаляється, а новий виходить заново.

Формат черги: ["<slug>/<канал>-<мова>[-N]", ...]. Після обробки черга очищається.
Що вміє видаляти сам:
- Telegram: так (бот-адміністратор каналу);
- Threads: так, якщо токен має дозвіл threads_delete, інакше просить видалити вручну;
- Instagram: API не дозволяє видаляти публікації, тому просить видалити вручну.
У всіх випадках допис знімається з журналу й виходить заново в цьому ж запуску.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import STATE_FILE, channel_of, load_state, save_state  # noqa: E402
from publish import NAMES, admin  # noqa: E402

QUEUE = STATE_FILE.parent / "delete-queue.json"


def delete_telegram(msg_id) -> str | None:
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHANNEL_ID")
    if not (token and chat):
        return "немає секретів Telegram"
    r = requests.post(f"https://api.telegram.org/bot{token}/deleteMessage", timeout=30,
                      json={"chat_id": chat, "message_id": int(msg_id)})
    return None if r.ok and r.json().get("ok") else f"Telegram: {r.text[:200]}"


def delete_threads(media_id) -> str | None:
    token = os.environ.get("THREADS_TOKEN")
    if not token:
        return "немає THREADS_TOKEN"
    r = requests.delete(f"https://graph.threads.net/v1.0/{media_id}", params={"access_token": token}, timeout=30)
    return None if r.ok else f"Threads: {r.text[:200]}"


def main() -> int:
    if not QUEUE.exists():
        return 0
    keys = json.loads(QUEUE.read_text(encoding="utf-8") or "[]")
    if not keys:
        return 0
    state = load_state()
    manual = []
    for key in keys:
        if key.startswith("tg:"):              # окреме повідомлення Telegram за номером, напр. «tg:12»
            err = delete_telegram(key[3:])
            print(f"{key}: {'видалено' if not err else err}")
            continue
        rec = state.get(key)
        if not rec:
            continue
        channel = channel_of(key)
        err = None
        if rec.get("status") == "published" and rec.get("id"):
            if channel == "telegram":
                err = delete_telegram(rec["id"])
                for extra in rec.get("extra_ids") or []:     # відео-відповідь до довгого тексту
                    if extra:
                        delete_telegram(extra)
            elif channel == "threads":
                err = delete_threads(rec["id"])
            elif channel == "linkedinpage":
                try:
                    import channels
                    from common import load_config
                    channels.delete_linkedin(rec["id"], load_config()["channels"]["linkedin"]["api_version"])
                    err = None
                except Exception as e:  # noqa: BLE001
                    err = f"LinkedIn: {e}"[:200]
            else:
                err = "API не дозволяє видаляти публікації"
        if err and rec.get("url"):
            manual.append(f"• {NAMES.get(channel, channel)}: {rec['url']} ({err})")
        print(f"{key}: {'видалено' if not err else 'вручну: ' + err}")
        state.pop(key, None)      # знімаємо з журналу: допис вийде заново
    save_state(state)
    QUEUE.write_text("[]\n", encoding="utf-8")
    if manual:
        admin("🗑 Нові версії дописів виходять зараз. Старі видаліть вручну:\n" + "\n".join(manual))
    return 0


if __name__ == "__main__":
    sys.exit(main())
