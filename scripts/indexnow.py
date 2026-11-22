"""Сповіщає пошуковики (Bing, Yandex, Seznam, Naver через api.indexnow.org) про нові й змінені сторінки сайту.

Звідки адреси: site/sitemap-insights.xml (статті, списки, словник термінів).
Як визначається зміна: хеш вмісту сторінки (без шапки й підвалу, якщо є <main>).
Затримка на один запуск: змінена сторінка спершу стає «очікує» і відправляється лише в наступному запуску
(не раніше ніж через 10 хв), коли вона вже точно розгорнута на хостингу. Стан: state/indexnow.json.
Ключ: config.yml → site.indexnow_key; файл ключа site/<ключ>.txt створюється автоматично.
Помилки мережі не зупиняють конвеєр.

Запуск: python scripts/indexnow.py [--dry-run]
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_config  # noqa: E402

STATE = ROOT / "state" / "indexnow.json"
ENDPOINT = "https://api.indexnow.org/indexnow"
DELAY = timedelta(minutes=10)


def page_hash(path: Path) -> str | None:
    if not path.exists():
        return None
    h = path.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"<main\b.*?</main>", h, re.S)
    body = m.group(0) if m else h
    title = re.search(r"<title>(.*?)</title>", h, re.S)
    return hashlib.sha256(((title.group(1) if title else "") + body).encode()).hexdigest()[:20]


def main() -> int:
    dry = "--dry-run" in sys.argv
    cfg = load_config()
    site = cfg["site"]
    key = site.get("indexnow_key")
    if not key:
        print("IndexNow: немає site.indexnow_key у config.yml, пропускаю")
        return 0
    base = site["base_url"].rstrip("/")
    out = ROOT / site["output_dir"]
    keyfile = out / f"{key}.txt"
    if not keyfile.exists() or keyfile.read_text().strip() != key:
        keyfile.write_text(key + "\n", encoding="utf-8")
    sm = out / "sitemap-insights.xml"
    if not sm.exists():
        print("IndexNow: немає sitemap-insights.xml, пропускаю")
        return 0
    urls = re.findall(r"<loc>(.*?)</loc>", sm.read_text(encoding="utf-8"))
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {"sent": {}, "pending": {}}
    sent, pending = state.setdefault("sent", {}), state.setdefault("pending", {})
    now = datetime.now(timezone.utc)
    ready = []
    for u in urls:
        rel = u[len(base):].strip("/")
        h = page_hash(out / rel / "index.html")
        if h is None or sent.get(u) == h:
            pending.pop(u, None)
            continue
        p = pending.get(u)
        if p and p[0] == h and now - datetime.fromisoformat(p[1]) >= DELAY:
            ready.append((u, h))
        elif not p or p[0] != h:
            pending[u] = [h, now.isoformat(timespec="seconds")]
    for u in list(pending):
        if u not in urls:
            pending.pop(u)
    if ready:
        host = base.split("://", 1)[1]
        payload = {"host": host, "key": key, "keyLocation": f"{base}/{key}.txt", "urlList": [u for u, _ in ready][:10000]}
        if dry:
            print(f"IndexNow (dry-run): відправив би {len(ready)} адрес")
        else:
            try:
                req = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode(), method="POST",
                                             headers={"Content-Type": "application/json; charset=utf-8"})
                with urllib.request.urlopen(req, timeout=30) as r:
                    code = r.status
                if code in (200, 202):
                    for u, h in ready:
                        sent[u] = h
                        pending.pop(u, None)
                    print(f"IndexNow: відправлено {len(ready)} адрес (HTTP {code})")
                else:
                    print(f"IndexNow: HTTP {code}, спробую наступного разу")
            except Exception as e:  # noqa: BLE001
                print(f"IndexNow: помилка {e}, спробую наступного разу")
    else:
        print(f"IndexNow: нових готових адрес немає (очікують: {len(pending)})")
    if not dry:
        STATE.write_text(json.dumps(state, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
