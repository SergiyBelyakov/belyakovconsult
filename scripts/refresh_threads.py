"""Продовжує токен Threads ще на 60 днів і записує новий токен у файл (не в журнал).

Запуск: python scripts/refresh_threads.py <файл-для-нового-токена> [threads|instagram]
Використовується щотижневим workflow; сам секрет оновлює `gh secret set`.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import channels  # noqa: E402


def main() -> int:
    network = sys.argv[2] if len(sys.argv) > 2 else "threads"
    var, name, fn = {"threads": ("THREADS_TOKEN", "Threads", channels.threads_refresh),
                     "instagram": ("INSTAGRAM_TOKEN", "Instagram", channels.instagram_refresh)}[network]
    token = os.environ.get(var)
    if not token or len(sys.argv) < 2:
        print(f"Немає {var} або шляху до файлу — пропускаю.")
        return 0
    data = fn(token)
    new = data.get("access_token")
    if not new:
        print(f"{name} не повернув новий токен.")
        return 1
    print(f"::add-mask::{new}")
    Path(sys.argv[1]).write_text(new, encoding="utf-8")
    days = int(data.get("expires_in", 0)) // 86400
    print(f"Токен {name} продовжено, діє ще {days} дн.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
