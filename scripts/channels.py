"""Публікація в окремі канали. Кожна функція повертає {"id": ..., "url": ...} або кидає помилку."""
from __future__ import annotations

import html
import os
import re
import time
from pathlib import Path

import requests

TIMEOUT = 30


class ChannelError(RuntimeError):
    pass


def _check(r: requests.Response, what: str) -> dict:
    if r.status_code >= 300:
        raise ChannelError(f"{what}: HTTP {r.status_code} {r.text[:400]}")
    try:
        return r.json() if r.content else {}
    except ValueError:
        return {}


# ---------------------------------------------------------------- Telegram

def md_to_telegram_html(text: str) -> str:
    """Мінімальний Markdown → HTML для Telegram: **жирний**, _курсив_, [текст](url), `код`."""
    t = html.escape(text, quote=False)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2">\1</a>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t, flags=re.S)
    t = re.sub(r"(?<![\w/])_(?!_)(.+?)(?<!_)_(?![\w/])", r"<i>\1</i>", t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    return t


def telegram_send(chat_id: str, text: str, token: str | None = None, preview: bool = True) -> dict:
    token = token or os.environ["TELEGRAM_BOT_TOKEN"]
    r = requests.post(f"https://api.telegram.org/bot{token}/sendMessage", timeout=TIMEOUT, json={
        "chat_id": chat_id, "text": md_to_telegram_html(text), "parse_mode": "HTML",
        "link_preview_options": {"is_disabled": not preview},
    })
    data = _check(r, "Telegram")
    msg = data.get("result", {})
    url = None
    chat = msg.get("chat", {})
    if chat.get("username"):
        url = f"https://t.me/{chat['username']}/{msg.get('message_id')}"
    return {"id": msg.get("message_id"), "url": url}


def telegram_send_photos(chat_id: str, paths: list[Path], caption: str | None = None) -> None:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    for i in range(0, len(paths), 10):  # Telegram приймає до 10 фото в альбомі
        chunk = paths[i:i + 10]
        media, files = [], {}
        for j, p in enumerate(chunk):
            key = f"f{j}"
            files[key] = (p.name, p.read_bytes(), "image/png")
            item = {"type": "photo", "media": f"attach://{key}"}
            if j == 0 and i == 0 and caption:
                item["caption"] = caption[:1000]
            media.append(item)
        import json
        r = requests.post(f"https://api.telegram.org/bot{token}/sendMediaGroup", timeout=60,
                          data={"chat_id": chat_id, "media": json.dumps(media)}, files=files)
        _check(r, "Telegram (фото)")


def publish_telegram(parts: list[str]) -> dict:
    chat = os.environ["TELEGRAM_CHANNEL_ID"]
    return telegram_send(chat, "\n\n".join(parts))


# ---------------------------------------------------------------- Threads

THREADS_API = "https://graph.threads.net/v1.0"


def _threads_wait(container_id: str, token: str, limit: int = 60) -> None:
    deadline = time.time() + limit
    while time.time() < deadline:
        r = requests.get(f"{THREADS_API}/{container_id}", timeout=TIMEOUT,
                         params={"fields": "status,error_message", "access_token": token})
        data = _check(r, "Threads (статус)")
        status = data.get("status")
        if status in (None, "FINISHED"):
            return
        if status in ("ERROR", "EXPIRED"):
            raise ChannelError(f"Threads: контейнер {status}: {data.get('error_message')}")
        time.sleep(3)
    raise ChannelError("Threads: контейнер не готовий за 60 секунд")


def publish_threads(parts: list[str]) -> dict:
    token = os.environ["THREADS_TOKEN"]
    first_id = first_url = None
    reply_to = None
    for text in parts:
        params = {"media_type": "TEXT", "text": text, "access_token": token}
        if reply_to:
            params["reply_to_id"] = reply_to
        c = _check(requests.post(f"{THREADS_API}/me/threads", params=params, timeout=TIMEOUT), "Threads (контейнер)")
        _threads_wait(c["id"], token)
        p = _check(requests.post(f"{THREADS_API}/me/threads_publish", timeout=TIMEOUT,
                                 params={"creation_id": c["id"], "access_token": token}), "Threads (публікація)")
        reply_to = p["id"]
        if first_id is None:
            first_id = p["id"]
            info = requests.get(f"{THREADS_API}/{first_id}", timeout=TIMEOUT,
                                params={"fields": "permalink", "access_token": token})
            first_url = (info.json() if info.ok else {}).get("permalink")
    return {"id": first_id, "url": first_url}


def threads_refresh(token: str) -> dict:
    r = requests.get("https://graph.threads.net/refresh_access_token", timeout=TIMEOUT,
                     params={"grant_type": "th_refresh_token", "access_token": token})
    return _check(r, "Threads (оновлення токена)")


# ---------------------------------------------------------------- LinkedIn

_LITTLE = re.compile(r"([\\|{}@\[\]()<>#*_~])")


def linkedin_commentary(text: str) -> str:
    """Екранує текст для поля commentary (формат «little text») і робить #хештеги клікабельними."""
    t = _LITTLE.sub(r"\\\1", text)
    return re.sub(r"\\#(\w+)", lambda m: "{hashtag|\\#|" + m.group(1) + "}", t)


def linkedin_author(token: str, version: str) -> str:
    urn = os.environ.get("LINKEDIN_PERSON_URN")
    if urn:
        return urn
    r = requests.get("https://api.linkedin.com/v2/userinfo", timeout=TIMEOUT, headers={"Authorization": f"Bearer {token}"})
    sub = _check(r, "LinkedIn (профіль)").get("sub")
    if not sub:
        raise ChannelError("LinkedIn: не вдалося визначити автора. Додайте секрет LINKEDIN_PERSON_URN.")
    return f"urn:li:person:{sub}"


def publish_linkedin(parts: list[str], version: str) -> dict:
    token = os.environ["LINKEDIN_TOKEN"]
    headers = {"Authorization": f"Bearer {token}", "LinkedIn-Version": version,
               "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json"}
    body = {
        "author": linkedin_author(token, version),
        "commentary": linkedin_commentary("\n\n".join(parts)),
        "visibility": "PUBLIC",
        "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    r = requests.post("https://api.linkedin.com/rest/posts", json=body, headers=headers, timeout=TIMEOUT)
    _check(r, "LinkedIn")
    post_id = r.headers.get("x-restli-id") or r.headers.get("X-RestLi-Id")
    url = f"https://www.linkedin.com/feed/update/{post_id}/" if post_id else None
    return {"id": post_id, "url": url}
