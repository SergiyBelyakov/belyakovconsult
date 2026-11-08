"""Треш-фан піксель-ролик «Data Boss» (20 с, англійською, 9:16, тест для Instagram).

Оригінальний піксельний персонаж Data Boss (аналітик в окулярах і чорній водолазці) вистрибує на пружині з
рубінового сервера, помічає «підозрілі +12%» на дашборді, лазерами з очей розносить стовпчики з дублікатами,
NULL і тестовими рядками (лишається умовне +2%), далі хаос-дроп: дощ із креветок, капібара-діджей, коти
трясуть головами, робот Dupe Muncher крутиться; фінал: велика кнопка FOLLOW FOR MORE, котяча лапа тисне.
Тряска кадру, зум-удари і спалахи тут доречні (жанр фан-тригера).

Запуск: python scripts/make_boss.py <папка>
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
from make_fun import SR, Mix, crash, groove, kick, melody, midi, sq, tri  # noqa: E402
from make_pixel import (BG, BG2, CAP_D, CAT1, CAT1_D, CAT2, CAT2_D, DARK, GREY, GREY_D, LH, LW, RUBY, RUBY_D,  # noqa: E402
                        RUBY_L, SILVER, STEEL, WHITE, big, blip, capybara, cat, clamp, ease, muncher, pop, ptext,
                        ptext_c, text_w)
from make_shooter import bang, beam, boom, zap  # noqa: E402
import make_pixel  # noqa: E402

make_pixel.FONT["="] = ["00000", "00000", "11111", "00000", "11111", "00000", "00000"]
make_pixel.FONT["^"] = ["11001", "11010", "00010", "00100", "01000", "01011", "10011"]   # знак відсотка (% у шрифті вже ✗)

W, H = 1080, 1920
FPS = 30
TOTAL = 20.0
BEAT = 60 / 160
S = [0.0, 2.4, 6.0, 10.2, 13.8, 17.2]     # вистрибує, підозріло, лазери, хаос-дроп, підписка, фінал
make_fun.CH.setdefault("Em", (40, [59, 64, 67, 71]))
make_fun.CH.setdefault("D", (38, [62, 66, 69, 74]))

SKIN, SKIN_D, SKIN_L = (232, 186, 150), (196, 146, 112), (246, 210, 180)
HAIR, HAIR_L = (92, 62, 40), (128, 90, 60)
JACKET, JACKET_L = (26, 28, 34), (52, 56, 66)
SHRIMP, SHRIMP_D = (255, 128, 110), (214, 86, 72)


# ---------------------------------------------------------------- Data Boss
def boss(img, x, y, t, talk=0.0, lasers=False, sus=0.0, bounce=0.0):
    """Голова й плечі Data Boss. x,y: низ плечей (центр). talk 0..1 рот, sus 0..1 «підозрілі» брови."""
    d = ImageDraw.Draw(img)
    x, y = int(x), int(y - bounce)
    # плечі й куртка, водолазка
    d.rounded_rectangle([x - 22, y - 16, x + 22, y + 6], 6, fill=JACKET)
    d.line([x - 8, y - 15, x - 13, y + 4], fill=JACKET_L)
    d.line([x + 8, y - 15, x + 13, y + 4], fill=JACKET_L)
    d.rectangle([x - 7, y - 20, x + 7, y - 12], fill=(16, 16, 20))
    # голова
    hx, hy = x, y - 36
    d.rounded_rectangle([hx - 12, hy - 15, hx + 12, hy + 15], 6, fill=SKIN)
    d.rectangle([hx - 12, hy + 6, hx - 11, hy + 10], fill=SKIN_D)
    d.rectangle([hx + 11, hy + 6, hx + 12, hy + 10], fill=SKIN_D)
    d.rectangle([hx - 14, hy - 2, hx - 12, hy + 4], fill=SKIN_D)          # вуха
    d.rectangle([hx + 12, hy - 2, hx + 14, hy + 4], fill=SKIN_D)
    # коротке волосся догори
    d.rectangle([hx - 12, hy - 18, hx + 12, hy - 11], fill=HAIR)
    for k in range(-11, 12, 3):
        d.rectangle([hx + k, hy - 20 - (k % 2), hx + k + 1, hy - 17], fill=HAIR)
    d.rectangle([hx - 9, hy - 16, hx + 6, hy - 15], fill=HAIR_L)
    # брови: при «підозрі» одна вгору, інша вниз
    b = int(round(2 * sus))
    d.line([hx - 9, hy - 7 - b, hx - 3, hy - 6], fill=HAIR, width=2)
    d.line([hx + 3, hy - 6 + b, hx + 9, hy - 7 + b * 2 - b], fill=HAIR, width=2)
    # прямокутні окуляри
    for ex in (-6, 6):
        d.rectangle([hx + ex - 5, hy - 4, hx + ex + 4, hy + 2], outline=(30, 30, 36))
        if lasers:
            d.rectangle([hx + ex - 4, hy - 3, hx + ex + 3, hy + 1], fill=RUBY_L)
            d.rectangle([hx + ex - 1, hy - 2, hx + ex, hy], fill=WHITE)
        else:
            d.rectangle([hx + ex - 4, hy - 3, hx + ex + 3, hy + 1], fill=(205, 222, 236))
            d.rectangle([hx + ex - 1, hy - 2, hx + ex, hy], fill=(40, 46, 56))
            d.point((hx + ex - 3, hy - 3), fill=WHITE)
    d.line([hx - 1, hy - 2, hx + 1, hy - 2], fill=(30, 30, 36))
    d.rectangle([hx - 1, hy + 3, hx, hy + 6], fill=SKIN_D)                # ніс
    m = int(round(talk * 3))
    d.rectangle([hx - 4, hy + 9, hx + 4, hy + 9 + m], fill=(120, 40, 46) if m else SKIN_D)
    if m >= 2:
        d.rectangle([hx - 3, hy + 9, hx + 3, hy + 9], fill=WHITE)


def boss_eyes(x, y, bounce=0.0):
    """Точки очей Data Boss у тих самих координатах, що й boss() (до збільшення big)."""
    return [(x - 6, y - bounce - 37), (x + 6, y - bounce - 37)]


def server(img, x, y, t, open_=1.0):
    """Рубіновий сервер-люк, з якого вистрибує бос (x,y: низ)."""
    d = ImageDraw.Draw(img)
    d.rectangle([x - 40, y - 26, x + 40, y], fill=RUBY_D)
    d.rectangle([x - 38, y - 24, x + 38, y - 2], fill=RUBY)
    for k in range(3):
        yy = y - 20 + k * 7
        d.rectangle([x - 32, yy, x + 18, yy + 3], fill=RUBY_D)
        for j in range(3):
            on = (int(t * 10) + j + k) % 3 == 0
            d.rectangle([x + 22 + j * 5, yy, x + 24 + j * 5, yy + 2], fill=WHITE if on else RUBY_L)
    # кришка, відкинута пружиною
    if open_ > 0:
        a = open_ * 1.9
        px, py = x - 40, y - 26
        ex, ey = px + math.cos(-a) * 80, py + math.sin(-a) * 80
        d.line([px, py, ex, ey], fill=SILVER, width=4)
    else:
        d.rectangle([x - 41, y - 29, x + 41, y - 26], fill=SILVER)


def spring(img, x, y0, y1, t):
    d = ImageDraw.Draw(img)
    n = 8
    pts = []
    for k in range(n * 2 + 1):
        yy = y0 + (y1 - y0) * k / (n * 2)
        pts.append((x + (6 if k % 2 else -6), yy))
    d.line(pts, fill=SILVER, width=2)


def shrimp(img, x, y, t, flip=1):
    d = ImageDraw.Draw(img)
    x, y = int(x), int(y)
    for k in range(5):
        a = (k / 4) * 2.2 + t * 6
        px, py = x + math.cos(a) * 4 * flip, y + math.sin(a) * 4
        d.rectangle([px - 1, py - 1, px + 1, py + 1], fill=SHRIMP if k % 2 else SHRIMP_D)
    d.point((x + 5 * flip, y - 3), fill=DARK)
    d.line([x + 5 * flip, y - 4, x + 10 * flip, y - 9], fill=SHRIMP_D)


def turntable(img, x, y, t):
    d = ImageDraw.Draw(img)
    d.rectangle([x - 26, y - 8, x + 26, y], fill=STEEL)
    for cx in (x - 13, x + 13):
        d.ellipse([cx - 9, y - 14, cx + 9, y - 6], fill=DARK)
        a = t * 12
        d.line([cx, y - 10, cx + math.cos(a) * 8, y - 10 + math.sin(a) * 3], fill=RUBY_L)


def bubble(img, text_lines, x, y, w=None, col=WHITE):
    d = ImageDraw.Draw(img)
    w = w or max(text_w(s) for s in text_lines) + 10
    h = len(text_lines) * 10 + 8
    d.rectangle([x, y, x + w, y + h], fill=WHITE, outline=DARK)
    d.polygon([(x + 14, y + h), (x + 22, y + h), (x + 12, y + h + 8)], fill=WHITE)
    for k, s in enumerate(text_lines):
        ptext(img, s, x + 5, y + 5 + k * 10, RUBY if col == RUBY else DARK, 1, shadow=False)


# ---------------------------------------------------------------- дашборд
BARS = [(0.42, "OK"), (0.55, "OK"), (0.95, "DUP X3"), (0.6, "OK"), (0.88, "NULL"), (0.66, "OK"), (1.0, "TEST")]


def chart(img, x, y, w, h, t, hit_at, labels=False):
    d = ImageDraw.Draw(img)
    d.rectangle([x, y, x + w, y + h], fill=(20, 24, 32), outline=GREY_D)
    ptext(img, "REVENUE", x + 4, y + 4, SILVER)
    bw = (w - 16) / len(BARS)
    for i, (v, tag) in enumerate(BARS):
        bad = tag != "OK"
        hit = hit_at.get(i)
        hv = v
        if hit is not None and t >= hit:
            hv = v * max(0.38, 1 - (t - hit) / 0.35) if bad else v
        bh = int((h - 24) * hv)
        bx = int(x + 8 + i * bw)
        col = RUBY if not bad else (RUBY_L if hit is None or t < hit else GREY)
        d.rectangle([bx, y + h - 4 - bh, bx + int(bw * 0.7), y + h - 4], fill=col)
        d.rectangle([bx, y + h - 4 - bh, bx + 1, y + h - 4], fill=WHITE if not bad else (255, 200, 205))
        if labels and bad and (hit is None or t < hit + 0.6):
            ptext(img, tag, bx - 4, y + h - 14 - bh, WHITE)
        if hit is not None and 0 <= t - hit < 0.45:
            boom(img, bx + int(bw * 0.35), y + h - 4 - bh, (t - hit) / 0.45)


class Boss:
    def __init__(self):
        rng = np.random.default_rng(9)
        self.lock = brand.lockup(46)
        self.logo = brand.logo(150)
        self.shr = [(rng.uniform(0, LW), rng.uniform(-200, 0), rng.uniform(60, 120), rng.choice([-1, 1])) for _ in range(26)]
        self.hit_at = {2: S[2] + 0.8, 4: S[2] + 1.5, 6: S[2] + 2.2}
        self.flash_t = [S[1], S[2], S[3], S[4], S[5]] + [S[3] + k * BEAT * 2 for k in range(9)]

    def frame(self, t) -> Image.Image:
        i = max(k for k, s0 in enumerate(S) if t >= s0)
        u = t - S[i]
        beat_ph = (t % BEAT) / BEAT
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        if i == 3:                                          # хаос-дроп: смуги, що пульсують у такт
            for k in range(0, LH, 16):
                c = RUBY_D if (k // 16 + int(t / BEAT)) % 2 else BG2
                d.rectangle([0, k, LW, k + 7], fill=c)
        else:
            for k in range(0, LH, 24):
                d.line([0, k, LW, k], fill=BG2)
            for k in range(0, LW, 24):
                d.line([k, 0, k, LH], fill=BG2)
        bx, base = 90, 252
        # Data Boss: пружина з сервера
        if i == 0:
            rise = pop(u / 0.45) if u > 0.25 else 0
            bounce = math.sin(u * 14) * 8 * math.exp(-u * 2.2) if u > 0.25 else 0
            top = base - 26 - 16 * rise
            server(img, bx, base, t, open_=clamp((u - 0.15) / 0.2))
            if rise > 0:
                spring(img, bx, base - 26, top + 4, t)
                big(img, boss, bx, top + 4, t, talk=0.0, sus=0, bounce=bounce)
            ptext_c(img, "POV:", 34, RUBY_L, 2)
            ptext_c(img, "DATA BOSS", 52, WHITE, 3)
            ptext_c(img, "SEES YOUR DASHBOARD", 78, WHITE, 1)
        elif i in (1, 2):
            server(img, bx - 46, base, t)
            spring(img, bx - 46, base - 26, base - 76, t)
            talk = abs(math.sin(t * 16)) if (i == 1 and u < 2.6) else 0.0
            lasers = i == 2 and 0.5 < u < 2.6
            big(img, boss, bx - 46, base - 72, t, talk=talk, sus=clamp((u - 1.6) / 0.3) if i == 1 else 1, bounce=math.sin(t * 9) * 1.5)
            chart(img, 74, 120, 100, 92, t, self.hit_at if i == 2 else {}, labels=True)
            if i == 1:
                ptext_c(img, "DASHBOARD: +12^", 102, WHITE, 1, cx=124)
                if u < 1.6:
                    bubble(img, ["THIS NUMBER", "LOOKS TOO", "HAPPY."], 8, 52)
                else:
                    bubble(img, ["SUSPICIOUS."], 8, 64, col=RUBY)
            else:
                if u <= 2.6:
                    ptext_c(img, "LASER AUDIT", 34, RUBY_L, 2)
                if lasers:                                    # лазери з окулярів у «погані» стовпчики
                    tgt = [k for k, h_ in sorted(self.hit_at.items(), key=lambda q: q[1]) if t < h_ + 0.25]
                    if tgt:
                        k = tgt[0]
                        tx = int(74 + 8 + k * (84 / len(BARS)) + 4)
                        for ex, ey in boss_eyes(0, 0):
                            sx = bx - 46 + ex * 2
                            sy = base - 72 + ey * 2 + 4
                            d.line([sx, sy, tx, 175], fill=RUBY, width=3)
                            d.line([sx, sy, tx, 175], fill=WHITE, width=1)
                if u > 2.6:
                    ptext_c(img, "REAL GROWTH: +2^", 102, RUBY_L, 1, cx=124)
                    bubble(img, ["ANALYSIS =", "ASKING 'IS", "THIS REAL?'"], 8, 52)
        elif i == 3:
            # дощ із креветок
            for (x0, y0, v, f) in self.shr:
                y = (y0 + u * v * 1.6) % (LH + 40) - 20
                shrimp(img, x0 + math.sin(t * 3 + x0) * 6, y, t, f)
            jump = abs(math.sin(t * math.pi / BEAT)) * 6
            big(img, capybara, 52, 214 - jump * 0.5, t, walk=False, face=1, glass=False)
            turntable(img, 52, 222, t)
            big(img, cat, 128, 228 - jump, t, CAT1, CAT1_D, walk=False, face=-1, glass=False)
            big(img, cat, 160, 248 - jump * 0.7, t + 0.2, CAT2, CAT2_D, walk=False, face=-1, glass=False)
            big(img, muncher, 112 + math.sin(t * 4) * 10, 268, t, abs(math.sin(t * 20)), 1 if int(t * 2) % 2 else -1)
            big(img, boss, 92, 176 + jump, t, talk=abs(math.sin(t * 20)), lasers=int(t / BEAT) % 2 == 0)
            word = ["DATA!", "DATA!", "ANALYSIS!", "DROP!"][int(u / (BEAT * 2)) % 4]
            k = 2 + (1 if beat_ph < 0.3 else 0)
            ptext_c(img, word, 30, WHITE if int(t / BEAT) % 2 else RUBY_L, k)
            ptext_c(img, "IS THIS NUMBER REAL?", 56, WHITE, 1)
        elif i == 4:
            big(img, boss, 52, 250, t, talk=abs(math.sin(t * 14)) if u < 1.2 else 0, sus=0)
            press = clamp((u - 1.4) / 0.25)
            done = u > 1.65
            bw_, bh_ = 128, 34
            x0, y0 = (LW - bw_) // 2, 104 + int(press * 3)
            d.rectangle([x0, y0 + 4, x0 + bw_, y0 + bh_ + 4], fill=RUBY_D)
            d.rectangle([x0, y0, x0 + bw_, y0 + bh_], fill=WHITE if done else RUBY, outline=WHITE)
            s = "FOLLOWED!" if done else "FOLLOW"
            ptext_c(img, s, y0 + 10, RUBY if done else WHITE, 2)
            ptext_c(img, "FOR MORE", 58, WHITE, 2)
            ptext_c(img, "DATA CHAOS", 76, RUBY_L, 2)
            # котяча лапа тисне кнопку
            py = int(30 + press * 92) if u < 2.2 else int(122 - (u - 2.2) * 120)
            d.rounded_rectangle([118, py - 30, 134, py], 5, fill=CAT2)
            for k in range(3):
                d.ellipse([119 + k * 5, py - 4, 123 + k * 5, py], fill=(255, 160, 170))
            if done:
                for k in range(14):                          # конфеті
                    a = k * 0.45 + u * 4
                    rr = 10 + (u - 1.65) * 60
                    d.rectangle([90 + math.cos(a) * rr, 120 + math.sin(a) * rr * 0.7, 91 + math.cos(a) * rr,
                                 121 + math.sin(a) * rr * 0.7], fill=[RUBY_L, WHITE, (255, 190, 90)][k % 3])
            bubble(img, ["SMASH IT."], 70, 172)
        else:
            ptext_c(img, "WHAT'S THE MOST", 110, WHITE, 1)
            ptext_c(img, "SUSPICIOUS NUMBER", 120, WHITE, 1)
            ptext_c(img, "YOU'VE SEEN?", 132, RUBY_L, 2)
            big(img, boss, 90, 302, t, talk=0, lasers=int(t * 3) % 2 == 0)
        # тряска кадру й зум-удари
        shake = 0
        if i == 0 and 0.25 < u < 0.9:
            shake = 3
        if i == 2 and any(0 <= t - h_ < 0.15 for h_ in self.hit_at.values()):
            shake = 2
        if i == 3 and beat_ph < 0.15:
            shake = 2
        if shake:
            ox, oy = int(math.sin(t * 90) * shake), int(math.cos(t * 77) * shake)
            img = img.transform(img.size, Image.AFFINE, (1, 0, ox, 0, 1, oy), fillcolor=BG)
        zoom = 1.0
        if i == 1 and 1.6 <= u < 2.4:                       # «SUSPICIOUS»: наїзд на обличчя
            zoom = 1 + 0.35 * ease((u - 1.6) / 0.15)
        if i == 3 and beat_ph < 0.12:
            zoom = 1.06
        if zoom > 1:
            cx, cy = (46, 150) if i == 1 else (LW / 2, LH / 2)
            w_, h_ = LW / zoom, LH / zoom
            box = (int(cx - w_ / 2 if i == 3 else max(0, cx - w_ / 2)), int(max(0, cy - h_ / 2)),
                   0, 0)
            x0 = int(clamp(cx - w_ / 2, 0, LW - w_)); y0 = int(clamp(cy - h_ / 2, 0, LH - h_))
            img = img.crop((x0, y0, x0 + int(w_), y0 + int(h_))).resize((LW, LH), Image.NEAREST)
        full = img.resize((W, H), Image.NEAREST)
        if i < 5:
            full.paste(self.lock, (56, 92), self.lock)
        else:
            k = ease(u / 0.5)
            full.paste(self.logo, (W // 2 - self.logo.width // 2, int(400 - (1 - k) * 40)), self.logo)
            if u > 0.8:
                url = Image.new("RGBA", (LW, 12), (0, 0, 0, 0))
                ptext(url, "BELYAKOVCONSULT.COM", int(LW / 2 - text_w("BELYAKOVCONSULT.COM") / 2), 2, SILVER)
                up = url.resize((W, 72), Image.NEAREST)
                full.paste(up, (0, 960), up)
        if any(0 <= t - ft < 0.06 for ft in self.flash_t):
            full = Image.blend(full, Image.new("RGB", full.size, WHITE if i != 3 else RUBY_L), 0.25)
        return full

    def poster(self):
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        for k in range(0, LH, 16):
            d.rectangle([0, k, LW, k + 7], fill=RUBY_D if (k // 16) % 2 else BG2)
        for (x0, y0, v, f) in self.shr[:14]:
            shrimp(img, x0, (y0 + 260) % 300 + 10, 0.3, f)
        server(img, 90, 272, 0.0)
        spring(img, 90, 246, 226, 0)
        big(img, boss, 90, 230, 0.0, lasers=True)
        for ex, ey in boss_eyes(0, 0):
            d.line([90 + ex * 2, 230 + ey * 2 + 4, 10 + ex * 6, 150], fill=RUBY, width=3)
            d.line([90 + ex * 2, 230 + ey * 2 + 4, 10 + ex * 6, 150], fill=WHITE, width=1)
        ptext_c(img, "DATA BOSS", 40, WHITE, 3)
        ptext_c(img, "IS THIS REAL?", 66, RUBY_L, 2)
        full = img.resize((W, H), Image.NEAREST)
        full.paste(self.lock, (56, 92), self.lock)
        return full


# ---------------------------------------------------------------- звук
def soundtrack(path: Path, b: Boss):
    m = Mix(TOTAL)
    hook = [(76, 1), (76, 1), (79, 1), (76, 1), (83, 2), (81, 2), (79, 1), (76, 1), (74, 2), (76, 4)]
    groove(m, S[1], S[3], ["Em", "C", "G", "D"], BEAT, arp=True, seed=2)
    melody(m, S[1], S[3], BEAT, hook * 3, gain=0.11)
    # хаос-дроп: «бочка» на кожну долю, бас октавами
    for k in range(int((S[4] - S[3]) / BEAT)):
        tt = S[3] + k * BEAT
        m.put(kick(), tt, 0.9)
        m.put(sq(midi(40 + (12 if k % 2 else 0)), BEAT * 0.9, decay=5), tt, 0.16)
        if k % 2:
            m.put(sq(midi(88 if k % 4 == 1 else 91), 0.08, decay=8), tt + BEAT / 2, 0.1)
    groove(m, S[4], TOTAL - 0.4, ["C", "G", "Am", "F"], BEAT, arp=True, seed=6)
    melody(m, S[4], TOTAL - 0.6, BEAT, hook, gain=0.1)
    m.put(crash(1), S[3], 0.4)
    m.put(crash(2), S[4] + 1.65, 0.3)
    music = m.x / max(1e-9, np.abs(m.x).max()) * 0.6
    fx = Mix(TOTAL)
    fx.put(blip(120, 900, 0.35, 1.0), 0.25, 0.8)               # пружина «боїнг»
    for k in range(4):
        fx.put(blip(500 - k * 60, 900 - k * 80, 0.08), 0.6 + k * 0.12, 0.4 / (k + 1))
    fx.put(blip(900, 200, 0.4), S[1] + 1.6, 0.5)                 # «підозріло»
    for tt in np.arange(S[2] + 0.5, S[2] + 2.6, 0.09):
        fx.put(zap(), tt, 0.2)
    for k, h_ in enumerate(b.hit_at.values()):
        fx.put(bang(k, 0.3), h_, 0.7)
    for k, note in enumerate([72, 79, 84, 91, 96]):              # «FOLLOWED!»
        fx.put(sq(midi(note), 0.07, decay=6), S[4] + 1.65 + k * 0.05, 0.45)
    for s0 in S[1:]:
        fx.put(blip(180, 1800, 0.16), s0 - 0.08, 0.35)
    sfx = fx.x / max(1e-9, np.abs(fx.x).max()) * 0.8
    n = int(TOTAL * SR)
    mix = (music * 0.85 + sfx * 0.45)[:n]
    mix[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))
    mix /= max(1.0, np.abs(mix).max() / 0.95)
    st = np.stack([mix, mix], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


def render(out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    b = Boss()
    wav = out_dir / "boss.wav"
    soundtrack(wav, b)
    b.poster().save(out_dir / "boss-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "boss-9x16.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", str(mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for k in range(int(TOTAL * FPS)):
            proc.stdin.write(b.frame(k / FPS).tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    wav.unlink(missing_ok=True)
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")
    return mp4


if __name__ == "__main__":
    print(render(Path(sys.argv[1])))
