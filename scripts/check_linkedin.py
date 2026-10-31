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


def main() -> int:
    cfg = load_config()
    version = cfg["channels"]["linkedin"]["api_version"]
    missing = [k for k in ("LINKEDIN_ORG_ID", "LINKEDIN_PAGE_TOKEN") if not os.environ.get(k)]
    if missing:
        msg = f"❌ LinkedIn: немає секретів {', '.join(missing)} (Settings → Secrets and variables → Actions)."
    else:
        try:
            author = channels.linkedin_check(version)
            msg = (f"✅ LinkedIn: ключ працює, публікація від імені сторінки ({author}) дозволена. "
                   "Дописи сторінки тепер виходять автоматично, з відео 4:5 і обкладинкою.")
        except Exception as e:  # noqa: BLE001
            msg = f"❌ LinkedIn: {str(e)[:500]}"
    (STATE_FILE.parent / "linkedin-check.md").write_text(f"# Перевірка LinkedIn\n\n{fmt_dt(now(cfg))}\n\n{msg}\n", encoding="utf-8")
    print(msg)
    admin(msg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
