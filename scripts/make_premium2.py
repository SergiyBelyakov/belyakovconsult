"""Преміум-ролик нового покоління (тест 14.11.2026): «3 питання, на які дашборд має відповісти раді».

Усі покращення з розбору якості в одному ролику:
  справжні кадри демо: запис керівницької панелі сайту (Playwright) на скляному екрані в перспективі; камера
    наїжджає на потрібні ділянки, рубінові рамки й підсвітки з'являються в такт сюжету (фон грає в історії);
  інший сценарій: холодний старт (−9.8% EBITDA, «чому?») і три питання замість двох перевірок;
  кінетична типографіка: слова виходять у такт, ключове слово з ударом і спалахом;
  сильна перша секунда: число «влітає» з ударом звуку на першому кадрі;
  розмиття руху на різких проїздах камери (кілька підкадрів), відблиск на склі екрана, віддзеркалення;
  проти смуг: живе зерно на кожному кадрі, кодування -preset slow -crf 18 -tune film, aq-mode 3;
  звук: суперпила на 7 голосів, Haas-розширення, реверб із ранніми відбиттями, компресор і лімітер;
  окрема обкладинка-постер і автоматична перевірка якості (час читання, безпечні зони, контраст, зерно).

Запуск: python scripts/make_premium2.py <мова en|uk> <папка з кадрами демо> <вихідний.mp4>
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_nightdrive as nd  # noqa: E402
import premium_scenes as ps  # noqa: E402  (першим: він сам підтягує premium_demo_scenes)
import premium_demo_scenes as pds  # noqa: E402
from make_nightdrive import (BODY, GRAPHITE, PINK, RUBY, SILVER, WHITE, Bus, B, BAR, S16, SR, clamp, comp, ease,  # noqa: E402
                             lerp, tracked)

W, H, FPS = 1080, 1920, 30
TOTAL = 9 * BAR                 # 21.6 с
T_TITLE, T_Q1, T_Q2, T_Q3, T_TAKE, T_END = 2.4, 4.8, 8.4, 12.0, 15.6, 18.0
CUTS = [T_TITLE, T_Q1, T_Q2, T_Q3, T_TAKE]
VW, VH = 1440, 1000             # в'юпорт запису демо (кадри у 2x)

TEXT = {
    "en": {
        "hook": ("BOARD MEETING  ·  9:00", "−9.8%", ["EBITDA", "falls.", "First", "question:", "*why?*"]),
        "title": ["*3*", "*questions*", "/", "your", "dashboard", "must", "answer"],
        "q1": ("QUESTION 1 OF 3", "What is happening?", "Key measures and the gap to plan."),
        "q2": ("QUESTION 2 OF 3", "Why?", "Causes ranked by their share of the gap, with sources."),
        "q3": ("QUESTION 3 OF 3", "What do we do?", "Move a lever, watch EBITDA and cash."),
        "take": ["Can't", "answer", "*why?*", "/", "Then", "it's", "a", "scoreboard."],
        "end": "Send this to whoever prepares your board reports.",
        "demo": "LIVE DEMO  ·  BELYAKOVCONSULT.COM",
        "badge": "DEMO ON SYNTHETIC DATA",
    },
    "uk": {
        "hook": ("ЗАСІДАННЯ РАДИ  ·  9:00", "−9,8%", ["EBITDA", "падає.", "Перше", "питання:", "*чому?*"]),
        "title": ["*3*", "*питання,*", "/", "на", "які", "має", "відповісти", "дашборд"],
        "q1": ("ПИТАННЯ 1 / 3", "Що відбувається?", "Головні показники й відхилення від плану."),
        "q2": ("ПИТАННЯ 2 / 3", "Чому?", "Причини за часткою у відхиленні, з джерелами."),
        "q3": ("ПИТАННЯ 3 / 3", "Що робити?", "Посуньте важіль і побачите, як зміняться EBITDA та гроші."),
        "take": ["Не", "відповідає", "на", "*«чому»?*", "/", "Тоді", "це", "табло."],
        "end": "Перешліть тому, хто готує звіти для керівництва.",
        "demo": "ЖИВЕ ДЕМО  ·  BELYAKOVCONSULT.COM",
        "badge": "ДЕМО НА СИНТЕТИЧНИХ ДАНИХ",
    },
}

# вікна камери в координатах в'юпорта демо (центр x, центр y, ширина); висота = ширина / 1.44
SHOTS = {"wide": (720, 500, 1440), "q1": (850, 560, 760), "q2": (1150, 470, 640), "q3": (860, 690, 1040), "take": (720, 500, 1440)}
# рамки й підсвітки на кадрах демо (x0, y0, x1, y1 у в'юпорті), коли з'являються
MARKS = {
    "q1": [((664, 391, 1032, 748), 5.4), ((282, 300, 990, 352), 6.6), ((676, 478, 750, 506), 7.5)],
    "q2": [((890, 226, 1430, 345), 9.3), ((890, 360, 1430, 478), 9.9), ((890, 494, 1430, 612), 10.5)],
    "q3": [((282, 750, 668, 1000), 12.5), ((688, 752, 1430, 862), 13.8)],
}


def font(kind, size):
    return brand.font(kind, size)


def bwrap(text, f, maxw):
    return nd.bwrap(text, f, maxw)


# ---------------------------------------------------------------- кадри демо
class Footage:
    def __init__(self, folder: Path):
        load = lambda n: Image.open(folder / n).convert("RGB")  # noqa: E731
        self.a = load("a.png")
        self.b = [load(f"b_{i:02d}.png") for i in range(14)] + [load("b_final.png")]
        self.c0 = load("c.png")
        self.c = [load(f"c_{i:02d}.png") for i in range(14)]

    def frame(self, t):
        if t < T_Q2:
            return self.a
        if t < T_Q3:
            k = int((t - T_Q2 - 0.2) / 0.1)
            return self.b[clamp(k, 0, 14) if k >= 0 else 0] if k < 15 else self.b[14]
        if t < T_TAKE:
            if t < T_Q3 + 0.5:
                return self.c0
            k = int((t - T_Q3 - 0.5) / 0.1)
            return self.c[min(13, max(0, k))]
        return self.a


def shot_at(t):
    """Вікно камери: плавні наїзди на ділянки демо між фазами."""
    seq = [(0.0, "wide"), (T_Q1, "q1"), (T_Q2, "q2"), (T_Q3, "q3"), (T_TAKE, "take")]
    cur, prev, t0 = "wide", "wide", 0.0
    for ts, name in seq:
        if t >= ts:
            prev, cur, t0 = cur, name, ts
    u = ease((t - t0) / 0.7) if t0 > 0 else 1.0
    (ax, ay, aw), (bx, by, bw) = SHOTS[prev], SHOTS[cur]
    cx, cy, w = ax + (bx - ax) * u, ay + (by - ay) * u, aw + (bw - aw) * u
    drift = 1 - 0.035 * math.sin(t * 0.5)                    # повільне «дихання» камери
    w *= drift
    h = w / 1.44
    x0 = clamp(cx - w / 2, 0, VW - w)
    y0 = clamp(cy - h / 2, 0, VH - h)
    return x0, y0, w, h


# ---------------------------------------------------------------- кінетична типографіка
@lru_cache(maxsize=None)
def word_img(text, kind, size, col):
    f = font(kind, size)
    w = int(f.getlength(text)) + 8
    asc, desc = f.getmetrics()
    img = Image.new("RGBA", (w, asc + desc + 8), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((4, 4), text, font=f, fill=(*col, 255))
    return img


def layout(words, kind, size, maxw, gap):
    """Рядки слів по центру; «/» примусово переносить рядок; *слово* = ключове (рубін)."""
    f = font(kind, size)
    space = f.getlength(" ")
    lines, cur, cw = [], [], 0
    for w in words:
        if w == "/":
            lines.append(cur)
            cur, cw = [], 0
            continue
        key = w.startswith("*")
        txt = w.strip("*")
        ww = f.getlength(txt)
        if cur and cw + space + ww > maxw:
            lines.append(cur)
            cur, cw = [], 0
        cur.append((txt, key, ww))
        cw += (space if len(cur) > 1 else 0) + ww
    if cur:
        lines.append(cur)
    asc, desc = f.getmetrics()
    lh = int((asc + desc) * gap)
    out = []
    for li, line in enumerate(lines):
        total = sum(w for _, _, w in line) + space * (len(line) - 1)
        x = (W - total) / 2
        for txt, key, ww in line:
            out.append((txt, key, x, li * lh))
            x += ww + space
    return out, len(lines) * lh


def kinetic(fr, words, t, t0, y, kind="head", size=88, step=0.3, gap=1.02, color=WHITE, alpha=1.0, maxw=960):
    items, hgt = layout(words, kind, size, maxw, gap)
    for i, (txt, key, x, dy) in enumerate(items):
        ta = t0 + i * step
        u = (t - ta) / 0.22
        if u <= 0:
            continue
        a = clamp(u) * alpha
        col = RUBY if key else color
        img = word_img(txt, kind, size, col)
        oy = (1 - ease(u)) * 26
        if key:
            sc = 1 + 0.32 * (1 - ease((t - ta) / 0.32))
            if sc > 1.003:
                img = img.resize((int(img.width * sc), int(img.height * sc)), Image.BICUBIC)
            if 0 <= t - ta < 0.5:                                    # спалах удару
                glow = img.filter(ImageFilter.GaussianBlur(14))
                comp(fr, glow, x - (img.width - word_img(txt, kind, size, col).width) / 2, y + dy + oy - (img.height - word_img(txt, kind, size, col).height) / 2, (1 - (t - ta) / 0.5) * a)
            base = word_img(txt, kind, size, col)
            comp(fr, img, x - (img.width - base.width) / 2, y + dy + oy - (img.height - base.height) / 2, a)
        else:
            comp(fr, img, x, y + dy + oy, a)
    return hgt


def label(fr, text, y, a=1.0):
    d = ImageDraw.Draw(fr)
    tracked(d, text, font("body-semi", 30), W / 2, y, (*SILVER, int(255 * a)), 6)


def sub(fr, text, y, a=1.0, size=42, col=BODY):
    f = font("body", size)
    d = ImageDraw.Draw(fr)
    for ln in bwrap(text, f, 900):
        d.text(((W - f.getlength(ln)) / 2, y), ln, font=f, fill=(*col, int(255 * a)))
        y += int(size * 1.32)
    return y


# ---------------------------------------------------------------- 3D-екран з демо
def find_coeffs(dst, src):
    return pds.coeffs(dst, src)


class Screen:
    def __init__(self, footage: Footage, lang: str):
        self.f = footage
        self.badge = TEXT[lang]["badge"]
        tw, th = 1440, 1000
        bez = Image.new("RGBA", (tw + 56, th + 56), (0, 0, 0, 0))
        d = ImageDraw.Draw(bez)
        d.rounded_rectangle([0, 0, bez.width - 1, bez.height - 1], 42, fill=(12, 13, 18, 255), outline=(255, 255, 255, 70), width=3)
        d.rounded_rectangle([4, 4, bez.width - 5, bez.height - 5], 40, outline=(*RUBY, 120), width=2)
        self.bezel = bez
        m = Image.new("L", (tw, th), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, tw - 1, th - 1], 18, fill=255)
        self.mask = m

    def texture(self, t):
        src = self.f.frame(t)
        x0, y0, w, h = shot_at(t)
        crop = src.crop((int(x0 * 2), int(y0 * 2), int((x0 + w) * 2), int((y0 + h) * 2))).resize((1440, 1000), Image.BICUBIC)
        tex = crop.convert("RGBA")
        lay = Image.new("RGBA", tex.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        sx, sy = 1440 / w, 1000 / h
        for name, marks in MARKS.items():
            for (a0, b0, a1, b1), tm in marks:
                if not (tm - 0.05 <= t < tm + 3.4) or (name == "q1" and t >= T_Q2) or (name == "q2" and (t < T_Q2 or t >= T_Q3)) or (name == "q3" and t >= T_TAKE):
                    continue
                u = ease((t - tm) / 0.35)
                fade = clamp((tm + 3.4 - t) / 0.4)
                rx0, ry0, rx1, ry1 = (a0 - x0) * sx, (b0 - y0) * sy, (a1 - x0) * sx, (b1 - y0) * sy
                pad = 18 * (1 - u)
                pulse = 0.6 + 0.4 * math.sin((t - tm) * 6)
                d.rounded_rectangle([rx0 - pad, ry0 - pad, rx1 + pad, ry1 + pad], 16, fill=(*RUBY, int(28 * u * fade)),
                                    outline=(*lerp(RUBY, PINK, pulse * 0.4), int(255 * u * fade)), width=6)
        tex.alpha_composite(lay.filter(ImageFilter.GaussianBlur(10)))
        tex.alpha_composite(lay)
        # відблиск на склі
        u = ((t * 0.18) % 1.0)
        g = Image.new("L", (1440, 1000), 0)
        gd = ImageDraw.Draw(g)
        cx = -500 + u * 2600
        gd.polygon([(cx, 0), (cx + 220, 0), (cx - 380, 1000), (cx - 600, 1000)], fill=38)
        sheen = Image.new("RGBA", (1440, 1000), (255, 255, 255, 0))
        sheen.putalpha(g.filter(ImageFilter.GaussianBlur(30)))
        tex.alpha_composite(sheen)
        tex.putalpha(self.mask)
        dev = self.bezel.copy()
        dev.alpha_composite(tex, (28, 28))
        fb = font("body-semi", 22)
        bd = ImageDraw.Draw(dev)
        tw = fb.getlength(self.badge)
        bd.rounded_rectangle([dev.width - tw - 92, dev.height - 70, dev.width - 48, dev.height - 30], 20, fill=(10, 10, 14, 210), outline=(255, 255, 255, 60))
        bd.text((dev.width - tw - 70, dev.height - 62), self.badge, font=fb, fill=(*SILVER, 255))
        return dev

    def quad(self, t):
        """Положення екрана: різкі проїзди камери на склейках, між ними ледь помітний облет."""
        yaw = 0.18 * math.sin(t * 0.33)
        pitch = -0.10
        dist = 2300
        for c in CUTS[1:]:
            if c - 0.18 <= t < c + 0.3:                      # проїзд-«віп»: швидкий поворот на склейці
                u = (t - (c - 0.18)) / 0.48
                yaw += 0.55 * math.sin(u * math.pi) * (1 if CUTS.index(c) % 2 else -1)
        if t < T_TITLE:                                       # наїзд на старті
            dist = 2900 - 600 * ease(t / T_TITLE)
        if t >= T_TAKE:                                        # відступ під висновок
            dist = 2300 + 700 * ease((t - T_TAKE) / 1.2)
        w, h = 1496, 1056
        P = np.array([[-w / 2, h / 2, 0], [w / 2, h / 2, 0], [w / 2, -h / 2, 0], [-w / 2, -h / 2, 0]], float)
        cy = 1150 + 90 * (1 - ease((t - T_TITLE) / 2.4)) if t < T_Q1 else 1150     # на старті нижче, щоб не закривати хук
        sx, sy, _, _ = pds.project(P, yaw, pitch, dist, 1880, 540, cy)
        return list(zip(sx, sy))

    def draw(self, fr, t, alpha=1.0, blur=0.0):
        dev = self.texture(t)
        q = self.quad(t)
        xs, ys = [p[0] for p in q], [p[1] for p in q]
        x0, y0 = int(min(xs)) - 2, int(min(ys)) - 2
        x1, y1 = int(max(xs)) + 2, int(max(ys)) + 2
        local = [(px - x0, py - y0) for px, py in q]
        out = dev.transform((x1 - x0, y1 - y0), Image.PERSPECTIVE, find_coeffs(local, [(0, 0), (dev.width, 0), (dev.width, dev.height), (0, dev.height)]), Image.BICUBIC)
        if blur > 0.3:
            out = out.filter(ImageFilter.GaussianBlur(blur))
        # віддзеркалення на «підлозі»
        refl = out.transpose(Image.FLIP_TOP_BOTTOM)
        g = Image.linear_gradient("L").resize(refl.size).point(lambda v: int(max(0, 70 - v * 0.5)))
        ra = Image.composite(refl.getchannel("A"), Image.new("L", refl.size, 0), g)
        refl.putalpha(ra)
        comp(fr, refl.filter(ImageFilter.GaussianBlur(4)), x0, y1 + 6, alpha * 0.9)
        halo = ps.halo_img(1500, 110)
        comp(fr, halo, 540 - 750, 1150 - 750, alpha * 0.85)
        comp(fr, out, x0, y0, alpha)


# ---------------------------------------------------------------- кадр
class Video:
    def __init__(self, lang: str, footage_dir: Path):
        self.lang = lang
        self.T = TEXT[lang]
        self.screen = Screen(Footage(footage_dir), lang)
        self.bg = ps.sky(horizon=2600, top=GRAPHITE, low=(26, 8, 22), glow=0.0, refl_x=None)
        self.lock = brand.lockup(52)
        self.logo = brand.logo(200)
        self.rng = np.random.default_rng(77)

    def base(self, t):
        fr = self.bg.copy()
        pds.site_waves(fr, t, 1600, 110, 28, 0.7, 1.2)
        return fr

    def header(self, fr, t):
        T = self.T
        if t < T_TITLE:                                       # холодний старт: число влітає з ударом
            label(fr, T["hook"][0], 268)
            f = font("head", 236)
            num = T["hook"][1]
            img = word_img(num, "head", 236, RUBY)
            sc = 1 + 0.35 * (1 - ease(t / 0.22))
            im = img.resize((int(img.width * sc), int(img.height * sc)), Image.BICUBIC) if sc > 1.003 else img
            glow = img.filter(ImageFilter.GaussianBlur(26))
            comp(fr, glow, (W - img.width) / 2, 318, 0.9)
            comp(fr, im, (W - im.width) / 2, 318 - (im.height - img.height) / 2)
            sh = nd_sheen(img, (t - 0.55) / 0.8)
            if sh:
                comp(fr, sh, (W - img.width) / 2, 318)
            kinetic(fr, T["hook"][2], t, 0.35, 592, "body-semi", 46, 0.16, 1.15, WHITE)
            _ = f
        elif t < T_Q1:
            kinetic(fr, T["title"], t, T_TITLE + 0.05, 300, "head", 104, 0.24, 1.0)
        elif t < T_TAKE:
            name = "q1" if t < T_Q2 else ("q2" if t < T_Q3 else "q3")
            t0 = {"q1": T_Q1, "q2": T_Q2, "q3": T_Q3}[name]
            t1 = {"q1": T_Q2, "q2": T_Q3, "q3": T_TAKE}[name]
            lab, ttl, sb = T[name]
            a_out = clamp((t1 - t) / 0.18)
            label(fr, lab, 268, clamp((t - t0) / 0.25) * a_out)
            words = ttl.split()
            words[-1] = "*" + words[-1] + "*"
            hgt = kinetic(fr, words, t, t0 + 0.12, 330, "head", 116 if len(ttl) < 14 else 96, 0.22, 1.0, WHITE, a_out)
            sub(fr, sb, 330 + hgt + 14, clamp((t - t0 - 0.9) / 0.35) * a_out)
        elif t < T_END:
            kinetic(fr, self.T["take"], t, T_TAKE + 0.1, 300, "head", 84, 0.18, 1.04)

    def end(self, fr, t):
        u = t - T_END
        r = 1300 * (1 - ease(u / 0.7))
        m = Image.new("L", (W, H), 215)
        if u < 0.7:
            ImageDraw.Draw(m).ellipse([540 - r, 1000 - r, 540 + r, 1000 + r], fill=0)
        dark = Image.new("RGBA", (W, H), (*GRAPHITE, 255))
        dark.putalpha(m)
        fr.alpha_composite(dark)
        k = ease((u - 0.35) / 0.6)
        comp(fr, self.logo, W / 2 - self.logo.width / 2, 560 + (1 - k) * 30, k)
        sh = nd_sheen(self.logo, (u - 0.9) / 0.9)
        if sh:
            comp(fr, sh, W / 2 - self.logo.width / 2, 560)
        y = sub(fr, self.T["end"], 860, ease((u - 0.7) / 0.5), 46, WHITE)
        d = ImageDraw.Draw(fr)
        k3 = ease((u - 1.1) / 0.5)
        d.line([W / 2 - 60 * k3, y + 24, W / 2 + 60 * k3, y + 24], fill=(*RUBY, int(255 * k3)), width=3)
        tracked(d, self.T["demo"], font("body-semi", 32), W / 2, y + 46, (*SILVER, int(255 * k3)), 5)

    def render_one(self, t):
        fr = self.base(t)
        if t < T_END + 0.6:
            blur = 6 * ease((t - T_TAKE) / 0.5) if t >= T_TAKE else 0.0     # розфокус екрана під висновок
            a = 1.0 if t < T_END else clamp(1 - (t - T_END) / 0.6)
            self.screen.draw(fr, t, a, blur)
        if t < 0.25:                                          # удар світла на першому кадрі (м'який, число читається)
            comp(fr, ps.halo_img(1800, 255, (255, 225, 230)), 540 - 900, 1100 - 900, (1 - t / 0.25) ** 2 * 0.3)
        for c in CUTS[1:]:
            if 0 <= t - c < 0.3:
                comp(fr, ps.halo_img(1800, 255, (255, 225, 230)), 540 - 900, 1110 - 900, (1 - (t - c) / 0.3) ** 2 * 0.35)
        self.header(fr, t)
        if t >= T_END:
            self.end(fr, t)
        else:
            fr.alpha_composite(self.lock, (72, 116))
        return fr

    def frame(self, t):
        whip = any(c - 0.18 <= t < c + 0.3 for c in CUTS[1:])
        if whip:                                              # розмиття руху: середнє з 4 підкадрів
            acc = None
            for k in range(4):
                a = np.asarray(self.render_one(t + k / 120).convert("RGB"), dtype=np.float32)
                acc = a if acc is None else acc + a
            img = acc / 4
        else:
            img = np.asarray(self.render_one(t).convert("RGB"), dtype=np.float32)
        grain = self.rng.normal(0, 2.4, (H // 2, W // 2)).astype(np.float32)   # живе зерно проти смуг
        grain = np.repeat(np.repeat(grain, 2, 0), 2, 1)[..., None]
        return Image.fromarray(np.clip(img + grain, 0, 255).astype(np.uint8))


def nd_sheen(img, u):
    import make_premium
    return make_premium.sheen(img, u)


# ---------------------------------------------------------------- звук
def pad7(notes, dur, cutoff=2200, attack=0.05, release=0.4):
    """Суперпила на 7 голосів і Haas-розширення (правий канал на 12 мс пізніше)."""
    n = int((dur + release) * SR)
    t = nd.tt(n)
    L, R = np.zeros(n), np.zeros(n)
    det = (-0.19, -0.12, -0.05, 0.0, 0.05, 0.12, 0.19)
    for j, m in enumerate(notes):
        for v, dt in enumerate(det):
            s = nd.saw(nd.midi(m + dt), n, ph0=(j * 0.37 + v * 0.13) % 1)
            if v <= 3:
                L += s
            if v >= 3:
                R += s
    env = np.clip(t / attack, 0, 1) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (release / 3)))
    k = 1.0 / (len(notes) * 3.2)
    L, R = nd.lpf(L, cutoff) * env * k, nd.lpf(R, cutoff) * env * k
    d = int(0.012 * SR)
    R = np.concatenate([np.zeros(d), R[:-d]])
    return L, R


def sting():
    """Удар на першому кадрі: суб-падіння, шумовий сплеск, металевий дзвін."""
    n = int(2.2 * SR)
    t = nd.tt(n)
    sub_ = np.sin(2 * np.pi * np.cumsum(38 + 90 * np.exp(-t * 9)) / SR) * np.exp(-t * 1.6)
    hit = nd.lpf(nd.noise(n, 5), 3000) * np.exp(-t * 14) * 0.8
    ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * dcy) for f, dcy in ((220, 1.6), (331, 2.2), (587, 3.0))) * 0.18
    return np.tanh(1.6 * (sub_ + hit + ring)) * nd.edge(n, 0.0005, 0.3)


def whoosh(dur=0.5, seed=3, up=True):
    n = int(dur * SR)
    x = nd.sweep_bp(nd.noise(n, seed), 400 if up else 6000, 6000 if up else 400)
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    return x * env


def compress(x, thr=0.35, ratio=3.0, att=0.005, rel=0.12):
    mono = np.max(np.abs(x), axis=1)
    env = np.zeros_like(mono)
    a_att, a_rel = math.exp(-1 / (att * SR)), math.exp(-1 / (rel * SR))
    # огинаюча блоками по 64 відліки (швидко й достатньо для мастерингу)
    blk = 64
    m = mono[: len(mono) // blk * blk].reshape(-1, blk).max(axis=1)
    e, out = 0.0, np.zeros_like(m)
    ab, rb = a_att ** blk, a_rel ** blk
    for i, v in enumerate(m):
        e = ab * e + (1 - ab) * v if v > e else rb * e + (1 - rb) * v
        out[i] = e
    env[: len(out) * blk] = np.repeat(out, blk)
    env[len(out) * blk:] = out[-1] if len(out) else 0
    gain = np.where(env > thr, (thr + (env - thr) / ratio) / np.maximum(env, 1e-9), 1.0)
    return x * gain[:, None]


def limit(x, ceiling=0.94, look=0.005):
    n = int(look * SR)
    peak = np.max(np.abs(x), axis=1)
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    pk = maximum_filter1d(peak, size=2 * n + 1)
    g = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    g = uniform_filter1d(g, size=n)
    return x * g[:, None]


def soundtrack(path: Path):
    dur = TOTAL + 1.5
    dry, send, padbus = Bus(dur), Bus(dur), Bus(dur)
    P = nd.TRACKS[2]                                          # гармонія Chrome Dawn, власна аранжування
    nd.TRANSPOSE = 0
    # 0..2.4 холодний старт: удар, vaporwave-пад, наростання
    dry.put(sting(), 0.0, 0.9)
    l, r = pad7([57, 60, 64, 71], BAR, cutoff=1500, attack=0.01, release=1.2)
    padbus.put2(l, r, 0.0, 0.8)
    for i in range(4):
        dry.put(nd.hat_c(i, 0.5), i * B + 0.3, 0.1, pan=0.3)
    n = int(1.2 * SR)
    dry.put(nd.sweep_bp(nd.noise(n, 21), 300, 7000) * np.linspace(0, 1, n) ** 2, T_TITLE - 1.2, 0.45)
    dry.put(nd.cymbal(31, 1.0)[::-1], T_TITLE - 1.0, 0.3)
    at, g = T_TITLE - B, 0.15
    while at < T_TITLE - 0.01:
        dry.put(nd.snare_gated(int(at * 100)), at, g)
        g = min(0.5, g + 0.06)
        at += S16 / 2
    # 2.4..12.0 synthwave: 4 такти
    prog = [("Am", 1), ("F", 2), ("C", 3), ("G", 4)]
    for ch, bar in prog:
        root, tones = nd.CH[ch]
        t0 = bar * BAR
        l, r = pad7(list(tones) + [tones[0] + 12], BAR, cutoff=2600)
        padbus.put2(l, r, t0, 1.0)
        for s in range(16):
            a = t0 + s * S16
            dry.put(nd.bass_note(root - 12 + (12 if s % 2 else 0), S16 * 0.92), a, 0.42)
            arp = [tones[0] + 12, tones[1] + 12, tones[2] + 12, tones[0] + 24]
            send.put(nd.pluck(arp[P["arp"][s % 8]], S16 * 0.9), a, 0.12, pan=(-0.45 if s % 2 else 0.45))
    for i in range(16):
        a = T_TITLE + i * B
        dry.put(nd.kick80(), a, 0.95)
        if i % 2 == 1:
            send.put(nd.snare_gated(i), a, 0.55)
            send.put(nd.clap(i + 40), a, 0.22)
        for e in range(4):
            dry.put(nd.hat_c(i * 4 + e, 1.0), a + e * S16, 0.17 if e % 2 else 0.09, pan=0.35)
        dry.put(nd.hat_o(i), a + B / 2, 0.07, pan=-0.3)
    dry.put(nd.cymbal(1), T_TITLE, 0.4)
    lead = [(76, 2), (79, 2), (81, 3), (79, 1), (77, 2), (76, 2), (72, 4), (74, 2), (76, 2), (79, 2), (76, 2), (74, 4), (71, 4)]
    at = T_Q1
    for m, e in lead:
        sig = nd.lead(m, e * B / 2 * 0.95, 3600)
        send.put(sig, at, 0.15)
        send.put(nd.lpf(sig, 2200), at + 0.75 * B, 0.05, pan=-0.6)
        send.put(nd.lpf(sig, 1800), at + 1.5 * B, 0.03, pan=0.6)
        at += e * B / 2
    # 12..15.6 phonk-кібер, 1.5 такту
    for k, (ch, beats) in enumerate((("Am", 4), ("F", 2))):
        root, tones = nd.CH[ch]
        t0 = T_Q3 + k * BAR
        l, r = pad7(tones, beats * B, cutoff=1300)
        padbus.put2(l, r, t0, 0.8)
        steps = beats * 4
        for s in (0, 6, 10):
            if s < steps:
                dry.put(nd.kick808(), t0 + s * S16, 0.8)
        for s in (4, 12):
            if s < steps:
                send.put(nd.clap(s + k), t0 + s * S16, 0.38)
        for s in range(steps):
            dry.put(nd.hat_c(200 + k * 16 + s, 1.0), t0 + s * S16, 0.14 if s % 2 else 0.08, pan=0.3)
        for s, m in P["cow"][k]:
            if s < steps:
                send.put(nd.cowbell(m), t0 + s * S16, 0.16, pan=0.15)
        glide = [(st * S16, nt) for st, nt in P["glide"][k] if st < steps]
        dry.put(nd.bass808(glide, beats * B), t0, 0.5)
    # 15.6 удар і dreamwave до кінця
    dry.put(sting(), T_TAKE, 0.55)
    dry.put(nd.cymbal(2, 2.6), T_TAKE, 0.4)
    dry.put(nd.kick80(), T_TAKE, 1.0)
    l, r = pad7([53, 57, 60, 65, 69], BAR, cutoff=3800, attack=0.01, release=0.6)
    padbus.put2(l, r, T_TAKE, 1.1)
    send.put(nd.snare_gated(77), T_TAKE + B, 0.45)
    send.put(nd.snare_gated(78), T_TAKE + 3 * B, 0.45)
    for i, (ch, cut) in enumerate((("F", 2600), ("Am9", 1800))):
        root, tones = nd.CH[ch]
        t0 = T_END + i * BAR * 0.75
        l, r = pad7(list(tones) + [tones[0] + 12], BAR * 0.75, cutoff=cut, attack=0.2, release=1.8 if i else 0.5)
        padbus.put2(l, r, t0, 0.95)
        for s in range(6):
            send.put(nd.pluck(tones[s % len(tones)] + 12, B / 2 * 0.9, 2000), t0 + s * B / 2, 0.09 * (1 - (i * 6 + s) / 14), pan=(-0.5 if s % 2 else 0.5))
    at = T_TAKE
    for m, e in [(81, 4), (79, 2), (77, 2), (76, 6), (72, 2), (69, 8)]:
        sig = nd.lead(m, e * B / 2 * 0.95, 3200)
        send.put(sig, at, 0.13)
        at += e * B / 2
    # звуки сюжету: проїзди камери, удари ключових слів, позначки
    for c in CUTS[1:]:
        send.put(whoosh(0.5, int(c * 10)), c - 0.35, 0.3, pan=(0.4 if CUTS.index(c) % 2 else -0.4))
    for marks in MARKS.values():
        for _, tm in marks:
            dry.put(nd.tick_sfx(1900), tm, 0.08)
            send.put(nd.collapse_sfx(int(tm * 10)), tm - 0.05, 0.12)
    for tk in (1.31, T_TITLE + 0.05, T_TAKE + 0.1 + 5 * 0.18):
        dry.put(nd.boom_sfx(int(tk * 7)), tk, 0.28)
    # зведення: «качання» паду від бочки, реверб з ранніми відбиттями, компресор, лімітер
    kicks = [T_TITLE + i * B for i in range(16)] + [T_Q3 + s * S16 for s in (0, 6, 10)] + [T_Q3 + BAR, T_TAKE]
    duck = np.ones(len(padbus.L))
    m = int(0.32 * SR)
    for k in kicks:
        a = int(k * SR)
        b_ = min(len(duck), a + m)
        duck[a:b_] = np.minimum(duck[a:b_], 1 - 0.6 * np.exp(-nd.tt(b_ - a) / 0.11))
    padbus.L *= duck
    padbus.R *= duck
    nir = int(2.2 * SR)
    tir = nd.tt(nir)
    irs = []
    for sd in (91, 92):
        ir = nd.lpf(nd.noise(nir, sd), 6500) * np.exp(-tir * 2.6) * np.clip((tir - 0.025) / 0.01, 0, 1)
        rng = np.random.default_rng(sd)
        for _ in range(9):                                     # ранні відбиття
            p = int(rng.uniform(0.008, 0.07) * SR)
            ir[p] += rng.uniform(0.4, 0.9) * (1 if rng.random() > 0.5 else -1) * 8
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    from scipy.signal import fftconvolve
    revL = fftconvolve(send.L + 0.5 * padbus.L, irs[0])[:len(dry.L)]
    revR = fftconvolve(send.R + 0.5 * padbus.R, irs[1])[:len(dry.L)]
    L = dry.L + send.L + padbus.L * 0.55 + revL * 0.3
    R = dry.R + send.R + padbus.R * 0.55 + revR * 0.3
    st = np.stack([L, R], axis=1)[: int(TOTAL * SR)]
    st /= max(1e-9, np.abs(st).max())
    st = compress(st, 0.32, 3.0)
    st /= max(1e-9, np.abs(st).max())
    st = limit(st * 1.25, 0.94)
    fade = int(1.2 * SR)
    st[-fade:] *= np.linspace(1, 0, fade)[:, None]
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


# ---------------------------------------------------------------- обкладинка й перевірка якості
def cover(v: Video, path: Path):
    fr = v.base(9.0)
    v.screen.draw(fr, 6.0)
    T = v.T
    dark = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = Image.linear_gradient("L").resize((W, 900)).point(lambda x: 255 - x)
    dark.paste(Image.new("RGBA", (W, 900), (*GRAPHITE, 235)), (0, 0), g)
    fr.alpha_composite(dark)
    label(fr, T["hook"][0], 330)
    kinetic(fr, T["title"], 99, 0, 390, "head", 112, 0.0, 1.0)
    fr.alpha_composite(v.lock, (72, 116))
    fr.convert("RGB").save(path, "JPEG", quality=93)


def qc(v: Video, mp4: Path):
    rep = {}
    phases = {"hook": (0, T_TITLE, len(v.T["hook"][2]) + 2), "title": (T_TITLE, T_Q1, len([w for w in v.T["title"] if w != "/"])),
              "q1": (T_Q1, T_Q2, len(" ".join(v.T["q1"][1:]).split())), "q2": (T_Q2, T_Q3, len(" ".join(v.T["q2"][1:]).split())),
              "q3": (T_Q3, T_TAKE, len(" ".join(v.T["q3"][1:]).split())), "take": (T_TAKE, T_END, len([w for w in v.T["take"] if w != "/"])),
              "end": (T_END, TOTAL, len(v.T["end"].split()) + 3)}
    rep["words_per_second"] = {k: round(n / (b - a), 2) for k, (a, b, n) in phases.items()}
    rep["reading_ok"] = all(x <= 3.3 for x in rep["words_per_second"].values())
    # контраст: яскравість тла в зоні заголовків (без тексту) на середині фаз
    worst = 99.0
    for k, (a, b, _) in phases.items():
        fr = v.base((a + b) / 2)
        if (a + b) / 2 < T_END:
            v.screen.draw(fr, (a + b) / 2)
        arr = np.asarray(fr.convert("L").crop((60, 250, 1020, 760)), dtype=np.float32) / 255
        lum = float(np.percentile(arr, 95)) ** 2.2
        worst = min(worst, (1.05) / (lum + 0.05))
    rep["text_contrast_min"] = round(worst, 1)
    # безпечні зони: текст у межах y 250..1150 та x 60..1020 (поза кнопками Reels/Shorts)
    rep["safe_zones"] = "text y 250..1150, x 60..1020; device lower area may sit under platform buttons"
    # зерно проти смуг: розкид пікселів у плоскій темній ділянці закодованого відео
    out = subprocess.run(["ffmpeg", "-v", "error", "-ss", "3.0", "-i", str(mp4), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                         capture_output=True).stdout
    if out:
        g = np.frombuffer(out, np.uint8).reshape(H, W).astype(np.float32)
        patch = g[40:200, 400:700]
        rep["flat_area_std"] = round(float(patch.std()), 2)
    return rep


def encode(out: Path, wav: Path, frames):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "slow",
           "-crf", "18", "-tune", "film", "-x264-params", "aq-mode=3", "-maxrate", "9M", "-bufsize", "18M", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-af", "loudnorm=I=-14:TP=-1.0:LRA=9", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
           "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for img in frames:
            proc.stdin.write(img.tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")


def render(lang: str, footage: Path, out: Path):
    out.parent.mkdir(parents=True, exist_ok=True)
    v = Video(lang, footage)
    wav = out.with_suffix(".wav")
    soundtrack(wav)
    cover(v, out.with_name(out.stem + "-cover.jpg"))
    encode(out, wav, (v.frame(k / FPS) for k in range(int(TOTAL * FPS))))
    wav.unlink(missing_ok=True)
    rep = qc(v, out)
    out.with_name(out.stem + "-qc.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1))
    print(json.dumps(rep, ensure_ascii=False))
    return out


if __name__ == "__main__":
    render(sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]))
