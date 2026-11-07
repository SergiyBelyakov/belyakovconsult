"""Збір статистики дописів з усіх платформ (нічого не публікує). Результат: state/stats.json.

  • Instagram: усі медіа акаунта (/me/media) з лайками й коментарями; перегляди, охоплення, збереження, поширення
    з /insights (потрібен дозвіл instagram_business_manage_insights; без нього лише лайки й коментарі);
  • Threads: усі дописи (/me/threads) і /insights (views, likes, replies, reposts, quotes, shares; потрібен
    threads_manage_insights);
  • Telegram: перегляди з публічної стрічки t.me/s/<канал> (Bot API переглядів не дає);
  • YouTube: статистика відео з API (якщо ключ дозволяє), інакше лічильник із публічної сторінки Shorts.
Помилки доступу не зупиняють збір: вони записуються в errors, щоб було видно, якого дозволу бракує.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_state  # noqa: E402

T = 30
UA = {"User-Agent": "Mozilla/5.0 (compatible; belyakovconsult-stats/1.0)"}


def _get(url, **params):
    r = requests.get(url, params=params, timeout=T, headers=UA)
    try:
        data = r.json()
    except ValueError:
        data = {"raw": r.text[:300]}
    return r.status_code, data


def instagram(errors):
    tok = os.environ.get("INSTAGRAM_TOKEN")
    if not tok:
        errors.append("instagram: немає INSTAGRAM_TOKEN")
        return []
    out, url = [], "https://graph.instagram.com/me/media"
    params = {"fields": "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count",
              "limit": 50, "access_token": tok}
    while url and len(out) < 300:
        code, d = _get(url, **params)
        if code != 200:
            errors.append(f"instagram media: HTTP {code} {json.dumps(d)[:300]}")
            break
        out += d.get("data", [])
        url, params = (d.get("paging") or {}).get("next"), {}
    warned = False
    for m in out:
        metrics = "views,reach,saved,shares,total_interactions"
        code, d = _get(f"https://graph.instagram.com/{m['id']}/insights", metric=metrics, access_token=tok)
        if code != 200 and m.get("media_product_type") != "REELS":
            code, d = _get(f"https://graph.instagram.com/{m['id']}/insights", metric="reach,saved,shares,total_interactions",
                           access_token=tok)
        if code == 200:
            for it in d.get("data", []):
                v = it.get("values", [{}])[0].get("value") if it.get("values") else it.get("total_value", {}).get("value")
                m[it["name"]] = v
        elif not warned:
            errors.append(f"instagram insights: HTTP {code} {json.dumps(d)[:300]}")
            warned = True
    return out


def threads(errors):
    tok = os.environ.get("THREADS_TOKEN")
    if not tok:
        errors.append("threads: немає THREADS_TOKEN")
        return []
    out, url = [], "https://graph.threads.net/v1.0/me/threads"
    params = {"fields": "id,text,media_type,permalink,timestamp,is_quote_post", "limit": 50, "access_token": tok}
    while url and len(out) < 400:
        code, d = _get(url, **params)
        if code != 200:
            errors.append(f"threads list: HTTP {code} {json.dumps(d)[:300]}")
            break
        out += d.get("data", [])
        url, params = (d.get("paging") or {}).get("next"), {}
    warned = False
    for m in out:
        code, d = _get(f"https://graph.threads.net/v1.0/{m['id']}/insights",
                       metric="views,likes,replies,reposts,quotes,shares", access_token=tok)
        if code == 200:
            for it in d.get("data", []):
                vals = it.get("values")
                m[it["name"]] = vals[0].get("value") if vals else (it.get("total_value") or {}).get("value")
        elif not warned:
            errors.append(f"threads insights: HTTP {code} {json.dumps(d)[:300]}")
            warned = True
    return out


def telegram(errors, channel="belyakovconsult"):
    out, before = {}, None
    for _ in range(10):
        url = f"https://t.me/s/{channel}" + (f"?before={before}" if before else "")
        try:
            html = requests.get(url, timeout=T, headers=UA).text
        except requests.RequestException as e:
            errors.append(f"telegram: {e}")
            break
        posts = re.findall(r'data-post="[^/]+/(\d+)"(.*?)(?=data-post="|\Z)', html, re.S)
        if not posts:
            break
        for pid, body in posts:
            views = re.search(r'tgme_widget_message_views">([^<]+)<', body)
            when = re.search(r'datetime="([^"]+)"', body)
            text = re.search(r'tgme_widget_message_text[^>]*>(.*?)</div>', body, re.S)
            v = views.group(1).strip() if views else None
            if v:
                mult = 1000 if v.endswith("K") else 1_000_000 if v.endswith("M") else 1
                v = int(float(v.rstrip("KM")) * mult)
            out[int(pid)] = {"id": int(pid), "views": v, "timestamp": when.group(1) if when else None,
                             "video": "tgme_widget_message_video" in body,
                             "text": re.sub(r"<[^>]+>", " ", text.group(1))[:200].strip() if text else ""}
        ids = [int(p) for p, _ in posts]
        if min(ids) <= 1 or before == min(ids):
            break
        before = min(ids)
    return sorted(out.values(), key=lambda x: x["id"])


def youtube(errors, state):
    vids = {v["id"]: k for k, v in state.items() if "/youtube-" in k and isinstance(v, dict) and v.get("status") == "published"}
    out = []
    tok = None
    if os.environ.get("YOUTUBE_REFRESH_TOKEN"):
        try:
            import channels
            tok = channels.youtube_token()
        except Exception as e:  # noqa: BLE001
            errors.append(f"youtube token: {e}")
    stats = {}
    if tok and vids:
        r = requests.get("https://www.googleapis.com/youtube/v3/videos", timeout=T,
                         params={"part": "statistics,snippet", "id": ",".join(vids)}, headers={"Authorization": f"Bearer {tok}"})
        if r.status_code == 200:
            for it in r.json().get("items", []):
                stats[it["id"]] = {**{k: int(v) for k, v in it["statistics"].items()}, "title": it["snippet"]["title"]}
        else:
            errors.append(f"youtube api: HTTP {r.status_code} {r.text[:200]}")
    for vid, key in vids.items():
        s = stats.get(vid)
        if s is None:                                   # запасний шлях: лічильник із публічної сторінки
            try:
                html = requests.get(f"https://www.youtube.com/shorts/{vid}", timeout=T, headers=UA).text
                m = re.search(r'"viewCount":"(\d+)"', html)
                s = {"viewCount": int(m.group(1))} if m else {}
            except requests.RequestException:
                s = {}
        out.append({"id": vid, "key": key, "published_at": state[key].get("at"), **s})
    return out


def main() -> int:
    state = load_state()
    errors: list[str] = []
    data = {"collected_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "instagram": instagram(errors), "threads": threads(errors), "telegram": telegram(errors),
            "youtube": youtube(errors, state), "errors": errors}
    # зв'язок із ключами конвеєра (який допис якої статті)
    by_id = {str(v.get("id")): k for k, v in state.items() if isinstance(v, dict) and v.get("id")}
    for ch in ("instagram", "threads", "telegram"):
        for m in data[ch]:
            m["key"] = by_id.get(str(m["id"]))
    (ROOT / "state" / "stats.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print({k: len(v) for k, v in data.items() if isinstance(v, list)}, errors)
    return 0


if __name__ == "__main__":
    sys.exit(main())
