"""Трендовий формат «GRWM loading» (Instagram, осінь 2026): «GRWM: month-end report edition».

Капібара-аналітик «збирається» разом зі звітом: 0% у халаті з патчами під очима, кожна склейка під біт додає
відсотки (тестові рядки, дублікати, дати 1900, одне визначення, власники показників, перевірки), а образ
доповнюється: окуляри, сорочка з краваткою, піджак, мандаринка. На 99% смуга застрягає: «waiting for one Excel
from accounting». Потім 100%: «READY.» Фінал: «CLEAN DATA FIRST. THEN THE REPORT.» і питання до аудиторії.

Вертикаль 9:16 для всіх мереж (LinkedIn у 2026 підсилює вертикальне відео), весь зміст текстом на екрані
(перегляд без звуку). Дві мови: en і uk.

Запуск: python scripts/make_grwm.py <папка> <en|uk>
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
from make_fun import (  # noqa: E402
    CAP, CAP_D, CAP_L, CAP_S, FPS, GRAPHITE, INK, ORANGE, ORANGE_L, LEAF, PANEL, PANEL_LINE, BAR, BAR_BG, RUBY, SILVER,
    SR, WHITE, Mix, back, clamp, crash, ease, env, fit_size, groove, hat, kick, melody, midi, put, sfx_ding,
    sfx_whoosh, sprite, sq, text_block, tri, xform)

W, H = 1080, 1920
BEAT = 0.6
STAGE = 4 * BEAT
PCTS = [0, 8, 23, 41, 58, 76, 92]
T_STALL = STAGE * 7            # 16.8: 99%
T_READY = 21.0
T_END = 24.0
TOTAL = 28.5
CUTS = [STAGE * i for i in range(1, 7)] + [T_STALL, T_READY, T_END]

TEXT = {
    "en": dict(title=["GRWM:", "MONTH-END REPORT"], loading="LOADING", card="MONTH-END REPORT", issues="{n} ISSUES",
               steps=["+ test rows removed", "+ duplicates merged", "+ 1900 dates fixed", '+ one definition of "active"',
                      "+ every metric has an owner", "+ checks passed"],
               chips=["TEST ROWS", "DUPLICATES", "1900 DATES", "3 DEFINITIONS", "NO OWNERS", "FAILED CHECKS"],
               stall="waiting for one Excel from accounting", ready="READY.", ready_sub="and it won't change after month-end",
               end=["CLEAN DATA FIRST.", "THEN THE REPORT."], cta="What's your 99%?", cover=["MONTH-END REPORT", "GRWM"]),
    "uk": dict(title=["GRWM:", "ЗВІТ ЗА МІСЯЦЬ"], loading="ЗАВАНТАЖЕННЯ", card="ЗВІТ ЗА МІСЯЦЬ", issues="ПРОБЛЕМ: {n}",
               steps=["+ прибрали тестові рядки", "+ злили дублікати", "+ виправили дати 1900", "+ одне визначення «активного»",
                      "+ у кожного показника є власник", "+ перевірки пройдено"],
               chips=["ТЕСТОВІ РЯДКИ", "ДУБЛІКАТИ", "ДАТИ 1900", "3 ВИЗНАЧЕННЯ", "БЕЗ ВЛАСНИКІВ", "ПЕРЕВІРКИ"],
               stall="чекаємо один Excel від бухгалтерії", ready="ГОТОВО.", ready_sub="і він не зміниться після закриття місяця",
               end=["СПОЧАТКУ ЧИСТІ ДАНІ.", "ПОТІМ ЗВІТ."], cta="А який ваш 99%?", cover=["ЗВІТ ЗА МІСЯЦЬ", "GRWM"]),
}

ROBE, ROBE_D = (246, 190, 210), (226, 160, 186)
PATCH = (255, 222, 232)
CX, O = 380, 110
EYES = [(CX - 118, 210 + O), (CX + 118, 210 + O)]


def draw_capy(stage):
    """Образ капібари на етапі stage (0..8): халат і патчі, далі окуляри, сорочка з краваткою, піджак, мандаринка."""
    cx, o = CX, O
    lap = (30, 36, 47)

    def body(d, S, k):
        if stage < 3:                                                             # пухнастий халат
            d.rounded_rectangle(S(50, 500 + o, 710, 1500 + o), radius=230 * k, fill=ROBE)
            d.polygon(S(cx - 110, 490 + o, cx, 760 + o, cx + 110, 490 + o), fill=CAP)
            d.polygon(S(cx - 110, 490 + o, cx - 10, 760 + o, cx - 60, 1000 + o, cx - 200, 560 + o), fill=ROBE_D)
            d.polygon(S(cx + 110, 490 + o, cx + 10, 760 + o, cx + 60, 1000 + o, cx + 200, 560 + o), fill=ROBE_D)
            d.rounded_rectangle(S(80, 900 + o, 680, 950 + o), radius=20 * k, fill=ROBE_D)
            for x, y in ((180, 700), (560, 760), (240, 1100), (520, 1150)):
                d.ellipse(S(x - 14, y - 14 + o, x + 14, y + 14 + o), fill=(255, 214, 228))
            return
        col = INK if stage >= 4 else WHITE
        d.rounded_rectangle(S(50, 500 + o, 710, 1500 + o), radius=230 * k, fill=col, outline=(54, 62, 78), width=6 * k)
        d.polygon(S(cx - 100, 490 + o, cx, 690 + o, cx + 100, 490 + o), fill=WHITE)
        if stage >= 4:
            d.polygon(S(cx - 100, 490 + o, cx - 20, 620 + o, cx - 130, 860 + o, cx - 205, 580 + o), fill=lap)
            d.polygon(S(cx + 100, 490 + o, cx + 20, 620 + o, cx + 130, 860 + o, cx + 205, 580 + o), fill=lap)
            d.polygon(S(cx - 212, 694 + o, cx - 126, 694 + o, cx - 140, 652 + o, cx - 166, 672 + o, cx - 190, 650 + o), fill=RUBY)
            for by in (900, 1000):
                d.ellipse(S(cx - 13, by - 13 + o, cx + 13, by + 13 + o), fill=(46, 52, 64))
        else:
            d.line(S(cx, 690 + o, cx, 1500 + o), fill=(214, 218, 226), width=4 * k)
        d.polygon(S(cx - 27, 498 + o, cx + 27, 498 + o, cx + 21, 538 + o, cx - 21, 538 + o), fill=RUBY)
        d.polygon(S(cx - 21, 538 + o, cx + 21, 538 + o, cx + 46, 770 + o, cx, 822 + o, cx - 46, 770 + o), fill=RUBY)

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
        d.arc(S(cx - 58, 392 + o, cx, 446 + o), 20, 160, fill=(72, 52, 36), width=6 * k)
        d.arc(S(cx, 392 + o, cx + 58, 446 + o), 20, 160, fill=(72, 52, 36), width=6 * k)
        for ex, ey in EYES:
            if stage == 0:                                                        # спить, патчі під очима
                d.arc(S(ex - 28, ey - 30, ex + 28, ey + 10), 20, 160, fill=INK, width=8 * k)
                d.chord(S(ex - 60, ey + 2, ex + 40, ey + 70), 0, 180, fill=PATCH)
            else:
                d.ellipse(S(ex - 24, ey - 22, ex + 24, ey + 22), fill=INK)
                d.ellipse(S(ex - 13, ey + 2, ex - 3, ey + 12), fill=WHITE)
                lid = 40 if stage < 2 else 32
                d.chord(S(ex - 32, ey - lid, ex + 32, ey + (32 if stage >= 2 else 44)), 180, 360, fill=CAP)
        if stage >= 2:
            gl = (228, 232, 238)
            for ex, ey in EYES:
                d.ellipse(S(ex - 74, ey - 70, ex + 74, ey + 70), outline=gl, width=11 * k)
            ey = EYES[0][1]
            d.arc(S(cx - 48, ey - 34, cx + 48, ey + 14), 200, 340, fill=gl, width=10 * k)

    def hat(d, S, k):
        if stage >= 5:
            mx, my, r = cx + 8, 44 + o - 32, 56
            d.ellipse(S(mx - r, my - r, mx + r, my + r * 0.92), fill=ORANGE)
            d.ellipse(S(mx - r * 0.55, my - r * 0.62, mx - r * 0.1, my - r * 0.22), fill=ORANGE_L)
            d.ellipse(S(mx + 8, my - r - 26, mx + 60, my - r + 2), fill=LEAF)
    return sprite(760, 1180, body, head, hat)


def stage_at(t):
    if t >= T_READY:
        return 8
    if t >= T_STALL:
        return 7
    return min(6, int(t // STAGE))


def pct_at(t):
    s = stage_at(t)
    if s == 8:
        return 100
    if s == 7:
        return 99 if t > T_STALL + 0.25 else int(92 + 7 * ease((t - T_STALL) / 0.25))
    t0 = s * STAGE
    prev = PCTS[max(0, s - 1)]
    return int(round(prev + (PCTS[s] - prev) * ease((t - t0) / 0.3)))


class Grwm:
    def __init__(self, lang):
        self.T = TEXT[lang]
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
            gd.ellipse([W // 2 - r, int(H * 0.55) - r, W // 2 + r, int(H * 0.55) + r], fill=int(60 * (1 - i / 30) ** 2))
        self.bg = Image.composite(Image.new("RGB", (W, H), RUBY), bg, glow)
        self.capy = [xform(draw_capy(s), 0.8) for s in range(9)]
        self.lock = brand.lockup(50)
        self.logo = brand.logo(170)
        self._c = {}

    def cache(self, key, fn):
        if key not in self._c:
            self._c[key] = fn()
        return self._c[key]

    def card(self, s):
        """Картка звіту: лічильник проблем, міні-діаграма (вирівнюється), фішки проблем, виправлені закреслені."""
        def make():
            T = self.T
            w, h = 470, 540
            im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            d = ImageDraw.Draw(im)
            d.rounded_rectangle([0, 0, w - 1, h - 1], 24, fill=(*PANEL, 248), outline=PANEL_LINE, width=3)
            d.text((28, 24), T["card"], font=brand.font("body-semi", fit_size([T["card"]], 190, 28, "body-semi")), fill=SILVER)
            n = max(0, 6 - min(s, 6))
            lab = T["issues"].format(n=n)
            fb = brand.font("head", 26)
            bw = d.textlength(lab, font=fb) + 30
            d.rounded_rectangle([w - 24 - bw, 18, w - 24, 62], 20, fill=RUBY if n else WHITE)
            d.text((w - 24 - bw + 15, 25), lab, font=fb, fill=WHITE if n else INK)
            p = min(s, 6) / 6
            messy, clean = [0.45, 0.0, 1.0, 0.3, 0.55], [0.42, 0.5, 0.58, 0.66, 0.76]
            for i in range(5):
                hh = (messy[i] + (clean[i] - messy[i]) * p) * 170
                x = 40 + i * 82
                col = RUBY if (i in (1, 2) and p < 0.5) else BAR
                d.rounded_rectangle([x, 250 - max(6, hh), x + 56, 250], 8, fill=col)
            d.line([30, 252, w - 30, 252], fill=PANEL_LINE, width=3)
            fc = brand.font("head", min(22, fit_size(T["chips"], 176, 22)))
            for i, chip in enumerate(T["chips"]):
                x, y = 28 + (i % 2) * 212, 290 + (i // 2) * 76
                fixed = i < min(s, 6)
                d.rounded_rectangle([x, y, x + 200, y + 56], 16, fill=(40, 46, 58) if fixed else (78, 12, 28),
                                    outline=PANEL_LINE if fixed else RUBY, width=2)
                tw = d.textlength(chip, font=fc)
                d.text((x + (200 - tw) / 2, y + 16), chip, font=fc, fill=(110, 118, 132) if fixed else WHITE)
                if fixed:
                    d.line([x + 14, y + 28, x + 186, y + 28], fill=(150, 156, 170), width=3)
            return im
        return self.cache(("card", s), make)

    def frame(self, t):
        T = self.T
        f = self.bg.copy()
        s = stage_at(t)
        # капібара зліва, підскок на кожній склейці
        last = max([c for c in [0.0] + CUTS if c <= t])
        hop = math.sin(math.pi * clamp((t - last) / 0.3)) * 30 if t < T_END else 0
        cy = H + 230 - self.capy[0].height / 2 - hop + (4 * math.sin(t * 9) if s == 7 else 0)
        if t < T_END:
            put(f, self.capy[s], W * 0.3, cy)
            put(f, xform(self.card(s), 0.95 + 0.05 * back((t - last) / 0.3)), W * 0.73, 1010)
        # оверлей «LOADING n%»
        if t < T_END:
            pct = pct_at(t)
            fl = brand.font("head", 104)
            lab = f"{T['loading']} {pct}%"
            size = fit_size([lab], W - 120, 104)
            im = self.cache(("load", pct), lambda: text_block([lab], size, [WHITE if pct < 100 else RUBY], 8))
            pop = 1 + 0.12 * (1 - back((t - last) / 0.25)) if t - last < 0.25 else 1
            put(f, xform(im, pop), W / 2, 330)
            d = ImageDraw.Draw(f, "RGBA")
            x0, x1, y0 = 80, W - 80, 430
            d.rounded_rectangle([x0, y0, x1, y0 + 34], 17, fill=BAR_BG)
            if pct:
                d.rounded_rectangle([x0, y0, x0 + max(34, (x1 - x0) * pct / 100), y0 + 34], 17, fill=RUBY if pct >= 99 else BAR)
            # підпис етапу
            if s == 0:
                cap = self.cache("title", lambda: text_block(T["title"], fit_size(T["title"], W - 140, 80), [WHITE, RUBY], 7))
            elif s <= 6:
                cap = self.cache(("step", s), lambda: text_block([T["steps"][s - 1]], fit_size([T["steps"][s - 1]], W - 120, 58), [SILVER], 6))
            elif s == 7:
                dots = "." * (1 + int(t * 3) % 3)
                cap = self.cache(("stall", dots), lambda: text_block([T["stall"] + dots], fit_size([T["stall"] + "..."], W - 100, 52), [SILVER], 6))
                ang = (t * 360) % 360                                              # спінер
                for i in range(8):
                    a = math.radians(ang + i * 45)
                    r = 16 if i == 0 else 9
                    cx_, cy_ = W / 2 + math.cos(a) * 46, 620 + math.sin(a) * 46
                    al = int(255 * (1 - i / 8))
                    d.ellipse([cx_ - r, cy_ - r, cx_ + r, cy_ + r], fill=(*WHITE, al))
            else:
                def ready():
                    a = text_block([T["ready"]], 96, [RUBY], 8)
                    b = text_block([T["ready_sub"]], fit_size([T["ready_sub"]], W - 120, 50), [WHITE], 6)
                    im = Image.new("RGBA", (max(a.width, b.width), a.height + b.height - 10), (0, 0, 0, 0))
                    im.alpha_composite(a, ((im.width - a.width) // 2, 0))
                    im.alpha_composite(b, ((im.width - b.width) // 2, a.height - 10))
                    return im
                cap = self.cache("ready", ready)
            put(f, xform(cap, 0.7 + 0.3 * back((t - last) / 0.3)), W / 2, 500 + cap.height / 2)
            put(f, self.lock, 60 + self.lock.width / 2, 150 + self.lock.height / 2, 0.9)
        if T_READY <= t < T_END:                                                  # іскри «готово»
            d = ImageDraw.Draw(f, "RGBA")
            u = t - T_READY
            rng = np.random.default_rng(5)
            for i in range(24):
                a, sp = rng.uniform(0, math.tau), rng.uniform(150, 420)
                x, y = W * 0.5 + math.cos(a) * sp * ease(u / 1.2), 900 + math.sin(a) * sp * ease(u / 1.2) + 120 * u * u
                r = (8 + 6 * (i % 3)) * max(0, 1 - u / 2)
                d.ellipse([x - r, y - r, x + r, y + r], fill=(*([WHITE, RUBY, ORANGE][i % 3]), int(255 * max(0, 1 - u / 2))))
        if t >= T_END:
            u = t - T_END
            im = self.cache("end", lambda: text_block(T["end"], fit_size(T["end"], W - 120, 110), [WHITE, RUBY]))
            put(f, xform(im, 0.7 + 0.3 * back(u / 0.35)), W / 2, 360 + im.height / 2, clamp(u * 6))
            y = 360 + im.height + 50
            if u > 0.5:
                put(f, xform(self.logo, 0.7 + 0.3 * back((u - 0.5) / 0.4)), W / 2, y + self.logo.height / 2, clamp((u - 0.5) * 4))
            if u > 0.9:
                c2 = self.cache("cta", lambda: text_block([T["cta"]], fit_size([T["cta"]], W - 160, 70), [WHITE], 6))
                put(f, c2, W / 2, y + self.logo.height + 60 + c2.height / 2, clamp((u - 0.9) * 3))
                c3 = self.cache("url", lambda: text_block(["belyakovconsult.com"], 40, [SILVER], 5))
                put(f, c3, W / 2, y + self.logo.height + 170 + c3.height / 2, clamp((u - 1.1) * 3))
            put(f, xform(self.capy[8], 0.62), W * 0.5, H + 330 - self.capy[8].height * 0.62 / 2 + (1 - ease(u / 0.5)) * 500)
        if any(0 <= t - c < 0.06 for c in CUTS):                                  # спалах склейки
            f = Image.blend(f, Image.new("RGB", f.size, WHITE), 0.12)
        return f

    def poster(self):
        T = self.T
        f = self.bg.copy()
        title = text_block(T["cover"], fit_size(T["cover"][:1], W - 120, 110), [WHITE, RUBY], 9)
        put(f, title, W / 2, 300 + title.height / 2)
        big = text_block(["0% → 100%"], 150, [WHITE], 10)
        put(f, big, W / 2, 300 + title.height + 30 + big.height / 2)
        put(f, xform(self.capy[0], 0.78), W * 0.26, 1420)
        put(f, xform(self.capy[8], 0.78), W * 0.74, 1420)
        put(f, self.lock, 60 + self.lock.width / 2, 150 + self.lock.height / 2, 0.9)
        return f


def soundtrack(path: Path):
    m = Mix(TOTAL)
    hook = [(72, 1), (76, 1), (79, 1), (76, 1), (81, 2), (79, 2), (77, 1), (76, 1), (74, 1), (72, 1), (74, 2), (67, 2),
            (69, 1), (72, 1), (76, 1), (72, 1), (79, 2), (77, 2), (76, 1), (74, 1), (72, 1), (71, 1), (72, 4)]
    groove(m, 0.0, T_STALL, ["C", "G", "Am", "F"], BEAT, arp=True, seed=5)
    for start in (STAGE * 1, STAGE * 1 + 8 * BEAT * 2 / 2 * 2):
        melody(m, start, T_STALL, BEAT, hook, gain=0.12)
    for i in range(int((T_READY - T_STALL) / BEAT)):                               # застрягли на 99%
        at = T_STALL + i * BEAT
        m.put(hat(900 + i, open_=False), at, 0.35)
        m.put(sq(midi(84), 0.08, decay=20), at + BEAT / 2, 0.05)
    m.put(tri(midi(36), T_READY - T_STALL - 0.1), T_STALL, 0.25)
    m.put(crash(5), T_READY, 0.3)
    m.put(kick(), T_READY, 1.0)
    groove(m, T_READY, TOTAL - 0.6, ["C", "F", "G", "C"], BEAT, arp=True, seed=9)
    melody(m, T_READY, TOTAL - 0.6, BEAT, hook, gain=0.11)
    music = m.x / max(1e-9, np.abs(m.x).max()) * 0.62
    fx = Mix(TOTAL)
    for i, c in enumerate(CUTS):
        fx.put(sfx_whoosh(0.35, 100 + i), c - 0.12, 0.35)
        fx.put(sfx_ding(1568 if c < T_STALL else 2093, 0.5), c, 0.25)
    fx.put(sfx_ding(1320, 1.2), T_READY, 0.6)
    sfx = fx.x / max(1e-9, np.abs(fx.x).max()) * 0.8
    n = int(TOTAL * SR)
    mix = (music * 0.85 + sfx * 0.6)[:n]
    mix[-int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))
    mix /= max(1.0, np.abs(mix).max() / 0.95)
    st = np.stack([mix, mix], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


def render(out_dir: Path, lang: str) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    wav = out_dir / "grwm.wav"
    soundtrack(wav)
    v = Grwm(lang)
    v.poster().save(out_dir / "grwm-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "grwm-9x16.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", str(mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for i in range(int(TOTAL * FPS)):
            proc.stdin.write(v.frame(i / FPS).tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    wav.unlink(missing_ok=True)
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")
    return mp4


if __name__ == "__main__":
    print(render(Path(sys.argv[1]), sys.argv[2]))
