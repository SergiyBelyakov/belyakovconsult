"""Піксель-арт фан-тригер «Check before you delete» (22 с, англійською, 9:16).

Власні персонажі, намальовані кодом на низькій роздільності (180×320, кожен піксель 6×6):
  • Dupe Muncher: рубіновий робот-пилосос із фронтальною щілиною-пащею, LED-очима й антеною; їде ребрами
    графа і з'їдає вузли-сміття (NULL, TEST, N/A, DUP), рахунок як в аркаді;
  • капібара-аналітик і два коти з лупами: перевіряють вузли, ставлять ✓ або ✗.
Сюжет: граф із вузлами-сміттям → робот їсть сміття → розганяється на справжній вузол REAL → капібара
з табличкою CHECK FIRST! → команда з лупами перевіряє все → робот доїдає лише підтверджене сміття →
«CLEAN DATA IS NOT LESS DATA. CHECK BEFORE YOU DELETE.» → фінал «HIGH SCORE: 0 REAL RECORDS LOST».
Логотип і лок-ап поверх у повній роздільності (бренд не пікселізується). Звук: чиптюн і 8-бітні ефекти.

Запуск: python scripts/make_pixel.py <папка>
"""
from __future__ import annotations

import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
from make_fun import SR, Mix, crash, groove, hat, kick, melody, midi, sq, tri  # noqa: E402

W, H = 1080, 1920
LW, LH, PX = 180, 320, 6
FPS = 30
TOTAL = 22.0
BEAT = 60 / 140
S = [0.0, 2.8, 8.2, 10.4, 15.2, 18.6]   # hook, muncher, wait, audit, takeaway, end

# палітра (бренд + кілька відтінків для персонажів)
BG, BG2 = (12, 15, 21), (17, 21, 29)
RUBY, RUBY_D, RUBY_L = brand.RUBY, (140, 0, 26), (255, 96, 118)
WHITE, SILVER, STEEL, DARK = (240, 242, 246), (170, 178, 192), (92, 102, 120), (6, 8, 12)
GREY, GREY_D = (110, 116, 128), (70, 75, 86)
CAP, CAP_D, CAP_L = (164, 118, 78), (120, 84, 54), (196, 150, 104)
CAT1, CAT1_D = (238, 240, 244), (196, 200, 210)
CAT2, CAT2_D = (240, 150, 70), (200, 110, 44)
GLASS = (150, 200, 230)
PINKN = (255, 160, 170)

# ---------------------------------------------------------------- піксельний шрифт 5×7
FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10011", "10101", "10101", "10101", "11001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
    "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
    "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
    ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
    "\"": ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
    "@": ["00000", "00001", "00011", "10110", "11100", "01000", "00000"],   # ✓
    "%": ["00000", "10001", "01010", "00100", "01010", "10001", "00000"],   # ✗
    " ": ["00000"] * 7,
}


def text_w(s, k=1):
    return (len(s) * 6 - 1) * k


def ptext(img, s, x, y, col, k=1, shadow=True):
    """Піксельний текст на низькій роздільності; k — ціле збільшення, з тінню на 1 піксель."""
    d = ImageDraw.Draw(img)
    for pass_, c in (((1, 1), DARK), ((0, 0), col)) if shadow else (((0, 0), col),):
        cx = x
        for ch in s.upper():
            g = FONT.get(ch, FONT[" "])
            for r, row in enumerate(g):
                for cc, v in enumerate(row):
                    if v == "1":
                        px, py = cx + cc * k + pass_[0] * k, y + r * k + pass_[1] * k
                        d.rectangle([px, py, px + k - 1, py + k - 1], fill=c)
            cx += 6 * k


def ptext_c(img, s, cy, col, k=1, cx=LW // 2):
    ptext(img, s, int(cx - text_w(s, k) / 2), cy, col, k)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def pop(x):
    """Аркадний «стрибок» масштабу: 0 → 1.25 → 1."""
    x = clamp(x)
    return 1.25 * math.sin(x * math.pi * 0.75) / math.sin(math.pi * 0.75) if x < 1 else 1.0


# ---------------------------------------------------------------- персонажі
def muncher(img, x, y, t, mouth=0.0, face=1, sweat=False):
    """Dupe Muncher: рубіновий робот-пилосос (вигляд збоку), x,y — низ центру. mouth 0..1 — щілина-паща."""
    d = ImageDraw.Draw(img)
    x, y = int(x), int(y)
    bob = int(round(math.sin(t * 18) * 0.6))
    y += bob
    # колеса з «спицями», що крутяться
    for wx in (x - 8, x + 8):
        d.rectangle([wx - 3, y - 5, wx + 3, y], fill=DARK)
        sp = int(t * 20) % 2
        d.point((wx - 1 + sp * 2, y - 3), fill=STEEL)
    # корпус
    d.rectangle([x - 13, y - 17, x + 13, y - 5], fill=RUBY)
    d.rectangle([x - 12, y - 18, x + 12, y - 18], fill=RUBY)
    d.rectangle([x - 11, y - 17, x + 11, y - 16], fill=RUBY_L)          # відблиск угорі
    d.rectangle([x - 13, y - 7, x + 13, y - 5], fill=RUBY_D)
    d.rectangle([x - 12, y - 11, x + 12, y - 10], fill=SILVER)          # срібна смуга
    # фронтальна щілина-паща з «щетиною»
    fx = x + 13 * face
    h = int(round(1 + mouth * 5))
    my = y - 8
    x0, x1 = (fx - 5, fx) if face > 0 else (fx, fx + 5)
    d.rectangle([x0, my - h // 2 - 1, x1, my + (h + 1) // 2], fill=DARK)
    for k in range(x0, x1 + 1, 2):
        d.point((k, my - h // 2 - 1), fill=WHITE)
        d.point((k, my + (h + 1) // 2), fill=WHITE)
    # LED-очі
    ex = x + 3 * face
    blink = (t % 3.1) < 0.08
    for dx in (0, 6 * face):
        if blink:
            d.rectangle([ex + dx - 1, y - 14, ex + dx + 1, y - 14], fill=WHITE)
        else:
            d.rectangle([ex + dx - 1, y - 15, ex + dx + 1, y - 13], fill=WHITE)
            d.point((ex + dx + face, y - 14), fill=DARK)
    # антена з вогником
    d.line([x - 6 * face, y - 19, x - 8 * face, y - 24], fill=SILVER)
    d.rectangle([x - 9 * face - 1, y - 26, x - 9 * face + 1, y - 24], fill=RUBY_L if int(t * 4) % 2 else WHITE)
    if sweat:
        d.rectangle([x - 15 * face, y - 22, x - 14 * face, y - 20], fill=GLASS)
        d.point((x - 15 * face if face > 0 else x + 14, y - 23), fill=GLASS)


def sign(img, text, x, y):
    """Табличка на держаку (у масштабі світу, щоб уміщалася в кадр): x — центр, y — низ держака."""
    d = ImageDraw.Draw(img)
    w = text_w(text) + 8
    x = int(clamp(x, w / 2 + 3, LW - w / 2 - 3))
    d.line([x, y, x, y - 14], fill=CAP_D, width=2)
    d.rectangle([x - w // 2, y - 27, x + w // 2, y - 13], fill=WHITE, outline=RUBY)
    d.rectangle([x - w // 2 + 1, y - 26, x + w // 2 - 1, y - 26], fill=(255, 255, 255))
    ptext(img, text, x - w // 2 + 4, y - 24, RUBY, 1, shadow=False)


def magnifier(d, x, y, r=4, flip=1):
    d.line([x - (r + 1) * flip, y + r + 1, x - (r + 4) * flip, y + r + 4], fill=CAP_D, width=2)
    d.ellipse([x - r, y - r, x + r, y + r], fill=GLASS, outline=SILVER)
    d.point((x - 1, y - 2), fill=WHITE)


def capybara(img, x, y, t, walk=True, face=-1, sign=None, glass=True):
    """Капібара-аналітик (вигляд збоку). x,y — низ центру; face=-1 дивиться ліворуч."""
    d = ImageDraw.Draw(img)
    x, y = int(x), int(y)
    ph = int(t * 8) % 2 if walk else 0
    f = face
    # ноги
    for k, lx in enumerate((x - 9, x - 4, x + 5, x + 10)):
        up = 1 if (k + ph) % 2 and walk else 0
        d.rectangle([lx - 1, y - 4 - up, lx + 1, y - up], fill=CAP_D)
    # тулуб
    d.rounded_rectangle([x - 14, y - 17, x + 14, y - 4], 4, fill=CAP)
    d.rectangle([x - 12, y - 16, x + 10, y - 15], fill=CAP_L)
    # голова (з боку face)
    hx = x + 13 * f
    d.rounded_rectangle([min(hx, hx + 11 * f), y - 22, max(hx, hx + 11 * f), y - 11], 3, fill=CAP)
    d.rectangle([min(hx + 8 * f, hx + 12 * f), y - 18, max(hx + 8 * f, hx + 12 * f), y - 12], fill=CAP_D)   # морда
    d.point((hx + 11 * f, y - 17), fill=DARK)                                                             # ніздря
    d.rectangle([hx + 4 * f - 1, y - 20, hx + 4 * f, y - 19], fill=DARK)                                  # око
    d.rectangle([hx + 1 * f - 1, y - 24, hx + 1 * f, y - 22], fill=CAP_D)                                 # вухо
    # мандаринка на голові (фірмова деталь серії)
    d.ellipse([hx + 2 * f - 3, y - 29, hx + 2 * f + 3, y - 23], fill=(255, 150, 30))
    d.point((hx + 2 * f, y - 30), fill=(88, 170, 84))
    if glass:
        magnifier(d, hx + 16 * f, y - 16, 4, f)
    if sign:
        w = text_w(sign) + 6
        sx = x - w // 2
        d.line([x, y - 26, x, y - 34], fill=CAP_D, width=2)
        d.rectangle([sx, y - 46, sx + w, y - 34], fill=WHITE, outline=RUBY)
        ptext(img, sign, sx + 3, y - 44, RUBY, 1, shadow=False)


def cat(img, x, y, t, fur, fur_d, walk=True, face=1, glass=True):
    d = ImageDraw.Draw(img)
    x, y = int(x), int(y)
    ph = int(t * 10) % 2 if walk else 0
    f = face
    for k, lx in enumerate((x - 6, x - 2, x + 3, x + 7)):
        up = 1 if (k + ph) % 2 and walk else 0
        d.rectangle([lx, y - 3 - up, lx + 1, y - up], fill=fur_d)
    d.rounded_rectangle([x - 8, y - 11, x + 8, y - 3], 3, fill=fur)
    hx = x + 8 * f
    d.rectangle([min(hx, hx + 7 * f), y - 16, max(hx, hx + 7 * f), y - 9], fill=fur)
    for ex in (hx + 1 * f, hx + 6 * f):                                # вуха
        d.polygon([(ex - 1, y - 16), (ex + 1, y - 16), (ex, y - 19)], fill=fur)
    d.point((hx + 3 * f, y - 13), fill=DARK)
    d.point((hx + 6 * f, y - 13), fill=DARK)
    d.point((hx + 5 * f, y - 11), fill=PINKN)
    tail = int(round(math.sin(t * 6) * 2))
    tx = x - 8 * f
    d.line([tx, y - 8, tx - 3 * f, y - 13 + tail, tx - 2 * f, y - 17 + tail], fill=fur_d, width=2)
    if glass:
        magnifier(d, hx + 11 * f, y - 10, 3, f)


def big(img, fn, x, y, *args, **kw):
    """Персонаж удвічі крупніший за світ (піксель 12×12): малюємо на малому полотні й збільшуємо без згладжування."""
    tmp = Image.new("RGBA", (100, 90), (0, 0, 0, 0))
    fn(tmp, 50, 80, *args, **kw)
    tmp = tmp.resize((200, 180), Image.NEAREST)
    img.paste(tmp, (int(x - 100), int(y - 160)), tmp)


# ---------------------------------------------------------------- граф
NODES = [  # (x, y, тип, мітка) на полотні 180×320
    (26, 150, "ok", ""), (62, 132, "junk", "NULL"), (100, 150, "ok", ""), (140, 128, "junk", "TEST"),
    (160, 168, "ok", ""), (120, 190, "junk", "N/A"), (80, 186, "ok", ""), (40, 200, "junk", "DUP"),
    (22, 236, "ok", ""), (64, 228, "real", "REAL"), (108, 226, "ok", ""), (150, 214, "junk", "DUP"),
    (158, 250, "ok", ""), (96, 256, "junk", "TEST"),
]
EDGES = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 2), (6, 7), (7, 0), (7, 8), (8, 9), (9, 6),
         (9, 10), (10, 5), (10, 11), (11, 4), (11, 12), (12, 13), (13, 10), (13, 9)]
FIRST_MEAL = [1, 3, 5, 7]            # сцена 2: робот їсть ці вузли
ROUTE = [(10, 120), 0, 1, 2, 3, 4, 5, 6, 7]   # шлях робота ребрами
LATER = [11, 13]                     # сміття, яке знайде команда з лупами
ROUTE2 = [(10, 200), 13, 11]
VERDICT_ORDER = [0, 2, 4, 6, 8, 9, 10, 11, 12, 13]


GY0, GK = 120, 0.74                 # граф стиснутий угору, щоб під ним ходили персонажі


def node_xy(i):
    x, y, _, _ = NODES[i]
    return x, int(GY0 + (y - 128) * GK)


def route_pos(u, route):
    """Позиція на ламаній route (точки або індекси вузлів) при частці шляху u (0..1)."""
    pts = [p if isinstance(p, tuple) else node_xy(p) for p in route]
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    tot = sum(seg)
    s = clamp(u) * tot
    for i, L in enumerate(seg):
        if s <= L or i == len(seg) - 1:
            k = 0 if L == 0 else min(1, s / L)
            x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k
            y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k
            return x, y, (1 if pts[i + 1][0] >= pts[i][0] else -1), s
        s -= L
    return pts[-1][0], pts[-1][1], 1, tot


def route_arrivals(route):
    pts = [p if isinstance(p, tuple) else node_xy(p) for p in route]
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    tot, acc, out = sum(seg), 0.0, {}
    for i, L in enumerate(seg):
        acc += L
        if not isinstance(route[i + 1], tuple):
            out[route[i + 1]] = acc / tot
    return out


class Pixel:
    def __init__(self):
        bg = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(bg)
        rng = np.random.default_rng(3)
        for y in range(LH):                      # легкий дизер-градієнт, як на старих екранах
            for x in range(0, LW, 2):
                if rng.random() < 0.10 * (1 - abs(y - LH * 0.55) / (LH * 0.6)):
                    d.point((x + (y % 2), y), fill=BG2)
        for _ in range(26):                      # піксельні «зірки» даних
            d.point((int(rng.integers(0, LW)), int(rng.integers(30, LH - 40))), fill=GREY_D)
        self.bg = bg
        self.lock = brand.lockup(46)
        self.logo = brand.logo(150)
        self.arr = route_arrivals(ROUTE)
        self.t_route = (S[1] + 0.9, S[2] - 0.25)
        self.eaten_at = {i: self.t_route[0] + (self.t_route[1] - self.t_route[0]) * self.arr[i] for i in FIRST_MEAL}
        arr2 = route_arrivals(ROUTE2)
        self.eaten_at.update({n: S[3] + 2.9 + 1.4 * arr2[n] for n in LATER})
        self.verdict_at = {n: S[3] + 0.7 + k * 0.23 for k, n in enumerate(VERDICT_ORDER)}

    # ---- шари
    def graph(self, img, t):
        d = ImageDraw.Draw(img)
        alive = lambda i: t < self.eaten_at.get(i, 1e9)
        for a, b in EDGES:
            ta = 0.15 + 0.05 * (a + b)                        # ребра «домальовуються» на старті
            if t < ta or not (alive(a) and alive(b)):
                continue
            (x0, y0), (x1, y1) = node_xy(a), node_xy(b)
            k = ease((t - ta) / 0.35)
            d.line([x0, y0, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k], fill=STEEL)
        for i, (x, _, kind, label) in enumerate(NODES):
            y = node_xy(i)[1]
            ta = 0.1 + 0.07 * i
            if t < ta or not alive(i):
                continue
            s = pop((t - ta) / 0.25)
            r = max(1, int(round((3 if kind != "junk" else 2) * s)))
            if kind == "junk":
                col, hi = GREY, SILVER
            elif kind == "real":
                col, hi = RUBY, RUBY_L
            else:
                col, hi = RUBY, RUBY_L
            d.rectangle([x - r, y - r, x + r, y + r], fill=col)
            d.point((x - r + 1, y - r + 1), fill=hi)
            if kind == "real":                                 # справжній вузол: рамка, що пульсує
                if int(t * 4) % 2:
                    d.rectangle([x - r - 2, y - r - 2, x + r + 2, y + r + 2], outline=WHITE)
            if label and t > ta + 0.3 and (kind == "junk" or t > S[2]):
                ptext(img, label, int(x - text_w(label) / 2), y - 13, SILVER if kind == "junk" else WHITE)
            v = self.verdict_at.get(i)
            if v is not None and S[3] <= t < S[4] and t > v:
                mark, c = ("%", RUBY_L) if kind == "junk" else ("@", WHITE)
                k = pop((t - v) / 0.2)
                ptext(img, mark, x + 4, int(y - 3 - 2 * (k - 1)), c)

    def crumbs(self, img, t):
        d = ImageDraw.Draw(img)
        for i, te in self.eaten_at.items():
            u = t - te
            if 0 <= u < 0.6:
                x, y = node_xy(i)
                for k in range(6):
                    a = k * 1.05 + i
                    rr = 2 + u * 22
                    d.point((x + math.cos(a) * rr, y + math.sin(a) * rr - u * 6), fill=SILVER if k % 2 else GREY)
                ptext(img, "+1", x - 5, int(y - 20 - u * 14), RUBY_L)

    def hud(self, img, t):
        n = sum(1 for te in self.eaten_at.values() if t >= te)
        ptext(img, f"JUNK EATEN {n:02d}", 6, 30, WHITE)
        ptext(img, "REAL LOST 00", LW - text_w("REAL LOST 00") - 6, 30, RUBY_L)

    # ---- кадр
    def frame(self, t) -> Image.Image:
        img = self.bg.copy()
        i = max(k for k, s0 in enumerate(S) if t >= s0)
        u = t - S[i]
        if i < 4:
            self.graph(img, t)
            self.crumbs(img, t)
            if i >= 1:
                self.hud(img, t)
        if i == 0:
            for k, (s, col) in enumerate((("YOUR GRAPH", WHITE), ("HAS JUNK", WHITE), ("NODES.", RUBY_L))):
                if u > 0.15 + k * 0.3:
                    ptext_c(img, s, 46 + k * 18, col, 2)
        elif i == 1:
            if u < 1.6:
                ptext_c(img, "ENTER THE", 50, SILVER, 1)
                ptext_c(img, "DUPE MUNCHER", 62, RUBY_L, 2)
            else:
                ptext_c(img, "NOM. NOM. NOM.", 56, WHITE, 2)
            t0, t1 = self.t_route
            uu = (t - t0) / (t1 - t0)
            if t < t0:
                x, y, face = -30 + 40 * ease((t - S[1]) / 0.9), GY0 + 18, 1
            else:
                x, y, face, _ = route_pos(uu, ROUTE)
            near = min((abs(t - te) for k, te in self.eaten_at.items() if k in FIRST_MEAL), default=9)
            mouth = clamp(1 - near / 0.25) * (0.6 + 0.4 * abs(math.sin(t * 30)))
            big(img, muncher, x, y + 10, t, mouth, face)
        elif i == 2:
            ptext_c(img, "WAIT.", 52, WHITE, 3)
            x1, y1 = node_xy(9)                                  # справжній вузол REAL
            k = ease(u / 1.0)
            stop = clamp((u - 0.85) / 0.2)
            x = -20 + (x1 - 30 + 20) * k
            gy = 252
            big(img, muncher, x, gy, t, 0.8 * (1 - stop), 1, sweat=u > 1.2)
            if u > 0.8:                                          # гальмівні сліди
                d = ImageDraw.Draw(img)
                for j in range(3):
                    d.line([x - 30 - j * 6, gy - 2 - 3 * j, x - 40 - j * 6, gy - 2 - 3 * j], fill=SILVER)
            if u > 0.55:
                jump = pop((u - 0.55) / 0.35)
                cy = gy + (1 - min(1.0, jump)) * 90 - max(0.0, jump - 1) * 30
                big(img, capybara, x1 + 62, cy, t, walk=False, face=-1, glass=False)
                sign(img, "CHECK FIRST!", x1 + 50, int(cy - 52))
        elif i == 3:
            ptext_c(img, "THE AUDIT TEAM", 50, WHITE, 2)
            n_ok = sum(1 for n, v in self.verdict_at.items() if t > v and NODES[n][2] != "junk")
            n_bad = sum(1 for n, v in self.verdict_at.items() if t > v and NODES[n][2] == "junk")
            ptext_c(img, f"VALID {n_ok:02d} @   JUNK {n_bad:02d} %", 72, SILVER, 1)
            # команда пробігає графом із лупами
            sweep = clamp(u / 4.6)
            big(img, capybara, 225 - 290 * sweep, 254, t, walk=True, face=-1)
            big(img, cat, -30 + 250 * clamp((u - 0.2) / 4.2), 222, t, CAT1, CAT1_D, face=1)
            big(img, cat, 235 - 280 * clamp((u - 1.0) / 3.8), 258, t + 0.3, CAT2, CAT2_D, face=-1)
            # робот доїдає лише підтверджене сміття
            if u > 2.9:
                v = clamp((u - 2.9) / 1.4)
                x, y, face, _ = route_pos(v, ROUTE2)
                near = min(abs(t - self.eaten_at[11]), abs(t - self.eaten_at[13]))
                big(img, muncher, x, y + 10, t, clamp(1 - near / 0.25), face)
                ptext_c(img, "APPROVED SNACKS ONLY", 88, RUBY_L, 1)
            else:
                big(img, muncher, 30, 200, t, 0, 1)
        elif i == 4:
            lines = [("CLEAN DATA", WHITE), ("IS NOT", WHITE), ("LESS DATA.", RUBY_L)]
            for k, (s, col) in enumerate(lines):
                if u > k * 0.25:
                    ptext_c(img, s, 56 + k * 20, col, 2)
            if u > 1.3:
                ptext_c(img, "CHECK BEFORE", 128, WHITE, 2)
                ptext_c(img, "YOU DELETE.", 146, RUBY_L, 2)
            # команда в ряд, робот «кланяється»
            big(img, muncher, 36, 252, t, 0.3 + 0.3 * math.sin(t * 6) ** 2, 1)
            big(img, capybara, 132, 252, t, walk=False, face=-1)
            big(img, cat, 72, 226, t, CAT1, CAT1_D, walk=False, face=1)
            big(img, cat, 162, 226, t + 0.5, CAT2, CAT2_D, walk=False, face=-1)
        else:
            ptext_c(img, "HIGH SCORE", 104, SILVER, 1)
            ptext_c(img, "0 REAL RECORDS", 116, WHITE, 2)
            ptext_c(img, "LOST.", 134, RUBY_L, 2)
            if u > 0.8:
                ptext_c(img, "EVER DELETED", 158, WHITE, 1)
                ptext_c(img, "A REAL RECORD?", 168, WHITE, 1)
                ptext_c(img, "COMMENT \"OOPS\"", 182, RUBY_L, 1)
            big(img, muncher, 90 + 8 * math.sin(t * 2), 268, t, 0.2, 1)
        full = img.resize((W, H), Image.NEAREST)
        # бренд у повній роздільності
        if i < 5:
            full.paste(self.lock, (56, 92), self.lock)
        else:
            k = ease(u / 0.5)
            lg = self.logo
            full.paste(lg, (W // 2 - lg.width // 2, int(400 - (1 - k) * 40)), lg)
            if u > 1.2:
                url = Image.new("RGBA", (LW, 12), (0, 0, 0, 0))
                ptext(url, "BELYAKOVCONSULT.COM", int(LW / 2 - text_w("BELYAKOVCONSULT.COM") / 2), 2, SILVER)
                full.paste(url.resize((W, 72), Image.NEAREST), (0, 1236), url.resize((W, 72), Image.NEAREST))
        if any(0 <= t - s0 < 0.05 for s0 in S[1:]):          # аркадний спалах на зміні сцени
            full = Image.blend(full, Image.new("RGB", full.size, WHITE), 0.12)
        return full

    def poster(self):
        img = self.bg.copy()
        t = S[2] + 1.6
        self.graph(img, t)
        x1, y1 = node_xy(9)
        big(img, muncher, x1 - 30, 252, t, 0.2, 1, sweat=True)
        big(img, capybara, x1 + 62, 252, t, walk=False, face=-1, glass=False)
        sign(img, "CHECK FIRST!", x1 + 50, 200)
        ptext_c(img, "DON'T LET IT", 54, WHITE, 2)
        ptext_c(img, "EAT REAL DATA", 74, RUBY_L, 2)
        full = img.resize((W, H), Image.NEAREST)
        full.paste(self.lock, (56, 92), self.lock)
        return full


# ---------------------------------------------------------------- звук
def blip(f0, f1, dur, gain=1.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = f0 + (f1 - f0) * t / dur
    ph = np.cumsum(f) / SR
    x = np.sign(np.sin(2 * np.pi * ph)) * 0.5
    return x * np.exp(-t * 6) * np.linspace(1, 0, n) ** 0.3 * gain


def soundtrack(path: Path, v: Pixel):
    m = Mix(TOTAL)
    hook = [(72, 1), (76, 1), (79, 1), (84, 1), (83, 2), (79, 2), (81, 1), (79, 1), (76, 2), (72, 4),
            (74, 1), (76, 1), (77, 2), (76, 2), (74, 2), (72, 4)]
    groove(m, 0.0, S[2], ["C", "Am", "F", "G"], BEAT, arp=True, seed=4)
    melody(m, S[1], S[2], BEAT, hook * 2, gain=0.12)
    # «WAIT.»: музика обривається, лишається бас-пульс
    for k in range(int((S[3] - S[2]) / BEAT)):
        m.put(tri(midi(36), 0.12), S[2] + 0.3 + k * BEAT, 0.6)
    groove(m, S[3], S[5], ["F", "G", "C", "Am"], BEAT, arp=True, seed=8)
    melody(m, S[4], S[5], BEAT, hook, gain=0.11)
    m.put(crash(2), S[4], 0.3)
    for k, note in enumerate([72, 76, 79, 84]):
        m.put(sq(midi(note), 0.18, decay=4), S[5] + 0.2 + k * 0.14, 0.14)
    m.put(sq(midi(84), 1.2, decay=1.5), S[5] + 0.8, 0.12)
    music = m.x / max(1e-9, np.abs(m.x).max()) * 0.6
    fx = Mix(TOTAL)
    for te in v.eaten_at.values():
        fx.put(blip(300, 900, 0.09), te - 0.06, 0.6)
        fx.put(blip(500, 1400, 0.08), te + 0.04, 0.5)
    fx.put(blip(1200, 200, 0.35), S[2] + 0.85, 0.7)            # гальмування
    fx.put(blip(200, 600, 0.12), S[2] + 0.95, 0.5)             # капібара вистрибує
    for vt in v.verdict_at.values():
        fx.put(blip(880, 1320, 0.05), vt, 0.35)
    for s0 in S[1:]:
        fx.put(blip(180, 1800, 0.18), s0 - 0.08, 0.4)
    sfx = fx.x / max(1e-9, np.abs(fx.x).max()) * 0.8
    n = int(TOTAL * SR)
    mix = (music * 0.85 + sfx * 0.5)[:n]
    mix[-int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))
    mix /= max(1.0, np.abs(mix).max() / 0.95)
    st = np.stack([mix, mix], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


def render(out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    v = Pixel()
    wav = out_dir / "pixel.wav"
    soundtrack(wav, v)
    v.poster().save(out_dir / "pixel-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "pixel-9x16.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", str(mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for k in range(int(TOTAL * FPS)):
            proc.stdin.write(v.frame(k / FPS).tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    wav.unlink(missing_ok=True)
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")
    return mp4


if __name__ == "__main__":
    print(render(Path(sys.argv[1])))
