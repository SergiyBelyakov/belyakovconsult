"""Перевірка ключа YouTube (нічого не публікує). Результат: state/youtube-check.md і повідомлення в Telegram адміну."""
from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import channels  # noqa: E402
from common import ROOT  # noqa: E402


def main() -> int:
    missing = [k for k in ("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN") if not os.environ.get(k)]
    if missing:
        msg = f"❌ YouTube: немає секретів {', '.join(missing)}"
    else:
        try:
            msg = channels.youtube_check()
        except Exception as e:  # noqa: BLE001
            text = str(e)
            hint = ""
            if "invalid_grant" in text:
                hint = (" Схоже, refresh-токен відкликано або він протермінований: якщо застосунок у Google Cloud у стані "
                        "«Testing», токен живе лише 7 днів. Переведіть його в «In production» і створіть токен заново.")
            elif "invalid_client" in text:
                hint = " Client ID або Client Secret не збігаються з OAuth-клієнтом."
            msg = f"❌ YouTube: {text[:400]}{hint}"
    out = ROOT / "state" / "youtube-check.md"
    out.write_text(f"# Перевірка YouTube\n\n{datetime.utcnow():%Y-%m-%d %H:%M} UTC\n\n{msg}\n", encoding="utf-8")
    print(msg)
    if os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_ADMIN_CHAT_ID"):
        try:
            channels.telegram_send(os.environ["TELEGRAM_ADMIN_CHAT_ID"], msg, preview=False)
        except Exception as e:  # noqa: BLE001
            print(f"Telegram: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
