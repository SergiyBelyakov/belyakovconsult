"""Піксель-арт фан-тригер «Laser Kitty vs the Data Bugs» (24 с, англійською, 9:16).

Оригінальний аркадний шутер (жанр, а не копія конкретної гри): маленький котик на рубіновій платформі внизу
екрана стріляє лазерами з очей у рій жуків-«багів даних» (NULL, DUP, N/A, 1900, TEST, #REF!), що висять строєм
і пікірують. Капібара-аналітик на літаючій тарілці скидає бонус VALIDATION RULE, і котик отримує потрійний
промінь. Хвиля 2: жуки нескінченно сиплються з труби SOURCE EXPORT, стрілянина не допомагає. Котик б'є
мегапроменем у саму трубу, на ній штамп VALIDATED AT ENTRY, рій зникає. Теза: «FIX THE SOURCE, NOT THE REPORT.»
Фінал: «HIGH SCORE: 0 BUGS RESPAWNED» і питання до аудиторії.

Запуск: python scripts/make_shooter.py <папка>
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
import make_fun  # noqa: E402
from make_fun import SR, Mix, crash, groove, kick, melody, midi, noise, sq, tri  # noqa: E402
from make_pixel import (BG, BG2, CAP_D, DARK, GREY, GREY_D, LH, LW, RUBY, RUBY_D, RUBY_L, SILVER, STEEL, WHITE,  # noqa: E402
                        big, blip, capybara, clamp, ease, pop, ptext, ptext_c, text_w)

W, H = 1080, 1920
make_fun.CH.setdefault("Em", (40, [59, 64, 67, 71]))   # додаткові акорди для аркадного треку
make_fun.CH.setdefault("D", (38, [62, 66, 69, 74]))
make_fun.CH.setdefault("E", (40, [59, 64, 68, 71]))
FPS = 30
TOTAL = 24.0
BEAT = 60 / 150
S = [0.0, 2.6, 8.4, 11.0, 15.0, 18.6]    # hook, wave 1, power-up, wave 2 (respawn), source fix, end
CAT = (240, 150, 70)                      # рудий котик
CAT_D, CAT_L = (196, 108, 40), (255, 196, 128)
BUG_LABELS = ["NULL", "DUP", "N/A", "1900", "TEST", "#REF!", "??", "DUP"]
BUG_COLS = [(150, 156, 170), (120, 128, 142), (176, 182, 194)]
KY = 258                                  # де стоїть котик (низ платформи), вище зони інтерфейсу Reels


# ---------------------------------------------------------------- спрайти
def kitty(img, x, y, t, eyes_on=False, mega=False):
    """Котик анфас на рубіновій платформі з реактивними струменями. x,y: низ платформи."""
    d = ImageDraw.Draw(img)
    x, y = int(x), int(y)
    # струмені
    fl = 2 + int(t * 24) % 3
    for fx in (x - 7, x + 6):
        d.rectangle([fx, y, fx + 1, y + fl], fill=RUBY_L)
        d.point((fx, y + fl + 1), fill=WHITE)
    # платформа
    d.rectangle([x - 11, y - 4, x + 11, y - 1], fill=RUBY)
    d.rectangle([x - 10, y - 4, x + 10, y - 4], fill=RUBY_L)
    d.rectangle([x - 11, y - 1, x + 11, y - 1], fill=RUBY_D)
    # тільце й лапки
    d.rounded_rectangle([x - 6, y - 12, x + 6, y - 4], 3, fill=CAT)
    d.rectangle([x - 5, y - 5, x - 3, y - 4], fill=CAT_L)
    d.rectangle([x + 3, y - 5, x + 5, y - 4], fill=CAT_L)
    # хвіст, що махає
    tw = int(round(math.sin(t * 7) * 2))
    d.line([x + 6, y - 7, x + 10, y - 10 + tw, x + 10, y - 14 + tw], fill=CAT_D, width=2)
    # голова
    d.rounded_rectangle([x - 8, y - 23, x + 8, y - 11], 4, fill=CAT)
    for ex in (-1, 1):                                       # вуха
        d.polygon([(x + ex * 8, y - 20), (x + ex * 3, y - 22), (x + ex * 7, y - 27)], fill=CAT)
        d.point((x + ex * 6, y - 23), fill=(255, 160, 170))
    d.rectangle([x - 3, y - 21, x + 3, y - 20], fill=CAT_D)  # смужки
    # очі: світяться, коли стріляє
    for ex in (-4, 3):
        if eyes_on or mega:
            d.rectangle([x + ex - 1, y - 18, x + ex + 2, y - 15], fill=RUBY_L)
            d.rectangle([x + ex, y - 17, x + ex + 1, y - 16], fill=WHITE)
        else:
            d.rectangle([x + ex, y - 18, x + ex + 1, y - 16], fill=DARK)
            d.point((x + ex, y - 18), fill=WHITE)
    d.point((x, y - 14), fill=(255, 140, 150))               # носик
    d.line([x - 2, y - 13, x, y - 12, x + 2, y - 13], fill=CAT_D)
    for s in (-1, 1):                                        # вуса
        d.line([x + s * 5, y - 14, x + s * 11, y - 15], fill=CAT_L)
        d.line([x + s * 5, y - 13, x + s * 11, y - 12], fill=CAT_L)


def eye_points(x, y):
    return (int(x) - 3, int(y) - 17), (int(x) + 4, int(y) - 17)


def bug(img, x, y, t, col, label=None, scale=1, flash=False, boss=False):
    """Жук-баг даних (оригінальний спрайт): овальний панцир, крильця, що тріпочуть, рубінові очі, бірка."""
    d = ImageDraw.Draw(img)
    x, y = int(x), int(y)
    k = scale
    wing = int(t * 14 + x) % 2
    body = WHITE if flash else col
    # крильця
    for s in (-1, 1):
        wy = y - 3 * k - wing * k
        d.ellipse([x + s * 3 * k - 3 * k, wy - 2 * k, x + s * 3 * k + 3 * k, wy + 2 * k], fill=(205, 215, 230))
    # лапки
    for j in (-1, 0, 1):
        for s in (-1, 1):
            lx = x + s * 4 * k
            d.line([lx, y + j * 2 * k, lx + s * 2 * k, y + j * 2 * k + (1 if (int(t * 8) + j) % 2 else -1) * k], fill=GREY_D)
    # панцир
    d.ellipse([x - 4 * k, y - 4 * k, x + 4 * k, y + 5 * k], fill=body)
    d.line([x, y - 3 * k, x, y + 4 * k], fill=GREY_D)
    d.point((x - 2 * k, y - 2 * k), fill=WHITE)
    # голова й вусики
    d.ellipse([x - 3 * k, y - 7 * k, x + 3 * k, y - 3 * k], fill=GREY_D if not boss else RUBY_D)
    d.rectangle([x - 2 * k, y - 6 * k, x - 1 * k, y - 5 * k], fill=RUBY_L)
    d.rectangle([x + 1 * k, y - 6 * k, x + 2 * k, y - 5 * k], fill=RUBY_L)
    d.line([x - 1 * k, y - 7 * k, x - 3 * k, y - 10 * k], fill=GREY)
    d.line([x + 1 * k, y - 7 * k, x + 3 * k, y - 10 * k], fill=GREY)
    if label:
        ptext(img, label, x - text_w(label) // 2, y + 6 * k, SILVER)


def boom(img, x, y, u, big_=False):
    """Піксельний вибух: кільце уламків і спалах (u від 0 до 1)."""
    d = ImageDraw.Draw(img)
    if u < 0.18:
        r = 2 + int(u * 30)
        d.rectangle([x - r, y - r, x + r, y + r], fill=WHITE if u < 0.08 else RUBY_L)
    n = 10 if big_ else 7
    for k in range(n):
        a = k * 2 * math.pi / n + 0.3
        rr = 3 + u * (26 if big_ else 16)
        c = [WHITE, RUBY_L, (255, 190, 90)][k % 3]
        if u < 0.9:
            d.rectangle([x + math.cos(a) * rr, y + math.sin(a) * rr, x + math.cos(a) * rr + 1, y + math.sin(a) * rr + 1], fill=c)


def beam(img, x0, y0, y1, width=1, col=RUBY_L):
    d = ImageDraw.Draw(img)
    d.rectangle([x0 - width, y1, x0 + width, y0], fill=RUBY)
    d.rectangle([x0 - max(0, width - 1), y1, x0 + max(0, width - 1), y0], fill=col)
    d.line([x0, y1, x0, y0], fill=WHITE)


def ufo(img, x, y, t, face=1):
    """Капібара на маленькій літаючій тарілці."""
    big(img, capybara, x, y - 4, t, walk=False, face=face, glass=False)
    d = ImageDraw.Draw(img)
    d.ellipse([x - 24, y - 6, x + 24, y + 4], fill=STEEL)
    d.ellipse([x - 20, y - 6, x + 20, y - 1], fill=SILVER)
    for k in range(5):
        on = (int(t * 8) + k) % 2
        d.rectangle([x - 16 + k * 8, y, x - 15 + k * 8, y + 1], fill=RUBY_L if on else WHITE)


def pipe(img, x, y, t, sealed=0.0):
    d = ImageDraw.Draw(img)
    d.rectangle([x - 22, y - 30, x + 22, y + 4], fill=STEEL)
    d.rectangle([x - 26, y, x + 26, y + 8], fill=SILVER)
    d.rectangle([x - 18, y + 8, x + 18, y + 10], fill=DARK)
    ptext(img, "SOURCE", x - text_w("SOURCE") // 2, y - 26, WHITE)
    ptext(img, "EXPORT", x - text_w("EXPORT") // 2, y - 16, WHITE)
    if sealed > 0:
        s = pop(sealed)
        w = int(52 * s)
        d.rectangle([x - w // 2 - 2, y - 2, x + w // 2 + 2, y + 18], fill=RUBY, outline=WHITE)
        if sealed > 0.4:
            ptext(img, "VALIDATED", x - text_w("VALIDATED") // 2, y + 1, WHITE)
            ptext(img, "AT ENTRY", x - text_w("AT ENTRY") // 2, y + 10, WHITE)


# ---------------------------------------------------------------- сценарій (рахується наперед)
class Game:
    def __init__(self):
        rng = np.random.default_rng(11)
        self.rng = rng
        # строй хвилі 1: 4 ряди × 6 колонок
        self.bugs = []
        for r in range(4):
            for c in range(6):
                hx, hy = 22 + c * 27, 84 + r * 22
                self.bugs.append(dict(hx=hx, hy=hy, col=BUG_COLS[(r + c) % 3], label=BUG_LABELS[(r * 6 + c) % len(BUG_LABELS)] if r == 3 else None,
                                      t_in=0.15 + 0.06 * (r * 6 + c), dive=None, dead=None, kind="w1"))
        for k, i in enumerate((20, 9, 14)):                 # кілька жуків пікірують на котика
            self.bugs[i]["dive"] = (3.6 + k * 1.4, 1.6)
        # хвиля 2: жуки сиплються з труби
        for k in range(26):
            t0 = S[3] + 0.25 + k * 0.17
            self.bugs.append(dict(hx=90, hy=86, col=BUG_COLS[k % 3], label=BUG_LABELS[k % len(BUG_LABELS)] if k % 3 == 0 else None,
                                  t_in=t0, dive=None, dead=None, kind="w2", vx=rng.uniform(-38, 38), ph=rng.uniform(0, 6)))
        self.shots, self.booms, self.score = [], [], []
        self._play()

    def pos(self, b, t):
        if b["kind"] == "w2":
            u = t - b["t_in"]
            x = b["hx"] + b["vx"] * u + math.sin(u * 5 + b["ph"]) * 10
            y = b["hy"] + 18 + u * 46
            return x, y
        sway = math.sin(t * 1.6) * 8
        x0, y0 = b["hx"] + sway, b["hy"]
        if t < b["t_in"] + 0.6:                             # прилітають дугою зверху
            u = ease((t - b["t_in"]) / 0.6)
            return x0 + (1 - u) * (90 - x0) * 0.6, -20 + (y0 + 20) * u
        if b["dive"]:
            td, dur = b["dive"]
            if td <= t < td + dur:                          # піке петлею вниз до котика
                u = (t - td) / dur
                return x0 + math.sin(u * math.pi * 2) * 34, y0 + math.sin(u * math.pi) * 120
        return x0, y0

    def kitty_x(self, t):
        return self._kx[min(len(self._kx) - 1, max(0, int(t * FPS)))]

    def _play(self):
        """Покадрова симуляція: котик їде під ціль і стріляє; влучання миттєві (промінь)."""
        n = int(TOTAL * FPS) + 1
        kx, x = [], 90.0
        cooldown = 0.0
        pts = 0
        for f in range(n):
            t = f / FPS
            alive = [b for b in self.bugs if b["dead"] is None and t >= b["t_in"] + (0.6 if b["kind"] == "w1" else 0.1)]
            if b_ := [b for b in alive if self.pos(b, t)[1] < KY - 30]:
                pass
            target = None
            shooting = (S[1] <= t < S[3] - 0.2) or (S[3] + 0.6 <= t < S[4])
            if shooting and b_:
                # найнижчий жук (найнебезпечніший), найближчий по горизонталі
                target = min(b_, key=lambda b: (abs(self.pos(b, t)[0] - x) * 0.6 - self.pos(b, t)[1]))
                tx = self.pos(target, t)[0]
            elif S[4] <= t < S[5]:
                tx = 90                                    # мегапромінь у трубу
            else:
                tx = 90 + math.sin(t * 1.3) * 20
            x += clamp((tx - x) * 0.25, -5, 5)
            kx.append(x)
            cooldown -= 1 / FPS
            power = S[2] + 0.9 <= t < S[3]
            if shooting and target and cooldown <= 0 and abs(self.pos(target, t)[0] - x) < 6:
                cooldown = 0.13 if power else 0.2
                hits = [target]
                if power:                                  # потрійний промінь: ще дві колонки
                    for dx in (-20, 20):
                        side = [b for b in b_ if abs(self.pos(b, t)[0] - (x + dx)) < 9 and b not in hits]
                        if side:
                            hits.append(max(side, key=lambda b: self.pos(b, t)[1]))
                for h in hits:
                    hx, hy = self.pos(h, t)
                    h["dead"] = t
                    self.booms.append((t, hx, hy, False))
                    self.shots.append((t, x, hx, hy, power))
                    pts += 100
                    self.score.append((t, pts))
            # хвиля 2 після запечатування: усі живі жуки «гаснуть»
            if S[4] + 1.4 <= t < S[4] + 1.5:
                for b in alive:
                    if b["dead"] is None:
                        b["dead"] = t
                        bx, by = self.pos(b, t)
                        self.booms.append((t, bx, by, False))
        self._kx = kx
        self.seal_t = S[4] + 1.2

    def score_at(self, t):
        s = 0
        for tt, p in self.score:
            if tt <= t:
                s = p
        return s

    def bugs_respawned(self, t):
        return sum(1 for b in self.bugs if b["kind"] == "w2" and b["t_in"] <= t)


class Shooter:
    def __init__(self):
        self.g = Game()
        rng = np.random.default_rng(5)
        self.stars = [(rng.uniform(0, LW), rng.uniform(0, LH), rng.choice([10, 22, 40]), rng.choice([0, 1, 2])) for _ in range(70)]
        self.lock = brand.lockup(46)
        self.logo = brand.logo(150)

    def background(self, t, speed=1.0):
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        for (x, y, v, c) in self.stars:
            yy = (y + t * v * speed) % LH
            d.point((x, yy), fill=[GREY_D, GREY, SILVER][c])
            if v == 40 and speed > 1.5:
                d.line([x, yy, x, yy - 3], fill=GREY)
        return img

    def frame(self, t) -> Image.Image:
        g = self.g
        i = max(k for k, s0 in enumerate(S) if t >= s0)
        u = t - S[i]
        img = self.background(t, 3.0 if i == 4 and u > 1.0 else 1.0)
        d = ImageDraw.Draw(img)
        kx = g.kitty_x(t)
        if i < 5:
            # жуки
            for b in g.bugs:
                if t < b["t_in"]:
                    continue
                if b["dead"] is not None and t >= b["dead"]:
                    continue
                if b["kind"] == "w2" and i < 3:
                    continue
                x, y = g.pos(b, t)
                if y > LH + 10:
                    continue
                bug(img, x, y, t, b["col"], b["label"] if b["kind"] == "w1" or y < 108 else None)
            if i >= 3:
                pipe(img, 90, 72, t, sealed=clamp((t - g.seal_t) / 0.4) if t >= g.seal_t else 0.0)
            # постріли
            for (ts, sx, hx, hy, power) in g.shots:
                if 0 <= t - ts < 0.09:
                    (ex1, ey1), (ex2, ey2) = eye_points(kx, KY)
                    beam(img, ex1 + (hx - kx), ey1, int(hy), 1)
                    beam(img, ex2 + (hx - kx), ey2, int(hy), 1)
            # мегапромінь у трубу
            if i == 4 and 0.4 <= u < 1.4:
                w = 2 + int(abs(math.sin(t * 40)) * 2)
                ey = eye_points(kx, KY)[0][1]
                beam(img, int(kx) - 3, ey, 84, w)
                beam(img, int(kx) + 4, ey, 84, w)
                d.rectangle([int(kx) - 12, 80, int(kx) + 12, 88], fill=WHITE)
            # вибухи
            for (tb, bx, by, bg_) in g.booms:
                if 0 <= t - tb < 0.45:
                    boom(img, int(bx), int(by), (t - tb) / 0.45, bg_)
            for (tb, p) in g.score:
                if 0 <= t - tb < 0.5 and (tb * 10) % 3 < 1.2:
                    pass
            # котик (удвічі крупніший)
            eyes = any(0 <= t - s[0] < 0.12 for s in g.shots) or (i == 4 and 0.3 <= u < 1.5)
            big(img, kitty, kx, KY + 8, t, eyes_on=eyes)
            # HUD
            ptext(img, f"SCORE {g.score_at(t):05d}", 6, 26, WHITE)
            ptext(img, "1UP", LW - text_w("1UP") - 6, 26, RUBY_L if int(t * 3) % 2 else WHITE)
        # сценічні написи
        if i == 0:
            ptext_c(img, "LASER KITTY", 42, RUBY_L, 2)
            if u > 0.4:
                ptext_c(img, "VS THE DATA BUGS", 62, WHITE, 1)
            if u > 1.3 and int(t * 4) % 2:
                ptext_c(img, "READY?", 178, WHITE, 2)
        elif i == 1 and u < 1.2:
            ptext_c(img, "WAVE 1", 170, WHITE, 2)
        elif i == 2:
            ufo(img, -30 + 260 * clamp(u / 2.4), 60, t)
            if u > 0.5:                                     # бонус падає до котика
                py = 64 + (u - 0.5) * 150
                if py < KY - 20:
                    d.ellipse([86, py - 4, 94, py + 4], fill=(255, 150, 30))
                    d.point((90, py - 5), fill=(88, 170, 84))
                    ptext(img, "RULE+", 60, int(py) - 3, WHITE)
            if u > 0.9:
                ptext_c(img, "POWER UP!", 170, RUBY_L, 2)
                ptext_c(img, "VALIDATION RULE", 188, WHITE, 1)
        elif i == 3:
            ptext_c(img, "WAVE 2", 150, WHITE, 2) if u < 1.0 else None
            if u > 1.2:
                ptext_c(img, "THEY KEEP", 150, WHITE, 2)
                ptext_c(img, "RESPAWNING?!", 168, RUBY_L, 2)
                ptext_c(img, f"BUGS FROM SOURCE: {g.bugs_respawned(t):02d}", 188, SILVER, 1)
        elif i == 4:
            if u < 0.4:
                ptext_c(img, "AIM AT THE SOURCE.", 150, WHITE, 1)
            if u > 1.6:
                ptext_c(img, "FIX THE SOURCE,", 140, WHITE, 2)
            if u > 2.2:
                ptext_c(img, "NOT THE REPORT.", 160, RUBY_L, 2)
        elif i == 5:
            ptext_c(img, "HIGH SCORE", 104, SILVER, 1)
            ptext_c(img, "0 BUGS", 116, WHITE, 2)
            ptext_c(img, "RESPAWNED.", 134, RUBY_L, 2)
            if u > 0.8:
                ptext_c(img, "WHAT BUG KEEPS", 160, WHITE, 1)
                ptext_c(img, "RESPAWNING IN", 170, WHITE, 1)
                ptext_c(img, "YOUR DATA?", 180, RUBY_L, 1)
            big(img, kitty, 62, KY + 8, t, eyes_on=int(t * 2) % 2 == 0)
            ufo(img, 128, 258 + math.sin(t * 3) * 2, t, face=-1)
        full = img.resize((W, H), Image.NEAREST)
        if i < 5:
            full.paste(self.lock, (56, 92), self.lock)
        else:
            k = ease(u / 0.5)
            full.paste(self.logo, (W // 2 - self.logo.width // 2, int(400 - (1 - k) * 40)), self.logo)
            if u > 1.2:
                url = Image.new("RGBA", (LW, 12), (0, 0, 0, 0))
                ptext(url, "BELYAKOVCONSULT.COM", int(LW / 2 - text_w("BELYAKOVCONSULT.COM") / 2), 2, SILVER)
                up = url.resize((W, 72), Image.NEAREST)
                full.paste(up, (0, 1150), up)
        if any(0 <= t - s0 < 0.05 for s0 in S[1:]) or (i == 4 and 1.2 <= u < 1.3):
            full = Image.blend(full, Image.new("RGB", full.size, WHITE), 0.15)
        return full

    def poster(self):
        t = S[2] + 1.6
        f = self.frame(t)
        img = self.background(0.0)
        g = self.g
        for b in g.bugs[:24]:
            x, y = b["hx"], b["hy"]
            bug(img, x, y + 10, 0.3, b["col"], b["label"])
        (ex1, ey1), (ex2, ey2) = eye_points(90, KY)
        beam(img, ex1, ey1, 130, 0)
        beam(img, ex2, ey2, 130, 0)
        boom(img, 88, 128, 0.1)
        big(img, kitty, 90, KY + 8, 0.0, eyes_on=True)
        ptext_c(img, "LASER KITTY", 36, RUBY_L, 2)
        ptext_c(img, "VS THE DATA BUGS", 56, WHITE, 1)
        full = img.resize((W, H), Image.NEAREST)
        full.paste(self.lock, (56, 92 + 300), self.lock) if False else None
        return full


# ---------------------------------------------------------------- звук
def zap(gain=1.0):
    return blip(1900, 420, 0.07, gain)


def bang(seed=0, dur=0.22, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = noise(n, seed)
    x = np.sign(x) * 0.5                                     # «8-бітний» шум
    step = 6
    x = np.repeat(x[::step], step)[:n]
    return x * np.exp(-t * 14) * gain


def soundtrack(path: Path, sh: Shooter):
    g = sh.g
    m = Mix(TOTAL)
    hook = [(76, 1), (79, 1), (83, 1), (88, 1), (86, 1), (83, 1), (79, 2), (81, 1), (84, 1), (88, 2), (86, 2), (83, 4),
            (76, 1), (79, 1), (83, 1), (84, 1), (83, 1), (79, 1), (76, 2), (74, 2), (76, 6)]
    groove(m, S[1], S[3], ["Em", "C", "G", "D"], BEAT, arp=True, seed=3)
    melody(m, S[1], S[3], BEAT, hook * 2, gain=0.12)
    # хвиля 2: тривожніше
    groove(m, S[3], S[4], ["Am", "F", "Am", "E"], BEAT, arp=True, seed=9)
    for k in range(int((S[4] - S[3]) / (BEAT / 2))):
        m.put(sq(midi(57 + (k % 2) * 12), 0.08, decay=8), S[3] + k * BEAT / 2, 0.06)
    groove(m, S[4] + 1.3, S[5], ["C", "G", "Am", "F"], BEAT, arp=True, seed=5)
    melody(m, S[4] + 1.3, TOTAL - 0.6, BEAT, hook, gain=0.11)
    # інтро: «старт» аркади
    for k, note in enumerate([64, 67, 71, 76, 79, 83]):
        m.put(sq(midi(note), 0.1, decay=6), 0.25 + k * 0.1, 0.12)
    m.put(crash(1), S[1], 0.25)
    m.put(crash(2), S[4] + 1.25, 0.35)
    # фінальний джингл
    for k, note in enumerate([72, 76, 79, 84, 88]):
        m.put(sq(midi(note), 0.16, decay=4), S[5] + 0.2 + k * 0.12, 0.13)
    music = m.x / max(1e-9, np.abs(m.x).max()) * 0.6
    fx = Mix(TOTAL)
    for k, (ts, *_r) in enumerate(g.shots):
        fx.put(zap(), ts, 0.35)
    for k, (tb, *_r) in enumerate(g.booms):
        fx.put(bang(k), tb + 0.02, 0.35)
    for k, note in enumerate([72, 79, 84, 91]):               # бонус
        fx.put(sq(midi(note), 0.07, decay=6), S[2] + 1.2 + k * 0.06, 0.4)
    fx.put(blip(120, 60, 1.0, 1.0), S[4] + 0.4, 0.6)          # мегапромінь
    fx.put(bang(99, 0.6), S[4] + 1.2, 0.8)
    for s0 in S[1:]:
        fx.put(blip(180, 1800, 0.16), s0 - 0.08, 0.35)
    sfx = fx.x / max(1e-9, np.abs(fx.x).max()) * 0.8
    n = int(TOTAL * SR)
    mix = (music * 0.85 + sfx * 0.45)[:n]
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
    sh = Shooter()
    wav = out_dir / "kitty.wav"
    soundtrack(wav, sh)
    sh.poster().save(out_dir / "kitty-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "kitty-9x16.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", str(mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for k in range(int(TOTAL * FPS)):
            proc.stdin.write(sh.frame(k / FPS).tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    wav.unlink(missing_ok=True)
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")
    return mp4


if __name__ == "__main__":
    print(render(Path(sys.argv[1])))
