"""Тестовий ролик «Night Drive» (9:16, 24 с, EN і UA): преміум-стилістика для керівників і музика-мікс
ретро-синт стилів.

Візуал: фірмовий Ruby Glass у нічній synthwave-сцені. Графітове небо, рубінове сонце з «жалюзі», тонка
перспективна сітка, скляні стовпчики-викиди, що розсипаються на уламки, матові скляні панелі KPI і таблиці,
строга типографіка Montserrat і Inter. Без піксель-арту і мемної подачі.

Схема міні-історії з плану на 90 днів:
  перший кадр: проблема і ставка («Звіт про виручку Q3: +300% за ніч, рада директорів побачить це о 9:00»);
  питання «Ви б це підписали?»; перевірка 1: викиди; перевірка 2: дублі; KPI падає до +12%, «перевірено»;
  висновок «Перевіряйте дані до рішення»; фінал з однією дією: переслати тому, хто підписує цифри.
Цифри й ідентифікатори в ролику ілюстративні.

Музика власна, синтезована кодом (100 уд/хв, ля мінор), стилі змінюються за сюжетом:
  0.0..4.8 с   vaporwave і chillwave: «плівка, що запускається», сповільнені акорди Fmaj7, Em7 з пливучим тоном,
               тріск платівки, напівтемп, наростання;
  4.8..12.0 с  synthwave і retrowave: прямий бит, гейтований малий барабан, октавний бас шістнадцятими,
               арпеджіо, суперпила з «качанням» від бочки, ведуча мелодія з відлунням;
  12.0..16.8 с phonkwave і cyberpunk: мелодійний ковбел 808, бас 808 з глісандо, тріолі хетів, перевантажений бас;
  16.8..24.0 с dreamwave: удар-розкриття акорду, пад і м'яке арпеджіо, що затихає.

Запуск: python scripts/make_nightdrive.py <папка> [en|uk]
"""
from __future__ import annotations

import math
import subprocess
import sys
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.signal import butter, fftconvolve, sosfilt

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import glass  # noqa: E402
from make_fun import sfx_ding  # noqa: E402

W, H = 1080, 1920
FPS = 30
SR = 44100
BPM = 100
B = 60 / BPM            # доля 0.6 с
BAR = 4 * B             # такт 2.4 с
S16 = B / 4
TOTAL = 10 * BAR        # 24 с

# сюжетні моменти
T_Q = 1 * BAR           # 2.4: питання
T_DROP = 2 * BAR        # 4.8: перевірка 1, вмикається драйв
ZAPS = [6.0, 7.8, 9.6]  # викиди розсипаються
T_DUPES = 11.0          # перевірка 2
EATS = [12.6, 13.8, 15.0]  # дублі зникають
T_PHONK = 5 * BAR       # 12.0
T_REAL = 15.6           # перевірено: +12%
T_BAND = 7 * BAR        # 16.8: висновок
T_END = 8 * BAR         # 19.2: фінал
KPI = [(0.0, 300), (ZAPS[0], 210), (ZAPS[1], 140), (ZAPS[2], 90), (EATS[0], 60), (EATS[1], 35), (EATS[2], 12)]

# ритм (спільний для звуку і для пульсу картинки)
KICKS = [T_DROP + i * B for i in range(int((T_PHONK - T_DROP) / B))]
KICKS += [T_PHONK + bar * BAR + s * S16 for bar in range(2) for s in (0, 6, 10)]
KICKS += [T_BAND, T_BAND + 2 * B]
COW = {0: [(0, 81), (3, 84), (6, 81), (8, 79), (10, 76), (11, 79), (14, 81)],
       1: [(0, 81), (3, 84), (6, 81), (8, 77), (10, 76), (11, 72), (14, 76)]}
COW_HITS = [T_PHONK + bar * BAR + s * S16 for bar in (0, 1) for s, _ in COW[bar]]

# ---------------------------------------------------------------- палітра і геометрія
RUBY, WHITE, SILVER, BODY = brand.RUBY, brand.WHITE, brand.SILVER, brand.BODY
GRAPHITE, MIDNIGHT = brand.GRAPHITE, brand.MIDNIGHT
CHAMPAGNE = (255, 206, 150)
PINK = (255, 120, 140)
COOL = (96, 176, 255)            # холодний відтінок сітки в кіберпанк-частині
HY = 1060                        # горизонт
SUN_C, SUN_R = (540, 1004), 236
TOP_Y = 268                      # верх блоку заголовків
CARD = (90, 1392, 930, 1520)     # скляна картка KPI
TABLE = (90, 1060, 930, 1372)    # скляна таблиця перевірки 2
ROW_H = 38

TEXT = {
    "en": {
        "p0": ("Q3 REVENUE REPORT", "+300%", "num", "overnight. The board sees it at 9:00."),
        "p1": ("Q3 REVENUE REPORT", "Would you sign this off?", "q", "Two checks. Twenty seconds."),
        "p2": ("CHECK 1 OF 2", "Outliers", "word", "One typo can triple a quarter."),
        "p3": ("CHECK 2 OF 2", "Duplicates", "word", "The same deal, counted twice."),
        "p4": ("VERIFIED", "+12%", "true", "Real growth. Still strong. Now defensible."),
        "p5": ("", "Check the data\nbefore the decision.", "q2", ""),
        "end": "Send this to whoever signs off on the numbers.",
        "kpi": "REVENUE GROWTH, Q3", "unver": "UNVERIFIED", "ver": "VERIFIED",
        "table": "Q3 SALES  ·  TOP ACCOUNTS", "dup": "DUPLICATE",
        "outl": ["999 999", "×1000", "TEST"],
    },
    "uk": {
        "p0": ("ЗВІТ ПРО ВИРУЧКУ, Q3", "+300%", "num", "за ніч. Рада директорів побачить це о 9:00."),
        "p1": ("ЗВІТ ПРО ВИРУЧКУ, Q3", "Ви б це підписали?", "q", "Дві перевірки. Двадцять секунд."),
        "p2": ("ПЕРЕВІРКА 1 / 2", "Викиди", "word", "Одна помилка в даних може потроїти квартал."),
        "p3": ("ПЕРЕВІРКА 2 / 2", "Дублі", "word", "Та сама угода, порахована двічі."),
        "p4": ("ПЕРЕВІРЕНО", "+12%", "true", "Реальне зростання. Все ще сильне. Тепер його можна захистити."),
        "p5": ("", "Перевіряйте дані\nдо рішення.", "q2", ""),
        "end": "Перешліть тому, хто підписує цифри.",
        "kpi": "ЗРОСТАННЯ ВИРУЧКИ, Q3", "unver": "НЕ ПЕРЕВІРЕНО", "ver": "ПЕРЕВІРЕНО",
        "table": "ПРОДАЖІ Q3  ·  ТОП КЛІЄНТИ", "dup": "ДУБЛЬ",
        "outl": ["999 999", "×1000", "ТЕСТ"],
    },
}
PHASES = [(0.0, "p0"), (T_Q, "p1"), (T_DROP, "p2"), (T_DUPES, "p3"), (T_REAL, "p4"), (T_BAND, "p5"), (T_END, None)]
OUT_X = [-820, 860, -60]                     # де на дорозі стоять викиди (світові одиниці)
ROWS = [("ACC-0417", "€1.20M", None), ("ACC-0417", "€1.20M", 0), ("ACC-0233", "€0.84M", None),
        ("ACC-0233", "€0.84M", 1), ("ACC-0981", "€0.56M", None), ("ACC-0981", "€0.56M", 2)]   # (id, сума, № дубля)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def lerp(a, b, u):
    return tuple(int(round(a[i] + (b[i] - a[i]) * u)) for i in range(3))


def speed(t):
    if t < T_DROP:
        return 0.55 + max(0.0, t - 3.6) * 1.4
    if t < T_DUPES:
        return 2.4
    if t < T_BAND:
        return 1.2
    return 0.5


def kick_pulse(t):
    best = 0.0
    for k in KICKS:
        if 0 <= t - k < 0.5:
            best = max(best, math.exp(-(t - k) / 0.14))
    return best


def kpi_at(t):
    v = KPI[0][1]
    for i, (tk, val) in enumerate(KPI):
        if t >= tk:
            prev = KPI[i - 1][1] if i else val
            v = int(round(prev + (val - prev) * ease((t - tk) / 0.4)))
    return v


def comp(frame, img, x, y, a=1.0):
    """Накласти RGBA з урахуванням виходу за край і загальної прозорості."""
    x, y = int(round(x)), int(round(y))
    if a <= 0.003:
        return
    if a < 0.999:
        img = img.copy()
        img.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
    cx0, cy0 = max(0, -x), max(0, -y)
    cx1, cy1 = min(img.width, frame.width - x), min(img.height, frame.height - y)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    frame.alpha_composite(img.crop((cx0, cy0, cx1, cy1)), (x + cx0, y + cy0))


def bwrap(text, f, maxw):
    """Перенос із рівними рядками (без «висячого» слова в кінці)."""
    total = f.getlength(text)
    if total <= maxw:
        return [text]
    n = math.ceil(total / maxw)
    for extra in (30, 60, 90, 140, 200):
        lines = brand.wrap(text, f, int(total / n + extra))
        if len(lines) <= n:
            return lines
    return brand.wrap(text, f, maxw)


def tracked(d, text, f, xc, y, fill, track=5):
    """Рядок із розрідженими літерами, вирівняний по центру xc."""
    ws = [f.getlength(c) for c in text]
    total = sum(ws) + track * (len(text) - 1)
    x = xc - total / 2
    for c, w in zip(text, ws):
        d.text((x, y), c, font=f, fill=fill)
        x += w + track


@lru_cache(maxsize=None)
def block(lang, name):
    """Блок заголовків фази: мітка, головний рядок, підрядок. Кешується."""
    label, big, style, sub = TEXT[lang][name]
    img = Image.new("RGBA", (W, 640), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    y = 0
    if label:
        tracked(d, label, brand.font("body-semi", 30), W / 2, y, (*SILVER, 255), 6)
        y += 64
    if style in ("num", "true"):
        f = brand.font("head", 236)
        col = RUBY if style == "num" else WHITE
        lines = [big]
    elif style == "word":
        f, col, lines = brand.font("head", 132), WHITE, [big]
    else:
        f, col = brand.font("head", 86 if style == "q" else 76), WHITE
        lines = [ln for part in big.split("\n") for ln in bwrap(part, f, 960)]
    asc, desc = f.getmetrics()
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dl = ImageDraw.Draw(lay)
    for i, ln in enumerate(lines):
        c = RUBY if (style == "q2" and i == len(lines) - 1) else col
        dl.text(((W - f.getlength(ln)) / 2, y), ln, font=f, fill=(*c, 255))
        y += int((asc + desc) * (0.86 if style in ("num", "true") else 1.02))
    if style in ("num", "true"):                     # світіння цифри
        glow = lay.filter(ImageFilter.GaussianBlur(26))
        img.alpha_composite(glow)
        img.alpha_composite(glow)
    img.alpha_composite(lay)
    y += 18
    if sub:
        fs = brand.font("body", 44)
        for ln in bwrap(sub, fs, 900):
            d.text(((W - fs.getlength(ln)) / 2, y), ln, font=fs, fill=(*BODY, 255))
            y += 58
    return img.crop((0, 0, W, y + 30))


@lru_cache(maxsize=None)
def sun_disk():
    r = SUN_R
    ss = 2
    n = 2 * r * ss
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5 - n / 2) / (r * ss)
    inside = np.clip((1 - np.sqrt(xx ** 2 + yy ** 2)) * r * ss, 0, 1)
    u = np.clip((yy + 1) / 2, 0, 1)[..., None]
    top, mid, bot = np.array(CHAMPAGNE), np.array((255, 96, 96)), np.array(RUBY)
    col = np.where(u < 0.5, top + (mid - top) * (u / 0.5), mid + (bot - mid) * ((u - 0.5) / 0.5))
    rgba = np.dstack([col, inside * 255]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA").resize((2 * r, 2 * r), Image.LANCZOS)


@lru_cache(maxsize=None)
def sun_halo():
    n = 1200
    yy, xx = (np.mgrid[0:n, 0:n] - n / 2) / (n / 2)
    m = np.clip(1 - np.sqrt(xx ** 2 + yy ** 2), 0, 1) ** 2.6 * 150
    img = Image.new("RGBA", (n, n), (*RUBY, 0))
    img.putalpha(Image.fromarray(m.astype(np.uint8), "L"))
    return img


def background():
    """Статичне тло: графітове небо в рубіновий серпанок, світіння горизонту, відблиск сонця на підлозі, зерно."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    base = np.zeros((H, W, 3), np.float32)
    sky_u = np.clip(yy / HY, 0, 1)[..., None]
    top, low = np.array(GRAPHITE, np.float32), np.array((44, 8, 30), np.float32)
    base[:] = top + (low - top) * sky_u ** 2.2
    floor = yy >= HY
    base[floor] = np.array((7, 6, 12), np.float32)
    glow = np.exp(-((yy - HY) / 90) ** 2)[..., None] * np.array(RUBY, np.float32) * 0.42
    base += glow
    refl = (np.exp(-((xx - SUN_C[0]) / 150) ** 2) * np.exp(-np.clip(yy - HY, 0, None) / 260) * floor)[..., None]
    base += refl * np.array((255, 70, 90), np.float32) * 0.28
    vign = np.clip(1 - (((xx - W / 2) / (W * 0.9)) ** 2 + ((yy - H * 0.5) / (H * 0.8)) ** 2), 0, 1) ** 0.6
    base *= (0.55 + 0.45 * vign)[..., None]
    rng = np.random.default_rng(5)
    grain = rng.normal(0, 2.6, (H // 2, W // 2)).astype(np.float32)
    base += np.asarray(Image.fromarray(grain).resize((W, H), Image.BILINEAR))[..., None]
    return Image.fromarray(base.clip(0, 255).astype(np.uint8), "RGB").convert("RGBA")


def glass_column(w, h, hot=0.0):
    """Скляний рубіновий стовпчик: вертикальний градієнт, світлий кант зліва, світла кришка."""
    w, h = max(4, int(w)), max(6, int(h))
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = yy / max(1, h - 1)
    v = xx / max(1, w - 1)
    col = np.array(PINK, np.float32) * (1 - u)[..., None] + np.array((120, 0, 24), np.float32) * u[..., None]
    col += 255 * (np.exp(-((v - 0.18) / 0.07) ** 2) * 0.55)[..., None]          # блік
    col += 255 * (np.exp(-(yy / 5.0)) * 0.5)[..., None]                         # кришка
    col += np.array((255, 255, 255), np.float32) * hot
    a = 0.82 + 0.18 * np.exp(-((v - 0.5) / 0.6) ** 2)
    rgba = np.dstack([col.clip(0, 255), a * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    ImageDraw.Draw(img).rectangle([0, 0, w - 1, h - 1], outline=(255, 210, 220, 150))
    return img


class Premium:
    def __init__(self, lang: str):
        self.lang = lang
        self.T = TEXT[lang]
        self.bg = background()
        self.lock = brand.lockup(52)
        self.logo = brand.logo(200)
        ts = np.arange(0, TOTAL + 0.5, 1 / 240)
        self.ts, self.pos = ts, np.cumsum([speed(t) for t in ts]) / 240
        rng = np.random.default_rng(11)
        self.dust = [(rng.uniform(40, 1040), rng.uniform(250, 980), rng.uniform(3, 9), rng.uniform(18, 50), rng.uniform(0, 6)) for _ in range(16)]
        self.shards = []
        for i in range(3):
            r = np.random.default_rng(40 + i)
            self.shards.append([(r.uniform(-3.0, 0.2), r.uniform(160, 520), r.uniform(6, 16), r.uniform(0, 6.3), r.uniform(-8, 8),
                                 r.uniform(0, 1)) for _ in range(34)])
        self.f_lab = brand.font("body-semi", 26)
        self.f_val = brand.font("head", 74)
        self.f_pill = brand.font("body-semi", 24)
        self.f_row = brand.font("body", 34)
        self.f_rowb = brand.font("body-semi", 34)
        self.f_out = {}
        self.f_end = brand.font("body", 46)
        self.f_url = brand.font("body-semi", 34)

    # -------- небо, сонце, сітка
    def scene(self, fr, t):
        p = kick_pulse(t)
        for x, y, r, sp, ph in self.dust:
            yy = (y - t * sp) % 760 + 250
            comp(fr, glass.dust(int(r), 60), x - 2 * r, yy - 2 * r, 0.5 + 0.5 * math.sin(t * 1.3 + ph))
        halo = sun_halo()
        comp(fr, halo, SUN_C[0] - halo.width / 2, SUN_C[1] - halo.height / 2, clamp(0.75 + 0.35 * p, 0, 1))
        disk = sun_disk().copy()
        a = np.asarray(disk.getchannel("A")).copy()
        r = SUN_R
        off = (t * 14) % 26
        for yy in range(r - 40, 2 * r):                  # «жалюзі», що повільно опускаються
            dy = yy - (r - 40)
            gap = 2 + dy / (r + 40) * 16
            if (dy + off) % 26 < gap:
                a[yy, :] = 0
        disk.putalpha(Image.fromarray(a))
        comp(fr, disk, SUN_C[0] - r, SUN_C[1] - r)
        # під горизонтом сонця не видно
        fr.alpha_composite(self.bg.crop((0, HY, W, SUN_C[1] + r + 2)), (0, HY))
        # сітка (з подвійною роздільністю для гладких ліній)
        hl = H - HY
        lay = Image.new("RGBA", (W * 2, hl * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        col = RUBY
        if T_PHONK <= t < T_BAND:
            col = lerp(RUBY, COOL, 0.75)
        bright = 0.75 + 0.25 * p
        pos = float(np.interp(t, self.ts, self.pos))
        frac = pos % 1.0
        for i in range(18):
            z = i + 1 - frac
            if z <= 0.12:
                continue
            y = hl / z
            if y >= hl:
                continue
            a_ = int(clamp(2.4 / z, 0.2, 1.0) * 235 * bright)
            d.line([0, y * 2, W * 2, y * 2], fill=(*lerp(col, PINK, 0.25), a_), width=2)
        for k in range(-14, 15):
            d.line([W, 0, (W / 2 + k * 230) * 2, hl * 2], fill=(*col, int(165 * bright)), width=2)
        lay = lay.reduce(2)
        # лінії гаснуть біля горизонту
        fade = Image.linear_gradient("L").resize((W, hl)).point(lambda v: min(255, int(v * 6)))
        lay.putalpha(Image.composite(lay.getchannel("A"), Image.new("L", lay.size, 0), fade))
        fr.alpha_composite(lay, (0, HY))
        ImageDraw.Draw(fr).line([0, HY, W, HY], fill=(*lerp(RUBY, WHITE, 0.45), 230), width=2)

    # -------- перевірка 1: скляні стовпчики-викиди
    def outliers(self, fr, t):
        hl = H - HY
        for i, X in enumerate(OUT_X):
            tz = ZAPS[i]
            if not (tz - 2.0 <= t < tz + 0.9):
                continue
            s = 0.30 if t >= tz else 0.30 / (1 + 5.0 * ((tz - t) / 2.0) ** 1.4)
            base = HY + hl * s
            cx = W / 2 + X * s
            w, h = 340 * s, 1060 * s
            top = base - h
            if t < tz:
                comp(fr, glass_column(w, h, hot=0.25 * clamp((t - (tz - 0.35)) / 0.35)), cx - w / 2, top, clamp((t - (tz - 2.0)) / 0.4))
                if s > 0.13:
                    size = int(26 + 50 * s)
                    f = self.f_out.setdefault(size, brand.font("body-semi", size))
                    lab = self.T["outl"][i]
                    d = ImageDraw.Draw(fr)
                    d.text((cx - f.getlength(lab) / 2, top - size - 14), lab, font=f, fill=(*WHITE, int(255 * clamp((s - 0.13) / 0.05))))
                if t > tz - 0.4:                         # світлова лінія перевірки проходить стовпчик згори вниз
                    u = clamp((t - (tz - 0.4)) / 0.4)
                    ys = top + h * u
                    lay = Image.new("RGBA", (int(w + 160), 40), (0, 0, 0, 0))
                    dl = ImageDraw.Draw(lay)
                    dl.line([0, 20, lay.width, 20], fill=(*RUBY, 120), width=14)
                    lay = lay.filter(ImageFilter.GaussianBlur(6))
                    ImageDraw.Draw(lay).line([10, 20, lay.width - 10, 20], fill=(255, 245, 248, 240), width=3)
                    comp(fr, lay, cx - lay.width / 2, ys - 20)
            else:
                u = (t - tz) / 0.9                       # скло розсипається
                lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                d = ImageDraw.Draw(lay)
                if u < 0.2:
                    rr = 30 + u * 500
                    d.ellipse([cx - rr, base - h / 2 - rr, cx + rr, base - h / 2 + rr], fill=(255, 230, 236, int(140 * (1 - u / 0.2))))
                for ang, v, sz, rot, spin, shade in self.shards[i]:
                    px = cx + math.cos(ang) * v * u * 0.9
                    py = base - h * (0.2 + 0.6 * shade) + math.sin(ang) * v * u * 0.6 + 900 * u * u
                    rr = rot + spin * u
                    pts = [(px + math.cos(rr + k * 2.1) * sz, py + math.sin(rr + k * 2.1) * sz * 0.7) for k in range(3)]
                    c = lerp(PINK, WHITE, shade * 0.6)
                    d.polygon(pts, fill=(*c, int(220 * (1 - u))))
                fr.alpha_composite(lay)

    # -------- перевірка 2: скляна таблиця, дублі зникають
    def table(self, fr, t):
        if not (T_DUPES - 0.4 <= t < T_REAL + 0.7):
            return
        k = ease((t - (T_DUPES - 0.4)) / 0.4) * clamp((T_REAL + 0.7 - t) / 0.4)
        x0, y0, x1, y1 = TABLE
        glass.frosted(fr, (x0, y0, x1, y1), 30, k)
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        tracked(d, self.T["table"], self.f_lab, 420, 26, (*SILVER, 255), 4)
        d.line([40, 74, lay.width - 40, 74], fill=(255, 255, 255, 40), width=1)
        y = 88
        for rid, amt, dup in ROWS:
            hgt = ROW_H
            a = 1.0
            if dup is not None:
                te = EATS[dup]
                c = clamp((t - te) / 0.4)
                hgt = ROW_H * (1 - ease(c))
                a = 1 - c
                if t >= te - 1.1 and a > 0:              # підсвітка дубля
                    pulse = 0.5 + 0.5 * math.sin((t - te) * 14)
                    d.rounded_rectangle([28, y - 4, lay.width - 28, y + hgt - 4], 8,
                                        fill=(*RUBY, int((50 + 50 * pulse) * a)))
                    fp = self.f_pill
                    tw = fp.getlength(self.T["dup"])
                    d.rounded_rectangle([lay.width - 70 - tw - 28, y + 2, lay.width - 50, y + 32], 15,
                                        outline=(*PINK, int(230 * a)), width=2)
                    d.text((lay.width - 64 - tw - 14, y + 4), self.T["dup"], font=fp, fill=(*PINK, int(255 * a)))
            if a > 0.25 and hgt > 18:
                d.text((48, y), rid, font=self.f_row, fill=(*BODY, int(255 * a)))
                d.text((520 - self.f_rowb.getlength(amt), y), amt, font=self.f_rowb, fill=(*WHITE, int(255 * a)))
            y += hgt
        comp(fr, lay, x0, y0, k)

    # -------- скляна картка KPI
    def card(self, fr, t):
        if t < T_DROP - 0.2 or t >= T_END + 0.4:
            return
        k = ease((t - (T_DROP - 0.2)) / 0.45) * clamp((T_END + 0.4 - t) / 0.4)
        x0, y0, x1, y1 = CARD
        dy = (1 - k) * 30
        glass.frosted(fr, (x0, y0 + dy, x1, y1 + dy), 28, k)
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        ok = t >= EATS[2] + 0.4
        d.text((40, 22), self.T["kpi"], font=self.f_lab, fill=(*SILVER, 255))
        val = f"+{kpi_at(t)}%"
        d.text((38, 50), val, font=self.f_val, fill=(*(WHITE if ok else RUBY), 255))
        pill = self.T["ver"] if ok else self.T["unver"]
        tw = self.f_pill.getlength(pill)
        px1 = lay.width - 36
        px0 = px1 - tw - 44
        if ok:
            d.rounded_rectangle([px0, 64, px1, 106], 21, fill=(*WHITE, 235))
            d.text((px0 + 22, 72), pill, font=self.f_pill, fill=(*GRAPHITE, 255))
        else:
            d.rounded_rectangle([px0, 64, px1, 106], 21, outline=(*RUBY, 255), width=2)
            d.text((px0 + 22, 72), pill, font=self.f_pill, fill=(*PINK, 255))
        # індикатор двох перевірок
        segs = [(ZAPS[2], T_DROP), (EATS[2], T_DUPES)]
        sw = (px0 - 40 - 360 - 16) / 2
        for j, (done, start) in enumerate(segs):
            sx = 400 + j * (sw + 16)
            d.rounded_rectangle([sx, 84, sx + sw, 90], 3, fill=(255, 255, 255, 40))
            prog = clamp((t - start) / (done + 0.2 - start))
            if prog > 0:
                d.rounded_rectangle([sx, 84, sx + sw * prog, 90], 3, fill=(*(WHITE if prog >= 1 else RUBY), 255))
        comp(fr, lay, x0, y0 + dy, k)

    # -------- заголовки історії
    def header(self, fr, t):
        for j, (t0, name) in enumerate(PHASES):
            if name is None:
                continue
            t1 = PHASES[j + 1][0]
            if not (t0 <= t < t1):
                continue
            a_in = 1.0 if name == "p0" else ease((t - t0) / 0.38)
            a_out = clamp((t1 - t) / 0.2)
            img = block(self.lang, name)
            comp(fr, img, 0, TOP_Y + (1 - a_in) * 30, a_in * a_out)

    def end(self, fr, t):
        u = t - T_END
        dark = Image.new("RGBA", (W, H), (*GRAPHITE, int(205 * ease(u / 0.6))))
        fr.alpha_composite(dark)
        k = ease((u - 0.2) / 0.6)
        comp(fr, self.logo, W / 2 - self.logo.width / 2, 600 + (1 - k) * 30, k)
        d = ImageDraw.Draw(fr)
        k2 = ease((u - 0.6) / 0.6)
        y = 900 + (1 - k2) * 20
        for ln in bwrap(self.T["end"], self.f_end, 900):
            d.text(((W - self.f_end.getlength(ln)) / 2, y), ln, font=self.f_end, fill=(*WHITE, int(255 * k2)))
            y += 62
        k3 = ease((u - 1.0) / 0.6)
        tracked(d, "BELYAKOVCONSULT.COM", self.f_url, W / 2, y + 40, (*SILVER, int(255 * k3)), 6)
        d.line([W / 2 - 60, y + 22, W / 2 + 60, y + 22], fill=(*RUBY, int(255 * k3)), width=3)

    def frame(self, t):
        fr = self.bg.copy()
        self.scene(fr, t)
        self.outliers(fr, t)
        self.table(fr, t)
        self.card(fr, t)
        self.header(fr, t)
        if t >= T_END:
            self.end(fr, t)
        else:
            fr.alpha_composite(self.lock, (72, 116))
        out = fr.convert("RGB")
        if t < T_DROP:
            out = vhs(out, t)
        for hit in COW_HITS:                              # стриманий кіберпанк-глітч на ударах ковбела
            if 0 <= t - hit < 0.05:
                a = np.asarray(out).copy()
                a[:, :, 0] = np.roll(a[:, :, 0], 3, axis=1)
                a[:, :, 2] = np.roll(a[:, :, 2], -3, axis=1)
                out = Image.fromarray(a)
                break
        return out


def vhs(full, t):
    """Vaporwave-натяк в інтро: легкий зсув кольорових каналів і тонкі скан-лінії, зникають до дропу."""
    k = 1.0 if t < T_DROP - 0.6 else clamp((T_DROP - t) / 0.6)
    a = np.asarray(full).astype(np.int16)
    sh = int(round(3 * k))
    if sh:
        a[:, :, 0] = np.roll(a[:, :, 0], sh, axis=1)
        a[:, :, 2] = np.roll(a[:, :, 2], -sh, axis=1)
    a[::4] = (a[::4] * (1 - 0.1 * k)).astype(np.int16)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- звук
def tt(n):
    return np.arange(n) / SR


TRANSPOSE = 0          # зсув тональності для шаблонних роликів (півтони)


def midi(m):
    return 440.0 * 2 ** ((m + TRANSPOSE - 69) / 12)


def edge(n, a=0.003, r=0.02):
    e = np.ones(n)
    na, nr = min(n, max(1, int(a * SR))), min(n, max(1, int(r * SR)))
    e[:na] *= np.linspace(0, 1, na)
    e[n - nr:] *= np.linspace(1, 0, nr)
    return e


def saw(freq, n, ph0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    return 2.0 * ((ph0 + np.cumsum(f) / SR) % 1.0) - 1.0


def square(freq, n):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    return np.where(((np.cumsum(f) / SR) % 1.0) < 0.5, 1.0, -1.0)


def _sos(kind, fc, order=2):
    if kind == "band":
        lo, hi = fc
        return butter(order, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], "bandpass", output="sos")
    return butter(order, min(fc, SR * 0.45) / (SR / 2), kind, output="sos")


def lpf(x, fc, order=2):
    return sosfilt(_sos("low", fc, order), x)


def hpf(x, fc, order=2):
    return sosfilt(_sos("high", fc, order), x)


def bpf(x, lo, hi, order=2):
    return sosfilt(_sos("band", (lo, hi), order), x)


def sweep_bp(x, f0, f1, block=512):
    """Смуговий фільтр, центр якого їде від f0 до f1 (для наростань)."""
    out = np.zeros_like(x)
    zi = None
    nb = max(1, len(x) // block)
    for i in range(nb + 1):
        a, b = i * block, min(len(x), (i + 1) * block)
        if a >= b:
            break
        fc = f0 * (f1 / f0) ** (a / len(x))
        sos = _sos("band", (fc / 1.5, fc * 1.5), 2)
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[a:b], zi = sosfilt(sos, x[a:b], zi=zi)
    return out


def noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


class Bus:
    def __init__(self, dur):
        self.L = np.zeros(int(dur * SR) + SR)
        self.R = np.zeros_like(self.L)

    def put(self, sig, at, gain=1.0, pan=0.0):
        a = int(round(at * SR))
        if a >= len(self.L):
            return
        s = sig
        if a < 0:
            s, a = sig[-a:], 0
        b = min(len(self.L), a + len(s))
        th = (pan + 1) * math.pi / 4
        self.L[a:b] += s[:b - a] * gain * math.cos(th) * 1.414
        self.R[a:b] += s[:b - a] * gain * math.sin(th) * 1.414

    def put2(self, l, r, at, gain=1.0):
        self.put(l, at, gain, -1.0)
        self.put(r, at, gain, 1.0)


# -------- інструменти
def kick80(gain_click=0.35):
    n = int(0.42 * SR)
    t = tt(n)
    body = np.sin(2 * np.pi * np.cumsum(46 + 125 * np.exp(-t * 30)) / SR) * np.exp(-t * 7.0)
    click = lpf(noise(n, 3), 5000) * np.exp(-t * 260) * gain_click
    return np.tanh(1.5 * (body + click)) * edge(n, 0.001, 0.03)


def kick808():
    n = int(0.6 * SR)
    t = tt(n)
    x = np.sin(2 * np.pi * np.cumsum(42 + 90 * np.exp(-t * 22)) / SR) * np.exp(-t * 4.2)
    return np.tanh(2.2 * x) * edge(n, 0.001, 0.05)


def snare_gated(seed=0):
    """Малий барабан вісімдесятих: тіло, шум і «гейтований» реверб, обрізаний на 0.22 с."""
    n = int(0.34 * SR)
    t = tt(n)
    body = np.sin(2 * np.pi * 182 * t) * np.exp(-t * 24) * 0.8
    nz = bpf(noise(n, seed), 1400, 9000) * np.exp(-t * 16)
    gate = np.where(t < 0.22, 0.55 * np.exp(-t * 2.5), 0.55 * np.exp(-0.55) * np.exp(-(t - 0.22) * 160))
    tail = lpf(hpf(noise(n, seed + 50), 700), 7000) * gate
    return (body + nz + tail) * edge(n, 0.001, 0.01)


def snare_lofi(seed=0):
    n = int(0.5 * SR)
    t = tt(n)
    x = np.sin(2 * np.pi * 200 * t) * np.exp(-t * 30) * 0.5 + lpf(bpf(noise(n, seed), 900, 5000), 3500) * np.exp(-t * 11)
    return x * edge(n, 0.002, 0.05)


def clap(seed=0):
    n = int(0.3 * SR)
    t = tt(n)
    env = np.zeros(n)
    for k, dt in enumerate((0.0, 0.011, 0.022)):
        a = int(dt * SR)
        env[a:] += np.exp(-(t[:n - a]) * 140) * (0.8 + 0.1 * k)
    env += 0.35 * np.exp(-t * 18)
    return bpf(noise(n, seed), 900, 4200) * env * edge(n, 0.001, 0.02)


def hat_c(seed=0, gain=1.0):
    n = int(0.05 * SR)
    return hpf(noise(n, seed), 7000, 4) * np.exp(-tt(n) * 90) * edge(n, 0.0005, 0.005) * gain


def hat_o(seed=0):
    n = int(0.3 * SR)
    return hpf(noise(n, seed), 6500, 4) * np.exp(-tt(n) * 11) * edge(n, 0.001, 0.03)


def cymbal(seed=0, dur=2.2):
    n = int(dur * SR)
    return hpf(noise(n, seed), 3200, 2) * np.exp(-tt(n) * 2.1) * edge(n, 0.001, 0.2)


def bass_note(note, dur, cutoff=620):
    n = int(dur * SR)
    t = tt(n)
    f = midi(note)
    x = 0.7 * saw(f, n) + 0.5 * square(f * 0.5, n)
    x = lpf(x, cutoff + 400, 2)
    return x * np.exp(-t * 5) * edge(n, 0.003, 0.015)


def pluck(note, dur, cutoff=2800):
    n = int(dur * SR)
    t = tt(n)
    f = midi(note)
    x = 0.6 * saw(f, n) + 0.4 * square(f * 1.003, n)
    return lpf(x, cutoff) * np.exp(-t * 11) * edge(n, 0.002, 0.02)


def pad(notes, dur, cutoff=1900, attack=0.3, release=0.6, detune=0.11, wobble=None):
    """Суперпила: три розстроєні голоси на ноту, ліворуч і праворуч різні; wobble(t) зсуває тон (півтони)."""
    n = int((dur + release) * SR)
    t = tt(n)
    shift = wobble(t) if wobble else 0.0
    L, R = np.zeros(n), np.zeros(n)
    for j, m in enumerate(notes):
        for v, dt in enumerate((-detune, 0.0, detune)):
            f = midi(m + dt + shift)
            s = saw(f, n, ph0=(j * 0.37 + v * 0.21) % 1.0)
            if v <= 1:
                L += s
            if v >= 1:
                R += s
    env = np.clip(t / attack, 0, 1) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (release / 3)))
    k = 1.0 / (len(notes) * 2.0)
    return lpf(L, cutoff) * env * k, lpf(R, cutoff) * env * k


def epiano(note, dur, wobble=None):
    n = int(dur * SR)
    t = tt(n)
    f = midi(note) * (2 ** ((wobble(t) if wobble else 0.0) / 12))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.3 * np.sin(2 * ph) * np.exp(-t * 5) + 0.1 * np.sin(3 * ph) * np.exp(-t * 8)
    return x * np.exp(-t * 1.6) * edge(n, 0.005, 0.1)


def lead(note, dur, cutoff=3400):
    n = int((dur + 0.08) * SR)
    t = tt(n)
    vib = 0.16 * np.clip((t - 0.18) / 0.2, 0, 1) * np.sin(2 * np.pi * 5.6 * t)
    f = midi(note) * 2 ** (vib / 12)
    x = 0.5 * saw(f, n) + 0.5 * saw(f * 1.006, n, 0.3) + 0.25 * square(f * 0.5, n)
    env = np.clip(t / 0.012, 0, 1) * np.where(t < dur, 1.0 - 0.25 * np.clip(t / 0.4, 0, 1), 0.75 * np.exp(-(t - dur) * 40))
    return lpf(x, cutoff) * env


def cowbell(note, dur=0.28):
    """Ковбел 808: дві квадратні хвилі з відношенням 1:1.48 через смуговий фільтр; висота за мелодією фонку."""
    n = int(dur * SR)
    t = tt(n)
    f0 = midi(note - 12)
    x = 0.5 * square(f0, n) + 0.5 * square(f0 * 1.48, n)
    x = bpf(x, 450, 5200)
    return x * (0.65 * np.exp(-t * 40) + 0.35 * np.exp(-t * 9)) * edge(n, 0.0008, 0.02)


def bass808(path, dur):
    """808: синус із глісандо між нотами (path: [(час_від_початку, нота)]), з перевантаженням для «кібер» бруду."""
    n = int(dur * SR)
    t = tt(n)
    times = [p[0] for p in path]
    notes = [p[1] for p in path]
    m = np.interp(t, np.repeat(times, 2)[1:], np.repeat(notes, 2)[:-1]) if len(path) > 1 else np.full(n, notes[0])
    # плавне глісандо 60 мс замість стрибка
    k = int(0.06 * SR)
    m = np.convolve(np.pad(m, (k, 0), mode="edge"), np.ones(k) / k, mode="valid")[:n]
    x = np.sin(2 * np.pi * np.cumsum(midi(m)) / SR)
    env = np.ones(n)
    for tm in times:
        a = int(tm * SR)
        env[a:] = np.minimum(env[a:], 0.0) + np.exp(-(t[:n - a]) * 1.4)
    return np.tanh(2.6 * x * env) * 0.9 * edge(n, 0.003, 0.08)


def crackle(n, seed=7):
    rng = np.random.default_rng(seed)
    x = np.zeros(n)
    idx = rng.integers(0, n, int(n / SR * 34))
    x[idx] = rng.uniform(-1, 1, len(idx)) * rng.uniform(0.3, 1.0, len(idx))
    x = lpf(x, 5000) * 3
    return x + lpf(noise(n, seed + 1), 2500) * 0.035


def scan_sfx():
    """М'який висхідний «скан» перед тим, як скло розсиплеться."""
    n = int(0.42 * SR)
    t = tt(n)
    f = 700 * (2600 / 700) ** (t / t[-1])
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / t[-1]) ** 1.5 * edge(n, 0.01, 0.03)


def shatter_sfx(seed=0):
    """Скло: кілька негармонійних дзвінких частот і короткий шумовий сплеск."""
    n = int(0.9 * SR)
    t = tt(n)
    rng = np.random.default_rng(seed)
    x = np.zeros(n)
    for f in rng.uniform(2200, 7800, 7):
        x += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t * rng.uniform(6, 14)) * rng.uniform(0.3, 1.0)
    x = x / 4 + hpf(noise(n, seed), 3000) * np.exp(-t * 30) * 0.7
    return x * edge(n, 0.001, 0.05)


def collapse_sfx(seed=0):
    """Рядок зникає: короткий «тук» і м'який повітряний свист донизу."""
    n = int(0.36 * SR)
    t = tt(n)
    thud = np.sin(2 * np.pi * np.cumsum(260 * np.exp(-t * 18) + 90) / SR) * np.exp(-t * 20)
    air = sweep_bp(noise(n, seed + 3), 4000, 600) * np.exp(-t * 8) * 0.6
    return (thud + air) * edge(n, 0.001, 0.03)


def zap_sfx():
    n = int(0.28 * SR)
    t = tt(n)
    f = 2400 * np.exp(-t * 9) + 260
    return lpf(saw(f, n), 6000) * np.exp(-t * 7) * edge(n, 0.001, 0.02)


def boom_sfx(seed=0):
    n = int(0.6 * SR)
    t = tt(n)
    return (lpf(noise(n, seed), 1400) * np.exp(-t * 8) + np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 6) + 30) / SR) * np.exp(-t * 6)) * edge(n, 0.001, 0.05)


def chomp_sfx(seed=0):
    n = int(0.16 * SR)
    t = tt(n)
    f = 700 * np.exp(-t * 16) + 120
    return (square(f, n) * 0.5 + bpf(noise(n, seed), 500, 3000) * 0.6) * np.exp(-t * 22) * edge(n, 0.001, 0.01)


def tick_sfx(f=1800):
    n = int(0.05 * SR)
    return np.sin(2 * np.pi * f * tt(n)) * np.exp(-tt(n) * 60) * edge(n, 0.0005, 0.005)


CH = {"Fmaj7": (41, [57, 60, 64, 65]), "Em7": (40, [55, 59, 62, 64]), "Am": (45, [57, 60, 64]),
      "F": (41, [57, 60, 65]), "C": (48, [55, 60, 64]), "G": (43, [55, 59, 62]), "Am9": (45, [57, 60, 64, 71])}


CH.update({"Em": (40, [55, 59, 64]), "Dm": (38, [57, 62, 65]), "E": (40, [56, 59, 64]), "Dm7": (38, [57, 60, 62, 65]),
           "Am7": (45, [55, 60, 64, 67]), "G6": (43, [55, 59, 62, 64])})

# П'ять мелодій формату (однаковий темп 100 уд/хв, щоб події сюжету лягали на долі). Ноти в ля мінорі, key зсуває.
# drive: (акорд, такт, зсув у долях, тривалість у долях); lead: (нота, восьмі) на 3 такти; cow: ковбел по 16-х.
TRACKS = [
    {"name": "Night Drive", "key": 0, "intro": ("Fmaj7", "Em7"),
     "ep": [(0.0, 76, 1.15), (1.2, 72, 1.15), (2.4, 71, 0.9), (3.3, 67, 1.4)],
     "drive": [("Am", 2, 0, 4), ("F", 3, 0, 4), ("C", 4, 0, 2), ("G", 4, 2, 2)], "arp": [0, 1, 2, 3, 2, 1, 2, 3],
     "lead": [(76, 3), (74, 1), (72, 2), (69, 2), (72, 2), (69, 2), (65, 3), (67, 1), (67, 2), (72, 2), (74, 2), (71, 2)],
     "lead_cut": 3400, "drums": "straight", "phonk": ("Am", "F"),
     "cow": {0: [(0, 81), (3, 84), (6, 81), (8, 79), (10, 76), (11, 79), (14, 81)],
             1: [(0, 81), (3, 84), (6, 81), (8, 77), (10, 76), (11, 72), (14, 76)]},
     "glide": [[(0, 33), (6, 36), (10, 33)], [(0, 29), (8, 29), (12, 31)]],
     "reveal": ([55, 60, 64, 67, 72], 36), "outro": (("F", 2600), ("Am9", 1700)),
     "lead2": [(79, 4), (76, 2), (74, 2), (72, 6), (76, 2), (69, 8)]},
    {"name": "Neon Rain", "key": -2, "intro": ("Dm7", "Em7"),
     "ep": [(0.0, 72, 1.15), (1.2, 69, 1.15), (2.4, 71, 0.9), (3.3, 74, 1.4)],
     "drive": [("Am", 2, 0, 4), ("G", 3, 0, 4), ("F", 4, 0, 2), ("E", 4, 2, 2)], "arp": [0, 2, 1, 3, 0, 2, 1, 3],
     "lead": [(72, 2), (76, 2), (77, 3), (76, 1), (74, 2), (71, 2), (72, 2), (69, 2), (69, 2), (72, 2), (71, 2), (68, 2)],
     "lead_cut": 2600, "drums": "clap", "phonk": ("Am", "E"),
     "cow": {0: [(0, 76), (2, 79), (4, 76), (7, 81), (10, 79), (12, 76)],
             1: [(0, 80), (2, 76), (4, 80), (7, 83), (10, 80), (12, 76)]},
     "glide": [[(0, 33), (8, 31), (12, 33)], [(0, 28), (6, 32), (10, 28)]],
     "reveal": ([55, 60, 64, 67, 72], 36), "outro": (("G", 2600), ("Am9", 1700)),
     "lead2": [(76, 4), (74, 2), (72, 2), (71, 6), (72, 2), (69, 8)]},
    {"name": "Chrome Dawn", "key": 3, "intro": ("Fmaj7", "G6"),
     "ep": [(0.0, 77, 0.55), (0.6, 76, 0.55), (1.2, 72, 1.1), (2.4, 74, 0.9), (3.3, 71, 1.4)],
     "drive": [("F", 2, 0, 4), ("G", 3, 0, 4), ("Em", 4, 0, 2), ("Am", 4, 2, 2)], "arp": [0, 1, 2, 1, 0, 1, 2, 3],
     "lead": [(69, 1), (72, 1), (77, 2), (76, 2), (72, 2), (74, 3), (71, 1), (67, 2), (71, 2), (71, 2), (67, 2), (69, 4)],
     "lead_cut": 3400, "drums": "straight", "phonk": ("Am", "G"),
     "cow": {0: [(0, 81), (3, 79), (6, 76), (8, 81), (11, 84), (14, 81)],
             1: [(0, 79), (3, 74), (6, 71), (8, 79), (11, 83), (14, 79)]},
     "glide": [[(0, 33), (6, 33), (10, 36)], [(0, 31), (8, 31), (12, 26)]],
     "reveal": ([53, 57, 60, 65, 69], 41), "outro": (("Dm7", 2600), ("Am9", 1700)),
     "lead2": [(81, 4), (79, 2), (76, 2), (77, 6), (76, 2), (72, 8)]},
    {"name": "Glass City", "key": -4, "intro": ("Am7", "Fmaj7"),
     "ep": [(0.0, 76, 1.15), (1.2, 79, 1.15), (2.4, 77, 0.9), (3.3, 72, 1.4)],
     "drive": [("Am", 2, 0, 4), ("Em", 3, 0, 4), ("F", 4, 0, 2), ("G", 4, 2, 2)], "arp": [0, 2, 1, 2, 0, 2, 1, 2],
     "lead": [(64, 2), (69, 2), (72, 2), (71, 2), (67, 3), (64, 1), (71, 2), (67, 2), (69, 2), (72, 2), (74, 2), (71, 2)],
     "lead_cut": 2200, "drums": "half", "phonk": ("Am", "F"),
     "cow": {0: [(0, 76), (3, 76), (6, 79), (8, 81), (10, 79), (13, 76)],
             1: [(0, 77), (3, 77), (6, 81), (8, 84), (10, 81), (13, 77)]},
     "glide": [[(0, 33), (6, 36), (10, 33)], [(0, 29), (8, 29), (12, 31)]],
     "reveal": ([55, 59, 62, 67, 71], 43), "outro": (("F", 2600), ("Am9", 1700)),
     "lead2": [(76, 2), (79, 2), (81, 4), (79, 4), (76, 4), (69, 8)]},
    {"name": "Midnight Ledger", "key": 1, "intro": ("Dm7", "Fmaj7"),
     "ep": [(0.0, 74, 1.15), (1.2, 77, 1.15), (2.4, 76, 0.9), (3.3, 72, 1.4)],
     "drive": [("Dm", 2, 0, 4), ("Am", 3, 0, 4), ("F", 4, 0, 2), ("G", 4, 2, 2)], "arp": [0, 1, 2, 3, 0, 1, 2, 3],
     "lead": [(74, 2), (77, 2), (76, 2), (74, 2), (72, 3), (69, 1), (76, 4), (77, 2), (76, 2), (74, 2), (71, 2)],
     "lead_cut": 4200, "drums": "clap", "phonk": ("Dm", "Am"),
     "cow": {0: [(0, 77), (3, 81), (6, 77), (8, 74), (10, 77), (11, 81), (14, 77)],
             1: [(0, 76), (3, 81), (6, 76), (8, 72), (10, 76), (11, 79), (14, 76)]},
     "glide": [[(0, 26), (6, 29), (10, 26)], [(0, 33), (8, 33), (12, 31)]],
     "reveal": ([53, 57, 60, 65, 69], 41), "outro": (("G", 2600), ("Am9", 1700)),
     "lead2": [(79, 4), (77, 2), (76, 2), (74, 6), (72, 2), (69, 8)]},
]


def cow_hits(track: int = 0):
    cow = TRACKS[track]["cow"]
    return [T_PHONK + bar * BAR + s * S16 for bar in (0, 1) for s, _ in cow[bar]]


def soundtrack(path: Path, story_sfx=None, transpose: int = 0, track: int = 0):
    """Трек ролика. track: одна з п'яти мелодій TRACKS; story_sfx(dry, send): власні звуки сюжету замість звуків
    Night Drive; transpose: додатковий зсув тональності."""
    global TRANSPOSE
    P = TRACKS[track]
    TRANSPOSE = P["key"] + transpose
    dur = TOTAL + 1.0
    dry, send, padbus = Bus(dur), Bus(dur), Bus(dur)

    # ---- 0..4.8 vaporwave і chillwave
    def wob(t):          # «плівка запускається» + повільне плавання тону
        return -7.0 * np.clip(1 - t / 0.4, 0, 1) ** 2 + 0.22 * np.sin(2 * np.pi * 0.55 * t)
    for bar, ch in enumerate(P["intro"]):
        root, tones = CH[ch]
        w = (lambda tt_, b=bar: wob(tt_ + b * BAR)) if bar else wob
        l, r = pad(list(tones) + [root + 12], BAR, cutoff=1300, attack=0.05 if bar == 0 else 0.2, release=0.4, wobble=w)
        padbus.put2(l, r, bar * BAR, 0.9)
        n = int(BAR * SR)
        send.put(lpf(np.sin(2 * np.pi * np.cumsum(midi(root) * 2 ** (w(tt(n)) / 12)) / SR), 400) * edge(n, 0.02, 0.3), bar * BAR, 0.2)
    for at, m, d in P["ep"]:
        send.put(lpf(epiano(m, d, lambda x, a=at: wob(x + a)), 2200), at, 0.3, pan=0.25)
    for at in (0.0, 2.4):
        dry.put(kick80(0.1), at, 0.55)
    for at in (1.2, 3.6):
        send.put(snare_lofi(int(at * 10) + track), at, 0.32)
    for i in range(8):
        dry.put(hat_c(i + 10 * track, 0.5), i * B + (0.07 if i % 2 else 0.0), 0.16 if i % 2 else 0.1, pan=0.3)
    cr = crackle(int((T_DROP + 0.3) * SR), 7 + track)
    dry.put(cr * np.clip((T_DROP + 0.3 - tt(len(cr))) / 0.5, 0, 1), 0.0, 0.08)
    n = int(1.8 * SR)
    dry.put(sweep_bp(noise(n, 21 + track), 300, 7000) * np.linspace(0, 1, n) ** 2, T_DROP - 1.8, 0.5)
    dry.put(cymbal(31, 1.2)[::-1], T_DROP - 1.2, 0.35)
    at, step, g = T_DROP - 2 * B, S16, 0.12
    while at < T_DROP - 0.01:
        dry.put(snare_gated(int(at * 100)), at, g)
        g = min(0.5, g + 0.035)
        if at > T_DROP - B:
            step = S16 / 2
        at += step

    # ---- 4.8..12 synthwave і retrowave
    for ch, bar, off, beats in P["drive"]:
        root, tones = CH[ch]
        t0 = bar * BAR + off * B
        l, r = pad(list(tones) + [tones[0] + 12], beats * B, cutoff=2300, attack=0.04, release=0.25)
        padbus.put2(l, r, t0, 1.0)
        for s_ in range(beats * 4):
            at = t0 + s_ * S16
            dry.put(bass_note(root - 12 + (12 if s_ % 2 else 0), S16 * 0.92), at, 0.42)
            arp = [tones[0] + 12, tones[1] + 12, tones[2] + 12, tones[0] + 24]
            idx = P["arp"][s_ % 8]
            send.put(pluck(arp[idx], S16 * 0.9), at, 0.13, pan=(-0.4 if s_ % 2 else 0.4))
    for i in range(int((T_PHONK - T_DROP) / B)):
        at = T_DROP + i * B
        dry.put(kick80(), at, 0.95)
        if P["drums"] == "half":
            if i % 4 == 2:
                send.put(snare_gated(i), at, 0.6)
        elif i % 2 == 1:
            send.put(snare_gated(i), at, 0.55)
            if P["drums"] == "clap":
                send.put(clap(i + 40), at, 0.3)
        for e in range(4):
            dry.put(hat_c(i * 4 + e, 1.0), at + e * S16, 0.18 if e % 2 else 0.1, pan=0.35)
        dry.put(hat_o(i), at + B / 2, 0.07 if P["drums"] != "half" else 0.11, pan=-0.3)
    dry.put(cymbal(1), T_DROP, 0.4)
    at = T_DROP
    for m, e in P["lead"]:
        sig = lead(m, e * B / 2 * 0.95, P["lead_cut"])
        send.put(sig, at, 0.17)
        for k, (dl, g, pn) in enumerate(((0.75 * B, 0.33, -0.6), (1.5 * B, 0.18, 0.6), (2.25 * B, 0.09, -0.6))):
            send.put(lpf(sig, 2400 - 500 * k), at + dl, 0.17 * g, pan=pn)   # пінг-понг відлуння
        at += e * B / 2

    # ---- 12..16.8 phonkwave і cyberpunk
    for bar, ch in enumerate(P["phonk"]):
        root, tones = CH[ch]
        t0 = T_PHONK + bar * BAR
        l, r = pad(list(tones), BAR, cutoff=1150, attack=0.03, release=0.3)
        padbus.put2(l, r, t0, 0.8)
        for s_ in (0, 6, 10):
            dry.put(kick808(), t0 + s_ * S16, 0.8)
        for s_ in (4, 12):
            send.put(clap(bar * 10 + s_ + track), t0 + s_ * S16, 0.42)
        for s_ in range(16):
            if s_ in (14, 15):
                continue
            dry.put(hat_c(200 + bar * 16 + s_, 1.0), t0 + s_ * S16, 0.15 if s_ % 2 else 0.09, pan=0.3)
        for k in range(3):                                   # тріоль хетів у кінці такту
            dry.put(hat_c(300 + bar * 3 + k, 1.0), t0 + 14 * S16 + k * (2 * S16 / 3), 0.14, pan=0.3)
        for s_, m in P["cow"][bar]:
            send.put(cowbell(m), t0 + s_ * S16, 0.2, pan=0.15)
        glide = [(st * S16, nt) for st, nt in P["glide"][bar]]
        dry.put(bass808(glide, BAR), t0, 0.55)
        n = int(BAR * SR)                                    # кібер-бас: перевантажена пила під 808
        grit = np.tanh(3.0 * lpf(saw(midi(root - 12), n), 700)) * edge(n, 0.01, 0.05)
        dry.put(grit, t0, 0.04)

    # ---- 16.8..24 dreamwave: удар, розкриття, затихання
    dry.put(cymbal(2, 2.6), T_BAND, 0.42)
    dry.put(kick80(), T_BAND, 1.0)
    dry.put(kick80(), T_BAND + 2 * B, 0.8)
    send.put(snare_gated(77), T_BAND + B, 0.5)
    send.put(snare_gated(78), T_BAND + 3 * B, 0.5)
    rv_notes, rv_root = P["reveal"]
    l, r = pad(rv_notes, BAR, cutoff=3600, attack=0.01, release=0.4)
    padbus.put2(l, r, T_BAND, 1.1)
    dry.put(bass_note(rv_root, BAR * 0.95, 400), T_BAND, 0.5)
    for i, (ch, cut) in enumerate(P["outro"]):
        root, tones = CH[ch]
        t0 = T_END + i * BAR
        l, r = pad(list(tones) + [tones[0] + 12], BAR, cutoff=cut, attack=0.3, release=1.6 if i else 0.5)
        padbus.put2(l, r, t0, 0.95)
        n = int(BAR * SR)
        dry.put(lpf(np.sin(2 * np.pi * midi(root - 12) * tt(n)), 300) * edge(n, 0.05, 0.4), t0, 0.22)
        for s_ in range(8):
            at = t0 + s_ * B / 2
            g = 0.1 * (1 - (i * 8 + s_) / 18)
            send.put(pluck(tones[s_ % len(tones)] + 12, B / 2 * 0.9, 2000), at, g, pan=(-0.5 if s_ % 2 else 0.5))
    at = T_BAND
    for m, e in P["lead2"]:
        sig = lead(m, e * B / 2 * 0.95, P["lead_cut"])
        send.put(sig, at, 0.14)
        send.put(lpf(sig, 2000), at + 0.75 * B, 0.05, pan=0.6)
        at += e * B / 2

    # ---- звуки сюжету
    if story_sfx:
        story_sfx(dry, send)
    else:
        for tz in ZAPS:
            dry.put(scan_sfx(), tz - 0.4, 0.16, pan=0.2)
            send.put(shatter_sfx(int(tz * 10)), tz, 0.32)
        for i, te in enumerate(EATS):
            send.put(collapse_sfx(i), te - 0.02, 0.3, pan=-0.2)
        for tk, _ in KPI[1:]:
            for k in range(3):
                dry.put(tick_sfx(1700 + 200 * k), tk + 0.05 + k * 0.09, 0.07)
        dry.put(sfx_ding(1320, 1.2), T_REAL, 0.18)
    TRANSPOSE = 0

    # ---- зведення: качання паду від бочки, реверб, м'яке обмеження
    duck = np.ones(len(padbus.L))
    m = int(0.32 * SR)
    for k in KICKS:
        a = int(k * SR)
        b = min(len(duck), a + m)
        duck[a:b] = np.minimum(duck[a:b], 1 - 0.62 * np.exp(-tt(b - a) / 0.11))
    padbus.L *= duck
    padbus.R *= duck
    nir = int(1.9 * SR)
    tir = tt(nir)
    irs = [lpf(noise(nir, s), 6000) * np.exp(-tir * 3.0) * np.clip((tir - 0.015) / 0.01, 0, 1) for s in (91, 92)]
    irs = [ir / np.sqrt(np.sum(ir ** 2)) for ir in irs]
    revL = fftconvolve(send.L + 0.5 * padbus.L, irs[0])[:len(dry.L)]
    revR = fftconvolve(send.R + 0.5 * padbus.R, irs[1])[:len(dry.L)]
    L = dry.L + send.L + padbus.L * 0.55 + revL * 0.32
    R = dry.R + send.R + padbus.R * 0.55 + revR * 0.32
    st = np.stack([L, R], axis=1)
    n = int(TOTAL * SR)
    st = st[:n]
    st /= max(1e-9, np.abs(st).max())
    st = np.tanh(1.6 * st) / np.tanh(1.6) * 0.92
    fade = int(1.4 * SR)
    st[-fade:] *= np.linspace(1, 0, fade)[:, None]
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


def render(out_dir: Path, lang: str = "en") -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    v = Premium(lang)
    wav = out_dir / f"nightdrive-{lang}.wav"
    soundtrack(wav)
    v.frame(1.2).save(out_dir / "nightdrive-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "nightdrive-9x16.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-movflags", "+faststart", str(mp4)]
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
    print(render(Path(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else "en"))
