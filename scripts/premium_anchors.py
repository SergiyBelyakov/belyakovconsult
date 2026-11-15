"""Якорі преміум-роликів (правило власника 15.11.2026): однакові звуко-візуальні сигнали в кожному ролику.

Якір закріплює зв'язок «сигнал → стан» лише тоді, коли сигнал щоразу той самий. Тому висота звуків тут фіксована
(не залежить від тональності треку), форма й колір кілець та смуг не змінюються від ролика до ролика.

  біль        (проблема, ризик, «не перевірено»): низький подвійний удар із биттям і рубінові кільця, що розходяться
  полегшення  (рішення, «перевірено», відповідь): дзвін квінтами C6-G6-C7 і світла смуга кольору шампань
  бренд       (фінал): звуковий логотип C5-G5-C6 і незмінна фраза «Check the data before the decision»
                / «Перевіряйте дані до рішення» під посиланням на сайт

Перший кадр кожного ролика завжди хук, і на ньому вже звучить і видно якір болю.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from make_nightdrive import RUBY, SR, clamp, ease, edge, noise, lpf, tt

CHAMPAGNE = (255, 214, 160)
TAGLINE = {"en": "CHECK THE DATA BEFORE THE DECISION", "uk": "ПЕРЕВІРЯЙТЕ ДАНІ ДО РІШЕННЯ"}


# ---------------------------------------------------------------- звук (фіксована висота)
def pain():
    """Низький подвійний удар (55 і 58.3 Гц, мала секунда дає тривожне биття) з глухим шумом."""
    n = int(0.9 * SR)
    t = tt(n)
    x = np.zeros(n)
    for at, g in ((0.0, 1.0), (0.19, 0.75)):
        a = int(at * SR)
        m = n - a
        tl = t[:m]
        body = (np.sin(2 * np.pi * 55 * tl) + 0.8 * np.sin(2 * np.pi * 58.3 * tl) + 0.35 * np.sin(2 * np.pi * 110 * tl)) * np.exp(-tl * 5.5)
        click = lpf(noise(m, 400 + a), 900) * np.exp(-tl * 60) * 0.5
        x[a:] += g * (body + click)
    return np.tanh(1.3 * x) * edge(n, 0.001, 0.08)


def relief():
    """Дзвін квінтами C6, G6, C7 з коротким мерехтінням."""
    n = int(1.3 * SR)
    t = tt(n)
    x = np.zeros(n)
    for k, f in enumerate((1046.5, 1568.0, 2093.0)):
        a = int(k * 0.075 * SR)
        tl = t[: n - a]
        x[a:] += (np.sin(2 * np.pi * f * tl) + 0.25 * np.sin(2 * np.pi * f * 2.01 * tl)) * np.exp(-tl * 4.2) * (1 - 0.15 * k)
    return x * 0.5 * edge(n, 0.002, 0.1)


def logo():
    """Звуковий логотип: C5, G5, C6 м'яким дзвоном, останній тон довгий."""
    n = int(2.0 * SR)
    t = tt(n)
    x = np.zeros(n)
    for k, (f, d) in enumerate(((523.25, 3.5), (783.99, 3.0), (1046.5, 1.3))):
        a = int(k * 0.16 * SR)
        tl = t[: n - a]
        x[a:] += (np.sin(2 * np.pi * f * tl) + 0.3 * np.sin(2 * np.pi * f * 3.0 * tl) * np.exp(-tl * 6)) * np.exp(-tl * d)
    return x * 0.45 * edge(n, 0.002, 0.2)


# ---------------------------------------------------------------- картинка
def pain_rings(fr, cx, cy, u, scale=1.0):
    """Рубінові кільця, що розходяться від проблеми (u від 0 до 1). На u=0 уже видно перше кільце."""
    if not 0 <= u < 1:
        return
    size = int(900 * scale)
    lay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    c = size / 2
    for k, delay in enumerate((0.0, 0.22)):
        v = clamp((u - delay) / (1 - delay))
        if v <= 0 and not (k == 0 and u == 0):
            continue
        r = (90 + 330 * ease(v)) * scale
        a = int(220 * (1 - v) ** 1.4)
        d.ellipse([c - r, c - r, c + r, c + r], outline=(*RUBY, a), width=max(3, int(8 * scale * (1 - v) + 2)))
    flash = int(70 * (1 - u) ** 2)
    if flash > 2:
        d.ellipse([c - 120 * scale, c - 120 * scale, c + 120 * scale, c + 120 * scale], fill=(*RUBY, flash))
    lay = Image.alpha_composite(lay.filter(ImageFilter.GaussianBlur(6 * scale)), lay)
    fr.alpha_composite(lay, (int(cx - c), int(cy - c)))


def relief_sweep(fr, box, u):
    """Світла смуга кольору шампань проходить зліва направо по блоку рішення, лишаючи м'яке світіння."""
    if not 0 <= u < 1:
        return
    x0, y0, x1, y1 = (int(v) for v in box)
    w, h = x1 - x0, y1 - y0
    xx = np.arange(w, dtype=np.float32)[None, :]
    pos = -0.2 * w + ease(u) * 1.4 * w
    band = np.exp(-((xx - pos) / (w * 0.06)) ** 2) * 150 + 26 * math.sin(math.pi * u)
    a = np.repeat(band, h, 0).clip(0, 255).astype(np.uint8)
    lay = Image.new("RGBA", (w, h), (*CHAMPAGNE, 0))
    lay.putalpha(Image.fromarray(a, "L"))
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], 26, fill=255)
    lay.putalpha(Image.fromarray((np.asarray(lay.getchannel("A")).astype(np.float32) * np.asarray(m) / 255).astype(np.uint8), "L"))
    fr.alpha_composite(lay, (x0, y0))
