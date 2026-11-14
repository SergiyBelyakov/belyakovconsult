"""Портрет для сторінки «Про мене» і блоку «Про мене» на головній.

Джерело: brand-assets/portrait/sergiy-belyakov-800.png, чорно-біле фото 800×800 з профілю LinkedIn
(знято піксель у піксель, без втрат). Скрипт робить із нього два файли в site/assets/:

  sergiy-belyakov.webp          портрет під темний сайт: світлий фон фото стає м'яким світлом за головою,
                                тіні зведено до кольору сторінки, краї розчиняються (прозорість).
                                Стоїть у першому екрані /sergiy-belyakov/, у блоці на головній і на прев'ю сторінки.
  sergiy-belyakov-portrait.jpg  звичайний квадратний портрет для структурованих даних (schema.org Person).

Щоб замінити фото: покладіть нове квадратне 800×800 замість джерела і запустіть скрипт. Числа нижче
підібрано під це фото (обличчя вгорі по центру, темний піджак, волосся впритул до верхнього краю),
для іншого кадру їх треба переглянути: центр світла, ширину розчинення країв і смугу над головою.

Запуск: python scripts/make_portrait.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "brand-assets" / "portrait" / "sergiy-belyakov-800.png"
OUT = ROOT / "site" / "assets"

BG = np.array([5, 7, 10], np.float32) / 255.0        # фон сторінки #05070a
HI = np.array([240, 243, 247], np.float32) / 255.0   # холодний білий, близький до --text-high


def smooth(e0: float, e1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def main() -> int:
    src = Image.open(SRC).convert("L")
    if src.size != (800, 800):
        raise SystemExit(f"очікую фото 800×800, отримав {src.size}")
    g = np.asarray(src).astype(np.float32) / 255.0
    h, w = g.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)

    # 1. Світло спадає від обличчя: яскравий фон фото стає м'яким світінням за головою,
    #    а не білим прямокутником на темній сторінці.
    dist = np.sqrt(((xx - 432) / 500) ** 2 + ((yy - 262) / 560) ** 2)
    lum = np.clip(g, 0.0, 1.0) ** 1.05 * (1.0 - 0.80 * smooth(0.30, 1.08, dist))

    # 2. Два тони з палітри сайту: чорна точка збігається з фоном сторінки, світле стає холодним білим.
    rgb = BG[None, None, :] + (HI - BG)[None, None, :] * lum[..., None]

    # 3. Краї розчиняються. Піджак майже чорний, тож рамки у фігури немає.
    #    Кадр зрізає маківку, тому над (темним) волоссям смуга розчинення коротка, а збоку від голови довга:
    #    світло фону замикається над головою дугою, а не рівним верхнім краєм.
    left = smooth(0.0, 150.0, xx)
    right = smooth(0.0, 150.0, (w - 1) - xx)
    over_head = smooth(225.0, 300.0, xx) * (1.0 - smooth(530.0, 605.0, xx))
    top = smooth(0.0, 34.0 + 150.0 * (1.0 - over_head), yy)
    bottom = 1.0 - smooth(0.80, 1.0, yy / (h - 1))
    alpha = left * right * top * bottom

    OUT.mkdir(parents=True, exist_ok=True)
    rgba = np.dstack([rgb, alpha[..., None]])
    toned = Image.fromarray((rgba * 255.0 + 0.5).clip(0, 255).astype(np.uint8), "RGBA")
    toned.save(OUT / "sergiy-belyakov.webp", "WEBP", quality=88, method=6, alpha_quality=92)
    src.convert("RGB").save(OUT / "sergiy-belyakov-portrait.jpg", "JPEG", quality=88, optimize=True, progressive=True)

    for name in ("sergiy-belyakov.webp", "sergiy-belyakov-portrait.jpg"):
        p = OUT / name
        print(f"site/assets/{name}: {Image.open(p).size[0]}×{Image.open(p).size[1]}, {p.stat().st_size / 1024:.1f} КБ")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
