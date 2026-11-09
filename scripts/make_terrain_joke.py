"""Фан-ролик «Щось у цьому дашборді є» (UA, 9:16, ~18 с, піксель-арт).

Аналітик в окулярах іде вздовж моніторів: простий стовпчиковий графік, складна панель KPI, лінії, карта.
Біля кожного коротка репліка. Останній монітор: 3D-модель рельєфу з двома круглими пагорбами, що повільно
обертається. Аналітик проходить повз, повертається, нахиляється ближче: «Не знаю що, але щось у цьому дашборді
точно є.» Слоган: «3D-моделі рельєфу» і belyakovconsult.com.

Запуск: python scripts/make_terrain_joke.py <папка>
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
import make_pixel  # noqa: E402
from make_fun import SR, Mix, crash, groove, melody, midi, sq, tri  # noqa: E402
from make_pixel import (BG, BG2, DARK, GREY, GREY_D, LH, LW, RUBY, RUBY_D, RUBY_L, SILVER, STEEL, WHITE, blip, clamp,  # noqa: E402
                        ease, ptext, ptext_c, text_w)

F = make_pixel.FONT
# кирилиця 5×7 (те, що збігається з латиницею, береться з неї)
CYR = {
    "А": F["A"], "В": F["B"], "Е": F["E"], "К": F["K"], "М": F["M"], "Н": F["H"], "О": F["O"], "Р": F["P"],
    "С": F["C"], "Т": F["T"], "Х": F["X"], "І": F["I"],
    "Б": ["11111", "10000", "10000", "11110", "10001", "10001", "11110"],
    "Г": ["11111", "10000", "10000", "10000", "10000", "10000", "10000"],
    "Д": ["00111", "01001", "01001", "01001", "01001", "11111", "10001"],
    "Є": ["01110", "10001", "10000", "11110", "10000", "10001", "01110"],
    "Ж": ["10101", "10101", "01110", "00100", "01110", "10101", "10101"],
    "З": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "И": ["10001", "10001", "10011", "10101", "11001", "10001", "10001"],
    "Ї": ["01010", "00000", "01110", "00100", "00100", "00100", "01110"],
    "Й": ["01010", "10001", "10011", "10101", "11001", "10001", "10001"],
    "Л": ["00111", "01001", "01001", "01001", "01001", "01001", "10001"],
    "П": ["11111", "10001", "10001", "10001", "10001", "10001", "10001"],
    "У": ["10001", "10001", "10001", "01111", "00001", "00001", "01110"],
    "Ф": ["00100", "01110", "10101", "10101", "01110", "00100", "00100"],
    "Ц": ["10010", "10010", "10010", "10010", "10010", "11111", "00001"],
    "Ч": ["10001", "10001", "10001", "01111", "00001", "00001", "00001"],
    "Ш": ["10101", "10101", "10101", "10101", "10101", "10101", "11111"],
    "Щ": ["10101", "10101", "10101", "10101", "10101", "11111", "00001"],
    "Ь": ["10000", "10000", "10000", "11110", "10001", "10001", "11110"],
    "Ю": ["10010", "10101", "10101", "11101", "10101", "10101", "10010"],
    "Я": ["01111", "10001", "10001", "01111", "00101", "01001", "10001"],
    "Ґ": ["00001", "11111", "10000", "10000", "10000", "10000", "10000"],
}
F.update(CYR)
F["'"] = F.get("'", ["00100", "00100", "01000", "00000", "00000", "00000", "00000"])
make_fun.CH.setdefault("Em", (40, [59, 64, 67, 71]))
make_fun.CH.setdefault("Dm", (38, [62, 65, 69, 74]))

W, H = 1080, 1920
FPS = 30
TOTAL = 18.0
BEAT = 60 / 112
WW = 520                                   # ширина «кімнати»
FLOOR = 238
SCREENS = [  # (центр x у кімнаті, вид, репліка)
    (70, "bars", "ПРОСТО."),
    (165, "kpi", "СКЛАДНО."),
    (260, "lines", "НОРМ."),
    (355, "map", "ЯСНО."),
    (455, "terrain", None),
]
SKIN, SKIN_D = (232, 186, 150), (196, 146, 112)
HAIR = (92, 62, 40)
JACKET, JACKET_L = (26, 28, 34), (56, 60, 70)
TEAL, GOLD = (70, 200, 190), (240, 190, 80)

# хореографія: (час, x аналітика) ключові точки; зупинки біля екранів
KEYS = [(0.0, -14), (1.4, 58), (2.6, 58), (3.6, 153), (4.8, 153), (5.8, 248), (6.8, 248), (7.8, 343), (8.6, 343),
        (9.7, 470), (10.1, 470), (10.7, 443), (18.0, 443)]


def walk_x(t):
    for (t0, x0), (t1, x1) in zip(KEYS, KEYS[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / max(1e-6, t1 - t0)
            return x0 + (x1 - x0) * u, (x1 != x0), (1 if x1 >= x0 else -1)
    return KEYS[-1][1], False, -1


def _rect(d, box, **kw):
    x0, y0, x1, y1 = box
    d.rectangle([min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)], **kw)


def analyst(img, x, y, t, moving, face, lean=0.0, glint=False):
    """Аналітик у профіль: окуляри, коротке волосся, чорна куртка і водолазка. x,y: ноги."""
    d = ImageDraw.Draw(img)
    x, y = int(x), int(y)
    ph = int(t * 8) % 2 if moving else 0
    f = face
    # ноги
    for k, s in enumerate((-2, 2)):
        step = (3 if (k + ph) % 2 else -3) if moving else 0
        _rect(d, [x + s + step - 1, y - 14, x + s + step + 1, y - 1], fill=(30, 32, 40))
        _rect(d, [x + s + step - 2, y - 1, x + s + step + 3 * f, y], fill=DARK)
    # тулуб (нахил уперед для «придивляється»)
    lx = int(lean * 4) * f
    d.rounded_rectangle([x - 5 + lx // 2, y - 30, x + 5 + lx // 2, y - 13], 3, fill=JACKET)
    d.line([x + 2 * f + lx // 2, y - 29, x + 2 * f + lx // 2, y - 15], fill=JACKET_L)
    # рука
    sw = (2 if ph else -2) if moving else 0
    d.line([x + lx // 2, y - 27, x + sw * f + lx // 2, y - 17], fill=JACKET, width=3)
    _rect(d, [x + sw * f + lx // 2 - 1, y - 17, x + sw * f + lx // 2 + 1, y - 15], fill=SKIN)
    # голова
    hx, hy = x + lx, y - 38
    _rect(d, [hx - 1, y - 32, hx + 1, y - 30], fill=(16, 16, 20))       # комір водолазки
    d.rounded_rectangle([hx - 5, hy - 6, hx + 5, hy + 6], 3, fill=SKIN)
    _rect(d, [hx - 5, hy - 8, hx + 5, hy - 4], fill=HAIR)
    _rect(d, [hx - 5 - (2 if f > 0 else -8), hy - 4, hx - 4 - (2 if f > 0 else -8), hy], fill=HAIR)
    d.point((hx + 5 * f, hy + 1), fill=SKIN_D)                              # ніс
    # окуляри
    gx = hx + 2 * f
    _rect(d, [gx - 2, hy - 2, gx + 2, hy + 1], outline=(30, 30, 36))
    d.line([gx - 2 * f, hy - 1, hx - 4 * f, hy - 2], fill=(30, 30, 36))
    d.point((gx, hy - 1), fill=WHITE if glint else (40, 46, 56))
    if glint:
        d.point((gx + 1, hy - 2), fill=WHITE)
        d.point((gx - 1, hy), fill=WHITE)
    d.line([hx + f, hy + 3, hx + 3 * f, hy + 3], fill=(150, 90, 80))       # рот


# ---------------------------------------------------------------- дашборди
def screen_bars(img, x0, y0, w, h, t):
    d = ImageDraw.Draw(img)
    vals = [0.4, 0.65, 0.5, 0.85, 0.7]
    bw = (w - 10) / len(vals)
    for i, v in enumerate(vals):
        bh = int((h - 12) * v * (0.85 + 0.15 * math.sin(t * 2 + i)))
        d.rectangle([x0 + 5 + i * bw, y0 + h - 4 - bh, x0 + 5 + i * bw + bw * 0.6, y0 + h - 4], fill=RUBY if i == 3 else SILVER)


def screen_kpi(img, x0, y0, w, h, t):
    d = ImageDraw.Draw(img)
    for i in range(3):
        bx = x0 + 3 + i * (w - 6) / 3
        d.rectangle([bx, y0 + 3, bx + (w - 6) / 3 - 2, y0 + 12], fill=(36, 42, 56))
        d.rectangle([bx + 2, y0 + 6, bx + 2 + 6 + (i * 3 + int(t * 3)) % 9, y0 + 8], fill=[RUBY_L, TEAL, GOLD][i])
    for i in range(10):
        d.point((x0 + 4 + i * 3, y0 + 30 - int(8 * abs(math.sin(i * 0.7 + t)))), fill=TEAL)
    d.pieslice([x0 + w - 22, y0 + 15, x0 + w - 4, y0 + 33], 0, 220 + int(40 * math.sin(t)), fill=RUBY)
    d.pieslice([x0 + w - 22, y0 + 15, x0 + w - 4, y0 + 33], 220 + int(40 * math.sin(t)), 360, fill=SILVER)
    for r in range(3):
        d.rectangle([x0 + 4, y0 + 34 + r * 3, x0 + 28 - r * 5, y0 + 35 + r * 3], fill=GREY)


def screen_lines(img, x0, y0, w, h, t):
    d = ImageDraw.Draw(img)
    for k, col in enumerate((RUBY_L, TEAL, GOLD)):
        pts = [(x0 + 3 + i * (w - 6) / 11, y0 + h * 0.5 + math.sin(i * 0.8 + k * 1.7 + t * 1.5) * (h * 0.25) + (k - 1) * 4) for i in range(12)]
        d.line(pts, fill=col)


def screen_map(img, x0, y0, w, h, t):
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(4)
    for i in range(9):
        for j in range(6):
            v = (math.sin(i * 0.9 + j * 1.3) + 1) / 2
            if rng.random() < 0.8:
                c = tuple(int(a + (b - a) * v) for a, b in zip((40, 52, 70), RUBY))
                d.rectangle([x0 + 4 + i * 5, y0 + 4 + j * 6, x0 + 7 + i * 5, y0 + 8 + j * 6], fill=c)
    py = y0 + 4 + int(3 * 6 + math.sin(t * 3) * 2)
    d.ellipse([x0 + 25, py, x0 + 29, py + 4], outline=WHITE)


def height(gx, gy):
    """Рельєф: дві круглі гори поруч і спокійна рівнина з легкими хвилями."""
    h = 0.0
    for cx in (-0.4, 0.4):                       # два круглі «куполи»
        r2 = ((gx - cx) ** 2 + (gy * 1.05) ** 2) / 0.15
        h += 0.85 * max(0.0, 1 - r2) ** 0.7 + 0.15 * math.exp(-r2 * 1.5)
    h += 0.05 * math.sin(gx * 7) * math.cos(gy * 6)
    return h


ELEV = [(40, 90, 70), (70, 140, 90), (150, 170, 90), (200, 170, 110), (230, 200, 170), (250, 230, 215)]


def elev_col(v, shade):
    v = clamp(v / 1.05)
    k = v * (len(ELEV) - 1)
    i = min(len(ELEV) - 2, int(k))
    u = k - i
    c = [ELEV[i][j] + (ELEV[i + 1][j] - ELEV[i][j]) * u for j in range(3)]
    return tuple(int(min(255, x * shade / 255)) for x in c)


def screen_terrain(img, x0, y0, w, h, t, scale=1.0):
    """Ізометрична 3D-модель рельєфу (малювання «від далекого до близького»), повільне обертання."""
    d = ImageDraw.Draw(img)
    n = 24
    ang = 0.25 * math.sin(t * 0.5)
    ca, sa = math.cos(ang), math.sin(ang)
    cx, cy = x0 + w / 2, y0 + h * 0.62
    sx_, sy_, sz = w * 0.44 * scale, h * 0.24 * scale, h * 0.34 * scale
    pts = {}
    for i in range(n + 1):
        for j in range(n + 1):
            gx, gy = -1 + 2 * i / n, -1 + 2 * j / n
            z = height(gx, gy)
            rx, ry = gx * ca - gy * sa, gx * sa + gy * ca
            pts[i, j] = (cx + rx * sx_, cy + ry * sy_ - z * sz, z, ry)
    cells = []
    for i in range(n):
        for j in range(n):
            a, b, c_, e = pts[i, j], pts[i + 1, j], pts[i + 1, j + 1], pts[i, j + 1]
            depth = (a[3] + b[3] + c_[3] + e[3]) / 4
            z = (a[2] + b[2] + c_[2] + e[2]) / 4
            slope = (b[2] - e[2]) + (c_[2] - a[2]) * 0.5
            cells.append((depth, [a[:2], b[:2], c_[:2], e[:2]], z, slope))
    for depth, poly, z, slope in sorted(cells, key=lambda q: q[0]):
        shade = clamp(0.78 + slope * 0.9, 0.45, 1.0) * 255
        d.polygon(poly, fill=elev_col(z, shade))
    # ізолінії-підпис і вісь
    d.line([x0 + 3, y0 + h - 4, x0 + w - 3, y0 + h - 4], fill=GREY_D)


DRAW = {"bars": screen_bars, "kpi": screen_kpi, "lines": screen_lines, "map": screen_map, "terrain": screen_terrain}


def monitor(img, cx, t, kind, glow=0.0):
    d = ImageDraw.Draw(img)
    w, h = 60, 42
    x0, y0 = cx - w // 2, 128
    d.rectangle([cx - 2, y0 + h, cx + 2, y0 + h + 14], fill=STEEL)                 # ніжка
    d.rectangle([cx - 10, y0 + h + 14, cx + 10, y0 + h + 16], fill=STEEL)
    if glow > 0:
        d.rectangle([x0 - 4, y0 - 4, x0 + w + 4, y0 + h + 4], fill=tuple(int(a * glow) for a in (60, 30, 36)))
    d.rectangle([x0 - 2, y0 - 2, x0 + w + 2, y0 + h + 2], fill=(10, 12, 16))
    d.rectangle([x0, y0, x0 + w, y0 + h], fill=(18, 22, 30))
    DRAW[kind](img, x0, y0, w, h, t)
    d.point((x0 + w - 2, y0 + h + 1), fill=RUBY_L)


def bubble(img, lines, x, y):
    d = ImageDraw.Draw(img)
    w = max(text_w(s) for s in lines) + 10
    h = len(lines) * 10 + 7
    x = int(clamp(x - w // 2, 3, LW - w - 3))
    d.rectangle([x, y, x + w, y + h], fill=WHITE, outline=DARK)
    d.polygon([(x + w // 2 - 3, y + h), (x + w // 2 + 3, y + h), (x + w // 2, y + h + 6)], fill=WHITE)
    for k, s in enumerate(lines):
        ptext(img, s, x + 5, y + 5 + k * 10, DARK, 1, shadow=False)


class Video:
    def __init__(self):
        self.lock = brand.lockup(46)
        self.logo = brand.logo(150)

    def room(self, t):
        img = Image.new("RGB", (WW, LH), BG)
        d = ImageDraw.Draw(img)
        for k in range(0, LH, 14):
            d.line([0, k, WW, k], fill=BG2)
        d.rectangle([0, 186, WW, 190], fill=(46, 40, 36))                            # стіл
        d.rectangle([0, 190, WW, FLOOR], fill=(20, 22, 28))
        d.rectangle([0, FLOOR, WW, LH], fill=(28, 26, 30))
        for k in range(0, WW, 20):
            d.line([k, FLOOR, k - 30, LH], fill=(36, 34, 40))
        return img

    def frame(self, t) -> Image.Image:
        x, moving, face = walk_x(t)
        stare = t >= 10.7
        img = self.room(t)
        for cx, kind, _ in SCREENS:
            monitor(img, cx, t, kind, glow=(0.6 + 0.4 * math.sin(t * 3)) if kind == "terrain" and t > 9.6 else 0.0)
        if 10.1 <= t < 10.7:                                                             # повертається назад
            face = -1
        lean = clamp((t - 11.0) / 0.6) if stare else 0.0
        analyst(img, x, FLOOR - 2, t, moving, face, lean=lean, glint=stare and int(t * 4) % 3 == 0)
        # камера йде за аналітиком крупним планом (масштаб Z), наприкінці наїжджає на 3D-модель рельєфу
        Z = 1.8
        if t >= 11.0:
            Z = 1.8 + 1.0 * ease((t - 11.0) / 1.2)
        ww, wh = LW / Z, LH / Z
        focus = x if t < 10.7 else x + (455 - x) * ease((t - 10.7) / 0.8)
        camx = clamp(focus - ww * (0.5 if t >= 10.7 else 0.42), 0, WW - ww)
        fy = 172 if t < 11.0 else 172 + (150 - 172) * ease((t - 11.0) / 1.2)
        camy = clamp(fy - wh * 0.5, 0, LH - wh)
        view = img.crop((int(camx), int(camy), int(camx + ww), int(camy + wh))).resize((LW, LH), Image.NEAREST)
        hx, hy = (x - camx) * Z, (FLOOR - 44 - camy) * Z          # голова аналітика на екрані
        for (cx, kind, line), t_stop in zip(SCREENS, (1.4, 3.6, 5.8, 7.8, None)):
            if line and t_stop is not None and t_stop + 0.15 <= t < t_stop + 1.15:
                bubble(view, [line], hx + 8, int(hy) - 34)
        if 10.1 <= t < 10.7:
            ptext(view, "?!", int(hx) - 6, int(hy) - 34, RUBY_L, 3)
        if 12.4 <= t < 15.6:
            bubble(view, ["НЕ ЗНАЮ ЩО,", "АЛЕ ЩОСЬ", "У ЦЬОМУ ДАШБОРДІ", "ТОЧНО Є."], LW // 2, 34)
        if t < 1.6:
            ptext_c(view, "АНАЛІТИК", 40, WHITE, 2)
            ptext_c(view, "ОБХОДИТЬ ДАШБОРДИ", 58, RUBY_L, 1)
        full = view.resize((W, H), Image.NEAREST)
        if t >= 15.6:                                                                  # слоган
            u = t - 15.6
            k = ease(u / 0.4)
            dark = Image.blend(full, Image.new("RGB", full.size, BG), 0.72 * k)
            full = dark
            lay = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
            ptext_c(lay, "3D-МОДЕЛІ", 104, WHITE, 3)
            ptext_c(lay, "РЕЛЬЄФУ", 130, RUBY_L, 3)
            if u > 0.5:
                ptext_c(lay, "BELYAKOVCONSULT.COM", 162, WHITE, 1)
            up = lay.resize((W, H), Image.NEAREST)
            full.paste(up, (0, 0), up)
            full.paste(self.logo, (W // 2 - self.logo.width // 2, 330), self.logo)
        else:
            full.paste(self.lock, (56, 92), self.lock)
        return full

    def poster(self):
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        for k in range(0, LH, 14):
            d.line([0, k, LW, k], fill=BG2)
        screen_terrain(img, 20, 70, 140, 110, 3.0, 1.0)
        analyst(img, 150, 250, 0, False, -1, lean=1.0, glint=True)
        ptext_c(img, "ЩОСЬ У ЦЬОМУ", 30, WHITE, 2)
        ptext_c(img, "ДАШБОРДІ Є", 48, RUBY_L, 2)
        full = img.resize((W, H), Image.NEAREST)
        full.paste(self.lock, (56, 92), self.lock)
        return full


def soundtrack(path: Path):
    m = Mix(TOTAL)
    walk = [(72, 1), (74, 1), (76, 1), (79, 1), (76, 2), (74, 2), (72, 1), (69, 1), (72, 2), (74, 4)]
    groove(m, 0.0, 9.6, ["C", "Am", "F", "G"], BEAT, arp=True, seed=2)
    melody(m, 0.3, 9.6, BEAT, walk * 3, gain=0.1)
    for k, tt in enumerate((1.4, 3.6, 5.8, 7.8)):
        m.put(sq(midi(84 - k * 2), 0.08, decay=8), tt + 0.15, 0.25)          # «бульк» репліки
    m.put(blip(1400, 120, 0.35, 1.0), 10.05, 0.7)                             # різке гальмування
    for k in range(8):                                                       # тиха загадкова пауза
        m.put(tri(midi(45 + (k % 2) * 3), BEAT * 0.9), 10.8 + k * BEAT, 0.3)
    m.put(sq(midi(91), 0.6, decay=2), 11.6, 0.12)                             # «дзинь» окулярів
    groove(m, 12.4, 15.6, ["Am", "Dm", "Em", "Am"], BEAT, arp=True, seed=7)
    m.put(crash(2), 15.6, 0.3)
    for k, note in enumerate([72, 76, 79, 84]):
        m.put(sq(midi(note), 0.16, decay=4), 15.7 + k * 0.12, 0.13)
    groove(m, 16.2, TOTAL - 0.3, ["C", "G", "Am", "F"], BEAT, arp=True, seed=4)
    x = m.x / max(1e-9, np.abs(m.x).max()) * 0.85
    n = int(TOTAL * SR)
    x = x[:n]
    x[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))
    st = np.stack([x, x], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


def render(out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    v = Video()
    wav = out_dir / "terrain.wav"
    soundtrack(wav)
    v.poster().save(out_dir / "terrain-joke-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "terrain-joke-9x16.mp4"
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
