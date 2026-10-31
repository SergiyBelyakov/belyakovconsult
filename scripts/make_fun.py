"""Фан-тригер «Your data has shrimp in it»: лазерні коти, літаючі креветки-заглушки й імпозантна капібара-аналітик.

Сюжет (19 с): смуга «DATA COMPLETENESS 98%» тремтить, з неї визирає креветка; смуга лопається, і кадром
розлітаються креветки з табличками-заглушками (N/A, 0, -, 01.01.1900, asdf, TEST TEST). «RELEASE THE LASER CATS»:
три коти лазерами з очей прибирають креветки, лічильник «ZAPPED n/6». «CLEAN. RIGHT?» Скретч платівки, і під лаунж
виходить капібара в костюмі: «FILLED 98% / USABLE ?», «Completeness counts filled fields. I count usable ones.»
Фінал: «FILLED IS NOT USABLE.», логотип, анонс статті; остання креветка «TBD» отримує лазер від кота.

Персонажі намальовані кодом (оригінальний мультяшний стиль) з надвибіркою ×2. Звук: власний чиптюн
(інтро з наростанням, груві, героїчна тема котів, лаунж аналітика, «крадькома» у фіналі) плюс ефекти.

Запуск: python scripts/make_fun.py <папка> [9x16|4x5 ...]
"""
from __future__ import annotations

import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402

FPS, SS, SR = 30, 2, 44100
TOTAL = 19.0

T_BURST = 2.1          # смуга лопається
T_EVERY = 3.3          # «PLACEHOLDERS. EVERYWHERE.»
T_CATS = 4.6           # «RELEASE THE LASER CATS»
ZAPS = [6.0, 6.55, 7.1, 7.65, 8.2, 8.75]
T_CLEAN = 9.15         # «CLEAN. RIGHT?»
T_CATS_OUT = 9.7
T_ANALYST = 10.1       # скретч, виходить капібара
T_PANEL = 10.9
T_BUBBLE = 12.3
T_FINALE = 15.4
T_SNEAK = 16.5
T_PEEK = 17.3
FINAL_ZAP = 18.0

RUBY, WHITE, SILVER, GRAPHITE = brand.RUBY, brand.WHITE, brand.SILVER, brand.GRAPHITE
INK = (14, 17, 23)
PANEL, PANEL_LINE, BAR, BAR_BG = (17, 22, 31), (66, 76, 94), (214, 220, 230), (34, 40, 52)
PINK = (247, 160, 178)
CORAL, CORAL_D, CORAL_L = (255, 122, 104), (214, 84, 72), (255, 184, 168)
CAP, CAP_D, CAP_L, CAP_S = (160, 118, 80), (124, 89, 59), (178, 136, 96), (92, 66, 44)
ORANGE, ORANGE_L, LEAF = (255, 150, 30), (255, 196, 110), (88, 170, 84)
CATS = [((236, 239, 244), (205, 210, 220)), ((242, 152, 74), (214, 120, 52)), ((142, 154, 175), (112, 124, 146))]
JUNK = ["N/A", "0", "-", "01.01.1900", "asdf", "TEST TEST"]
STAMPS = ["PLACEHOLDER!", "FAKE ZERO!", "NOT A VALUE!", "NOT A DATE!", "KEYBOARD MASH!", "TEST DATA!"]
LAST_SIGN, LAST_STAMP = "TBD", "NICE TRY."


# ---------------------------------------------------------------- допоміжне
def clamp(x, a=0.0, b=1.0):
    return min(b, max(a, x))


def ease(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_in(x):
    return clamp(x) ** 3


def back(x, c=1.9):
    x = clamp(x)
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def sprite(w, h, *layers):
    """Спрайт із шарів (кожен шар малюється окремо й накладається з прозорістю), надвибірка ×SS."""
    out = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    for fn in layers:
        layer = Image.new("RGBA", out.size, (0, 0, 0, 0))
        fn(ImageDraw.Draw(layer), lambda *v: [x * SS for x in v], SS)
        out.alpha_composite(layer)
    return out.resize((w, h), Image.LANCZOS)


def alpha(img, a):
    if a >= 0.999:
        return img
    im = img.copy()
    im.putalpha(im.getchannel("A").point(lambda v: int(v * max(0.0, a))))
    return im


def xform(img, scale=1.0, rot=0.0):
    if abs(scale - 1) > 1e-3:
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.BICUBIC)
    if abs(rot) > 0.1:
        img = img.rotate(rot, resample=Image.BICUBIC, expand=True)
    return img


def put(f, img, cx, cy, a=1.0):
    """Накласти RGBA-спрайт центром у (cx, cy) на RGB-кадр."""
    if a <= 0.003:
        return
    img = alpha(img, a)
    f.paste(img, (int(cx - img.width / 2), int(cy - img.height / 2)), img)


def text_block(lines, size, colors, stroke=8):
    f = brand.font("head", size)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    ws = [probe.textlength(l, font=f) for l in lines]
    step = int(size * 1.02)
    pad = stroke + 6
    img = Image.new("RGBA", (int(max(ws)) + pad * 2, step * (len(lines) - 1) + int(size * 1.22) + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, (l, w) in enumerate(zip(lines, ws)):
        d.text(((img.width - w) / 2, pad + i * step), l, font=f, fill=colors[i % len(colors)], stroke_width=stroke, stroke_fill=INK)
    return img


def fit_size(lines, max_w, start, kind="head"):
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    size = start
    while size > 24 and max(probe.textlength(l, font=brand.font(kind, size)) for l in lines) > max_w:
        size -= 2
    return size


def stamp(text, size):
    """Рубінова плашка-штамп із білим текстом."""
    f = brand.font("head", size)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    w = int(probe.textlength(text, font=f)) + size
    h = int(size * 1.55)
    img = Image.new("RGBA", (w + 8, h + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([4, 4, w + 3, h + 3], radius=int(size * 0.3), fill=RUBY, outline=WHITE, width=max(3, size // 12))
    d.text((4 + size / 2, 4 + (h - size * 1.2) / 2), text, font=f, fill=WHITE)
    return img


# ---------------------------------------------------------------- персонажі
CAT_W, CAT_H = 380, 440
CAT_EYES = [(130, 188), (250, 188)]


def draw_cat(fur, fur2, mode):
    """mode: calm (звичайні очі), charge (рубінова райдужка, брови насуплені), fire (очі світяться)."""
    def fn(d, S, k):
        d.rounded_rectangle(S(70, 270, 310, 440), radius=100 * k, fill=fur2)
        d.polygon(S(62, 150, 98, 18, 176, 104), fill=fur)
        d.polygon(S(318, 150, 282, 18, 204, 104), fill=fur)
        d.polygon(S(88, 130, 104, 52, 152, 104), fill=PINK)
        d.polygon(S(292, 130, 276, 52, 228, 104), fill=PINK)
        d.ellipse(S(36, 70, 344, 336), fill=fur)
        d.ellipse(S(22, 196, 120, 300), fill=fur)
        d.ellipse(S(260, 196, 358, 300), fill=fur)
        for ex, ey in CAT_EYES:
            if mode == "calm":
                d.ellipse(S(ex - 38, ey - 40, ex + 38, ey + 40), fill=WHITE)
                d.ellipse(S(ex - 22, ey - 28, ex + 22, ey + 32), fill=INK)
                d.ellipse(S(ex - 14, ey - 22, ex - 2, ey - 8), fill=WHITE)
            elif mode == "charge":
                d.ellipse(S(ex - 38, ey - 40, ex + 38, ey + 40), fill=WHITE)
                d.ellipse(S(ex - 24, ey - 26, ex + 24, ey + 30), fill=RUBY)
                d.ellipse(S(ex - 10, ey - 8, ex + 10, ey + 12), fill=(255, 200, 210))
            else:
                d.ellipse(S(ex - 42, ey - 44, ex + 42, ey + 44), fill=RUBY)
                d.ellipse(S(ex - 26, ey - 26, ex + 26, ey + 26), fill=(255, 120, 140))
                d.ellipse(S(ex - 13, ey - 13, ex + 13, ey + 13), fill=(255, 240, 244))
        if mode != "calm":
            d.line(S(86, 128, 170, 150), fill=INK, width=10 * k)
            d.line(S(294, 128, 210, 150), fill=INK, width=10 * k)
        d.polygon(S(176, 236, 204, 236, 190, 252), fill=PINK)
        d.line(S(190, 252, 190, 262), fill=INK, width=4 * k)
        d.arc(S(160, 246, 192, 280), 20, 160, fill=INK, width=4 * k)
        d.arc(S(188, 246, 220, 280), 20, 160, fill=INK, width=4 * k)
        for dy in (-8, 8, 24):
            d.line(S(150, 252 + dy, 46, 236 + dy * 1.7), fill=(250, 250, 250), width=3 * k)
            d.line(S(230, 252 + dy, 334, 236 + dy * 1.7), fill=(250, 250, 250), width=3 * k)
    return sprite(CAT_W, CAT_H, fn)


def draw_shrimp(wing_up):
    """Креветка з крильцями, голова ліворуч."""
    pts = []
    for i in range(9):
        t = i / 8
        pts.append((92 + 150 * t, 112 - 46 * math.sin(math.pi * (0.15 + 0.85 * t)), 40 * (1 - 0.58 * t)))

    def body(d, S, k):
        tx, ty, _ = pts[-1]
        d.polygon(S(tx, ty, tx + 52, ty - 34, tx + 60, ty + 4), fill=CORAL_D)
        d.polygon(S(tx, ty, tx + 60, ty + 4, tx + 44, ty + 40), fill=CORAL)
        for x, y, r in reversed(pts):
            d.ellipse(S(x - r, y - r, x + r, y + r), fill=CORAL)
        for x, y, r in pts[1:-1]:
            d.arc(S(x - r, y - r, x + r, y + r), 200, 340, fill=CORAL_D, width=4 * k)
            d.ellipse(S(x - r * 0.45, y + r * 0.15, x + r * 0.2, y + r * 0.6), fill=CORAL_L)
        for x, y, r in pts[1:6]:
            d.line(S(x, y + r * 0.8, x - 8, y + r * 0.8 + 22), fill=CORAL_D, width=4 * k)
        hx, hy, hr = pts[0]
        d.ellipse(S(hx - hr - 6, hy - hr - 4, hx + hr - 6, hy + hr + 4), fill=CORAL)
        d.arc(S(hx - 34, hy + 2, hx - 8, hy + 22), 30, 150, fill=CORAL_D, width=4 * k)          # усмішка
        d.line(S(hx - 18, hy - 22, hx - 30, hy - 44), fill=INK, width=5 * k)
        d.ellipse(S(hx - 44, hy - 60, hx - 18, hy - 34), fill=INK)
        d.ellipse(S(hx - 37, hy - 55, hx - 29, hy - 47), fill=WHITE)
        for a in (0, 1):
            line = [(hx - 40 - j * 10, hy - 10 - j * (7 + a * 4) - 10 * math.sin(j * 0.6 + a)) for j in range(10)]
            d.line([c for p in line for c in S(*p)], fill=CORAL_D, width=3 * k)

    def wings(d, S, k):
        wy = -60 if wing_up else -18
        d.ellipse(S(140, 40 + wy, 228, 92 + wy), fill=(255, 255, 255, 200), outline=(255, 255, 255), width=3 * k)
        d.ellipse(S(108, 46 + wy * 0.8, 186, 92 + wy * 0.8), fill=(255, 255, 255, 160), outline=(255, 255, 255), width=3 * k)
    return sprite(330, 200, body, wings)


def draw_sign(text):
    f = brand.font("head", 44)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    w = int(probe.textlength(text, font=f)) + 48
    img = Image.new("RGBA", (w, 118), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.line([w // 2 - 34, 0, w // 2 - 12, 40], fill=SILVER, width=4)
    d.line([w // 2 + 34, 0, w // 2 + 12, 40], fill=SILVER, width=4)
    d.rounded_rectangle([0, 36, w - 1, 116], 12, fill=WHITE, outline=INK, width=4)
    d.text((24, 46), text, font=f, fill=INK)
    return img


CAPY_W, CAPY_H, CAPY_CX, CAPY_O = 760, 1180, 380, 110
CAPY_EYES = [(CAPY_CX - 118, 210 + CAPY_O), (CAPY_CX + 118, 210 + CAPY_O)]
CAPY_PAW = (CAPY_CX + 318, 520 + CAPY_O)


def draw_capybara():
    cx, o = CAPY_CX, CAPY_O
    lap = (30, 36, 47)

    def suit(d, S, k):
        d.rounded_rectangle(S(50, 500 + o, 710, 1500 + o), radius=230 * k, fill=INK, outline=(54, 62, 78), width=6 * k)
        d.polygon(S(cx - 100, 490 + o, cx, 690 + o, cx + 100, 490 + o), fill=WHITE)
        d.polygon(S(cx - 100, 490 + o, cx - 20, 620 + o, cx - 130, 860 + o, cx - 205, 580 + o), fill=lap)
        d.polygon(S(cx + 100, 490 + o, cx + 20, 620 + o, cx + 130, 860 + o, cx + 205, 580 + o), fill=lap)
        d.polygon(S(cx - 27, 498 + o, cx + 27, 498 + o, cx + 21, 538 + o, cx - 21, 538 + o), fill=RUBY)
        d.polygon(S(cx - 21, 538 + o, cx + 21, 538 + o, cx + 46, 770 + o, cx, 822 + o, cx - 46, 770 + o), fill=RUBY)
        for yy in (590, 670):
            d.line(S(cx - 32, yy + 34 + o, cx + 38, yy + o), fill=(168, 0, 30), width=7 * k)
        d.polygon(S(cx - 212, 694 + o, cx - 126, 694 + o, cx - 140, 652 + o, cx - 166, 672 + o, cx - 190, 650 + o), fill=RUBY)
        d.line(S(cx - 222, 696 + o, cx - 116, 696 + o), fill=lap, width=6 * k)
        for by in (900, 1000):
            d.ellipse(S(cx - 13, by - 13 + o, cx + 13, by + 13 + o), fill=(46, 52, 64))
        # піднята рука з указкою (праворуч від глядача)
        d.line(S(cx + 236, 780 + o, CAPY_PAW[0], CAPY_PAW[1] + 30), fill=INK, width=92 * k)
        d.ellipse(S(cx + 186, 726 + o, cx + 286, 826 + o), fill=INK)
        d.line(S(CAPY_PAW[0] - 40, CAPY_PAW[1] + 66, CAPY_PAW[0] + 36, CAPY_PAW[1] + 44), fill=WHITE, width=18 * k)
        d.ellipse(S(CAPY_PAW[0] - 40, CAPY_PAW[1] - 40, CAPY_PAW[0] + 40, CAPY_PAW[1] + 40), fill=CAP_D)

    def head(d, S, k):
        for ex in (cx - 150, cx + 150):
            d.ellipse(S(ex - 40, 22 + o, ex + 40, 100 + o), fill=CAP_S)
            d.ellipse(S(ex - 20, 42 + o, ex + 20, 86 + o), fill=(70, 50, 34))
        d.rounded_rectangle(S(cx - 190, 44 + o, cx + 190, 520 + o), radius=175 * k, fill=CAP)
        d.rounded_rectangle(S(cx - 212, 270 + o, cx + 212, 526 + o), radius=140 * k, fill=CAP)
        d.ellipse(S(cx - 120, 70 + o, cx + 120, 176 + o), fill=CAP_L)
        for i in range(5):
            x = cx - 60 + i * 30
            d.arc(S(x - 18, 92 + o, x + 18, 128 + o), 200, 340, fill=CAP_D, width=4 * k)
        d.rounded_rectangle(S(cx - 152, 300 + o, cx + 152, 522 + o), radius=115 * k, fill=CAP_D)
        d.rounded_rectangle(S(cx - 98, 318 + o, cx + 98, 388 + o), radius=35 * k, fill=(72, 52, 36))
        d.line(S(cx - 58, 346 + o, cx - 26, 360 + o), fill=(36, 26, 18), width=9 * k)
        d.line(S(cx + 58, 346 + o, cx + 26, 360 + o), fill=(36, 26, 18), width=9 * k)
        d.line(S(cx, 388 + o, cx, 420 + o), fill=(72, 52, 36), width=6 * k)
        d.arc(S(cx - 58, 392 + o, cx, 446 + o), 20, 160, fill=(72, 52, 36), width=6 * k)
        d.arc(S(cx, 392 + o, cx + 58, 446 + o), 20, 160, fill=(72, 52, 36), width=6 * k)
        for ex, ey in CAPY_EYES:                         # спокійні напівприкриті очі
            d.ellipse(S(ex - 24, ey - 22, ex + 24, ey + 22), fill=INK)
            d.ellipse(S(ex - 13, ey + 2, ex - 3, ey + 12), fill=WHITE)
            d.chord(S(ex - 32, ey - 40, ex + 32, ey + 32), 180, 360, fill=CAP)
            d.line(S(ex - 28, ey - 4, ex + 28, ey - 4), fill=CAP_S, width=5 * k)
        gl = (228, 232, 238)
        for ex, ey in CAPY_EYES:
            d.ellipse(S(ex - 74, ey - 70, ex + 74, ey + 70), outline=gl, width=11 * k)
        ey = CAPY_EYES[0][1]
        d.arc(S(cx - 48, ey - 34, cx + 48, ey + 14), 200, 340, fill=gl, width=10 * k)

    def hat(d, S, k):
        mx, my, r = cx + 8, 44 + o - 32, 56
        d.ellipse(S(mx - r, my - r, mx + r, my + r * 0.92), fill=ORANGE)
        d.ellipse(S(mx - r * 0.55, my - r * 0.62, mx - r * 0.1, my - r * 0.22), fill=ORANGE_L)
        d.line(S(mx + 2, my - r + 4, mx + 6, my - r - 10), fill=(110, 80, 40), width=6 * k)
        d.ellipse(S(mx + 8, my - r - 26, mx + 60, my - r + 2), fill=LEAF)
    return sprite(CAPY_W, CAPY_H, suit, head, hat)


# ---------------------------------------------------------------- макет
def layout(W, H):
    if H > 1500:     # 9:16, з урахуванням інтерфейсу Reels (верх, кнопки праворуч, підпис унизу)
        return dict(k=1.0, cap_y=270, cap_size=124, lock=(60, 150, 50), open_y=860, open_h=340,
                    swarm=(660, 1170), shrimp=0.82, cat_y=H - 330, cat_x=(0.22, 0.5, 0.78),
                    panel_y=560, panel_h=340, bubble_y=925, bubble_r=W - 130,
                    capy=0.84, capy_bottom=H + 210, capy_x=0.31, end_y=300, gag_y=1330, ground=1560)
    return dict(k=0.8, cap_y=104, cap_size=100, lock=(48, 30, 44), open_y=560, open_h=270,
                swarm=(430, 830), shrimp=0.66, cat_y=H - 165, cat_x=(0.2, 0.5, 0.8),
                panel_y=330, panel_h=290, bubble_y=660, bubble_r=W - 50,
                capy=0.62, capy_bottom=H + 150, capy_x=0.26, end_y=96, gag_y=1110, ground=H)


CAPTIONS = {
    "c1": (["YOUR DATA IS", "98% COMPLETE"], [WHITE, WHITE], -1.0, 1.3),
    "c2": (["...BUT WHAT'S", "IN IT?"], [WHITE, RUBY], 1.3, T_BURST + 0.15),
    "c3": (["SHRIMP."], [RUBY], T_BURST + 0.15, T_EVERY),
    "c3b": (["PLACEHOLDERS.", "EVERYWHERE."], [WHITE, RUBY], T_EVERY, T_CATS),
    "c4": (["RELEASE THE", "LASER CATS"], [WHITE, RUBY], T_CATS, ZAPS[0]),
    "c45": (["CLEAN.", "RIGHT?"], [WHITE, RUBY], T_CLEAN, T_ANALYST),
    "c5": (["MEANWHILE,", "THE ANALYST"], [WHITE, RUBY], T_ANALYST, T_PANEL + 0.4),
    "c6": (["FILLED", "IS NOT", "USABLE."], [WHITE, WHITE, RUBY], T_FINALE, TOTAL + 1),
}


class FunVideo:
    def __init__(self, W, H):
        self.W, self.H = W, H
        self.tall = H > 1500
        self.L = L = layout(W, H)
        self.k = L["k"]
        bg = Image.new("RGB", (W, H), GRAPHITE)
        d = ImageDraw.Draw(bg)
        for x in range(0, W, 60):
            d.line([x, 0, x, H], fill=(13, 16, 22))
        for y in range(0, H, 60):
            d.line([0, y, W, y], fill=(13, 16, 22))
        glow = Image.new("L", (W, H), 0)
        gd = ImageDraw.Draw(glow)
        for i in range(30, 0, -1):
            r = int(W * 0.8 * i / 30)
            gd.ellipse([W // 2 - r, int(H * 0.52) - r, W // 2 + r, int(H * 0.52) + r], fill=int(64 * (1 - i / 30) ** 2))
        self.bg = Image.composite(Image.new("RGB", (W, H), RUBY), bg, glow)
        self.cats = [{m: draw_cat(a, b, m) for m in ("calm", "charge", "fire")} for a, b in CATS]
        self.shrimp = [draw_shrimp(True), draw_shrimp(False)]
        self.signs = [draw_sign(t) for t in JUNK] + [draw_sign(LAST_SIGN)]
        self.capy = xform(draw_capybara(), L["capy"])
        self.logo = brand.logo(170 if self.tall else 130)
        self.lock = brand.lockup(L["lock"][2])
        rng = np.random.default_rng(7)
        self.parts = {i: rng.uniform(-1, 1, (28, 2)) for i in range(8)}
        self.frags = rng.uniform(-1, 1, (22, 6))
        self.cracks = [rng.uniform(0, 1, 6) for _ in range(4)]
        self._c = {}
        self.cap_size = {key: fit_size(v[0], W - 130, L["cap_size"]) for key, v in CAPTIONS.items()}
        self.cap_size["c3"] = fit_size(["SHRIMP."], W - 130, int(L["cap_size"] * 1.6))
        self.cap_size["c6"] = fit_size(CAPTIONS["c6"][0], W - 130, int(L["cap_size"] * 1.15))
        x0, x1 = 70, W - 70
        self.bar = (x0 + 44, L["open_y"] + L["open_h"] - 118, x1 - 44, L["open_y"] + L["open_h"] - 54)

    def cache(self, key, fn):
        if key not in self._c:
            self._c[key] = fn()
        return self._c[key]

    # ---- креветки
    GRID = [(0, 0), (1, 1), (2, 0), (0, 1), (1, 0), (2, 1)]

    def shrimp_center(self, i):
        y0, y1 = self.L["swarm"]
        c, r = self.GRID[i]
        return self.W * (0.21, 0.5, 0.79)[c], y0 + (y1 - y0) * (0.18, 0.82)[r]

    def burst_origin(self, i):
        bx0, by0, bx1, by1 = self.bar
        if i == 0:
            return self.peek_pos(T_BURST)
        return bx0 + (bx1 - bx0) * (0.12 + 0.17 * (i - 1)), (by0 + by1) / 2

    def peek_pos(self, t):
        _, by0, bx1, _ = self.bar
        rise = 0.55 + 0.45 * back(t / 0.4)                  # уже з першого кадру видно голову й вусики
        return bx1 - 70 + math.sin(t * 5) * 6, self.L["open_y"] + 30 - 120 * self.k * rise

    def shrimp_pos(self, i, t):
        """(x, y, напрям, кут) креветки i у момент t."""
        cx, cy = self.shrimp_center(i)
        c, r = self.GRID[i]
        y0, y1 = self.L["swarm"]
        w, ph = 1.6, (0.0 if r == 0 else math.pi)            # ряд рухається разом, ряди назустріч
        sx = cx + self.W * 0.045 * math.sin(w * t + ph) + 10 * math.sin(t * 3.1 + i * 2)
        sy = cy + (y1 - y0) * 0.07 * math.sin(2 * w * t + ph + c) + 8 * math.sin(t * 4.7 + i)
        dirn = 1 if math.cos(w * t + ph) > 0 else -1
        u = (t - T_BURST) / 0.75
        if u < 1:
            ox, oy = self.burst_origin(i)
            e = ease(u)
            return ox + (sx - ox) * e, oy + (sy - oy) * e - math.sin(math.pi * clamp(u)) * 160 * self.k, dirn, (1 - e) * 300 * (1 if i % 2 else -1)
        return sx, sy, dirn, math.sin(t * 4 + i) * 8

    def draw_shrimp(self, f, x, y, dirn, rot, t, i, scale=None, sign=None, a=1.0):
        s = (scale or self.L["shrimp"])
        im = self.shrimp[int(t * 14 + i) % 2]
        if dirn > 0:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        sg = self.signs[i if sign is None else sign]
        put(f, xform(sg, s, math.sin(t * 3 + i) * 6 + rot * 0.3), x, y + 86 * s, a)
        put(f, xform(im, s, rot), x, y, a)

    # ---- кадр
    def frame(self, t):
        f = self.bg.copy()
        self.opening(f, t)
        self.swarm(f, t)
        self.cats_scene(f, t)
        self.zap_fx(f, t)
        self.analyst(f, t)
        self.finale(f, t)
        self.texts(f, t)
        return self.post_fx(f, t)

    def opening(self, f, t):
        L, k = self.L, self.k
        if t >= T_BURST + 0.9:
            return
        x0, x1, y0, h = 70, self.W - 70, L["open_y"], L["open_h"]
        bx0, by0, bx1, by1 = self.bar
        if t < T_BURST:
            amp = 0 if t < 1.2 else 18 * ((t - 1.2) / (T_BURST - 1.2)) ** 2
            dx, dy = amp * math.sin(t * 71), amp * 0.6 * math.cos(t * 57)
            px, py = self.peek_pos(t)                         # креветка визирає з-за смуги
            put(f, xform(self.shrimp[int(t * 14) % 2].transpose(Image.FLIP_LEFT_RIGHT), L["shrimp"], -25 + 8 * math.sin(t * 6)), px + dx, py + dy)
            d = ImageDraw.Draw(f, "RGBA")
            d.rounded_rectangle([x0 + dx, y0 + dy, x1 + dx, y0 + h + dy], 24, fill=PANEL, outline=PANEL_LINE, width=3)
            fl = brand.font("body-semi", int(40 * k + 4))
            d.text((x0 + 44 + dx, y0 + 40 * k + dy), "DATA COMPLETENESS", font=fl, fill=SILVER)
            pct = int(round(90 + 8 * ease(t / 0.7)))
            fv = brand.font("head", int(120 * k))
            txt = f"{pct}%"
            d.text((x1 - 44 - d.textlength(txt, font=fv) + dx, y0 + 12 * k + dy), txt, font=fv, fill=WHITE)
            d.rounded_rectangle([bx0 + dx, by0 + dy, bx1 + dx, by1 + dy], 30, fill=BAR_BG)
            fw = (bx1 - bx0) * pct / 100
            d.rounded_rectangle([bx0 + dx, by0 + dy, bx0 + fw + dx, by1 + dy], 30, fill=BAR)
            grow = clamp((t - 0.3) / 1.6)
            for j in range(3):                                 # щось ворушиться всередині смуги
                pos = bx0 + (bx1 - bx0) * (0.2 + 0.28 * j + 0.05 * math.sin(t * 3 + j * 2)) + dx
                r = (10 + 16 * grow + 5 * math.sin(t * 11 + j * 2)) * k
                d.ellipse([pos - r * 1.5, by0 - r + dy, pos + r * 1.5, by0 + r * 0.8 + dy], fill=BAR)
                d.ellipse([pos - r * 1.3, by1 - r * 0.6 + dy, pos + r * 1.3, by1 + r * 0.8 + dy], fill=BAR)
            if t > 1.5:                                        # тріщини
                g = clamp((t - 1.5) / 0.5)
                for c in self.cracks:
                    sx, sy = x0 + (x1 - x0) * (0.15 + 0.7 * c[0]), y0 + h * (0.2 + 0.6 * c[1])
                    pts = [(sx + dx, sy + dy)]
                    for m in range(4):
                        pts.append((pts[-1][0] + (c[2 + m % 4] - 0.5) * 120 * k * g + 30 * k * g, pts[-1][1] + (25 + 20 * c[m % 6]) * k * g * (1 if m % 2 else -1)))
                    d.line(pts, fill=RUBY, width=max(3, int(6 * k)), joint="curve")
        else:
            u = t - T_BURST
            d = ImageDraw.Draw(f, "RGBA")
            cxp, cyp = (x0 + x1) / 2, y0 + h / 2
            r = 60 + 900 * ease(u / 0.55)
            d.ellipse([cxp - r, cyp - r * 0.7, cxp + r, cyp + r * 0.7], outline=(255, 230, 235, int(200 * (1 - clamp(u / 0.55)))), width=int(10 * k))
            for fr in self.frags:                              # уламки смуги
                vx, vy, w0, h0, rot, col = fr
                px = cxp + (x1 - x0) * 0.4 * fr[0] + vx * 900 * ease(u / 0.9)
                py = cyp + h * 0.4 * fr[1] + vy * 700 * ease(u / 0.9) + 900 * u * u
                ww, hh = (40 + 50 * abs(w0)) * k, (18 + 26 * abs(h0)) * k
                ang = rot * 6 * u
                ca, sa = math.cos(ang), math.sin(ang)
                poly = [(px + ca * ax - sa * ay, py + sa * ax + ca * ay) for ax, ay in ((-ww, -hh), (ww, -hh), (ww, hh), (-ww, hh))]
                fill = (*(BAR if col > 0.3 else PANEL), int(255 * (1 - clamp(u / 0.9))))
                d.polygon(poly, fill=fill, outline=(*PANEL_LINE, int(255 * (1 - clamp(u / 0.9)))))

    def swarm(self, f, t):
        if t < T_BURST:
            return
        for i in range(len(JUNK)):
            if t > ZAPS[i] + 0.05:
                continue
            x, y, dirn, rot = self.shrimp_pos(i, t)
            self.draw_shrimp(f, x, y, dirn, rot, t, i)

    def cat_state(self, j, t):
        L, k, H = self.L, self.k, self.H
        pop_t = T_CATS + 0.2 + j * 0.2
        if t < pop_t or t > T_CATS_OUT + 0.6:
            return None
        hidden = H + CAT_H * k * 0.6
        y = hidden + (L["cat_y"] - hidden) * back((t - pop_t) / 0.45)
        if T_CLEAN <= t < T_CATS_OUT:
            y -= abs(math.sin((t - T_CLEAN) * math.pi * 3.4 + j)) * 50 * k
        if t >= T_CATS_OUT:
            y += H * 0.45 * ease_in((t - T_CATS_OUT - j * 0.05) / 0.45)
        firing = any(0 <= t - z < 0.32 and zi % 3 == j for zi, z in enumerate(ZAPS))
        charge = T_CATS + 0.9 <= t < ZAPS[-1] + 0.4
        return self.W * L["cat_x"][j], y, "fire" if firing else ("charge" if charge else "calm")

    def cat_eyes(self, cx, cy, s):
        return [(cx + (ex - CAT_W / 2) * s, cy + (ey - CAT_H / 2) * s) for ex, ey in CAT_EYES]

    def cats_scene(self, f, t):
        for j in range(3):
            st = self.cat_state(j, t)
            if not st:
                continue
            cx, cy, mode = st
            s = self.k * (1 + 0.03 * math.sin(t * 6 + j))
            put(f, xform(self.cats[j][mode], s, math.sin(t * 2.2 + j) * 3), cx, cy)

    def beam(self, f, src, dst, kk):
        """Лазер: розмите світіння + яскраве ядро з білою серединою."""
        W, H = self.W, self.H
        layer = Image.new("L", (W // 2, H // 2), 0)
        d = ImageDraw.Draw(layer)
        for sx, sy in src:
            d.line([sx / 2, sy / 2, dst[0] / 2, dst[1] / 2], fill=int(255 * kk), width=int(16 * self.k))
        glow = layer.filter(ImageFilter.GaussianBlur(10)).resize((W, H), Image.BILINEAR)
        f.paste(Image.new("RGB", (W, H), RUBY), (0, 0), glow.point(lambda v: min(255, v * 3)))
        dd = ImageDraw.Draw(f, "RGBA")
        for sx, sy in src:
            dd.line([sx, sy, dst[0], dst[1]], fill=(255, 70, 100, int(255 * kk)), width=int(13 * self.k))
            dd.line([sx, sy, dst[0], dst[1]], fill=(255, 244, 246, int(255 * kk)), width=int(5 * self.k))
            r = 26 * self.k
            dd.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(255, 220, 228, int(170 * kk)))
        r = 46 * self.k * (0.6 + 0.4 * kk)
        dd.ellipse([dst[0] - r, dst[1] - r, dst[0] + r, dst[1] + r], fill=(255, 236, 240, int(220 * kk)))

    def zap_fx(self, f, t):
        for zi, z in enumerate(ZAPS):
            u = t - z
            if 0 <= u < 0.3:
                st = self.cat_state(zi % 3, t)
                if st:
                    x, y, _, _ = self.shrimp_pos(zi, z)
                    self.beam(f, self.cat_eyes(st[0], st[1], self.k), (x, y), 1 - u / 0.3)
            if 0 <= u < 1.0:
                x, y, _, _ = self.shrimp_pos(zi, z)
                self.poof(f, x, y, u, zi, STAMPS[zi])

    def poof(self, f, x, y, u, zi, label):
        d = ImageDraw.Draw(f, "RGBA")
        for n, (vx, vy) in enumerate(self.parts[zi]):
            r = (9 + n % 5 * 3) * (1 - u) * self.k
            px, py = x + vx * 280 * ease(u) * self.k, y + vy * 280 * ease(u) * self.k + 160 * u * u
            col = [CORAL, WHITE, RUBY, CORAL_L][n % 4]
            if r > 0.5:
                d.ellipse([px - r, py - r, px + r, py + r], fill=(*col, int(255 * (1 - u))))
        if u < 0.95:
            im = self.cache(("stamp", label), lambda: stamp(label, int(46 * self.k + 6)))
            im = xform(im, 0.6 + 0.4 * back(u / 0.22), (-9, 7, -5, 8, -7, 5, -6, 6)[zi % 8])
            put(f, im, clamp(x, im.width / 2 + 20, self.W - im.width / 2 - 20), y - 30 * self.k, 1 - ease((u - 0.65) / 0.3))

    def capy_place(self, t):
        """(центр x, центр y) капібари, або None, якщо її не видно."""
        L, W, H = self.L, self.W, self.H
        if t < T_ANALYST or t > T_FINALE + 0.8:
            return None
        cw, ch = self.capy.size
        x = W * L["capy_x"] + (1 - ease((t - T_ANALYST) / 0.8)) * W * 1.1
        y = L["capy_bottom"] - ch / 2 + math.sin((t - T_ANALYST) * 2.2) * 4
        if t >= T_FINALE:
            y += H * 0.6 * ease_in((t - T_FINALE) / 0.6)
        return x, y

    def capy_point(self, place, p):
        s = self.L["capy"]
        return place[0] + (p[0] - CAPY_W / 2) * s, place[1] + (p[1] - CAPY_H / 2) * s

    def analyst(self, f, t):
        L, k, W = self.L, self.k, self.W
        place = self.capy_place(t)
        if not place:
            return
        out = 1 - clamp((t - (T_FINALE - 0.25)) / 0.25)
        # звіт: FILLED 98% і USABLE ?
        x0, x1 = 60, W - 60
        py, ph = L["panel_y"], L["panel_h"]
        bx0, bx1 = x0 + 40, x1 - 40
        a = clamp((t - T_PANEL) / 0.35) * out
        if a > 0:
            panel = Image.new("RGBA", (x1 - x0, ph), (0, 0, 0, 0))
            d = ImageDraw.Draw(panel)
            d.rounded_rectangle([0, 0, panel.width - 1, ph - 1], 22, fill=(*PANEL, 245), outline=PANEL_LINE, width=3)
            fs = brand.font("body-semi", int(30 * k + 2))
            fl = brand.font("head", int(46 * k + 4))
            fv = brand.font("head", int(64 * k + 6))
            d.text((40, 30 * k), "DATA QUALITY REPORT", font=fs, fill=SILVER)
            g1 = ease((t - T_PANEL - 0.2) / 0.9)
            y1 = 84 * k + 6
            d.text((40, y1), "FILLED", font=fl, fill=WHITE)
            pct = f"{int(round(98 * g1))}%"
            d.text((panel.width - 40 - d.textlength(pct, font=fv), y1 - 12 * k), pct, font=fv, fill=WHITE)
            bw = panel.width - 80
            d.rounded_rectangle([40, y1 + 66 * k, 40 + bw, y1 + 100 * k], 16, fill=BAR_BG)
            d.rounded_rectangle([40, y1 + 66 * k, 40 + max(32, bw * 0.98 * g1), y1 + 100 * k], 16, fill=BAR)
            g2 = clamp((t - T_PANEL - 0.9) / 0.4)
            y2 = y1 + 130 * k
            d.text((40, y2), "USABLE", font=fl, fill=WHITE)
            if g2 > 0:
                q = "?" if int(t * 3) % 2 else "??"
                d.text((panel.width - 40 - d.textlength("??", font=fv), y2 - 12 * k), q, font=fv, fill=RUBY)
                wob = 0.3 + 0.25 * (0.5 + 0.5 * math.sin(t * 4.3)) * (0.6 + 0.4 * math.sin(t * 9.7))
                d.rounded_rectangle([40, y2 + 66 * k, 40 + bw, y2 + 100 * k], 16, fill=BAR_BG)
                d.rounded_rectangle([40, y2 + 66 * k, 40 + max(32, bw * wob * g2), y2 + 100 * k], 16, fill=RUBY)
            put(f, panel, (x0 + x1) / 2, py + ph / 2, a)
        # указка від лапи до смуги USABLE
        pa = clamp((t - T_PANEL - 1.0) / 0.3) * out
        paw = self.capy_point(place, CAPY_PAW)
        if pa > 0:
            tx, ty = bx0 + (bx1 - bx0) * 0.42, py + 84 * k + 6 + 130 * k + 120 * k
            ex, ey = paw[0] + (tx - paw[0]) * 0.86 * ease(pa), paw[1] + (ty - paw[1]) * 0.86 * ease(pa)
            d = ImageDraw.Draw(f, "RGBA")
            d.line([paw[0], paw[1], ex, ey], fill=(232, 236, 242, int(255 * pa)), width=int(9 * k))
            d.ellipse([ex - 11 * k, ey - 11 * k, ex + 11 * k, ey + 11 * k], fill=(*RUBY, int(255 * pa)))
        put(f, self.capy, place[0], place[1])
        # відблиск на окулярах
        for gt in (T_PANEL + 0.8, T_BUBBLE + 2.2):
            g = (t - gt) / 0.35
            if 0 <= g <= 1:
                d = ImageDraw.Draw(f, "RGBA")
                s = L["capy"]
                for p in CAPY_EYES:
                    gx, gy = self.capy_point(place, p)
                    r = 62 * s
                    off = (g * 2 - 1) * r * 0.8
                    d.line([gx - r * 0.5 + off, gy + r * 0.5, gx + r * 0.5 + off, gy - r * 0.5], fill=(255, 255, 255, 230), width=int(12 * s))
        # репліка
        b = clamp((t - T_BUBBLE) / 0.3) * out
        if b > 0:
            im = self.cache("bubble", self.make_bubble)
            im = xform(im, 0.7 + 0.3 * back(clamp((t - T_BUBBLE) / 0.3)))
            right = L["bubble_r"]
            put(f, im, right - im.width / 2, L["bubble_y"] + im.height / 2, b)

    def make_bubble(self):
        k = self.k
        fb = brand.font("head", int(42 * k + 6))
        lines = ["Completeness counts", "filled fields.", "I count usable ones."]
        probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        bw = int(max(probe.textlength(l, font=fb) for l in lines)) + 64
        lh = int(fb.size * 1.25)
        bh = lh * len(lines) + 52
        im = Image.new("RGBA", (bw, bh + 56), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, bw - 1, bh], 26, fill=WHITE)
        d.polygon([70, bh - 4, 130, bh - 4, 40, bh + 52], fill=WHITE)
        for i, l in enumerate(lines):
            d.text((32, 24 + i * lh), l, font=fb, fill=INK if i < 2 else RUBY)
        return im

    def finale(self, f, t):
        if t < T_FINALE:
            return
        L, k, W, H = self.L, self.k, self.W, self.H
        u = t - T_FINALE
        cap = self.cache(("cap", "c6"), lambda: text_block(CAPTIONS["c6"][0], self.cap_size["c6"], CAPTIONS["c6"][1]))
        y = L["end_y"] + cap.height + 30 * k
        if u > 0.5:
            lg = xform(self.logo, 0.7 + 0.3 * back((u - 0.5) / 0.4))
            put(f, lg, W / 2, y + self.logo.height / 2, clamp((u - 0.5) * 4))
        if u > 0.9:
            def endline():
                f1 = brand.font("head", 50 if self.tall else 42)
                f2 = brand.font("body-semi", 38 if self.tall else 32)
                im = Image.new("RGBA", (W, 150), (0, 0, 0, 0))
                d = ImageDraw.Draw(im)
                l1, l2 = "Full breakdown on Monday", "belyakovconsult.com"
                d.text(((W - d.textlength(l1, font=f1)) / 2, 0), l1, font=f1, fill=WHITE)
                d.text(((W - d.textlength(l2, font=f2)) / 2, 76 if self.tall else 64), l2, font=f2, fill=SILVER)
                return im
            im = self.cache("endline", endline)
            put(f, im, W / 2, y + self.logo.height + 40 * k + im.height / 2, clamp((u - 0.9) * 3))
        # остання креветка «TBD» крадеться, кіт визирає знизу і стріляє
        gy = L["gag_y"]
        speed = 300 * (1 if self.tall else 0.95)
        xz = -160 + (FINAL_ZAP - T_SNEAK) * speed
        if T_SNEAK <= t < FINAL_ZAP + 0.06:
            v = t - T_SNEAK
            self.draw_shrimp(f, -160 + v * speed, gy - abs(math.sin(v * 9)) * 14 * k, 1, math.sin(v * 9) * 6, t, 2, L["shrimp"] * 0.85, sign=6)
        if T_PEEK <= t < FINAL_ZAP + 1.0:
            v = t - T_PEEK
            rise = back(v / 0.35) - ease_in((t - (FINAL_ZAP + 0.55)) / 0.4)
            s = k * 0.9
            ground = L["ground"]
            cx = W - (290 if self.tall else 175) * k
            cy = ground + CAT_H * s * 0.5 - CAT_H * s * 0.62 * rise
            mode = "fire" if 0 <= t - FINAL_ZAP < 0.3 else ("charge" if FINAL_ZAP - 0.5 < t < FINAL_ZAP else "calm")
            im = xform(self.cats[1][mode], s, -8)
            top = int(cy - im.height / 2)
            if ground - top > 0:                               # видно лише те, що над «підвіконням»
                part = im.crop((0, 0, im.width, min(im.height, ground - top)))
                f.paste(part, (int(cx - im.width / 2), top), part)
            if ground < H:
                la = clamp(min(v / 0.2, (FINAL_ZAP + 1.0 - t) / 0.2))
                ImageDraw.Draw(f, "RGBA").line([cx - 250 * k, ground, cx + 250 * k, ground], fill=(*PANEL_LINE, int(255 * la)), width=4)
            if 0 <= t - FINAL_ZAP < 0.3:
                self.beam(f, self.cat_eyes(cx, cy, s), (xz, gy), 1 - (t - FINAL_ZAP) / 0.3)
        if 0 <= t - FINAL_ZAP < 1.0:
            self.poof(f, xz, gy, t - FINAL_ZAP, 7, LAST_STAMP)

    def texts(self, f, t):
        L, k, W = self.L, self.k, self.W
        if t < T_FINALE:
            lx, ly, _ = L["lock"]
            put(f, self.lock, lx + self.lock.width / 2, ly + self.lock.height / 2, 0.9)
        for key, (lines, cols, t0, t1) in CAPTIONS.items():
            if not (t0 <= t < t1):
                continue
            im = self.cache(("cap", key), lambda: text_block(lines, self.cap_size[key], cols))
            kin = back((t - t0) / 0.32) if t0 >= 0 else 1
            kout = ease((t - (t1 - 0.16)) / 0.16) if t1 < TOTAL else 0
            s = (0.6 + 0.4 * kin) * (1 - 0.25 * kout)
            if key == "c5" and not self.tall:
                t1 = T_PANEL + 0.05                           # у 4:5 звіт з'являється одразу під заголовком
                if t >= t1:
                    continue
                kout = ease((t - (t1 - 0.16)) / 0.16)
                s = (0.6 + 0.4 * kin) * (1 - 0.25 * kout)
            y = L["end_y"] if key == "c6" else L["cap_y"]
            put(f, xform(im, s, math.sin(t * 3) * 0.8), W / 2, y + im.height / 2, min(1, (t - t0) * 7 if t0 >= 0 else 1) * (1 - kout))
        # лічильник зачистки
        if ZAPS[0] <= t < T_CLEAN:
            n = sum(1 for z in ZAPS if t >= z + 0.1)
            last = max([z for z in ZAPS if t >= z + 0.1], default=ZAPS[0])
            lab = self.cache("hud-lab", lambda: text_block(["PLACEHOLDERS ZAPPED"], int(40 * k + 6), [SILVER], 6))
            num = self.cache(("hud", n), lambda: text_block([f"{n}/6"], int(150 * k), [WHITE if n < 6 else RUBY], 10))
            y = L["cap_y"]
            put(f, lab, W / 2, y + lab.height / 2)
            put(f, xform(num, 1 + 0.25 * (1 - back((t - last - 0.1) / 0.25)) if n else 1), W / 2, y + lab.height + num.height / 2 - 6)

    def post_fx(self, f, t):
        hits = ZAPS + [FINAL_ZAP, T_BURST]
        shake = 0
        for z in hits:
            if 0 <= t - z < 0.18:
                shake = int((16 if z == T_BURST else 9) * (1 - (t - z) / 0.18))
        if shake:
            sx = shake * (1 if int(t * 60) % 2 else -1)
            f = f.transform(f.size, Image.AFFINE, (1, 0, sx, 0, 1, shake // 2), resample=Image.BILINEAR, fillcolor=GRAPHITE)
        if any(0 <= t - z < 0.07 for z in hits):
            f = Image.blend(f, Image.new("RGB", f.size, (255, 70, 100)), 0.07)
        return f

    # ---- обкладинка
    def poster(self):
        L, k, W, H = self.L, self.k, self.W, self.H
        f = self.bg.copy()
        title = text_block(["YOUR DATA", "HAS SHRIMP", "IN IT."], fit_size(["HAS SHRIMP"], W - 120, 190 if self.tall else 150),
                           [WHITE, RUBY, WHITE], 10)
        ty = 300 if self.tall else 70
        put(f, title, W / 2, ty + title.height / 2)
        # капібара в центрі, коти по боках; у 9:16 очі персонажів у центральній зоні 3:4 (сітка профілю)
        cs = 0.74 if self.tall else 0.52
        capy = xform(draw_capybara(), cs)
        eye_y = 1420 if self.tall else H - 250
        cxp, cyp = W * 0.5, eye_y - (CAPY_EYES[0][1] - CAPY_H / 2) * cs
        sy = ty + title.height + (90 if self.tall else 40)
        shrimp_pos = [(W * 0.24, sy + 40 * k, 0, 1), (W * 0.74, sy + 190 * k, 3, -1), (W * 0.5, sy + 30 * k, 4, 1)]
        target = shrimp_pos[1]
        catpos = []
        for j, (fx, rot) in enumerate(((0.16, 8), (0.84, -8))):
            s = k * (0.95 if self.tall else 0.8)
            cy = (eye_y + 70) - (CAT_EYES[0][1] - CAT_H / 2) * s if self.tall else H - CAT_H * s * 0.42
            catpos.append((W * fx, cy, s, rot, (0, 2)[j]))
        for i, (x, y, si, dirn) in enumerate(shrimp_pos):
            if i != 1:
                self.draw_shrimp(f, x, y, dirn, (6, 0, -8)[i], 0.3 * i, si)
        for cx, cy, s, rot, j in catpos:
            put(f, xform(self.cats[j]["fire"], s, rot), cx, cy)
        hit = (target[0] + 30 * k, target[1] + 20 * k)
        for cx, cy, s, rot, j in catpos:
            self.beam(f, self.cat_eyes(cx, cy, s), hit, 1.0)
        put(f, capy, cxp, cyp)                                 # промені проходять за капібарою
        self.draw_shrimp(f, target[0], target[1], target[3], 14, 0.9, target[2])
        st = xform(stamp("NOT A DATE!", int(46 * k + 6)), 1.0, 7)
        put(f, st, clamp(target[0], st.width / 2 + 20, W - st.width / 2 - 20), target[1] - 130 * k)
        lx, ly, _ = L["lock"]
        put(f, self.lock, lx + self.lock.width / 2, ly + self.lock.height / 2, 0.9)
        return f


# ---------------------------------------------------------------- звук
def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def _t(n):
    return np.arange(n) / SR


def env(n, a=0.004, r=0.04):
    e = np.ones(n)
    na, nr = min(n, max(1, int(a * SR))), min(n, max(1, int(r * SR)))
    e[:na] *= np.linspace(0, 1, na)
    e[n - nr:] *= np.linspace(1, 0, nr)
    return e


def sq(f, dur, decay=0.0):
    """Квадратна хвиля з обмеженим спектром (м'який чиптюн без аліасингу)."""
    n = int(dur * SR)
    t = _t(n)
    x = np.zeros(n)
    h = 1
    while h <= 11 and f * h < 9000:
        x += np.sin(2 * np.pi * f * h * t) / h
        h += 2
    return x * env(n) * (np.exp(-t * decay) if decay else 1)


def tri(f, dur, decay=0.0):
    n = int(dur * SR)
    t = _t(n)
    x = sum(((-1) ** i) * np.sin(2 * np.pi * f * h * t) / (h * h) for i, h in enumerate((1, 3, 5, 7)))
    return x * env(n, 0.003, 0.03) * (np.exp(-t * decay) if decay else 1)


def epiano(f, dur):
    n = int(dur * SR)
    t = _t(n)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 6) + 0.12 * np.sin(6 * np.pi * f * t) * np.exp(-t * 9)
    return x * np.exp(-t * 2.2) * (1 + 0.15 * np.sin(2 * np.pi * 5 * t)) * env(n, 0.005, 0.08)


def noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


def hp(x):
    return x - np.convolve(x, np.ones(5) / 5, mode="same")


def lp(x, w=8):
    return np.convolve(x, np.ones(w) / w, mode="same")


def kick():
    n = int(0.32 * SR)
    t = _t(n)
    return np.sin(2 * np.pi * np.cumsum(48 + 110 * np.exp(-t * 28)) / SR) * np.exp(-t * 9) * env(n, 0.001, 0.03)


def snare(seed=0):
    n = int(0.2 * SR)
    t = _t(n)
    return (lp(hp(noise(n, seed)), 2) * np.exp(-t * 22) * 0.9 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.6) * env(n, 0.001, 0.03)


def hat(seed=0, open_=False):
    """Хай-хет: шум у середньо-високій смузі (без різкого шипіння), з м'яким кінцем."""
    n = int((0.25 if open_ else 0.05) * SR)
    return lp(hp(hp(noise(n, seed))), 3) * np.exp(-_t(n) * (14 if open_ else 80)) * env(n, 0.001, 0.01)


def crash(seed=0):
    n = int(1.4 * SR)
    return lp(hp(noise(n, seed)), 3) * np.exp(-_t(n) * 3.4) * env(n, 0.002, 0.1)


def brush(seed=0):
    n = int(0.2 * SR)
    t = _t(n)
    return lp(noise(n, seed), 6) * np.clip(t / 0.03, 0, 1) * np.exp(-t * 14) * env(n, 0.001, 0.04)


def sfx_pew(dur=0.32):
    t = _t(int(SR * dur))
    ph = 2 * np.pi * np.cumsum(1500 * np.exp(-t * 10) + 220) / SR
    return (0.55 * np.sin(ph) + 0.2 * np.sin(3 * ph) + 0.1 * np.sin(5 * ph)) * np.exp(-t * 6) * env(len(t), 0.002, 0.02)


def sfx_pop(dur=0.24, seed=0):
    t = _t(int(SR * dur))
    return (0.7 * lp(noise(len(t), seed), 6) * np.exp(-t * 30) + 0.6 * np.sin(2 * np.pi * (300 * np.exp(-t * 12) + 90) * t) * np.exp(-t * 14)) * env(len(t), 0.001, 0.04)


def sfx_whoosh(dur=0.7, seed=1):
    t = _t(int(SR * dur))
    return lp(noise(len(t), seed), 14) * np.sin(np.pi * t / dur) ** 2 * 1.6


def sfx_boing(dur=0.42):
    t = _t(int(SR * dur))
    f = 180 + 260 * (1 - np.exp(-t * 9)) + 30 * np.sin(2 * np.pi * 14 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) * 0.7 * env(len(t), 0.003, 0.03)


def sfx_ding(f0=1320, dur=1.2):
    t = _t(int(SR * dur))
    return (np.sin(2 * np.pi * f0 * t) + 0.5 * np.sin(2 * np.pi * f0 * 1.5 * t)) * np.exp(-t * 4) * 0.45 * env(len(t), 0.002, 0.05)


def sfx_crack(seed=4):
    t = _t(int(SR * 0.09))
    return hp(noise(len(t), seed)) * np.exp(-t * 60) * 1.2


def sfx_charge(dur=0.55):
    t = _t(int(SR * dur))
    f = 300 * (1400 / 300) ** (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.3 + 0.7 * t / dur) * (0.75 + 0.25 * np.sin(2 * np.pi * 22 * t)) * env(len(t), 0.02, 0.04) * 0.35


def sfx_scratch(dur=0.34, seed=5):
    """Скретч платівки: шум, промодульований пилкою з частотою, що злітає і падає."""
    t = _t(int(SR * dur))
    f = 60 + 900 * np.sin(np.pi * t / dur) ** 1.5
    saw = (np.cumsum(f) / SR) % 1.0
    n = lp(noise(len(t), seed), 3)
    return (n * (0.4 + saw) + 0.4 * np.sin(2 * np.pi * np.cumsum(f * 0.6) / SR)) * np.hanning(len(t)) * 0.9


class Mix:
    def __init__(self, dur):
        self.x = np.zeros(int(dur * SR) + SR)

    def put(self, sig, at, gain=1.0):
        a = int(at * SR)
        if a < 0 or a >= len(self.x):
            return
        b = min(len(self.x), a + len(sig))
        self.x[a:b] += sig[:b - a] * gain


CH = {"C": (36, [60, 64, 67, 72]), "G": (43, [59, 62, 67, 71]), "Am": (45, [60, 64, 69, 72]), "F": (41, [60, 65, 69, 72])}


def groove(m, t0, t1, chords, beat, arp=True, seed=0):
    nb = int((t1 - t0) / beat + 0.999)
    for b in range(nb):
        at = t0 + b * beat
        if at >= t1:
            break
        root, tones = CH[chords[(b // 4) % len(chords)]]
        m.put(kick(), at, 0.9)
        if b % 2 == 1:
            m.put(snare(seed + b), at, 0.5)
        for e in range(2):
            ae = at + e * beat / 2
            if ae < t1:
                m.put(hat(seed + b * 2 + e), ae, 0.2 if e == 0 else 0.13)
                m.put(tri(midi(root + 12 * e), beat / 2 * 0.85), ae, 0.55)
        if arp:
            for s in range(4):
                if at + s * beat / 4 < t1:
                    m.put(sq(midi(tones[(b * 4 + s) % 4]), beat / 4 * 0.8, decay=7), at + s * beat / 4, 0.07)


def melody(m, t0, t1, beat, notes, gain=0.14):
    at = t0
    for note, eighths in notes:
        dur = eighths * beat / 2
        if at >= t1:
            break
        if note:
            m.put(sq(midi(note), min(dur, t1 - at) * 0.92, decay=1.2), at, gain)
            m.put(sq(midi(note + 12), min(dur, t1 - at) * 0.92, decay=3.0), at, gain * 0.25)
        at += dur


def soundtrack(path: Path):
    beat = 60 / 128
    m = Mix(TOTAL)
    # інтро: тікання, пульс баса, барабанний дріб і наростання до вибуху смуги
    for i in range(int(T_BURST / (beat / 2))):
        m.put(hat(i), i * beat / 2, 0.12 if i % 2 else 0.18)
    for i in range(int(T_BURST / beat) + 1):
        if i * beat < T_BURST - 0.05:
            m.put(tri(midi(36), 0.14), i * beat, 0.7)
    at, step, g = 1.2, beat / 4, 0.12
    while at < T_BURST - 0.02:
        m.put(snare(int(at * 100)), at, g)
        g = min(0.42, g + 0.03)
        if at > 1.68:
            step = beat / 8
        at += step
    n = int((T_BURST - 1.0) * SR)
    t = _t(n)
    m.put(np.sin(2 * np.pi * np.cumsum(200 * 8 ** (t / t[-1])) / SR) * (t / t[-1]) ** 2 * env(n, 0.05, 0.02), 1.0, 0.07)
    # вибух: тарілка, бочка, акорд
    m.put(crash(1), T_BURST, 0.32)
    m.put(kick(), T_BURST, 1.0)
    for note in (60, 64, 67, 72):
        m.put(sq(midi(note), 0.4, decay=4), T_BURST, 0.06)
    groove(m, T_BURST, T_CATS, ["C", "G"], beat, arp=True, seed=10)
    # героїчна тема котів
    groove(m, T_CATS, T_ANALYST, ["C", "G", "Am", "F"], beat, arp=False, seed=40)
    m.put(crash(2), T_CATS, 0.22)
    melody(m, T_CATS, T_ANALYST - 0.05, beat, [
        (67, 1), (67, 1), (72, 2), (76, 2), (79, 2),
        (77, 1), (76, 1), (74, 2), (71, 2), (67, 2),
        (69, 1), (72, 1), (76, 2), (81, 2), (79, 1), (76, 1),
        (77, 2), (76, 2), (74, 2), (72, 2)])
    # лаунж аналітика: 90 уд/хв, свінг, «прогулянковий» бас, електропіано, щітки
    lb = 60 / 90
    l0 = T_ANALYST + 0.3
    walk = [38, 41, 45, 48, 43, 47, 50, 41, 36, 40, 43, 47, 45, 43, 40, 38]
    chords = [(l0, [62, 65, 69, 72]), (l0 + 2 * lb, [59, 62, 65, 67]), (l0 + 4 * lb, [60, 64, 67, 71]), (l0 + 6 * lb, [60, 64, 67, 71])]
    for i, note in enumerate(walk):
        at = l0 + i * lb
        if at < T_FINALE - 0.1:
            m.put(tri(midi(note), lb * 0.95), at, 0.6)
            m.put(brush(i), at, 0.10 if i % 2 == 0 else 0.16)
            m.put(hat(200 + i, open_=True), at + lb * 2 / 3, 0.05)
    for at, notes in chords:
        for d0, dur in ((0.0, lb * 1.4), (lb * 5 / 3, lb * 0.5)):
            if at + d0 < T_FINALE - 0.15:
                for note in notes:
                    m.put(epiano(midi(note), dur), at + d0, 0.06)
    # фінал: удар, груві, «крадькома», останній постріл і акорд
    m.put(crash(3), T_FINALE, 0.28)
    m.put(kick(), T_FINALE, 1.0)
    for note in (60, 64, 67, 72):
        m.put(sq(midi(note), 0.5, decay=3), T_FINALE, 0.06)
    groove(m, T_FINALE, T_SNEAK, ["C"], beat, arp=True, seed=80)
    sneak = [36, 39, 40, 43, 46, 45, 43, 40, 39, 38]
    for i, note in enumerate(sneak):
        at = T_SNEAK + i * beat / 2
        if at < FINAL_ZAP - 0.05:
            m.put(tri(midi(note + 12), 0.09), at, 0.7)
            m.put(hat(300 + i), at + beat / 4, 0.12)
    m.put(crash(4), FINAL_ZAP, 0.3)
    m.put(kick(), FINAL_ZAP, 1.0)
    for note in (48, 60, 64, 67, 72):
        m.put(sq(midi(note), 1.0, decay=2.2), FINAL_ZAP + 0.02, 0.06)
    m.put(tri(midi(36), 1.0, decay=2.5), FINAL_ZAP, 0.7)
    music = m.x / max(1e-9, np.abs(m.x).max()) * 0.62

    fx = Mix(TOTAL)
    fx.put(sfx_boing(), 0.25, 0.45)
    fx.put(sfx_crack(4), 1.5, 0.35)
    fx.put(sfx_crack(6), 1.8, 0.45)
    fx.put(sfx_pop(0.3, 1), T_BURST, 0.9)
    fx.put(sfx_whoosh(0.7, 2), T_BURST, 0.55)
    for i in range(3):
        fx.put(sfx_boing(), T_CATS + 0.2 + i * 0.2, 0.45)
    fx.put(sfx_charge(), ZAPS[0] - 0.55, 0.9)
    for i, z in enumerate(ZAPS):
        fx.put(sfx_pew(), z, 0.6)
        fx.put(sfx_pop(0.24, 10 + i), z + 0.12, 0.55)
    fx.put(sfx_ding(1568, 0.8), ZAPS[-1] + 0.35, 0.35)
    fx.put(sfx_whoosh(0.5, 3), T_CATS_OUT, 0.4)
    fx.put(sfx_scratch(), T_ANALYST - 0.02, 0.75)
    fx.put(sfx_whoosh(0.8, 4), T_ANALYST + 0.05, 0.35)
    for gt in (T_PANEL + 0.8, T_BUBBLE + 2.2):
        fx.put(sfx_ding(2637, 0.4), gt, 0.18)
    fx.put(sfx_ding(), T_BUBBLE, 0.5)
    fx.put(sfx_whoosh(0.5, 5), T_FINALE - 0.1, 0.35)
    fx.put(sfx_boing(), T_PEEK, 0.4)
    fx.put(sfx_pew(), FINAL_ZAP, 0.7)
    fx.put(sfx_pop(0.24, 30), FINAL_ZAP + 0.12, 0.6)
    sfx = fx.x / max(1e-9, np.abs(fx.x).max()) * 0.8

    n = int(TOTAL * SR)
    mix = (music * 0.8 + sfx * 0.7)[:n]
    mix[-int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))
    mix /= max(1.0, np.abs(mix).max() / 0.95)
    st = np.stack([mix, mix], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


# ---------------------------------------------------------------- збирання
def render(out_dir: Path, fmt: str) -> Path:
    W, H = (1080, 1920) if fmt == "9x16" else (1080, 1350)
    out_dir.mkdir(parents=True, exist_ok=True)
    wav = out_dir / "laser-cats.wav"
    if not wav.exists():
        soundtrack(wav)
    v = FunVideo(W, H)
    v.poster().save(out_dir / f"laser-cats-{fmt}-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / f"laser-cats-{fmt}.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
           "-movflags", "+faststart", str(mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for i in range(int(TOTAL * FPS)):
            proc.stdin.write(v.frame(i / FPS).tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")
    return mp4


if __name__ == "__main__":
    out = Path(sys.argv[1])
    for fmt in (sys.argv[2:] or ["9x16", "4x5"]):
        print(render(out, fmt))
    (out / "laser-cats.wav").unlink(missing_ok=True)
