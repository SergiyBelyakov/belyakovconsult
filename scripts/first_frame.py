"""Правило «хук на кадрі 0»: перший кадр відео не може бути порожнім екраном.

Міра: частка пікселів-контурів (текст, схеми, об'єкти) у кадрі 0, зменшеному до 270×480.
Відео з хуком дають 2..20 %, порожній фон або сам логотип 0..1.2 %. Поріг 1.5 %.
validate.py блокує ще не опубліковані дописи, чиє відео починається з порожнього кадру.

Запуск: python scripts/first_frame.py <відео.mp4> [...]
"""
from __future__ import annotations

import io
import shutil
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

THRESHOLD = 1.5


@lru_cache(maxsize=None)
def detail(path: str) -> float | None:
    """Відсоток контурних пікселів у кадрі 0 (None, якщо ffmpeg недоступний або кадр не прочитався)."""
    if not shutil.which("ffmpeg"):
        return None
    import numpy as np
    from PIL import Image, ImageFilter
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-frames:v", "1", "-vf", "scale=270:480",
                          "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
    if not raw:
        return None
    im = Image.open(io.BytesIO(raw)).convert("L")
    return float((np.asarray(im.filter(ImageFilter.FIND_EDGES)) > 40).mean() * 100)


def is_blank(path) -> bool:
    d = detail(str(path))
    return d is not None and d < THRESHOLD


if __name__ == "__main__":
    bad = 0
    for p in sys.argv[1:]:
        d = detail(str(Path(p)))
        flag = "ПОРОЖНІЙ" if d is not None and d < THRESHOLD else "ок"
        bad += flag != "ок"
        print(f"{flag:9} {d if d is None else round(d, 2)}  {p}")
    sys.exit(1 if bad else 0)
