"""Перевірка доступу до сторінки LinkedIn без публікації.

Ініціалізує завантаження відео від імені сторінки (нічого не завантажує й не публікує). Успіх означає:
токен дійсний, має дозвіл w_organization_social, а людина, що його видала, є адміністратором сторінки.
Результат: state/linkedin-check.md і повідомлення в Telegram-адмінку.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import channels  # noqa: E402
from common import STATE_FILE, fmt_dt, load_config, now  # noqa: E402
from publish import admin  # noqa: E402


def linkedin_diag(tok: str) -> str:
    """Чи LinkedIn узагалі впізнає ключ: на /v2/me дійсний ключ без потрібного дозволу дає 403, недійсний 401.
    Якщо є секрети LINKEDIN_CLIENT_ID і LINKEDIN_CLIENT_SECRET, ще й інтроспекція: активний, дозволи, строк."""
    import requests
    out = []
    try:
        r = requests.get("https://api.linkedin.com/v2/me", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        out.append({401: "LinkedIn ключ не впізнає (401: неповний, відкликаний, прострочений або це не access token)",
                    403: "LinkedIn ключ впізнає (403 на профіль), тобто проблема в дозволах чи сторінці",
                    200: "ключ дійсний"}.get(r.status_code, f"/v2/me: HTTP {r.status_code}"))
    except Exception as e:  # noqa: BLE001
        out.append(f"/v2/me: {e}")
    cid, cs = os.environ.get("LINKEDIN_CLIENT_ID"), os.environ.get("LINKEDIN_CLIENT_SECRET")
    if cid and cs:
        try:
            r = requests.post("https://www.linkedin.com/oauth/v2/introspectToken", timeout=30,
                              data={"client_id": cid, "client_secret": cs, "token": tok})
            j = r.json()
            out.append(f"інтроспекція: active={j.get('active')}, status={j.get('status')}, scope={j.get('scope')}, "
                       f"expires_at={j.get('expires_at')}, client_id_збігається={j.get('client_id') == cid}")
        except Exception as e:  # noqa: BLE001
            out.append(f"інтроспекція: {e}")
    return "; ".join(out)


def main() -> int:
    cfg = load_config()
    version = cfg["channels"]["linkedin"]["api_version"]
    missing = [k for k in ("LINKEDIN_ORG_ID", "LINKEDIN_PAGE_TOKEN") if not os.environ.get(k)]
    if missing:
        msg = f"❌ LinkedIn: немає секретів {', '.join(missing)} (Settings → Secrets and variables → Actions)."
    else:
        raw = os.environ["LINKEDIN_PAGE_TOKEN"]
        tok, _ = channels.linkedin_page_auth()
        shape = f"довжина ключа {len(tok)} симв." + (", прибрано пробіли чи перенос рядка" if tok != raw else "")
        bad = [c for c in tok if not (c.isascii() and (c.isalnum() or c in "-_.~+/="))]
        shape += f", починається з «{tok[:2]}»"
        if bad:
            shape += f", зайві символи: {len(bad)} (напр. пробіл, двокрапка чи невидимий символ усередині ключа)"
        print(shape)
        diag = linkedin_diag(tok)
        if diag:
            shape += f"; {diag}"
        try:
            author = channels.linkedin_check(version)
            msg = (f"✅ LinkedIn: ключ працює, публікація від імені сторінки ({author}) дозволена. "
                   "Дописи сторінки тепер виходять автоматично, з відео 4:5 і обкладинкою.")
        except Exception as e:  # noqa: BLE001
            msg = f"❌ LinkedIn: {str(e)[:500]} ({shape})"
    (STATE_FILE.parent / "linkedin-check.md").write_text(f"# Перевірка LinkedIn\n\n{fmt_dt(now(cfg))}\n\n{msg}\n", encoding="utf-8")
    print(msg)
    admin(msg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
