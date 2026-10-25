"""Продовжує токен Threads ще на 60 днів і записує новий токен у файл (не в журнал).

Запуск: python scripts/refresh_threads.py <файл-для-нового-токена>
Використовується щотижневим workflow; сам секрет оновлює `gh secret set`.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import channels  # noqa: E402


def main() -> int:
    token = os.environ.get("THREADS_TOKEN")
    if not token or len(sys.argv) < 2:
        print("Немає THREADS_TOKEN або шляху до файлу — пропускаю.")
        return 0
    data = channels.threads_refresh(token)
    new = data.get("access_token")
    if not new:
        print("Threads не повернув новий токен.")
        return 1
    print(f"::add-mask::{new}")
    Path(sys.argv[1]).write_text(new, encoding="utf-8")
    days = int(data.get("expires_in", 0)) // 86400
    print(f"Токен Threads продовжено, діє ще {days} дн.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
