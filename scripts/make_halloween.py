"""Хелловінський фан-ролик «Your register is haunted»: привиди-мальтіпу, хаскі-ніндзя, котики-гедоністи, капібари-митці.

Сюжет (20 с): ніч, місяць, кажани, надгробки «RIP N/A», «RIP 01.01.1900». «YOUR REGISTER IS HAUNTED.», з-за надгробків
виринає привид-мальтіпу: «BOO!». «GHOST RECORDS.»: привиди з бірками DUPLICATE, TEST USER, LEFT IN 2019, NO MATCH, ID: NULL.
«THEY COUNT. THEY DON'T EXIST.» «SUMMON THE HUSKY NINJAS»: хаскі-ніндзя з сальто влітають у кадр і сюрикенами ставлять
штампи MERGED, DELETED, ARCHIVED, MATCHED, FIXED (лічильник GHOSTS RESOLVED n/5), потім зникають у клубах диму.
«MEANWHILE, THE STAKEHOLDERS»: котики-гедоністи в шовкових халатах на оксамитовому дивані: «We only consume clean data.
And candy.» «AND THE ARTISTS»: капібара в береті малює картину «COUNTED ONCE.», друга тримає гарбуз із вирізаною
діаграмою. Фінал: «COUNT PEOPLE, NOT GHOSTS.», логотип, «Happy Halloween»; останнього привида DUPLICATE ніндзя
позначає «MERGED. NICE TRY.»

Персонажі намальовані кодом (оригінальний мультяшний стиль). Звук: власна музика (дзвін, орган і терменвокс,
мінорний ніндзя-груві, лаунж, вальс клавесина) і ефекти. Спільні інструменти беруться з make_fun.py.

Запуск: python scripts/make_halloween.py <папка> [9x16|4x5 ...]
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
from make_fun import (  # noqa: E402
    CAP, CAP_D, CAP_L, CAP_S, CAT_EYES, CATS, FPS, GRAPHITE, INK, PANEL_LINE, PINK, RUBY, SILVER, SR, WHITE,
    Mix, _t, alpha, back, brush, clamp, crash, draw_sign, ease, ease_in, env, epiano, fit_size, hat, hp, kick, lp,
    midi, noise, put, sfx_ding, sfx_pop, sfx_scratch, sfx_whoosh, snare, sprite, sq, stamp, text_block, tri, xform)

TOTAL = 20.0
T_GHOSTS, T_EXIST, T_NINJA = 1.5, 3.0, 4.6
HITS = [6.2, 6.8, 7.4, 8.0, 8.6]
HIT_ORDER = [0, 1, 3, 4, 2]           # кути, потім центр
T_DONE, T_NINJA_OUT = 9.0, 9.1
T_CATS, T_CAT_BUBBLE = 9.4, 10.7
T_ART, T_PAINT0, T_PAINT1 = 13.2, 13.6, 15.0
T_FINALE, T_SNEAK, T_PEEK, FINAL_HIT = 16.6, 17.3, 18.2, 19.0

NIGHT_TOP, NIGHT_BOT = (18, 20, 38), (5, 7, 10)
MOON = (238, 236, 226)
PUMPKIN, PUMPKIN_D, PUMPKIN_L, FLAME = (255, 136, 26), (206, 92, 12), (255, 184, 92), (255, 216, 120)
GHOST = (242, 245, 250)
EARS = [(238, 220, 196), (232, 178, 128), (226, 228, 232)]
HUSKY, HUSKY_W, ICE = (122, 132, 148), (242, 244, 247), (110, 190, 255)
VELVET, VELVET_D, VELVET_L = (128, 10, 34), (84, 6, 22), (160, 24, 52)
WOOD = (122, 84, 52)
SMOCK = (238, 230, 212)
GHOST_TAGS = ["DUPLICATE", "TEST USER", "LEFT IN 2019", "NO MATCH", "ID: NULL"]
GHOST_STAMPS = ["MERGED!", "DELETED!", "ARCHIVED!", "MATCHED!", "FIXED!"]
GPOS = [(0.22, 0.1), (0.78, 0.1), (0.5, 0.5), (0.22, 0.9), (0.78, 0.9)]
LAST_TAG, LAST_STAMP = "DUPLICATE", "MERGED. NICE TRY."


# ---------------------------------------------------------------- персонажі й реквізит
def with_glow(img, color, radius, strength=0.7, pad=None):
    pad = pad or radius * 2
    out = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    a = Image.new("L", out.size, 0)
    a.paste(img.getchannel("A"), (pad, pad))
    a = a.filter(ImageFilter.GaussianBlur(radius)).point(lambda v: int(v * strength))
    glow = Image.new("RGBA", out.size, (*color, 255))
    glow.putalpha(a)
    out.alpha_composite(glow)
    out.alpha_composite(img, (pad, pad))
    return out


GH_W, GH_H = 300, 340


def draw_ghost(ear):
    """Привид-мальтіпу: пухнаста простирадлова фігурка з кучерями, висячими вухами й рожевим язиком."""
    cx = 150

    def fn(d, S, k):
        d.rounded_rectangle(S(54, 130, 246, 290), radius=40 * k, fill=GHOST)
        for i in range(4):
            x0 = 54 + i * 48
            d.ellipse(S(x0, 262, x0 + 48, 318 + (16 if i % 2 else 0)), fill=GHOST)
        d.ellipse(S(22, 176, 72, 222), fill=GHOST)
        d.ellipse(S(228, 176, 278, 222), fill=GHOST)
        d.ellipse(S(40, 24, 260, 236), fill=GHOST)
        for a in range(190, 351, 20):                                   # кучері на маківці
            r = 102
            x, y = cx + r * math.cos(math.radians(a)), 128 + r * 0.95 * math.sin(math.radians(a))
            d.ellipse(S(x - 25, y - 25, x + 25, y + 25), fill=(250, 251, 253))
        d.ellipse(S(cx - 30, 28, cx + 30, 80), fill=(250, 251, 253))
        sh = tuple(int(c * 0.9) for c in ear)
        for sx in (-1, 1):                                              # висячі кучеряві вуха
            ex = cx + sx * 108
            d.ellipse(S(ex - 34, 104, ex + 34, 238), fill=ear)
            for j in range(3):
                d.arc(S(ex - 24, 120 + j * 34, ex + 24, 160 + j * 34), 20, 160, fill=sh, width=4 * k)
        for ex in (112, 188):
            d.ellipse(S(ex - 18, 126, ex + 18, 164), fill=INK)
            d.ellipse(S(ex - 10, 132, ex - 1, 142), fill=WHITE)
        d.ellipse(S(84, 168, 106, 182), fill=(255, 196, 206))
        d.ellipse(S(194, 168, 216, 182), fill=(255, 196, 206))
        d.ellipse(S(136, 164, 164, 186), fill=INK)
        d.arc(S(124, 176, 150, 200), 20, 160, fill=INK, width=3 * k)
        d.arc(S(150, 176, 176, 200), 20, 160, fill=INK, width=3 * k)
        d.ellipse(S(141, 190, 159, 214), fill=(255, 120, 140))
    return with_glow(sprite(GH_W, GH_H, fn), (190, 214, 255), 14, 0.55)


NJ_W, NJ_H = 420, 480
NJ_EYES = [(150, 200), (270, 200)]


def draw_ninja():
    """Хаскі-ніндзя: маска хаскі, крижані очі, чорна пов'язка на морді, рубінова стрічка з хвостами, катана за спиною."""
    cx = 210

    def fn(d, S, k):
        d.line(S(250, 470, 372, 214), fill=(44, 34, 30), width=26 * k)               # катана за спиною
        d.line(S(352, 256, 392, 168), fill=(30, 30, 36), width=24 * k)
        for j in range(4):
            y = 250 - j * 22
            d.line(S(350 + j * 10, y, 368 + j * 10, y + 10), fill=RUBY, width=6 * k)
        d.rounded_rectangle(S(74, 300, 346, 520), radius=100 * k, fill=INK)          # костюм
        d.polygon(S(160, 300, 260, 300, 210, 386), fill=(34, 38, 48))
        d.line(S(96, 340, 340, 470), fill=RUBY, width=24 * k)                         # пояс-перев'язь
        d.polygon(S(88, 156, 114, 18, 188, 100), fill=HUSKY)                          # вуха
        d.polygon(S(332, 156, 306, 18, 232, 100), fill=HUSKY)
        d.polygon(S(108, 136, 120, 54, 166, 102), fill=(236, 214, 220))
        d.polygon(S(312, 136, 300, 54, 254, 102), fill=(236, 214, 220))
        d.ellipse(S(64, 70, 356, 344), fill=HUSKY)                                    # голова
        d.ellipse(S(94, 156, 326, 344), fill=HUSKY_W)                                 # біла маска
        d.ellipse(S(118, 128, 172, 166), fill=HUSKY_W)
        d.ellipse(S(248, 128, 302, 166), fill=HUSKY_W)
        d.polygon(S(cx - 22, 76, cx + 22, 76, cx + 12, 214, cx - 12, 214), fill=HUSKY)
        for ex, ey in NJ_EYES:
            d.ellipse(S(ex - 30, ey - 24, ex + 30, ey + 24), fill=WHITE)
            d.ellipse(S(ex - 19, ey - 19, ex + 19, ey + 19), fill=ICE)
            d.ellipse(S(ex - 9, ey - 9, ex + 9, ey + 9), fill=INK)
            d.ellipse(S(ex - 15, ey - 15, ex - 7, ey - 7), fill=WHITE)
        d.line(S(112, 166, 182, 182), fill=INK, width=9 * k)                          # рішучі брови
        d.line(S(308, 166, 238, 182), fill=INK, width=9 * k)
        d.rounded_rectangle(S(80, 228, 340, 356), radius=60 * k, fill=INK)            # пов'язка на морді
        d.line(S(106, 266, 314, 268), fill=(38, 42, 52), width=5 * k)
        d.line(S(114, 306, 306, 310), fill=(38, 42, 52), width=5 * k)
        d.arc(S(62, 118, 358, 420), 218, 322, fill=RUBY, width=22 * k)                 # стрічка на лобі
        d.polygon(S(320, 162, 404, 140, 412, 162, 328, 186), fill=RUBY)               # хвости стрічки
        d.polygon(S(318, 178, 398, 204, 390, 224, 312, 196), fill=(176, 2, 34))
    return sprite(NJ_W, NJ_H, fn)


def draw_shuriken():
    def fn(d, S, k):
        c = 60
        pts = [(c + (56 if i % 2 == 0 else 17) * math.cos(math.pi / 4 * i), c + (56 if i % 2 == 0 else 17) * math.sin(math.pi / 4 * i))
               for i in range(8)]
        d.polygon([v for p in pts for v in S(*p)], fill=(210, 216, 226), outline=(110, 118, 132))
        d.ellipse(S(c - 10, c - 10, c + 10, c + 10), fill=(30, 34, 44))
    return sprite(120, 120, fn)


LUX_W, LUX_H = 380, 470


def draw_lux_cat(fur, fur2, robe, trim, extra):
    """Котик-гедоніст: шовковий халат, блаженно примружені очі, рум'янець; аксесуар: чашка, окуляри чи льодяник."""
    def fn(d, S, k):
        d.rounded_rectangle(S(58, 268, 322, 520), radius=110 * k, fill=robe)
        d.polygon(S(146, 276, 234, 276, 190, 392), fill=fur2)
        d.line(S(146, 276, 190, 392), fill=trim, width=14 * k)
        d.line(S(234, 276, 190, 392), fill=trim, width=14 * k)
        d.polygon(S(62, 150, 98, 18, 176, 104), fill=fur)
        d.polygon(S(318, 150, 282, 18, 204, 104), fill=fur)
        d.polygon(S(88, 130, 104, 52, 152, 104), fill=PINK)
        d.polygon(S(292, 130, 276, 52, 228, 104), fill=PINK)
        d.ellipse(S(36, 70, 344, 336), fill=fur)
        d.ellipse(S(22, 196, 120, 300), fill=fur)
        d.ellipse(S(260, 196, 358, 300), fill=fur)
        if extra == "shades":
            for ex, ey in CAT_EYES:
                d.rounded_rectangle(S(ex - 46, ey - 30, ex + 46, ey + 30), radius=26 * k, fill=(20, 20, 26))
                d.line(S(ex - 26, ey - 16, ex - 6, ey - 22), fill=(120, 130, 150), width=6 * k)
            d.line(S(176, 182, 204, 182), fill=(20, 20, 26), width=8 * k)
        else:
            for ex, ey in CAT_EYES:                                                   # блаженні дужки
                d.arc(S(ex - 30, ey - 12, ex + 30, ey + 34), 200, 340, fill=INK, width=8 * k)
        d.ellipse(S(66, 226, 112, 252), fill=(255, 168, 188))
        d.ellipse(S(268, 226, 314, 252), fill=(255, 168, 188))
        d.polygon(S(176, 236, 204, 236, 190, 252), fill=PINK)
        d.arc(S(160, 246, 192, 280), 20, 160, fill=INK, width=4 * k)
        d.arc(S(188, 246, 220, 280), 20, 160, fill=INK, width=4 * k)
        for dy in (-8, 8, 24):
            d.line(S(150, 252 + dy, 46, 236 + dy * 1.7), fill=(250, 250, 250), width=3 * k)
            d.line(S(230, 252 + dy, 334, 236 + dy * 1.7), fill=(250, 250, 250), width=3 * k)
        if extra == "cup":                                                            # чашка з блюдцем
            d.ellipse(S(250, 352, 340, 372), fill=WHITE)
            d.rounded_rectangle(S(262, 304, 328, 362), radius=14 * k, fill=WHITE)
            d.arc(S(316, 314, 346, 344), 270, 90, fill=WHITE, width=8 * k)
            d.line(S(272, 318, 318, 318), fill=RUBY, width=5 * k)
            d.ellipse(S(236, 340, 276, 380), fill=fur)
        elif extra == "shades":                                                       # цукерка в лапі
            d.ellipse(S(236, 330, 276, 370), fill=fur)
            d.ellipse(S(262, 308, 318, 348), fill=RUBY)
            d.polygon(S(262, 328, 240, 312, 242, 344), fill=(255, 120, 140))
            d.polygon(S(318, 328, 340, 312, 338, 344), fill=(255, 120, 140))
        else:                                                                          # льодяник
            d.line(S(276, 380, 300, 250), fill=WHITE, width=8 * k)
            d.ellipse(S(266, 200, 340, 274), fill=WHITE)
            d.arc(S(276, 210, 330, 264), 0, 300, fill=RUBY, width=8 * k)
            d.arc(S(290, 224, 316, 250), 60, 360, fill=PUMPKIN, width=6 * k)
            d.ellipse(S(250, 350, 290, 390), fill=fur)
    return sprite(LUX_W, LUX_H, fn)


def draw_sofa():
    def back_(d, S, k):
        d.rounded_rectangle(S(80, 30, 900, 300), radius=100 * k, fill=VELVET)
        for x in range(180, 860, 112):
            for y in (110, 200):
                d.ellipse(S(x - 9, y - 9, x + 9, y + 9), fill=VELVET_D)

    def front(d, S, k):
        d.rounded_rectangle(S(100, 250, 880, 380), radius=40 * k, fill=VELVET_L)
        d.rounded_rectangle(S(14, 140, 160, 400), radius=64 * k, fill=VELVET)
        d.rounded_rectangle(S(820, 140, 966, 400), radius=64 * k, fill=VELVET)
        d.rounded_rectangle(S(60, 340, 920, 410), radius=20 * k, fill=VELVET_D)
        for x in (110, 840):
            d.rounded_rectangle(S(x, 404, x + 30, 436), radius=6 * k, fill=SILVER)
    return sprite(980, 440, back_), sprite(980, 440, front)


def draw_pumpkin(kind):
    """kind: bucket (відерце з цукерками) або chart (ліхтар із вирізаною стовпчиковою діаграмою, світиться)."""
    def fn(d, S, k):
        if kind == "bucket":
            d.arc(S(40, -10, 220, 150), 200, 340, fill=(60, 64, 76), width=8 * k)
            for i, col in enumerate((RUBY, WHITE, PUMPKIN_L, (120, 190, 255), RUBY, WHITE)):
                x = 70 + i * 24
                d.ellipse(S(x, 40 - (i % 2) * 14, x + 40, 80 - (i % 2) * 14), fill=col)
        for x0, x1 in ((30, 150), (90, 230), (60, 200)):
            d.ellipse(S(x0, 60, x1, 240), fill=PUMPKIN)
        d.arc(S(60, 62, 200, 238), 100, 260, fill=PUMPKIN_D, width=5 * k)
        d.arc(S(60, 62, 200, 238), 280, 80, fill=PUMPKIN_D, width=5 * k)
        d.ellipse(S(108, 64, 152, 236), outline=PUMPKIN_D, width=4 * k)
        if kind == "chart":
            d.rounded_rectangle(S(122, 34, 140, 70), radius=6 * k, fill=(96, 120, 50))
            d.polygon(S(76, 132, 108, 132, 92, 104), fill=FLAME)
            d.polygon(S(152, 132, 184, 132, 168, 104), fill=FLAME)
            for i, h in enumerate((22, 36, 50, 66)):                                 # діаграма замість усмішки
                x = 84 + i * 24
                d.rounded_rectangle(S(x, 212 - h, x + 16, 212), radius=3 * k, fill=FLAME)
        else:
            d.polygon(S(78, 140, 110, 140, 94, 112), fill=(70, 26, 6))
            d.polygon(S(150, 140, 182, 140, 166, 112), fill=(70, 26, 6))
            d.polygon(S(78, 172, 96, 192, 114, 174, 130, 194, 146, 174, 164, 192, 182, 172, 172, 206, 88, 206), fill=(70, 26, 6))
    im = sprite(260, 250, fn)
    return with_glow(im, (255, 170, 60), 18, 0.6) if kind == "chart" else im


CAPY_W, CAPY_H, CAPY_CX, CAPY_O = 760, 1180, 380, 110
CAPY_PAW = (CAPY_CX + 318, 520 + CAPY_O)


def draw_capy_artist(beret, raised):
    """Капібара-митець: берет, вусики-завитки, блуза з плямами фарби й рубіновий шарф; raised: піднята лапа з пензлем."""
    cx, o = CAPY_CX, CAPY_O

    def body(d, S, k):
        d.rounded_rectangle(S(50, 500 + o, 710, 1500 + o), radius=230 * k, fill=SMOCK, outline=(200, 190, 170), width=6 * k)
        for (x, y, r, col) in ((180, 760, 30, RUBY), (520, 840, 24, PUMPKIN), (300, 960, 20, (110, 170, 230)), (560, 1000, 28, RUBY),
                               (230, 1060, 18, PUMPKIN), (430, 700, 16, (110, 170, 230))):
            d.ellipse(S(x - r, y - r * 0.8 + o, x + r, y + r * 0.8 + o), fill=col)
        d.polygon(S(cx - 150, 500 + o, cx + 150, 500 + o, cx + 60, 600 + o, cx - 60, 600 + o), fill=RUBY)   # шарф
        d.polygon(S(cx + 40, 580 + o, cx + 110, 580 + o, cx + 130, 720 + o, cx + 70, 700 + o), fill=(176, 2, 34))
        if raised:
            d.line(S(cx + 236, 780 + o, CAPY_PAW[0], CAPY_PAW[1] + 30), fill=SMOCK, width=92 * k)
            d.ellipse(S(cx + 186, 726 + o, cx + 286, 826 + o), fill=SMOCK)
            d.ellipse(S(CAPY_PAW[0] - 40, CAPY_PAW[1] - 40, CAPY_PAW[0] + 40, CAPY_PAW[1] + 40), fill=CAP_D)

    def head(d, S, k):
        for ex in (cx - 150, cx + 150):
            d.ellipse(S(ex - 40, 22 + o, ex + 40, 100 + o), fill=CAP_S)
            d.ellipse(S(ex - 20, 42 + o, ex + 20, 86 + o), fill=(70, 50, 34))
        d.rounded_rectangle(S(cx - 190, 44 + o, cx + 190, 520 + o), radius=175 * k, fill=CAP)
        d.rounded_rectangle(S(cx - 212, 270 + o, cx + 212, 526 + o), radius=140 * k, fill=CAP)
        d.ellipse(S(cx - 120, 70 + o, cx + 120, 176 + o), fill=CAP_L)
        d.rounded_rectangle(S(cx - 152, 300 + o, cx + 152, 522 + o), radius=115 * k, fill=CAP_D)
        d.rounded_rectangle(S(cx - 98, 318 + o, cx + 98, 388 + o), radius=35 * k, fill=(72, 52, 36))
        d.line(S(cx - 58, 346 + o, cx - 26, 360 + o), fill=(36, 26, 18), width=9 * k)
        d.line(S(cx + 58, 346 + o, cx + 26, 360 + o), fill=(36, 26, 18), width=9 * k)
        d.arc(S(cx - 104, 364 + o, cx - 4, 420 + o), 0, 180, fill=INK, width=10 * k)    # вуса-кермо
        d.arc(S(cx + 4, 364 + o, cx + 104, 420 + o), 0, 180, fill=INK, width=10 * k)
        d.ellipse(S(cx - 118, 374 + o, cx - 94, 398 + o), fill=INK)
        d.ellipse(S(cx + 94, 374 + o, cx + 118, 398 + o), fill=INK)
        d.arc(S(cx - 40, 430 + o, cx + 40, 476 + o), 20, 160, fill=(72, 52, 36), width=6 * k)
        for ex in (cx - 118, cx + 118):                                               # мрійливо примружені очі
            ey = 210 + o
            d.arc(S(ex - 30, ey - 16, ex + 30, ey + 30), 200, 340, fill=INK, width=9 * k)
        d.ellipse(S(cx - 200, 250 + o, cx - 150, 280 + o), fill=(214, 140, 120))
        d.ellipse(S(cx + 150, 250 + o, cx + 200, 280 + o), fill=(214, 140, 120))

    def hat(d, S, k):                                                                  # берет набакир
        d.ellipse(S(cx - 200, 10 + o, cx + 140, 120 + o), fill=beret)
        d.ellipse(S(cx - 160, 24 + o, cx + 60, 70 + o), fill=tuple(min(255, c + 30) for c in beret))
        d.line(S(cx - 20, 14 + o, cx - 10, -14 + o), fill=beret, width=12 * k)
    return sprite(CAPY_W, CAPY_H, body, head, hat)


def draw_painting(w, h):
    """Картина на полотні: п'ять людей, кожен з галочкою, і напис «COUNTED ONCE.» мазками."""
    im = Image.new("RGBA", (w, h), (250, 246, 236, 255))
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(3)
    for _ in range(140):                                                              # фактура полотна
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        d.line([x, y, x + rng.uniform(10, 40), y + rng.uniform(-4, 4)], fill=(238, 232, 218), width=3)
    n = 5
    for i in range(n):
        x = w * (0.14 + 0.18 * i)
        y = h * 0.3
        r = h * 0.07
        d.ellipse([x - r, y - r, x + r, y + r], fill=INK)
        d.rounded_rectangle([x - r * 1.5, y + r * 1.2, x + r * 1.5, y + r * 4.2], radius=int(r), fill=INK)
        d.line([x - r * 1.2, y - r * 2.4, x - r * 0.4, y - r * 1.6, x + r * 1.2, y - r * 3.4], fill=RUBY, width=max(4, int(r * 0.45)), joint="curve")
    f = brand.font("head", fit_size(["COUNTED ONCE."], int(w * 0.84), int(h * 0.2)))
    txt = "COUNTED ONCE."
    tw = d.textlength(txt, font=f)
    d.text(((w - tw) / 2, h * 0.64), txt, font=f, fill=INK)
    d.line([w * 0.12, h * 0.9, w * 0.88, h * 0.88], fill=RUBY, width=max(6, int(h * 0.03)))
    return im


def draw_tomb(text):
    w, h = 250, 230

    def fn(d, S, k):
        d.rounded_rectangle(S(10, 10, w - 10, h + 60), radius=110 * k, fill=(58, 64, 78), outline=(84, 92, 108), width=5 * k)
        d.line(S(60, 80, 90, 96), fill=(46, 50, 62), width=4 * k)
    im = sprite(w, h, fn)
    d = ImageDraw.Draw(im)
    f1, f2 = brand.font("head", 46), brand.font("head", fit_size([text], w - 50, 36))
    d.text(((w - d.textlength("RIP", font=f1)) / 2, 62), "RIP", font=f1, fill=(30, 34, 44))
    d.text(((w - d.textlength(text, font=f2)) / 2, 130), text, font=f2, fill=(30, 34, 44))
    return im


def draw_bat(up):
    def fn(d, S, k):
        wy = -40 if up else 30
        d.polygon(S(100, 60, 60, 40 + wy, 30, 60 + wy * 0.6, 10, 50 + wy, 40, 80, 70, 72), fill=(16, 16, 26))
        d.polygon(S(100, 60, 140, 40 + wy, 170, 60 + wy * 0.6, 190, 50 + wy, 160, 80, 130, 72), fill=(16, 16, 26))
        d.ellipse(S(82, 46, 118, 92), fill=(16, 16, 26))
        d.polygon(S(86, 52, 90, 34, 98, 50), fill=(16, 16, 26))
        d.polygon(S(114, 52, 110, 34, 102, 50), fill=(16, 16, 26))
        d.ellipse(S(92, 60, 98, 66), fill=(255, 210, 120))
        d.ellipse(S(102, 60, 108, 66), fill=(255, 210, 120))
    return sprite(200, 140, fn)


def bubble(lines, size, colors, tail="left"):
    fb = brand.font("head", size)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    bw = int(max(probe.textlength(l, font=fb) for l in lines)) + 64
    lh = int(size * 1.25)
    bh = lh * len(lines) + 46
    im = Image.new("RGBA", (bw, bh + 56), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, bw - 1, bh], 26, fill=WHITE)
    if tail == "left":
        d.polygon([60, bh - 4, 120, bh - 4, 36, bh + 52], fill=WHITE)
    elif tail == "right":
        d.polygon([bw - 60, bh - 4, bw - 120, bh - 4, bw - 36, bh + 52], fill=WHITE)
    else:
        d.polygon([bw / 2 - 30, bh - 4, bw / 2 + 30, bh - 4, bw / 2, bh + 52], fill=WHITE)
    for i, l in enumerate(lines):
        d.text(((bw - probe.textlength(l, font=fb)) / 2, 22 + i * lh), l, font=fb, fill=colors[i % len(colors)])
    return im


# ---------------------------------------------------------------- макет
def layout(W, H):
    if H > 1500:
        return dict(k=1.0, cap_y=270, cap_size=124, lock=(60, 150, 50), moon=(W - 170, 140, 88), tomb_y=H - 420,
                    boo=(W / 2, 1060, 1.2), swarm=(650, 1210), ghost=0.8, ninja_y=H - 330, ninja=0.92,
                    sofa_y=1250, sofa=1.0, cat_y=1130, cat=0.82, cat_bubble_y=650,
                    canvas=(0.6, 640, 580, 430), painter=(0.2, H + 300, 0.74), sculptor=(0.64, H + 60, 0.5),
                    end_y=300, gag_y=1330, ground=1560, fog_y=H - 560)
    return dict(k=0.8, cap_y=110, cap_size=100, lock=(48, 30, 44), moon=(W - 96, 64, 48), tomb_y=H - 180,
                boo=(W / 2, 760, 0.9), swarm=(430, 850), ghost=0.6, ninja_y=H - 170, ninja=0.7,
                sofa_y=H - 230, sofa=0.82, cat_y=H - 330, cat=0.66, cat_bubble_y=560,
                canvas=(0.62, 350, 480, 356), painter=(0.18, H + 260, 0.56), sculptor=(0.87, H + 120, 0.38),
                end_y=96, gag_y=1110, ground=H, fog_y=H - 330)


CAPTIONS = {
    "c1": (["YOUR REGISTER", "IS HAUNTED."], [WHITE, RUBY], -1.0, T_GHOSTS),
    "c2": (["GHOST", "RECORDS."], [WHITE, RUBY], T_GHOSTS, T_EXIST),
    "c3": (["THEY COUNT.", "THEY DON'T EXIST."], [WHITE, RUBY], T_EXIST, T_NINJA),
    "c4": (["SUMMON THE", "HUSKY NINJAS"], [WHITE, RUBY], T_NINJA, HITS[0] - 0.05),
    "c5": (["MEANWHILE,", "THE STAKEHOLDERS"], [WHITE, RUBY], T_CATS, T_CAT_BUBBLE + 0.3),
    "c55": (["AND THE", "ARTISTS"], [WHITE, RUBY], T_ART, T_PAINT0 + 0.9),
    "c6": (["COUNT PEOPLE,", "NOT GHOSTS."], [WHITE, RUBY], T_FINALE, TOTAL + 1),
}


class Halloween:
    def __init__(self, W, H):
        self.W, self.H = W, H
        self.tall = H > 1500
        self.L = L = layout(W, H)
        self.k = k = L["k"]
        rng = np.random.default_rng(11)
        t = np.linspace(0, 1, H)[:, None]
        grad = np.array(NIGHT_TOP)[None, :] * (1 - t) + np.array(NIGHT_BOT)[None, :] * t
        arr = np.repeat(grad[:, None, :], W, axis=1)
        bg = Image.fromarray(arr.astype(np.uint8), "RGB")
        d = ImageDraw.Draw(bg)
        for _ in range(140):
            x, y = rng.uniform(0, W), rng.uniform(0, H * 0.6)
            r = rng.choice([1, 1, 1.5, 2])
            c = int(rng.uniform(120, 230))
            d.ellipse([x - r, y - r, x + r, y + r], fill=(c, c, min(255, c + 20)))
        glow = Image.new("L", (W, H), 0)
        gd = ImageDraw.Draw(glow)
        for i in range(30, 0, -1):
            r = int(W * 0.8 * i / 30)
            gd.ellipse([W // 2 - r, int(H * 0.55) - r, W // 2 + r, int(H * 0.55) + r], fill=int(48 * (1 - i / 30) ** 2))
        bg = Image.composite(Image.new("RGB", (W, H), RUBY), bg, glow)
        mx, my, mr = L["moon"]
        mg = Image.new("L", (W, H), 0)
        ImageDraw.Draw(mg).ellipse([mx - mr * 1.9, my - mr * 1.9, mx + mr * 1.9, my + mr * 1.9], fill=80)
        bg = Image.composite(Image.new("RGB", (W, H), (220, 214, 200)), bg, mg.filter(ImageFilter.GaussianBlur(mr * 0.7)))
        d = ImageDraw.Draw(bg)
        d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=MOON)
        for (dx, dy, r) in ((-0.3, -0.2, 0.18), (0.25, 0.1, 0.24), (-0.1, 0.4, 0.12), (0.4, -0.35, 0.1)):
            d.ellipse([mx + dx * mr - r * mr, my + dy * mr - r * mr, mx + dx * mr + r * mr, my + dy * mr + r * mr], fill=(222, 218, 206))
        hill = [(0, H)] + [(x, H - (130 + 40 * math.sin(x / W * 5.0) + 25 * math.sin(x / W * 13)) * k) for x in range(0, W + 20, 20)] + [(W, H)]
        d.polygon(hill, fill=(9, 10, 18))
        self.bg = bg
        fog = rng.uniform(0, 1, (60, 120))
        fog = Image.fromarray((fog * 255).astype(np.uint8), "L").resize((W * 2, int(300 * k) + 60), Image.BICUBIC).filter(ImageFilter.GaussianBlur(30))
        arr = np.clip(np.asarray(fog, np.float32) - 90, 0, None) * 0.5
        fh = arr.shape[0]
        g = np.clip(np.minimum(np.linspace(0, 1.8, fh), np.linspace(1.8, 0, fh)), 0, 1) ** 1.6
        self.fog = Image.fromarray((arr * g[:, None]).astype(np.uint8), "L")
        self.bats = [draw_bat(True), draw_bat(False)]
        self.ghosts = [draw_ghost(EARS[i % 3]) for i in range(5)] + [draw_ghost(EARS[1])]
        self.tags = [draw_sign(t) for t in GHOST_TAGS] + [draw_sign(LAST_TAG)]
        self.ninja = draw_ninja()
        self.shuriken = draw_shuriken()
        self.lux = [draw_lux_cat(CATS[0][0], CATS[0][1], RUBY, WHITE, "cup"),
                    draw_lux_cat(CATS[1][0], CATS[1][1], (32, 36, 46), SILVER, "shades"),
                    draw_lux_cat(CATS[2][0], CATS[2][1], SMOCK, RUBY, "lolly")]
        self.sofa_back, self.sofa_front = draw_sofa()
        self.bucket = draw_pumpkin("bucket")
        self.lantern = draw_pumpkin("chart")
        self.painter = xform(draw_capy_artist(RUBY, True), L["painter"][2])
        self.sculptor = xform(draw_capy_artist(INK, False), L["sculptor"][2])
        cw, ch = L["canvas"][2], L["canvas"][3]
        self.painting = draw_painting(cw, ch)
        self.tombs = [draw_tomb(v) for v in ("N/A", "01.01.1900", "TEST TEST")]
        self.logo = brand.logo(170 if self.tall else 130)
        self.lock = brand.lockup(L["lock"][2])
        self.sparks = {i: rng.uniform(-1, 1, (26, 3)) for i in range(8)}
        self._c = {}
        self.cap_size = {key: fit_size(v[0], W - 130, L["cap_size"]) for key, v in CAPTIONS.items()}
        self.cap_size["c6"] = fit_size(CAPTIONS["c6"][0], W - 130, int(L["cap_size"] * 1.1))

    def cache(self, key, fn):
        if key not in self._c:
            self._c[key] = fn()
        return self._c[key]

    # ---- небо, надгробки, туман
    def sky(self, f, t):
        if not (t < T_NINJA + 0.5 or t > T_FINALE):
            return
        W, H, k = self.W, self.H, self.k
        for i in range(4):
            sp = (90 + 30 * i) * k
            x = (-200 + ((t + i * 1.7) * sp * 1.4) % (W + 400)) if i % 2 == 0 else (W + 200 - ((t + i * 1.3) * sp * 1.4) % (W + 400))
            y = (self.L["cap_y"] + 380 * k + i * 70 * k) + 30 * math.sin(t * 2 + i)
            im = self.bats[int(t * 10 + i) % 2]
            if i % 2:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            put(f, xform(im, (0.45 + 0.1 * (i % 2)) * k), x, y, 0.9)

    def tombstones(self, f, t):
        if t > T_NINJA + 0.6:
            return
        W, k = self.W, self.k
        sink = ease_in((t - T_NINJA) / 0.6) * 400 * k
        for i, (fx, rot) in enumerate(((0.16, 6), (0.5, -3), (0.84, -7))):
            im = xform(self.tombs[i], 0.95 * k, rot)
            put(f, im, W * fx, self.L["tomb_y"] + sink + (30 if i == 1 else 0) * k)

    def fog_layer(self, f, t, a=1.0):
        W, k = self.W, self.k
        off = int((t * 40) % W)
        strip = self.fog.crop((off, 0, off + W, self.fog.height))
        m = strip.point(lambda v: int(v * a))
        f.paste(Image.new("RGB", strip.size, (190, 196, 214)), (0, self.L["fog_y"]), m)

    # ---- привиди
    def ghost_appear(self, i):
        return {0: T_GHOSTS + 0.15, 1: T_GHOSTS + 0.35, 2: -1.0, 3: T_GHOSTS + 0.55, 4: T_GHOSTS + 0.75}[i]

    def ghost_hit(self, i):
        return HITS[HIT_ORDER.index(i)]

    def ghost_pos(self, i, t):
        L = self.L
        y0, y1 = L["swarm"]
        gx, gy = GPOS[i]
        x = self.W * gx + 14 * math.sin(t * 1.7 + i)
        y = y0 + (y1 - y0) * gy + 18 * math.sin(t * 2.3 + i * 1.3)
        s = L["ghost"]
        if i == 2:
            bx, by, bs = L["boo"]
            bx += 10 * math.sin(t * 2.0)
            by += 14 * math.sin(t * 2.6)
            u = ease((t - T_GHOSTS) / 0.6)
            x, y, s = bx + (x - bx) * u, by + (y - by) * u, bs + (s - bs) * u
        return x, y, s

    def draw_ghost_at(self, f, i, x, y, s, t, tag=None, a=0.94):
        sg = self.tags[i if tag is None else tag]
        put(f, xform(sg, s, math.sin(t * 3 + i) * 5), x, y + (GH_H * 0.5 + 34) * s, a)
        put(f, xform(self.ghosts[i if tag is None else tag], s, math.sin(t * 2.1 + i) * 5), x, y, a)

    def ghost_scene(self, f, t):
        if t > T_NINJA_OUT + 1:
            return
        for i in range(5):
            t0, th = self.ghost_appear(i), self.ghost_hit(i)
            if t < t0 or t > th + 0.04:
                continue
            x, y, s = self.ghost_pos(i, t)
            s *= back((t - t0) / 0.35) if t0 > 0 else 1
            self.draw_ghost_at(f, i, x, y, s, t)
        if 0.35 <= t < T_GHOSTS:                                                   # «BOO!»
            b = self.cache("boo", lambda: bubble(["BOO!"], int(64 * self.k + 8), [RUBY], "left"))
            x, y, s = self.ghost_pos(2, t)
            put(f, xform(b, 0.6 + 0.4 * back((t - 0.35) / 0.25), -6), x + 200 * s, y - 230 * s,
                1 - ease((t - (T_GHOSTS - 0.15)) / 0.15))
        for i in range(5):
            th = self.ghost_hit(i)
            if 0 <= t - th < 1.0:
                x, y, s = self.ghost_pos(i, th)
                self.sparkle(f, x, y, t - th, i, GHOST_STAMPS[i])

    def sparkle(self, f, x, y, u, i, label):
        d = ImageDraw.Draw(f, "RGBA")
        k = self.k
        for n, (vx, vy, sz) in enumerate(self.sparks[i]):
            px, py = x + vx * 260 * ease(u) * k, y + vy * 220 * ease(u) * k - 120 * u * k
            r = (6 + 6 * abs(sz)) * (1 - u) * k
            col = [WHITE, (190, 214, 255), (255, 214, 120), (255, 255, 255)][n % 4]
            if r > 0.5:
                d.polygon([(px, py - r * 2), (px + r * 0.5, py - r * 0.5), (px + r * 2, py), (px + r * 0.5, py + r * 0.5),
                           (px, py + r * 2), (px - r * 0.5, py + r * 0.5), (px - r * 2, py), (px - r * 0.5, py - r * 0.5)],
                          fill=(*col, int(255 * (1 - u))))
        if u < 0.95:
            im = self.cache(("stamp", label), lambda: stamp(label, int(46 * k + 6)))
            im = xform(im, 0.6 + 0.4 * back(u / 0.22), (-8, 6, -5, 7, -6, 5, -7, 6)[i % 8])
            put(f, im, clamp(x, im.width / 2 + 20, self.W - im.width / 2 - 20), y - 40 * k, 1 - ease((u - 0.65) / 0.3))

    # ---- ніндзя
    def ninja_state(self, j, t):
        W, H, L, k = self.W, self.H, self.L, self.k
        t0 = T_NINJA + 0.15 + 0.2 * j
        if t < t0 or t > T_NINJA_OUT + 0.06:
            return None
        u = (t - t0) / 0.55
        tx, ty = W * (0.2, 0.5, 0.8)[j], L["ninja_y"]
        if u < 1:
            side = (-1, 0, 1)[j]
            x = tx + (1 - ease(u)) * side * W * 0.35
            y = (H + 300 * k) + (ty - (H + 300 * k)) * ease(u) - math.sin(math.pi * clamp(u)) * 380 * k
            rot = 360 * (1 - ease(u)) * (1 if j % 2 else -1)
        else:
            x, y, rot = tx, ty + 6 * math.sin(t * 4 + j), 0.0
            for kk, h in enumerate(HITS):
                if kk % 3 == j and 0 <= t - (h - 0.34) < 0.3:
                    rot = 10 * math.sin(math.pi * (t - (h - 0.34)) / 0.3) * (1 if tx > W / 2 else -1)
        return x, y, rot

    def ninja_scene(self, f, t):
        k, L = self.k, self.L
        s = L["ninja"]
        for j in range(3):
            st = self.ninja_state(j, t)
            if st:
                put(f, xform(self.ninja, s, st[2]), st[0], st[1])
        for kk, h in enumerate(HITS):                                              # сюрикени
            u = (t - (h - 0.3)) / 0.3
            if 0 <= u < 1:
                st = self.ninja_state(kk % 3, h - 0.3)
                gx, gy, _ = self.ghost_pos(HIT_ORDER[kk], h)
                sx, sy = st[0], st[1] - 150 * s
                put(f, xform(self.shuriken, 0.8 * k, (t * 1400) % 360), sx + (gx - sx) * u, sy + (gy - sy) * u)
        if T_NINJA_OUT <= t < T_NINJA_OUT + 0.7:                                    # зникають у диму
            d = ImageDraw.Draw(f, "RGBA")
            u = (t - T_NINJA_OUT) / 0.7
            for j in range(3):
                x, y = self.W * (0.2, 0.5, 0.8)[j], L["ninja_y"]
                for n in range(9):
                    a = n / 9 * math.tau + j
                    r = (60 + 40 * (n % 3)) * k * (0.6 + 0.6 * ease(u))
                    px, py = x + math.cos(a) * r * 1.1, y - 60 * k + math.sin(a) * r * 0.8 - 60 * u * k
                    rr = (70 + 20 * (n % 2)) * k * (0.7 + 0.5 * ease(u))
                    d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=(150, 156, 172, int(200 * (1 - u))))

    # ---- котики-гедоністи
    def cat_scene(self, f, t):
        if t < T_CATS - 0.05 or t > T_ART + 0.1:
            return
        W, H, L, k = self.W, self.H, self.L, self.k
        dy = (1 - ease((t - T_CATS) / 0.45)) * H * 0.6 + ease_in((t - (T_ART - 0.45)) / 0.5) * H * 0.7
        ss, cs = L["sofa"], L["cat"]
        sy = L["sofa_y"] + dy
        put(f, xform(self.sofa_back, ss), W / 2, sy)
        for j, fx in enumerate((0.28, 0.5, 0.72)):
            bob = 6 * math.sin(t * 2.2 + j * 1.4)
            put(f, xform(self.lux[j], cs * (1 + 0.015 * math.sin(t * 3 + j)), 3 * math.sin(t * 1.5 + j)), W * fx, L["cat_y"] + dy + bob)
        put(f, xform(self.sofa_front, ss), W / 2, sy)
        put(f, xform(self.bucket, 0.8 * k), W * 0.12, sy + 150 * ss)
        d = ImageDraw.Draw(f, "RGBA")
        for n in range(6):                                                        # сердечка над диваном
            u = ((t - T_CATS) * 0.45 + n / 6) % 1
            x = W * (0.25 + 0.1 * n) + 20 * math.sin(t * 2 + n)
            y = L["cat_y"] + dy - 230 * k - u * 260 * k
            r = 13 * k
            a = int(220 * math.sin(math.pi * u))
            d.ellipse([x - r * 2, y - r, x, y + r], fill=(*RUBY, a))
            d.ellipse([x, y - r, x + r * 2, y + r], fill=(*RUBY, a))
            d.polygon([(x - r * 1.9, y + r * 0.35), (x + r * 1.9, y + r * 0.35), (x, y + r * 2.4)], fill=(*RUBY, a))
        b = clamp((t - T_CAT_BUBBLE) / 0.3) * (1 - clamp((t - (T_ART - 0.65)) / 0.15))
        if b > 0:
            im = self.cache("catb", lambda: bubble(["We only consume", "clean data.", "And candy."], int(46 * k + 6), [INK, INK, RUBY], "mid"))
            put(f, xform(im, 0.7 + 0.3 * back(b)), W / 2, L["cat_bubble_y"] + im.height / 2 + dy, b)

    # ---- капібари-митці
    def art_scene(self, f, t):
        if t < T_ART - 0.05 or t > T_FINALE + 0.7:
            return
        W, H, L, k = self.W, self.H, self.L, self.k
        enter = ease((t - T_ART) / 0.5)
        leave = ease_in((t - T_FINALE) / 0.6) * H * 0.8
        fx, cy0, cw, ch = L["canvas"]
        cx0 = W * fx - cw / 2 + (1 - enter) * W * 0.9
        cy = cy0 + leave
        d = ImageDraw.Draw(f, "RGBA")
        for (x0, x1) in ((cx0 + cw * 0.18, cx0 + cw * 0.05), (cx0 + cw * 0.82, cx0 + cw * 0.95), (cx0 + cw * 0.5, cx0 + cw * 0.5)):
            d.line([x0, cy - 40 * k, x1, cy + ch + 420 * k], fill=WOOD, width=int(16 * k))
        d.rectangle([cx0 - 20 * k, cy + ch + 4, cx0 + cw + 20 * k, cy + ch + 26 * k], fill=WOOD)
        d.rectangle([cx0 - 8, cy - 8, cx0 + cw + 8, cy + ch + 8], fill=(200, 160, 80))  # рама
        d.rectangle([cx0, cy, cx0 + cw, cy + ch], fill=(250, 246, 236))
        p = clamp((t - T_PAINT0) / (T_PAINT1 - T_PAINT0))
        if p > 0:
            mask = Image.new("L", (cw, ch), 0)
            md = ImageDraw.Draw(mask)
            edge = cw * p
            md.polygon([(0, 0), (edge + 20 * math.sin(0), 0)] + [(edge + 22 * math.sin(yy / 18 + t * 9), yy) for yy in range(0, ch + 1, 12)] + [(0, ch)], fill=255)
            f.paste(self.painting.convert("RGB"), (int(cx0), int(cy)), mask)
        # художник зліва, пензель до полотна
        px, pb, ps = L["painter"]
        pw, ph = self.painter.size
        pxc = W * px - (1 - enter) * W * 0.8
        pyc = pb - ph / 2 + leave + 5 * math.sin(t * 2.4)
        paw = (pxc + (CAPY_PAW[0] - CAPY_W / 2) * ps, pyc + (CAPY_PAW[1] - CAPY_H / 2) * ps)
        if p < 1 and t >= T_PAINT0:
            tip = (cx0 + cw * p, cy + ch * (0.5 + 0.38 * math.sin(t * 15)))
        else:
            tip = (cx0 - 30 * k, cy + ch * 0.75)
        d = ImageDraw.Draw(f, "RGBA")
        d.line([paw[0], paw[1], tip[0], tip[1]], fill=WOOD, width=int(10 * k))
        d.ellipse([tip[0] - 12 * k, tip[1] - 12 * k, tip[0] + 12 * k, tip[1] + 12 * k], fill=RUBY)
        put(f, self.painter, pxc, pyc)
        # скульптор праворуч із гарбузом-діаграмою
        sx, sb, s2 = L["sculptor"]
        sw, sh = self.sculptor.size
        sxc = W * sx
        syc = sb - sh / 2 + leave + (1 - enter) * H * 0.4 + 5 * math.sin(t * 2.0 + 1)
        put(f, self.sculptor, sxc, syc)
        top = syc - sh / 2
        lx = sxc + (210 if self.tall else -175) * s2 / 0.5
        put(f, xform(self.lantern, 1.1 if self.tall else 0.8, 6 * math.sin(t * 2.5)), lx, top + 230 * s2 / 0.5)
        # табличка й «Voilà.»
        a = clamp((t - T_PAINT1) / 0.3)
        if a > 0:
            def plaque():
                f1, f2 = brand.font("head", int(30 * k + 4)), brand.font("body-semi", int(24 * k + 4))
                l1, l2 = "CLEAN REGISTER, 2026", "Oil on canvas"
                probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
                w = int(max(probe.textlength(l1, font=f1), probe.textlength(l2, font=f2))) + 40
                im = Image.new("RGBA", (w, int(96 * k + 16)), (0, 0, 0, 0))
                dd = ImageDraw.Draw(im)
                dd.rounded_rectangle([0, 0, w - 1, im.height - 1], 8, fill=WHITE, outline=(200, 160, 80), width=3)
                dd.text((20, 10), l1, font=f1, fill=INK)
                dd.text((20, 14 + f1.size * 1.15), l2, font=f2, fill=(90, 96, 110))
                return im
            im = self.cache("plaque", plaque)
            put(f, im, cx0 + cw / 2, cy + ch + 60 * k + im.height / 2, a)
        b = clamp((t - (T_PAINT1 + 0.3)) / 0.25)
        if b > 0 and t < T_FINALE:
            im = self.cache("voila", lambda: bubble(["Voilà."], int(50 * k + 8), [RUBY], "left"))
            put(f, xform(im, 0.7 + 0.3 * back(b)), pxc + 120 * k + im.width / 2, pyc - ph / 2 + 40 * k, b)

    # ---- фінал
    def finale(self, f, t):
        if t < T_FINALE:
            return
        L, k, W, H = self.L, self.k, self.W, self.H
        u = t - T_FINALE
        cap = self.cache(("cap", "c6"), lambda: text_block(CAPTIONS["c6"][0], self.cap_size["c6"], CAPTIONS["c6"][1]))
        y = L["end_y"] + cap.height + 30 * k
        if u > 0.5:
            put(f, xform(self.logo, 0.7 + 0.3 * back((u - 0.5) / 0.4)), W / 2, y + self.logo.height / 2, clamp((u - 0.5) * 4))
        if u > 0.9:
            def endline():
                f1 = brand.font("head", 54 if self.tall else 44)
                f2 = brand.font("body-semi", 38 if self.tall else 32)
                im = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
                d = ImageDraw.Draw(im)
                l1, l2 = "Happy Halloween", "belyakovconsult.com"
                d.text(((W - d.textlength(l1, font=f1)) / 2, 0), l1, font=f1, fill=PUMPKIN)
                d.text(((W - d.textlength(l2, font=f2)) / 2, 80 if self.tall else 66), l2, font=f2, fill=SILVER)
                return im
            im = self.cache("endline", endline)
            put(f, im, W / 2, y + self.logo.height + 40 * k + im.height / 2, clamp((u - 0.9) * 3))
        gy = L["gag_y"]
        speed = 260 * (1 if self.tall else 0.95)
        xz = -160 + (FINAL_HIT - T_SNEAK) * speed
        s = L["ghost"] * 0.85
        if T_SNEAK <= t < FINAL_HIT + 0.05:
            v = t - T_SNEAK
            self.draw_ghost_at(f, 5, -160 + v * speed, gy - abs(math.sin(v * 6)) * 16 * k, s, t, tag=5)
        if T_PEEK <= t < FINAL_HIT + 1.0:
            v = t - T_PEEK
            rise = back(v / 0.35) - ease_in((t - (FINAL_HIT + 0.55)) / 0.4)
            ns = L["ninja"] * 0.9
            ground = L["ground"]
            cx = W - (290 if self.tall else 170) * k
            cy = ground + NJ_H * ns * 0.5 - NJ_H * ns * 0.6 * rise
            im = xform(self.ninja, ns, -6)
            top = int(cy - im.height / 2)
            if ground - top > 0:
                part = im.crop((0, 0, im.width, min(im.height, ground - top)))
                f.paste(part, (int(cx - im.width / 2), top), part)
            if ground < H:
                la = clamp(min(v / 0.2, (FINAL_HIT + 1.0 - t) / 0.2))
                ImageDraw.Draw(f, "RGBA").line([cx - 250 * k, ground, cx + 250 * k, ground], fill=(*PANEL_LINE, int(255 * la)), width=4)
            uu = (t - (FINAL_HIT - 0.3)) / 0.3
            if 0 <= uu < 1:
                sx, sy = cx - 60 * k, cy - 120 * k
                put(f, xform(self.shuriken, 0.8 * k, (t * 1400) % 360), sx + (xz - sx) * uu, sy + (gy - sy) * uu)
        if 0 <= t - FINAL_HIT < 1.0:
            self.sparkle(f, xz, gy, t - FINAL_HIT, 7, LAST_STAMP)

    # ---- тексти
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
            y = L["end_y"] if key == "c6" else L["cap_y"]
            put(f, xform(im, s, math.sin(t * 3) * 0.8), W / 2, y + im.height / 2, min(1, (t - t0) * 7 if t0 >= 0 else 1) * (1 - kout))
        if HITS[0] - 0.05 <= t < T_NINJA_OUT + 0.25:
            n = sum(1 for h in HITS if t >= h + 0.05)
            last = max([h for h in HITS if t >= h + 0.05], default=HITS[0])
            lab = self.cache("hud-lab", lambda: text_block(["GHOSTS RESOLVED"], int(40 * k + 6), [SILVER], 6))
            num = self.cache(("hud", n), lambda: text_block([f"{n}/5"], int(150 * k), [WHITE if n < 5 else RUBY], 10))
            y = L["cap_y"]
            put(f, lab, W / 2, y + lab.height / 2)
            put(f, xform(num, 1 + 0.25 * (1 - back((t - last - 0.05) / 0.25)) if n else 1), W / 2, y + lab.height + num.height / 2 - 6)

    def post_fx(self, f, t):
        hits = HITS + [FINAL_HIT]
        shake = 0
        for z in hits:
            if 0 <= t - z < 0.16:
                shake = int(8 * (1 - (t - z) / 0.16))
        if shake:
            sx = shake * (1 if int(t * 60) % 2 else -1)
            f = f.transform(f.size, Image.AFFINE, (1, 0, sx, 0, 1, shake // 2), resample=Image.BILINEAR, fillcolor=GRAPHITE)
        if any(0 <= t - z < 0.06 for z in hits):
            f = Image.blend(f, Image.new("RGB", f.size, (200, 220, 255)), 0.07)
        return f

    def frame(self, t):
        f = self.bg.copy()
        self.sky(f, t)
        self.tombstones(f, t)
        self.fog_layer(f, t, 1.0 if t < T_NINJA + 0.6 or t > T_FINALE else 0.5)
        self.ghost_scene(f, t)
        self.ninja_scene(f, t)
        self.cat_scene(f, t)
        self.art_scene(f, t)
        self.finale(f, t)
        self.texts(f, t)
        return self.post_fx(f, t)

    # ---- обкладинка
    def poster(self):
        L, k, W, H = self.L, self.k, self.W, self.H
        f = self.bg.copy()
        self.fog_layer(f, 0.0)
        title = text_block(["YOUR REGISTER", "IS HAUNTED."], fit_size(["YOUR REGISTER"], W - 110, 170 if self.tall else 140), [WHITE, RUBY], 10)
        ty = 300 if self.tall else 70
        put(f, title, W / 2, ty + title.height / 2)
        kick_ = ty + title.height
        hw = self.cache("hw", lambda: text_block(["HAPPY HALLOWEEN"], int(54 * k + 6), [PUMPKIN], 7))
        put(f, hw, W / 2, kick_ + hw.height / 2 - 6)
        gy = kick_ + hw.height + (250 if self.tall else 130) * k
        gs = L["ghost"] * (1.25 if self.tall else 1.1)
        self.draw_ghost_at(f, 2, W * 0.5, gy, gs, 0.3)
        self.draw_ghost_at(f, 0, W * 0.16, gy + 40 * k, L["ghost"] * 0.8, 0.9)
        self.draw_ghost_at(f, 3, W * 0.84, gy - 10 * k, L["ghost"] * 0.8, 1.7)
        b = bubble(["BOO!"], int(64 * k + 8), [RUBY], "left")
        put(f, xform(b, 1 if self.tall else 0.85, -6), W * 0.5 + 255 * gs, gy - (140 if self.tall else 30) * gs)
        base = 1600 if self.tall else H - 40
        put(f, xform(self.lux[1], L["cat"] * 1.05, 4), W * 0.8, base - LUX_H * L["cat"] * 0.42)
        put(f, xform(self.ninja, L["ninja"] * 0.95, -8), W * 0.2, base - NJ_H * L["ninja"] * 0.4)
        put(f, xform(self.shuriken, 0.8 * k, 20), W * 0.34, base - NJ_H * L["ninja"] * 1.05)
        ps = 0.5 if self.tall else 0.36
        cap = xform(draw_capy_artist(RUBY, False), ps)
        put(f, cap, W * 0.5, base - CAPY_H * ps * 0.12)
        put(f, xform(self.lantern, 1.0 * k), W * 0.5, base + 90 * k)
        lx, ly, _ = L["lock"]
        put(f, self.lock, lx + self.lock.width / 2, ly + self.lock.height / 2, 0.9)
        return f


# ---------------------------------------------------------------- звук
def smooth(x, w):
    w = max(1, int(w))
    xp = np.pad(x, (w, w), mode="edge")
    return np.convolve(xp, np.ones(w) / w, mode="same")[w:-w]


def bell(f0=110, dur=3.0):
    t = _t(int(SR * dur))
    parts = [(0.5, 0.6, 1.0), (1.0, 1.0, 1.6), (1.19, 0.5, 2.2), (1.56, 0.4, 2.8), (2.0, 0.5, 3.2), (2.51, 0.25, 4.2), (3.01, 0.2, 5.0)]
    x = sum(a * np.sin(2 * np.pi * f0 * r * t) * np.exp(-t * dd) for r, a, dd in parts)
    return x * env(len(t), 0.002, 0.3) * 0.5


def organ(notes, dur):
    t = _t(int(SR * dur))
    x = sum(np.sin(2 * np.pi * midi(m) * t) + 0.5 * np.sin(4 * np.pi * midi(m) * t) + 0.25 * np.sin(6 * np.pi * midi(m) * t) for m in notes)
    return x * (1 + 0.18 * np.sin(2 * np.pi * 5.5 * t)) * env(len(t), 0.25, 0.4) / len(notes)


def theremin(notes, step):
    n = int(SR * step * len(notes))
    f = np.zeros(n)
    for i, m in enumerate(notes):
        f[int(i * step * SR):int((i + 1) * step * SR)] = midi(m)
    f = smooth(f, 0.07 * SR)
    t = _t(n)
    f *= 1 + 0.013 * np.sin(2 * np.pi * 6 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.12 * np.sin(2 * ph)) * env(n, 0.1, 0.25)


def sfx_woo(dur=0.9):
    t = _t(int(SR * dur))
    f = 420 + 260 * np.sin(np.pi * t / dur) + 18 * np.sin(2 * np.pi * 7 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur) ** 1.5 * 0.5


def sfx_shing(dur=0.35, seed=7):
    t = _t(int(SR * dur))
    x = sum(np.sin(2 * np.pi * fr * t) * np.exp(-t * dd) for fr, dd in ((3200, 9), (4100, 11), (5300, 14)))
    return (x * 0.22 + lp(hp(noise(len(t), seed)), 2) * np.exp(-t * 30) * 0.5) * env(len(t), 0.002, 0.03)


def sfx_sparkle(seed=0):
    rng = np.random.default_rng(seed)
    n = int(0.45 * SR)
    x = np.zeros(n)
    for _ in range(7):
        a = int(rng.uniform(0, 0.3) * SR)
        m = int(0.12 * SR)
        tt = _t(m)
        x[a:a + m] += np.sin(2 * np.pi * rng.uniform(2200, 4200) * tt) * np.exp(-tt * 30) * 0.3
    return x


def sfx_purr(dur=1.3, seed=8):
    t = _t(int(SR * dur))
    return lp(noise(len(t), seed), 40) * (0.5 + 0.5 * np.sin(2 * np.pi * 24 * t)) * np.sin(np.pi * t / dur) * 3.0


def sfx_swish(seed=9):
    t = _t(int(SR * 0.22))
    return lp(noise(len(t), seed), 4) * np.sin(np.pi * t / 0.22) ** 2 * 0.8


def sfx_puff(seed=10):
    t = _t(int(SR * 0.5))
    return lp(noise(len(t), seed), 20) * np.exp(-t * 7) * env(len(t), 0.005, 0.05) * 2.2


def soundtrack(path: Path):
    m = Mix(TOTAL)
    # 1. Північ: дзвін, орган ре мінор, терменвокс
    m.put(bell(110), 0.0, 0.9)
    m.put(organ([50, 53, 57, 62], T_NINJA + 0.2), 0.0, 0.32)
    m.put(theremin([69, 74, 77, 76, 74, 73, 74, 69, 70, 69], 0.42), 0.25, 0.16)
    for i in range(int(T_NINJA / 0.5)):
        m.put(tri(midi(38), 0.18), i * 0.5, 0.45)
    # 2. Ніндзя: мінорний груві 140 уд/хв, рифи пентатоніки
    beat = 60 / 140
    t0 = T_NINJA
    bass = [38, 38, 41, 43, 46, 45, 43, 41]
    riff = [(74, 1), (77, 1), (79, 1), (81, 1), (84, 2), (81, 1), (79, 1), (77, 2), (74, 1), (77, 1), (79, 2), (77, 1), (74, 1),
            (74, 1), (77, 1), (79, 1), (81, 1), (86, 2), (84, 1), (81, 1), (79, 2), (77, 1), (79, 1), (74, 4)]
    nb = int((T_NINJA_OUT + 0.3 - t0) / beat)
    for b in range(nb):
        at = t0 + b * beat
        m.put(kick() * env(int(0.32 * SR), 0.001, 0.03), at, 0.85 if b % 2 == 0 else 0.5)
        if b % 2 == 1:
            m.put(snare(b), at, 0.45)
        for e in range(2):
            m.put(hat(b * 2 + e), at + e * beat / 2, 0.16 if e == 0 else 0.1)
            m.put(tri(midi(bass[(b * 2 + e) % 8]), beat / 2 * 0.85), at + e * beat / 2, 0.55)
    at = t0 + beat * 2
    for note, eighths in riff:
        dur = eighths * beat / 2
        if at + dur > T_NINJA_OUT + 0.3:
            break
        m.put(sq(midi(note - 12), dur * 0.9, decay=2.0), at, 0.11)
        at += dur
    m.put(crash(2), T_NINJA, 0.22)
    # 3. Лаунж котиків
    lb = 60 / 90
    l0 = T_CATS + 0.3
    walk = [38, 41, 45, 48, 43, 47, 50, 41, 36, 40, 43, 47, 45, 49, 52, 43]
    for i, note in enumerate(walk):
        at = l0 + i * lb
        if at < T_ART - 0.1:
            m.put(tri(midi(note), lb * 0.95), at, 0.6)
            m.put(brush(i), at, 0.1 if i % 2 == 0 else 0.16)
    for at, notes in ((l0, [62, 65, 69, 72]), (l0 + 2 * lb, [59, 62, 65, 67]), (l0 + 4 * lb, [60, 64, 67, 71]), (l0 + 6 * lb, [61, 64, 67, 70])):
        for d0, dur in ((0.0, lb * 1.4), (lb * 5 / 3, lb * 0.5)):
            if at + d0 < T_ART - 0.15:
                for note in notes:
                    m.put(epiano(midi(note), dur), at + d0, 0.06)
    # 4. Вальс митців (клавесин)
    wb = 0.4
    w0 = T_ART + 0.2
    for bar, (root, chord) in enumerate(((41, [65, 69, 72]), (36, [64, 67, 72]), (38, [65, 69, 74]), (46, [65, 70, 74]))):
        for beat_i in range(3):
            at = w0 + (bar * 3 + beat_i) * wb
            if at >= T_FINALE - 0.1:
                break
            if beat_i == 0:
                m.put(tri(midi(root), wb * 0.9), at, 0.85)
            else:
                for note in chord:
                    m.put(sq(midi(note), 0.18, decay=14), at, 0.085)
        for j, note in enumerate(chord + [chord[0] + 12]):
            at = w0 + bar * 3 * wb + j * wb * 0.75
            if at < T_FINALE - 0.1:
                m.put(sq(midi(note + 12), 0.16, decay=16), at, 0.075)
    # 5. Фінал: удар, орган, «крадькома», дзвін
    m.put(crash(3), T_FINALE, 0.26)
    m.put(kick(), T_FINALE, 0.9)
    m.put(organ([50, 53, 57, 62], FINAL_HIT - T_FINALE), T_FINALE, 0.38)
    for i, note in enumerate([38, 41, 42, 43, 46, 45, 43, 41, 38, 41, 42, 43]):
        at = T_SNEAK + i * 0.21
        if at < FINAL_HIT - 0.05:
            m.put(tri(midi(note + 12), 0.08), at, 0.85)
    m.put(crash(4), FINAL_HIT, 0.28)
    m.put(kick(), FINAL_HIT, 0.9)
    for note in (50, 57, 62, 65, 69):
        m.put(sq(midi(note), 0.9, decay=2.4), FINAL_HIT + 0.02, 0.075)
    m.put(bell(110, 1.0), FINAL_HIT + 0.05, 0.6)
    music = m.x / max(1e-9, np.abs(m.x).max()) * 0.62

    fx = Mix(TOTAL)
    fx.put(sfx_woo(1.0), 0.3, 0.7)
    for i, a in enumerate((T_GHOSTS + 0.15, T_GHOSTS + 0.35, T_GHOSTS + 0.55, T_GHOSTS + 0.75)):
        fx.put(sfx_woo(0.7) * (1 + 0.1 * i), a, 0.35)
    for j in range(3):
        fx.put(sfx_whoosh(0.5, 20 + j), T_NINJA + 0.15 + 0.2 * j, 0.45)
        fx.put(kick(), T_NINJA + 0.68 + 0.2 * j, 0.35)
    for i, h in enumerate(HITS):
        fx.put(sfx_shing(seed=30 + i), h - 0.3, 0.5)
        fx.put(sfx_pop(0.24, 40 + i), h, 0.5)
        fx.put(sfx_sparkle(i), h + 0.02, 0.6)
    fx.put(sfx_ding(1568, 0.8), T_DONE, 0.35)
    fx.put(sfx_puff(), T_NINJA_OUT, 0.6)
    fx.put(sfx_scratch(), T_CATS - 0.02, 0.7)
    fx.put(sfx_purr(), T_CAT_BUBBLE - 0.1, 0.55)
    fx.put(sfx_ding(), T_CAT_BUBBLE, 0.35)
    for i in range(4):
        fx.put(sfx_swish(50 + i), T_PAINT0 + i * 0.36, 0.45)
    fx.put(sfx_ding(1760, 0.8), T_PAINT1 + 0.3, 0.4)
    fx.put(sfx_whoosh(0.5, 60), T_FINALE - 0.1, 0.35)
    fx.put(sfx_woo(0.8), T_SNEAK, 0.3)
    fx.put(sfx_shing(seed=70), FINAL_HIT - 0.3, 0.55)
    fx.put(sfx_pop(0.24, 71), FINAL_HIT, 0.55)
    fx.put(sfx_sparkle(9), FINAL_HIT + 0.02, 0.6)
    sfx = fx.x / max(1e-9, np.abs(fx.x).max()) * 0.8

    n = int(TOTAL * SR)
    mix = (music * 0.8 + sfx * 0.7)[:n]
    mix[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))
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
    wav = out_dir / "halloween.wav"
    if not wav.exists():
        soundtrack(wav)
    v = Halloween(W, H)
    v.poster().save(out_dir / f"halloween-{fmt}-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / f"halloween-{fmt}.mp4"
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
    (out / "halloween.wav").unlink(missing_ok=True)
