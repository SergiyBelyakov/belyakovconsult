"""Тестовий ролик «Neon Smash» (9:16, 24 с, EN і UA): преміум-неон, історія з неоновим чоловічком.

Задум власника 18.11.2026: неоновий чоловічок на першому кадрі вже летить кулаком у камеру й розбиває її,
потім вибачається і розповідає історію. Хук і якір болю видно з кадру 0.

Сюжет (цифри умовні, у кадрі позначено «Умовний приклад»):
  0.0   «СТОП.» кулак у камеру, 0.2 удар: тріщини, спалах, тремтіння, уламки; 2.15 скло обсипається
  2.4   «Вибачте за камеру. Зараз поясню.»
  4.8   П'ятниця: неонова вивіска +38%; 7.2 понеділок: штамп «затверджено»; 9.6 вівторок: вивіска згасає (біль)
  11.0  три перевірки: дублі, запізнілі записи, змінені статуси (чоловічок торкається кожної)
  15.6  вивіска +6% кольору шампань, «перевірено» (полегшення); 16.8 висновок; 19.2 фінал з брендом

Якорі з premium_anchors.py: біль (хук і згасання вивіски), полегшення (перевірене число), бренд (фінал).
Музика: спільний синт-трек make_nightdrive (одна з п'яти мелодій), звуки сюжету власні.

Запуск: python scripts/make_neon.py <en|uk> <out.mp4> [track]
"""
from __future__ import annotations

import math
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_nightdrive as nd  # noqa: E402
import premium_anchors as pa  # noqa: E402
from make_nightdrive import (B, BAR, CHAMPAGNE, FPS, GRAPHITE, H, MIDNIGHT, PINK, RUBY, SILVER, T_BAND, T_DROP,  # noqa: E402
                             T_END, T_Q, T_REAL, TOTAL, W, WHITE, bwrap, clamp, ease, tracked)

FLOOR = 1560
P_HIT = (600, 1010)
T_HIT = 0.2
T_FALL = 2.15
T_MON = 3 * BAR          # 7.2
T_TUE = 4 * BAR          # 9.6
T_CHECK = 11.0
TAPS = [12.6, 13.8, 15.0]
NEON = (70, 190, 255)    # неон чоловічка
UNLIT = (40, 46, 58)     # незасвічена трубка
SIGN_C = (540, 770)
BOXES = [(520, 960 + 140 * i, 1010, 1072 + 140 * i) for i in range(3)]

TEXT = {
    "en": dict(
        stop="STOP.", hook="Don't take that number to the board.",
        say=[(T_Q, T_DROP, "Sorry about the camera. *Let me explain.*"),
             (T_DROP, T_MON, "*Friday.* The report says +38%."),
             (T_MON, T_TUE, "*Monday.* The board budgets on it."),
             (T_TUE, T_CHECK, "*Tuesday.* Finance finds duplicates."),
             (T_CHECK, T_REAL, "Three checks before any number goes up:"),
             (T_REAL, T_BAND, "Smaller. *But true.*"),
             (T_BAND, T_END, "Cameras are cheaper than *wrong decisions.*")],
        label="REVENUE GROWTH", approved="APPROVED", verified="VERIFIED",
        checks=["DUPLICATES", "LATE RECORDS", "CHANGED STATUSES"],
        illus="ILLUSTRATIVE EXAMPLE", end="Send this to whoever signs off the numbers."),
    "uk": dict(
        stop="СТОП.", hook="Не несіть це число раді директорів.",
        say=[(T_Q, T_DROP, "Вибачте за камеру. *Зараз поясню.*"),
             (T_DROP, T_MON, "*П’ятниця.* Звіт показує +38%."),
             (T_MON, T_TUE, "*Понеділок.* Рада затверджує на ньому бюджет."),
             (T_TUE, T_CHECK, "*Вівторок.* Фінансисти знаходять дублі."),
             (T_CHECK, T_REAL, "Три перевірки, перш ніж число піде нагору:"),
             (T_REAL, T_BAND, "Менше. *Зате правда.*"),
             (T_BAND, T_END, "Камера дешевша за *хибне рішення.*")],
        label="ЗРОСТАННЯ ВИРУЧКИ", approved="ЗАТВЕРДЖЕНО", verified="ПЕРЕВІРЕНО",
        checks=["ДУБЛІ", "ЗАПІЗНІЛІ ЗАПИСИ", "ЗМІНЕНІ СТАТУСИ"],
        illus="УМОВНИЙ ПРИКЛАД", end="Перешліть тому, хто підписує цифри."),
}


def mix(a, b, u):
    return tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3))


def sc(c, a):
    return tuple(int(v * clamp(a)) for v in c)


def seg(t, t0, t1):
    return ease((t - t0) / max(1e-6, t1 - t0))


def flicker(t, t0, seed, dur=0.45):
    """Запалювання неонової трубки: кілька спалахів, потім рівне світло."""
    u = t - t0
    if u < 0:
        return 0.0
    if u >= dur:
        return 1.0
    rng = np.random.default_rng(seed + int(u * 40))
    return float(rng.uniform(0.0, 1.0) > 0.45) * (0.4 + 0.6 * u / dur)


# ---------------------------------------------------------------- неоновий шар
class Neon:
    def __init__(self):
        self.g = Image.new("RGB", (W, H))
        self.c = Image.new("RGB", (W, H))
        self.dg = ImageDraw.Draw(self.g)
        self.dc = ImageDraw.Draw(self.c)

    def line(self, pts, col, w, a=1.0):
        if a <= 0.01:
            return
        self.dg.line(pts, fill=sc(col, a), width=max(3, int(w * 2.4)), joint="curve")
        self.dc.line(pts, fill=sc(mix(col, (255, 255, 255), 0.7), a), width=max(2, int(w)), joint="curve")

    def circle(self, c, r, col, w, a=1.0, fill=False):
        if a <= 0.01:
            return
        box = [c[0] - r, c[1] - r, c[0] + r, c[1] + r]
        if fill:
            self.dg.ellipse([box[0] - w, box[1] - w, box[2] + w, box[3] + w], fill=sc(col, a))
            self.dc.ellipse(box, fill=sc(mix(col, (255, 255, 255), 0.7), a))
        else:
            self.dg.ellipse(box, outline=sc(col, a), width=max(3, int(w * 2.4)))
            self.dc.ellipse([box[0] + w * 0.7, box[1] + w * 0.7, box[2] - w * 0.7, box[3] - w * 0.7],
                            outline=sc(mix(col, (255, 255, 255), 0.7), a), width=max(2, int(w)))

    def rect(self, box, col, w, a=1.0, r=22):
        if a <= 0.01:
            return
        self.dg.rounded_rectangle(box, r, outline=sc(col, a), width=max(3, int(w * 2.4)))
        self.dc.rounded_rectangle(box, r, outline=sc(mix(col, (255, 255, 255), 0.7), a), width=max(2, int(w)))

    def text(self, xy, s, f, col, a=1.0, glow=6, core_mix=0.75):
        if a <= 0.01:
            return
        self.dg.text(xy, s, font=f, fill=sc(col, a), anchor="mm", stroke_width=glow, stroke_fill=sc(col, a))
        self.dc.text(xy, s, font=f, fill=sc(mix(col, (255, 255, 255), core_mix), a), anchor="mm")

    def render(self):
        g = self.g
        big = np.asarray(g.reduce(4).filter(ImageFilter.GaussianBlur(7)).resize((W, H), Image.BILINEAR), np.float32)
        mid = np.asarray(g.reduce(2).filter(ImageFilter.GaussianBlur(3)).resize((W, H), Image.BILINEAR), np.float32)
        return big * 1.5 + mid * 0.9 + np.asarray(g, np.float32) * 0.35 + np.asarray(self.c, np.float32), big


# ---------------------------------------------------------------- чоловічок
L_TH, L_SH, TORSO, NECK, HEAD_R, L_UA, L_FA = 135, 130, 210, 22, 46, 112, 108
STAND = dict(x=540, y=FLOOR - 262, s=1.0, lean=0, tilt=0, look=0, fist=0,
             lh=(-58, -2), rh=(58, -2), lf=(-42, 262), rf=(42, 262))


def P(**kw):
    p = dict(STAND)
    p.update(kw)
    return p


PUNCH = P(x=250, y=1700, s=2.4, lean=28, tilt=-34, look=12, fist=60, lh=(-70, -140), rh=(146, -288))
PUNCH0 = dict(PUNCH, fist=40)
SHAKE = P(rh=(62, -112), lh=(-50, -4), tilt=-6)
SORRY = P(rh=(26, -282), lh=(-56, 0), tilt=-12, look=-4)
EXPLAIN = P(rh=(96, -150), lh=(-56, 0), tilt=4, look=4)
POINT = P(x=330, rh=(270, -545), lh=(-50, -2), lean=10, tilt=10, look=10)
CHEER = P(x=330, rh=(100, -400), lh=(-100, -400), tilt=0)
SHOCK = P(x=330, y=FLOOR - 250, rh=(42, -284), lh=(-42, -284), lf=(-52, 250), rf=(52, 250), tilt=0, look=6)
READY = P(x=330, rh=(70, -150), lh=(-52, 0), look=12, tilt=6)
TADA = P(x=330, rh=(170, -300), lh=(-150, -210), look=6)
CROSS = P(x=540, rh=(-38, -150), lh=(38, -150), look=0)
WAVE = P(x=540, y=1690 - 262 * 0.55, s=0.55, rh=(105, -330), lh=(-56, 0), look=0)

KEYS = [(0.0, PUNCH0), (T_HIT, PUNCH), (1.25, SHAKE), (2.3, SHAKE), (2.7, SORRY), (3.3, SORRY), (3.6, EXPLAIN),
        (4.8, EXPLAIN), (5.6, READY), (5.9, POINT), (7.1, POINT), (7.45, CHEER), (9.5, CHEER), (9.75, SHOCK),
        (10.9, SHOCK), (11.3, READY), (15.4, READY), (15.75, TADA), (16.7, TADA), (17.6, CROSS), (19.2, CROSS),
        (19.9, WAVE), (24.0, WAVE)]
TAP_REACH = [(528, 1016), (528, 1156), (528, 1296)]


def lerp_pose(a, b, u):
    out = {}
    for k, v in a.items():
        w = b[k]
        out[k] = tuple(v[i] + (w[i] - v[i]) * u for i in range(2)) if isinstance(v, tuple) else v + (w - v) * u
    return out


def pose_at(t):
    for (t0, a), (t1, b) in zip(KEYS, KEYS[1:]):
        if t0 <= t < t1:
            u = (t - t0) / (t1 - t0)
            return lerp_pose(a, b, (3 - 2 * u) * u * u)
    return dict(KEYS[-1][1])


def ik(a, t, l1, l2, outward):
    dx, dy = t[0] - a[0], t[1] - a[1]
    d = max(abs(l1 - l2) + 1, min(l1 + l2 - 0.5, math.hypot(dx, dy)))
    ang = math.atan2(dy, dx)
    b = math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1))
    opts = [(a[0] + l1 * math.cos(ang + s * b), a[1] + l1 * math.sin(ang + s * b)) for s in (1, -1)]
    j = min(opts, key=lambda p: p[0] * outward)          # лікоть і коліно назовні
    return j, (a[0] + d * math.cos(ang), a[1] + d * math.sin(ang))


def man_pose(t):
    p = pose_at(t)
    p["lh"], p["rh"], p["lf"], p["rf"] = list(p["lh"]), list(p["rh"]), list(p["lf"]), list(p["rf"])
    if 0.5 < t < 1.9:                                      # трусить забитою рукою
        k = math.sin(math.pi * clamp((t - 0.5) / 1.4))
        p["rh"][0] += 16 * k * math.sin(2 * math.pi * 9 * t)
        p["rh"][1] += 8 * k * math.cos(2 * math.pi * 9 * t)
    if 3.6 < t < 4.8:                                      # жести, поки говорить
        p["rh"][0] += 12 * math.sin(2 * math.pi * 1.6 * t)
        p["rh"][1] += 14 * math.sin(2 * math.pi * 3.2 * t)
    if 7.45 < t < 9.5:                                     # радіє на долі
        p["y"] -= 16 * abs(math.sin(math.pi * (t - 7.2) / B))
    for i, tp in enumerate(TAPS):                          # торкається перевірки
        k = clamp(1 - abs(t - tp) / 0.32)
        if k > 0:
            k = (3 - 2 * k) * k * k
            tx, ty = TAP_REACH[i]
            rel = ((tx - p["x"]) / p["s"], (ty - p["y"]) / p["s"])
            p["rh"] = [p["rh"][j] + (rel[j] - p["rh"][j]) * k for j in range(2)]
            p["lean"] += 22 * k
            if i == 2:
                p["y"] += 30 * k
    if t > 19.9:                                           # махає у фіналі
        p["rh"][0] += 26 * math.sin(2 * math.pi * 2.2 * t)
    p["y"] += 3 * math.sin(2 * math.pi * 0.5 * t)          # дихання
    # хода, коли тазовий центр рухається
    dx = (pose_at(t + 0.02)["x"] - pose_at(t - 0.02)["x"]) / 0.04
    if abs(dx) > 30 and p["s"] > 0.9:
        ph = p["x"] / 70 * math.pi
        amp = clamp(abs(dx) / 300)
        for key, sgn in (("lf", 1), ("rf", -1)):
            p[key][0] += 34 * amp * sgn * math.sin(ph)
            p[key][1] -= 26 * amp * max(0, sgn * math.cos(ph))
        p["y"] -= 6 * amp * abs(math.sin(ph))
    return p


def draw_man(nz, p, a=1.0):
    s, x0, y0 = p["s"], p["x"], p["y"]

    def S(v):
        return (x0 + s * v[0], y0 + s * v[1])
    w = 8.5 * s
    neck = (p["lean"], -TORSO)
    sh = (p["lean"] * 0.95, -TORSO + 14)
    head = (p["lean"] + p["tilt"], -TORSO - NECK - HEAD_R)
    nz.line([S((0, 0)), S(neck)], NEON, w, a)
    for key, out, l1, l2, root in (("lf", -1, L_TH, L_SH, (0, 0)), ("rf", 1, L_TH, L_SH, (0, 0)),
                                   ("lh", -1, L_UA, L_FA, sh), ("rh", 1, L_UA, L_FA, sh)):
        j, e = ik(root, p[key], l1, l2, out)
        nz.line([S(root), S(j), S(e)], NEON, w, a)
        if key[1] == "h":
            r = p["fist"] if key == "rh" and p["fist"] > 0 else 10
            nz.circle(S(e), r * s, NEON, w * (0.6 if r > 20 else 0.8), a, fill=r <= 20)
        else:
            nz.line([S(e), S((e[0] + 18 * out, e[1]))], NEON, w, a)
    nz.circle(S(head), HEAD_R * s, NEON, w, a)
    for ex in (-15, 15):
        c = S((head[0] + ex + p["look"], head[1] - 4))
        nz.dc.ellipse([c[0] - 5 * s, c[1] - 6 * s, c[0] + 5 * s, c[1] + 6 * s], fill=sc((235, 250, 255), a))


# ---------------------------------------------------------------- розбита камера
class Glass:
    def __init__(self, seed=5):
        rng = np.random.default_rng(seed)
        px, py = P_HIT
        n = 13
        self.rays = []
        base = rng.uniform(0, 2 * math.pi)
        for i in range(n):
            ang = base + 2 * math.pi * i / n + rng.uniform(-0.12, 0.12)
            pts, r = [(px, py)], 0.0
            x, y = px, py
            while r < 2400:
                step = rng.uniform(45, 110)
                ang += rng.uniform(-0.18, 0.18)
                x, y = x + step * math.cos(ang), y + step * math.sin(ang)
                r += step
                pts.append((x, y))
            self.rays.append(pts)
        self.rings = [60, 140, 260, 420, 640, 900, 1250]

        def at(ray, rad):
            acc = 0.0
            for a, b in zip(ray, ray[1:]):
                l = math.hypot(b[0] - a[0], b[1] - a[1])
                if acc + l >= rad:
                    u = (rad - acc) / l
                    return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)
                acc += l
            return ray[-1]
        self.at = at
        self.links = [(i, k) for i in range(n) for k in range(len(self.rings)) if rng.uniform() < 0.8]
        self.cells = []
        for i in range(n):
            j = (i + 1) % n
            for k in range(len(self.rings) - 1):
                r0, r1 = self.rings[k], self.rings[k + 1]
                poly = [at(self.rays[i], r0), at(self.rays[i], r1), at(self.rays[j], r1), at(self.rays[j], r0)]
                cx = sum(q[0] for q in poly) / 4
                cy = sum(q[1] for q in poly) / 4
                if -200 < cx < W + 200 and -200 < cy < H + 200:
                    self.cells.append(dict(poly=poly, c=(cx, cy), vx=rng.uniform(-260, 260), vy=rng.uniform(-300, 60),
                                           rot=rng.uniform(-3, 3), delay=rng.uniform(0, 0.28)))
        # заломлення: кожна клітинка трохи зсуває зображення
        yy, xx = np.mgrid[0:H, 0:W]
        ang = (np.arctan2(yy - py, xx - px) - base) % (2 * math.pi)
        sector = (ang / (2 * math.pi / n)).astype(np.int32)
        ring = np.searchsorted(np.array(self.rings), np.hypot(yy - py, xx - px))
        cid = sector * 10 + ring
        offs = rng.integers(-7, 8, size=(n * 10 + 10, 2))
        offs[cid[py, px]] = 0
        self.sy = np.clip(yy + offs[cid, 1], 0, H - 1).astype(np.int32)
        self.sx = np.clip(xx + offs[cid, 0], 0, W - 1).astype(np.int32)
        self.shards = [dict(a=rng.uniform(0, 2 * math.pi), v=rng.uniform(500, 1600), sz=rng.uniform(8, 26),
                            rot=rng.uniform(0, 6)) for _ in range(34)]

    def cracks(self, fr, t):
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        if t < T_FALL:
            R = 2600 * ease((t - T_HIT) / 0.14)
            for ray in self.rays:
                acc, pts = 0.0, [ray[0]]
                for a, b in zip(ray, ray[1:]):
                    acc += math.hypot(b[0] - a[0], b[1] - a[1])
                    if acc > R:
                        break
                    pts.append(b)
                if len(pts) > 1:
                    d.line(pts, fill=(235, 242, 255, 190), width=3)
            for i, k in self.links:
                r = self.rings[k]
                if r < R:
                    j = (i + 1) % len(self.rays)
                    d.line([self.at(self.rays[i], r), self.at(self.rays[j], r)], fill=(235, 242, 255, 150), width=2)
            d.ellipse([P_HIT[0] - 34, P_HIT[1] - 34, P_HIT[0] + 34, P_HIT[1] + 34], fill=(255, 255, 255, 60))
        else:                                              # скло обсипається
            for c in self.cells:
                u = t - T_FALL - c["delay"]
                if u < 0:
                    u = 0.0
                if u > 1.2:
                    continue
                dx, dy = c["vx"] * u, c["vy"] * u + 0.5 * 5200 * u * u
                th = c["rot"] * u
                cs, sn = math.cos(th), math.sin(th)
                pts = []
                for q in c["poly"]:
                    rx, ry = q[0] - c["c"][0], q[1] - c["c"][1]
                    pts.append((c["c"][0] + rx * cs - ry * sn + dx, c["c"][1] + rx * sn + ry * cs + dy))
                al = clamp(1 - u / 1.0)
                d.polygon(pts, fill=(220, 235, 255, int(22 * al)), outline=(235, 242, 255, int(170 * al)))
        if T_HIT <= t < T_HIT + 0.8:                       # уламки летять у глядача
            u = (t - T_HIT) / 0.8
            for s in self.shards:
                r = 40 + s["v"] * u
                x = P_HIT[0] + r * math.cos(s["a"])
                y = P_HIT[1] + r * math.sin(s["a"]) + 900 * u * u
                z = s["sz"] * (1 + 3 * u)
                th = s["rot"] + 8 * u
                pts = [(x + z * math.cos(th + k * 2.2), y + z * math.sin(th + k * 2.2)) for k in range(3)]
                d.polygon(pts, fill=(230, 240, 255, int(120 * (1 - u))), outline=(255, 255, 255, int(200 * (1 - u))))
        fr.alpha_composite(lay)


# ---------------------------------------------------------------- ролик
class Video:
    def __init__(self, lang):
        self.lang = lang
        self.S = TEXT[lang]
        self.lock = brand.lockup(52)
        self.logo = brand.logo(200)
        self.f_stop = brand.font("head", 230)
        self.f_hook = brand.font("body-semi", 50)
        self.f_say = brand.font("body-semi", 56)
        self.f_take = brand.font("head", 64)
        self.f_sign = brand.font("head", 210)
        self.f_lab = brand.font("body-semi", 28)
        self.f_box = brand.font("body-semi", 34)
        self.f_stamp = brand.font("head", 40)
        self.f_end = brand.font("body", 46)
        self.f_url = brand.font("body-semi", 34)
        self.f_tag = brand.font("body-semi", 26)
        self.glass = Glass()
        self.bg, self.haze = self.background()
        yy, xx = np.mgrid[0:H, 0:W]
        v = 1 - 0.55 * np.clip((np.hypot((xx - 540) / 760, (yy - 1000) / 1250) - 0.55) / 0.6, 0, 1) ** 1.6
        self.vig = v[..., None].astype(np.float32)
        rng = np.random.default_rng(3)
        self.grain = [rng.normal(0, 4.5, (H // 2, W // 2, 1)).astype(np.float32) for _ in range(6)]
        self.dust = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(6, 22), rng.uniform(1, 2.6)) for _ in range(46)]
        self.refl = np.linspace(0.34, 0.0, H - FLOOR, dtype=np.float32)[:, None, None]

    def background(self):
        top, bot = np.array(MIDNIGHT, np.float32), np.array(GRAPHITE, np.float32)
        y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
        bg = np.broadcast_to(top + (bot - top) * y, (H, W, 3)).copy()
        img = Image.fromarray(bg.astype(np.uint8))
        d = ImageDraw.Draw(img)
        for x in range(-40, W + 90, 120):                  # панелі задньої стіни
            d.line([x, 0, x, FLOOR], fill=(15, 19, 27), width=2)
        for k in range(-14, 15):                           # перспектива глянцевої підлоги
            d.line([540 + k * 70, FLOOR, 540 + k * 230, H], fill=(20, 25, 34), width=2)
        for i in range(1, 9):
            yy = FLOOR + (H - FLOOR) * (i / 8) ** 1.8
            d.line([0, yy, W, yy], fill=(18, 23, 31), width=2)
        nz = Neon()
        nz.line([(-20, FLOOR), (W + 20, FLOOR)], RUBY, 3, 0.55)
        strip, _ = nz.render()
        bg = np.asarray(img, np.float32) + strip
        yy, xx = np.mgrid[0:H, 0:W]
        haze = np.exp(-(((xx - 540) / 620) ** 2 + ((yy - 1150) / 760) ** 2))[..., None] * np.array([14, 30, 52], np.float32)
        return bg, haze.astype(np.float32)

    # ---- тексти
    def caption(self, d, text, t, t0, t1, take=False):
        if not (t0 <= t < t1 + 0.01):
            return
        f = self.f_take if take else self.f_say
        words = text.split()
        plain = " ".join(w.strip("*") for w in words)
        lines = bwrap(plain, f, 920)
        state, flags = False, []
        for w in words:                                   # *кілька слів* підряд
            st = w.startswith("*")
            flags.append(state or st)
            state = (state or st) and not w.endswith("*")
        out = max(0.0, 1 - max(0.0, t - (t1 - 0.22)) / 0.22) if t1 < T_END else 1.0
        y = 300
        idx = 0
        for ln in lines:
            lw = ln.split()
            x = (W - f.getlength(ln)) / 2
            for wd in lw:
                k = ease((t - t0 - 0.07 * idx - (0.08 if t0 == T_Q else 0)) / 0.3)
                col = CHAMPAGNE if flags[idx] else WHITE
                d.text((x, y + (1 - k) * 18), wd, font=f, fill=(*col, int(255 * k * out)))
                x += f.getlength(wd + " ")
                idx += 1
            y += int(f.size * 1.22)

    def texts(self, fr, t):
        d = ImageDraw.Draw(fr)
        if t < T_Q:                                        # хук: повністю видно з кадру 0
            a = 1.0 if t < T_Q - 0.22 else (T_Q - t) / 0.22
            ys = 540
            for ln in bwrap(self.S["hook"], self.f_hook, 900):
                d.text((540, ys), ln, font=self.f_hook, fill=(*WHITE, int(255 * a)), anchor="mm")
                ys += 62
        for t0, t1, s in self.S["say"]:
            self.caption(d, s, t, t0, t1, take=t0 == T_BAND)
        if T_DROP <= t < T_BAND + 0.3:
            a = min(seg(t, T_DROP, T_DROP + 0.5), 1 - seg(t, T_BAND, T_BAND + 0.3))
            tracked(d, self.S["illus"], brand.font("body-semi", 24), 540, 1828, (*SILVER, int(190 * a)), 5)
        if T_DROP + 0.2 <= t < T_END + 0.4:
            a = min(seg(t, T_DROP + 0.2, T_DROP + 0.7), 1 - seg(t, T_END, T_END + 0.4))
            tracked(d, self.S["label"], self.f_lab, SIGN_C[0], 618, (*SILVER, int(220 * a)), 6)
        if T_REAL + 0.25 <= t < T_END + 0.4:
            a = min(seg(t, T_REAL + 0.25, T_REAL + 0.7), 1 - seg(t, T_END, T_END + 0.4))
            tracked(d, self.S["verified"], self.f_lab, SIGN_C[0] + 22, 900, (*CHAMPAGNE, int(255 * a)), 7)
        if T_CHECK <= t < T_BAND + 0.4:
            a = 1 - seg(t, T_BAND, T_BAND + 0.4)
            for i, (box, lab) in enumerate(zip(BOXES, self.S["checks"])):
                k = seg(t, T_CHECK + 0.2 * i, T_CHECK + 0.2 * i + 0.4) * a
                f = self.f_box
                d.text((box[0] + 40, (box[1] + box[3]) / 2), lab, font=f, fill=(*WHITE, int(255 * k)), anchor="lm")

    def end(self, fr, t):
        u = t - T_END
        k = ease((u - 0.35) / 0.6)
        nd.comp(fr, self.logo, W / 2 - self.logo.width / 2, 600 + (1 - k) * 30, k)
        d = ImageDraw.Draw(fr)
        k2 = ease((u - 0.7) / 0.6)
        y = 900 + (1 - k2) * 20
        for ln in bwrap(self.S["end"], self.f_end, 900):
            d.text(((W - self.f_end.getlength(ln)) / 2, y), ln, font=self.f_end, fill=(*WHITE, int(255 * k2)))
            y += 62
        k3 = ease((u - 1.1) / 0.6)
        tracked(d, "BELYAKOVCONSULT.COM", self.f_url, W / 2, y + 40, (*SILVER, int(255 * k3)), 6)
        d.line([W / 2 - 60 * k3, y + 22, W / 2 + 60 * k3, y + 22], fill=(*RUBY, int(255 * k3)), width=3)
        k4 = ease((u - 1.5) / 0.6)                         # якір бренду
        tracked(d, pa.TAGLINE[self.lang], self.f_tag, W / 2, y + 104, (*pa.CHAMPAGNE, int(235 * k4)), 5)

    # ---- неонові об'єкти
    def signs(self, nz, fr_np_draw, t):
        fade = 1 - seg(t, T_END, T_END + 0.4)
        if t < T_DROP or fade <= 0:
            return
        f = self.f_sign
        if t < T_REAL:
            txt, col = "+38%", PINK
            if t < T_TUE:
                a = flicker(t, T_DROP, 11)
            else:
                u = t - T_TUE
                a = flicker(t, T_TUE - 0.6, 23, 0.6) * (1 - u / 0.5) if u < 0.5 else 0.0
                a = max(a, 0.0)
        else:
            txt, col = "+6%", CHAMPAGNE
            a = flicker(t, T_REAL - 0.05, 37, 0.35)
        fr_np_draw.text(SIGN_C, txt, font=f, fill=UNLIT, anchor="mm", stroke_width=3, stroke_fill=(30, 35, 46))
        nz.text(SIGN_C, txt, f, col, a * fade, glow=7)
        if T_REAL + 0.25 <= t:                             # галочка біля «перевірено»
            k = seg(t, T_REAL + 0.25, T_REAL + 0.7)
            x0 = SIGN_C[0] + 22 - self.f_lab.getlength(self.S["verified"]) / 2 - 70
            nz.line([(x0, 902), (x0 + 12, 916), (x0 + 36, 888)], CHAMPAGNE, 4, k * fade)
        if T_MON <= t < T_TUE + 0.5:                       # штамп «затверджено»
            u = t - T_MON
            z = 1 + 0.6 * (1 - ease(u / 0.22))
            fs = brand.font("head", int(40 * z))
            a = clamp(u / 0.12) * (flicker(t, T_TUE - 0.6, 29, 0.6) * (1 - (t - T_TUE) / 0.5) if t >= T_TUE else 1.0)
            wdt = fs.getlength(self.S["approved"]) + 56 * z
            c = (790, 968)
            nz.rect([c[0] - wdt / 2, c[1] - 38 * z, c[0] + wdt / 2, c[1] + 38 * z], RUBY, 4, a, 10)
            nz.text(c, self.S["approved"], fs, RUBY, a, glow=4, core_mix=0.55)

    def boxes(self, nz, t):
        if not (T_CHECK <= t < T_BAND + 0.4):
            return
        fade = 1 - seg(t, T_BAND, T_BAND + 0.4)
        for i, box in enumerate(BOXES):
            a = flicker(t, T_CHECK + 0.2 * i, 50 + i, 0.4) * fade
            done = t >= TAPS[i]
            k = clamp((t - TAPS[i]) / 0.25) if done else 0.0
            col = mix(RUBY, CHAMPAGNE, k)
            nz.rect(box, col, 3.5, a * (1 + 0.6 * clamp(1 - (t - TAPS[i]) / 0.3) if done else 1), 20)
            cx, cy = box[2] - 56, (box[1] + box[3]) / 2
            if done:
                nz.line([(cx - 18, cy), (cx - 4, cy + 14), (cx + 20, cy - 14)], CHAMPAGNE, 4, a * k)
            else:
                nz.text((cx, cy), "?", self.f_box, RUBY, a, glow=3, core_mix=0.5)

    def speed_lines(self, nz, t):
        if t >= T_HIT:
            return
        u = t / T_HIT
        for k in range(14):
            ang = k * 2 * math.pi / 14 + 0.2
            r0 = 2.4 * (40 + 20 * u) + 40
            r1 = r0 + 140 + 100 * u
            nz.line([(P_HIT[0] + r0 * math.cos(ang), P_HIT[1] + r0 * math.sin(ang)),
                     (P_HIT[0] + r1 * math.cos(ang), P_HIT[1] + r1 * math.sin(ang))], NEON, 2.2, 0.55)

    # ---- кадр
    def frame(self, t):
        pulse = nd.kick_pulse(t) if t >= T_DROP else 0.0
        base = self.bg + self.haze * (0.7 + 0.6 * pulse)
        if t >= T_END:
            base = base * (1 - 0.72 * ease((t - T_END) / 0.6))
        under = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
        du = ImageDraw.Draw(under)
        nz = Neon()
        if t < T_Q:                                        # «СТОП.» неоновим рубіном
            a = 1.0 if t < T_Q - 0.22 else (T_Q - t) / 0.22
            du.text((540, 400), self.S["stop"], font=self.f_stop, fill=UNLIT, anchor="mm")
            nz.text((540, 400), self.S["stop"], self.f_stop, RUBY, a, glow=8, core_mix=0.45)
        self.signs(nz, du, t)
        self.boxes(nz, t)
        self.speed_lines(nz, t)
        draw_man(nz, man_pose(t))
        neon, big = nz.render()
        img = np.asarray(under, np.float32) + neon
        h = H - FLOOR                                      # відбиток у глянцевій підлозі
        src = (big * 0.9 + neon * 0.35)[FLOOR - h:FLOOR][::-1]
        img[FLOOR:] += src * self.refl
        img *= self.vig
        g = self.grain[int(t * FPS) % len(self.grain)]
        img += np.repeat(np.repeat(g, 2, 0), 2, 1)
        fr = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")
        d = ImageDraw.Draw(fr)
        for x, y, sp, r in self.dust:                      # пил у світлі
            yy = (y - sp * t * 3) % H
            d.ellipse([x - r, yy - r, x + r, yy + r], fill=(200, 225, 255, 40))
        fr.alpha_composite(self.lock, (72, 116))
        self.texts(fr, t)
        if t < 0.8:                                        # якір болю на хуку
            pa.pain_rings(fr, P_HIT[0], P_HIT[1], t / 0.8, 1.0)
        if 0 <= t - T_TUE < 0.8:
            pa.pain_rings(fr, SIGN_C[0], SIGN_C[1], (t - T_TUE) / 0.8, 0.8)
        if 0 <= t - T_REAL < 0.9:
            pa.relief_sweep(fr, (150, 650, 930, 940), (t - T_REAL) / 0.9)
        if t >= T_END:
            self.end(fr, t)
        if T_HIT <= t < T_FALL + 1.3:                      # тріщини й уламки
            if t < T_FALL:
                a = np.asarray(fr)
                fr = Image.fromarray(a[self.glass.sy, self.glass.sx], "RGBA")
            self.glass.cracks(fr, t)
        out = fr.convert("RGB")
        if T_HIT <= t < T_HIT + 0.6:                       # удар: спалах, зсув каналів, тремтіння
            u = (t - T_HIT) / 0.6
            a = np.asarray(out).astype(np.int16)
            k = int(round(14 * (1 - u) ** 2))
            if k:
                a[:, :, 0] = np.roll(a[:, :, 0], k, axis=1)
                a[:, :, 2] = np.roll(a[:, :, 2], -k, axis=1)
            a = a + int(110 * (1 - u / 0.4) ** 2) if u < 0.4 else a
            amp = 34 * math.exp(-u * 5)
            sx = int(amp * math.sin(t * 95))
            sy = int(amp * math.cos(t * 77))
            a = np.roll(np.roll(a, sx, axis=1), sy, axis=0)
            out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
        if T_FALL <= t < T_FALL + 0.3:                     # короткий глітч, коли скло падає
            a = np.asarray(out).copy()
            sh = int(10 * (1 - (t - T_FALL) / 0.3))
            a[:, :, 0] = np.roll(a[:, :, 0], sh, axis=1)
            out = Image.fromarray(a)
        return out


# ---------------------------------------------------------------- звук
def neon_buzz(dur=0.5, seed=0, on=True):
    n = int(dur * SR)
    t = nd.tt(n)
    rng = np.random.default_rng(seed)
    gate = np.repeat(rng.uniform(0, 1, n // 600 + 1) > 0.4, 600)[:n].astype(float)
    env = (t / dur) if on else (1 - t / dur)
    x = nd.lpf(nd.saw(120.0, n), 2400) * gate * env * 0.6 + nd.hpf(nd.noise(n, seed), 4000) * gate * 0.15
    return x * nd.edge(n, 0.002, 0.05)


SR = nd.SR


def story_sfx(dry, send):
    dry.put(pa.pain(), 0.0, 0.5)                          # якір болю на хуку; другий удар збігається з ударом кулака
    for s in (1, 2, 3):
        send.put(nd.shatter_sfx(s), T_HIT + 0.012 * s, 0.42, pan=(-0.3, 0.0, 0.3)[s - 1])
    dry.put(nd.boom_sfx(4), T_HIT, 0.6)
    send.put(nd.shatter_sfx(11), T_FALL + 0.08, 0.2, pan=-0.2)
    send.put(nd.shatter_sfx(12), T_FALL + 0.32, 0.15, pan=0.2)
    dry.put(neon_buzz(0.45, 1), T_DROP, 0.22)
    dry.put(nd.zap_sfx(), T_DROP + 0.4, 0.1)
    dry.put(nd.boom_sfx(7), T_MON, 0.3)
    dry.put(pa.pain(), T_TUE, 0.32)
    dry.put(neon_buzz(0.6, 2, on=False), T_TUE - 0.1, 0.2)
    for i in range(3):
        dry.put(neon_buzz(0.4, 5 + i), T_CHECK + 0.2 * i, 0.08, pan=0.3)
    for tp in TAPS:
        dry.put(nd.tick_sfx(1900), tp, 0.1)
        dry.put(nd.tick_sfx(2500), tp + 0.08, 0.08)
    dry.put(neon_buzz(0.35, 9), T_REAL - 0.05, 0.16)
    dry.put(pa.relief(), T_REAL, 0.34, pan=0.1)
    send.put(pa.logo(), T_END + 0.45, 0.38)


# ---------------------------------------------------------------- рендер
_V = None


def _init(lang):
    global _V
    _V = Video(lang)


def _frame(k):
    return _V.frame(k / FPS).tobytes()


def render(lang, out: Path, track=3):
    out.parent.mkdir(parents=True, exist_ok=True)
    wav = out.with_suffix(".wav")
    nd.soundtrack(wav, story_sfx=story_sfx, track=track)
    v = Video(lang)
    v.frame(0.36).save(out.with_name(out.stem + "-cover.jpg"), "JPEG", quality=92)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "medium",
           "-crf", "19", "-tune", "film", "-x264-params", "aq-mode=3", "-maxrate", "5000k", "-bufsize", "10M",
           "-pix_fmt", "yuv420p", "-profile:v", "high", "-af", "loudnorm=I=-14:TP=-1.0:LRA=9", "-c:a", "aac",
           "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        with Pool(2, initializer=_init, initargs=(lang,)) as pool:
            for buf in pool.imap(_frame, range(int(TOTAL * FPS)), chunksize=6):
                proc.stdin.write(buf)
    finally:
        proc.stdin.close()
        proc.wait()
    wav.unlink(missing_ok=True)
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")
    return out


if __name__ == "__main__":
    print(render(sys.argv[1], Path(sys.argv[2]), int(sys.argv[3]) if len(sys.argv) > 3 else 3))
