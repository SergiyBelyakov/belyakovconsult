"""Тематичні візуали стилю Ruby Glass (з 08.11.2026): тема відео визначає, що живе в кадрі.

  graph      мережа скляних куль (glass.Graph): графи, зв'язки, мережі;
  dashboard  скляні панелі дашборда: KPI, що лічаться, стовпчики ростуть і перебудовуються на кожному слайді,
             лінія малюється світловим слідом, один показник «змінюється» рубіновим спалахом;
  cloud      хмара даних: сотні скляних точок у кластерах повільно обертаються, площина перевірки проходить
             крізь хмару, погані точки (викиди, дублікати) розжарюються рубіновим і зникають, хмара стає чистішою;
  flow       потік даних: джерела ліворуч, скляні частинки пливуть дугами до звіту праворуч, рубінові «браковані»
             зупиняє ворота перевірки біля самого джерела;
  table      реєстр записів: скляні рядки з плашками полів, дублікати підсвічуються, з'їжджаються і зливаються в один.
Вибір: поле `visual` статті, інакше за ключовими словами назви, тегів і slug (`pick`).
Усі візуали малюються в «коробці» навколо якоря (x, y, sx, sy), яку задає рушій ролика, і плавно переїжджають
разом із якорем між слайдами.
"""
from __future__ import annotations

import math
import re
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw

import brand
import glass
from glass import PINK, _fade, _smooth, dust, halo, sphere

KINDS = ("graph", "dashboard", "cloud", "flow", "table")
RULES = [
    ("graph", r"граф(?!ік)|graph(?!ic)|network|мереж|зв.язк"),
    ("table", r"реєстр|register|дублікат|duplicate|документ|document|ідентиф|identif|запис|record|master data"),
    ("flow", r"джерел|source|pipeline|etl|обмін|exchange|інтеграц|integration|потік|export"),
    ("dashboard", r"дашборд|dashboard|звіт|report|\bbi\b|power bi|kpi|зріз|метрик|metric"),
    ("cloud", r"якіст|quality|повнот|complete|valid|аномал|anomal|outlier"),
]


def pick(article) -> str:
    v = getattr(article, "visual", None) or (getattr(article, "meta", None) or {}).get("visual")
    if v in KINDS:
        return v
    text = " ".join([article.slug.replace("-", " "), article.title or "", " ".join(article.tags or [])]).lower()
    for kind, rx in RULES:
        if re.search(rx, text):
            return kind
    return "cloud"


def make(kind: str, seed: int, w: int, h: int, total: float, cuts: list[float], fps: int = 30, scale: float = 1.0,
         anchors=None, **graph_kw):
    if kind == "graph":
        return glass.Graph(seed, w, h, total, cuts, fps, scale=scale, anchors=anchors, **graph_kw)
    cls = {"dashboard": Dashboard, "cloud": Cloud, "flow": Flow, "table": Table}[kind]
    return cls(seed, w, h, total, cuts, fps, scale, anchors)


@lru_cache(maxsize=64)
def panel(w: int, h: int, r: int = 18, tint: int = 150) -> Image.Image:
    """Скляна панель: темне напівпрозоре скло, світлий кант угорі, тонка рамка."""
    w, h = max(8, w), max(8, h)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, h - 1], r, fill=(22, 26, 35, tint))
    hi = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dh = ImageDraw.Draw(hi)
    dh.rounded_rectangle([0, 0, w - 1, h - 1], r, outline=(255, 255, 255, 46), width=2)
    g = Image.linear_gradient("L").resize((w, h)).point(lambda v: int((255 - v) * 0.9))
    a = hi.getchannel("A")
    hi.putalpha(Image.fromarray((np.asarray(a, np.float32) * np.asarray(g, np.float32) / 255).astype(np.uint8)))
    img.alpha_composite(hi)
    d.line([r, 2, w - r, 2], fill=(255, 255, 255, 60))
    return img


@lru_cache(maxsize=64)
def glass_bar(w: int, h: int, hot: bool = False) -> Image.Image:
    """Стовпчик із рубінового (або розжареного) скла: вертикальний градієнт, світлий лівий край, відблиск угорі."""
    w, h = max(2, w), max(2, h)
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    base = np.array(glass.DEEP, np.float32) * (1 - (1 - y) * 0.6)[..., None] + np.array(brand.RUBY, np.float32) * ((1 - y) * 0.6)[..., None]
    if hot:
        base = base * 0.5 + np.array([255, 150, 160], np.float32) * 0.5
    edge = np.exp(-((x - 0.12) / 0.08) ** 2) * 0.55
    rgb = base + 255 * edge[..., None] * np.ones((h, 1, 1))
    top = np.exp(-(y / 0.04) ** 2) * 0.6
    rgb = rgb + 255 * top[..., None]
    a = np.full((h, w), 225, np.float32)
    img = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8), "RGBA")
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], min(w // 2, 8), fill=255)
    img.putalpha(Image.fromarray((np.asarray(m, np.float32) * 225 / 255).astype(np.uint8)))
    return img


class Stage:
    """Спільне: якір і «коробка» візуалу, повільний наїзд камери протягом слайда, пил у розфокусі."""

    def __init__(self, seed, w, h, total, cuts, fps, scale, anchors):
        self.w, self.h, self.total, self.cuts, self.fps, self.scale = w, h, total, list(cuts), fps, scale
        self.anchors = anchors or [(0.5, 0.5, 1.0, 0.6)]
        self.rng = np.random.default_rng(seed)
        self.bounds = [0.0] + self.cuts + [total]
        self.dust = [(self.rng.uniform(0, w), self.rng.uniform(0, h), self.rng.uniform(-6, 6), self.rng.uniform(-14, -3),
                      int(self.rng.integers(2, 9)), int(self.rng.integers(18, 55))) for _ in range(16)]

    def seg(self, t):
        i = sum(1 for c in self.cuts if t >= c)
        return i, t - self.bounds[i], self.bounds[i + 1] - self.bounds[i]

    def anchor(self, t):
        return glass.Graph.anchor(self, t)

    def box(self, t):
        ax, ay, fx, fy = self.anchor(t)
        k = self.w / 1080 * self.scale
        bw, bh = 900 * fx * k, 760 * fy * k
        cx, cy = self.w * ax, self.h * ay
        return cx - bw / 2, cy - bh / 2, bw, bh

    def backdrop(self, frame, t, opacity):
        for (x0, y0, vx, vy, r, a) in self.dust:
            x = (x0 + vx * t) % self.w
            y = (y0 + vy * t) % self.h
            g = dust(r, int(a * opacity))
            frame.alpha_composite(g, (int(x - g.width / 2), int(y - g.height / 2)))


def _paste(frame, img, x, y):
    frame.alpha_composite(img, (int(x), int(y)))


def _glow_line(frame, pts, width=3, a=230):
    """Світлова лінія з ореолом (bloom) по точках."""
    if len(pts) < 2:
        return
    W, H = frame.size
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, y0 = int(max(0, min(xs) - 30)), int(max(0, min(ys) - 30))
    x1, y1 = int(min(W, max(xs) + 30)), int(min(H, max(ys) + 30))
    if x1 <= x0 or y1 <= y0:
        return
    ss = 2
    m = Image.new("L", ((x1 - x0) * ss, (y1 - y0) * ss), 0)
    ImageDraw.Draw(m).line([((x - x0) * ss, (y - y0) * ss) for x, y in pts], fill=a, width=width * ss, joint="curve")
    m = m.resize((x1 - x0, y1 - y0), Image.BOX)
    from PIL import ImageFilter
    bl = m.filter(ImageFilter.GaussianBlur(7))
    glow = Image.new("RGBA", m.size, (*PINK, 0))
    glow.putalpha(bl.point(lambda v: min(255, int(v * 1.8))))
    frame.alpha_composite(glow, (x0, y0))
    core = Image.new("RGBA", m.size, (255, 236, 240, 0))
    core.putalpha(m)
    frame.alpha_composite(core, (x0, y0))


# ---------------------------------------------------------------- дашборд
class Dashboard(Stage):
    def __init__(self, *a):
        super().__init__(*a)
        n = len(self.bounds) - 1
        self.bars = [self.rng.uniform(0.25, 1.0, 7) for _ in range(n)]
        self.lines = [np.cumsum(self.rng.normal(0.02, 0.12, 14)) for _ in range(n)]
        self.kpi = [(self.rng.uniform(80, 99.5), self.rng.integers(1200, 98000), self.rng.uniform(1, 40)) for _ in range(n)]
        self.hot = [int(self.rng.integers(0, 7)) for _ in range(n)]

    def draw(self, frame, t, beat=0.0, opacity=1.0):
        self.backdrop(frame, t, opacity)
        i, u, L = self.seg(t)
        bx, by, bw, bh = self.box(t)
        k = _smooth(u / 0.9)
        prev = max(0, i - 1)
        bars = self.bars[prev] + (self.bars[i] - self.bars[prev]) * k if i else self.bars[0] * _smooth(u / 1.2)
        gap = bw * 0.03
        two_rows = bh > 380
        float_y = math.sin(t * 0.9) * 4
        if two_rows:
            kh = bh * 0.3
            tiles = [(bx + j * (bw + gap) / 3, by + float_y * (1 if j % 2 else -1), (bw - 2 * gap) / 3, kh) for j in range(3)]
            chart = (bx, by + kh + gap, bw * 0.6, bh - kh - gap)
            line = (bx + bw * 0.6 + gap, by + kh + gap - float_y, bw * 0.4 - gap, bh - kh - gap)
        else:
            tiles = [(bx, by + float_y, bw * 0.24, bh)]
            chart = (bx + bw * 0.24 + gap, by - float_y, bw * 0.44, bh)
            line = (bx + bw * 0.68 + 2 * gap, by + float_y, bw * 0.32 - 2 * gap, bh)
        # KPI: числа лічаться, у кожному слайді нові значення
        kv = self.kpi[i]
        fmt = [f"{kv[0] * min(1, k * 1.2 + 0.2):.1f}%", f"{int(kv[1] * min(1, k * 1.1 + 0.1)):,}".replace(",", " "), f"{kv[2] * k:.1f}"]
        for j, (x, y, w, h) in enumerate(tiles):
            _paste(frame, _fade(panel(int(w), int(h)), opacity), x, y)
            f = brand.font("head", max(18, int(h * (0.34 if two_rows else 0.22))))
            d = ImageDraw.Draw(frame)
            txt = fmt[j % 3]
            tw = d.textlength(txt, font=f)
            d.text((x + (w - tw) / 2, y + h * 0.28), txt, font=f, fill=(240, 242, 246, int(255 * opacity)))
            d.rounded_rectangle([x + w * 0.2, y + h * 0.72, x + w * 0.2 + w * 0.6 * k, y + h * 0.72 + max(3, h * 0.04)], 3,
                                fill=(*brand.RUBY, int(230 * opacity)))
        # стовпчики
        x, y, w, h = chart
        _paste(frame, _fade(panel(int(w), int(h)), opacity), x, y)
        n = len(bars)
        pad = w * 0.08
        bwid = (w - 2 * pad) / n * 0.62
        for j, v in enumerate(bars):
            hh = max(4, (h - 2 * pad) * float(v))
            hot = j == self.hot[i] and u > 0.9
            img = glass_bar(int(bwid), int(hh), hot)
            xx = x + pad + j * (w - 2 * pad) / n
            yy = y + h - pad - hh
            if hot:
                g = halo(int(bwid), int(80 * (0.6 + 0.4 * math.sin(t * 5)) * opacity))
                _paste(frame, g, xx + bwid / 2 - g.width / 2, yy - g.height / 2 + 10)
            _paste(frame, _fade(img, opacity), xx, yy)
        # лінія малюється світловим слідом
        x, y, w, h = line
        _paste(frame, _fade(panel(int(w), int(h)), opacity), x, y)
        ln = self.lines[i]
        ln = (ln - ln.min()) / max(1e-6, ln.max() - ln.min())
        m = len(ln)
        p = _smooth(u / 1.6)
        cnt = max(2, int(p * (m - 1)) + 1)
        pts = [(x + w * 0.1 + (w * 0.8) * j / (m - 1), y + h * 0.85 - (h * 0.65) * ln[j]) for j in range(cnt)]
        _glow_line(frame, pts, 3, int(220 * opacity))
        hx, hy = pts[-1]
        s = sphere(max(5, int(h * 0.045)), "hot")
        _paste(frame, _fade(s, opacity), hx - s.width / 2, hy - s.height / 2)


# ---------------------------------------------------------------- хмара даних
class Cloud(Stage):
    def __init__(self, *a):
        super().__init__(*a)
        rng = self.rng
        cents = rng.normal(0, 1, (4, 3)) * np.array([0.55, 0.35, 0.45])
        pts, bad = [], []
        for c in cents:
            for _ in range(36):
                pts.append(c + rng.normal(0, 0.16, 3)); bad.append(False)
        for _ in range(26):                                 # викиди й «сміття»
            pts.append(rng.uniform(-1, 1, 3) * np.array([1.1, 0.7, 0.9])); bad.append(True)
        for _ in range(10):                                 # дублікати: точка поруч з іншою
            j = int(rng.integers(0, 144))
            pts.append(pts[j] + rng.normal(0, 0.015, 3)); bad.append(True)
        self.p = np.array(pts)
        self.bad = np.array(bad)
        nseg = len(self.bounds) - 1
        idx = np.flatnonzero(self.bad)
        rng.shuffle(idx)
        self.kill_seg = np.full(len(pts), 999)
        for j, q in enumerate(idx):                         # кожен слайд очищає свою частку поганих точок
            self.kill_seg[q] = j % max(1, nseg)
        self.size = np.where(self.bad, rng.uniform(8, 11, len(pts)), rng.uniform(7, 14, len(pts)))

    def draw(self, frame, t, beat=0.0, opacity=1.0):
        self.backdrop(frame, t, opacity)
        i, u, L = self.seg(t)
        bx, by, bw, bh = self.box(t)
        ang = t * 0.22
        ca, sa = math.cos(ang), math.sin(ang)
        x = self.p[:, 0] * ca + self.p[:, 2] * sa
        z = -self.p[:, 0] * sa + self.p[:, 2] * ca
        y = self.p[:, 1] + 0.15 * z
        foc = 3.2
        kz = foc / (foc + z)
        sx = bx + bw / 2 + x * kz * bw * 0.45
        sy = by + bh / 2 + y * kz * bh * 0.62
        # площина перевірки: світла вертикаль проходить крізь хмару на кожному слайді
        scan_u = (u - 0.3) / 1.6
        scan_x = bx + bw * (-0.05 + 1.1 * scan_u) if 0 <= scan_u <= 1 else None
        if scan_x is not None:
            _glow_line(frame, [(scan_x, by - bh * 0.05), (scan_x, by + bh * 1.05)], 2, int(170 * opacity))
        d = ImageDraw.Draw(frame)
        for j in np.argsort(-z):
            ks = self.kill_seg[j]
            alpha = opacity
            hot = 0.0
            if self.bad[j]:
                if ks < i:
                    continue                                 # уже вичищено на попередніх слайдах
                if ks == i:
                    tflag = self.bounds[i] + 0.3 + 1.6 * float(np.clip((sx[j] - bx) / bw / 1.1 + 0.05, 0, 1))
                    if t >= tflag:
                        hot = min(1.0, (t - tflag) / 0.25)
                        gone = (t - tflag - 0.9) / 0.5
                        if gone >= 1:
                            continue
                        if gone > 0:
                            alpha *= 1 - gone
            r = max(3, int(self.size[j] * kz[j] * self.w / 1080 * self.scale))
            blur = 1 if z[j] > 0.6 else 0
            spr = sphere(r, "hot" if hot > 0.5 else ("ruby" if j % 9 == 0 else "clear"), blur)
            if alpha < 0.999 or z[j] > 0.8:
                spr = _fade(spr, alpha * (0.6 if z[j] > 0.8 else 1))
            if hot > 0:
                g = halo(r * 2, int(70 * hot * alpha))
                _paste(frame, g, sx[j] - g.width / 2, sy[j] - g.height / 2)
            _paste(frame, spr, sx[j] - spr.width / 2, sy[j] - spr.height / 2)


# ---------------------------------------------------------------- потік даних від джерел
class Flow(Stage):
    def __init__(self, *a):
        super().__init__(*a)
        rng = self.rng
        self.parts = [(rng.uniform(0, 1), int(rng.integers(0, 3)), rng.uniform(0.18, 0.28), rng.random() < 0.18, rng.uniform(-1, 1))
                      for _ in range(46)]

    def geometry(self, t):
        bx, by, bw, bh = self.box(t)
        src = [(bx + bw * 0.07, by + bh * (0.18 + 0.32 * j)) for j in range(3)]
        gate = [(bx + bw * 0.26, y) for _, y in src]
        sink = (bx + bw * 0.86, by + bh * 0.5)
        return bx, by, bw, bh, src, gate, sink

    def path(self, a, b, bend):
        (x0, y0), (x1, y1) = a, b
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + bend
        return lambda s: ((1 - s) ** 2 * x0 + 2 * (1 - s) * s * cx + s * s * x1, (1 - s) ** 2 * y0 + 2 * (1 - s) * s * cy + s * s * y1)

    def draw(self, frame, t, beat=0.0, opacity=1.0):
        self.backdrop(frame, t, opacity)
        bx, by, bw, bh, src, gate, sink = self.geometry(t)
        k = self.w / 1080 * self.scale
        paths = [self.path(gate[j], sink, (j - 1) * -bh * 0.25) for j in range(3)]
        # трубопроводи: тонкі срібні дуги
        for j in range(3):
            pts = [paths[j](s / 20) for s in range(21)]
            ImageDraw.Draw(frame).line([src[j], gate[j]], fill=(*brand.SILVER, int(90 * opacity)), width=2)
            ImageDraw.Draw(frame).line(pts, fill=(*brand.SILVER, int(70 * opacity)), width=2)
        # звіт праворуч: скляна панель із міні-стовпчиками
        pw, ph = int(bw * 0.2), int(bh * 0.62)
        _paste(frame, _fade(panel(pw, ph), opacity), sink[0] - pw / 2 + bw * 0.04, sink[1] - ph / 2)
        for q in range(4):
            hh = int(ph * (0.25 + 0.15 * q + 0.05 * math.sin(t * 1.3 + q)))
            bar = glass_bar(max(6, int(pw * 0.13)), hh)
            _paste(frame, _fade(bar, opacity), sink[0] - pw / 2 + bw * 0.04 + pw * (0.14 + 0.2 * q), sink[1] + ph / 2 - ph * 0.1 - hh)
        # джерела: великі рубінові кулі з ореолом
        for j, (x, y) in enumerate(src):
            r = int(30 * k)
            g = halo(r * 2, int(50 * opacity))
            _paste(frame, g, x - g.width / 2, y - g.height / 2)
            s = sphere(r, "ruby")
            _paste(frame, _fade(s, opacity), x - s.width / 2, y - s.height / 2)
        # частинки
        stops = []
        for (ph0, j, spd, bad, jit) in self.parts:
            s = (ph0 + t * spd) % 1.0
            if s < 0.25:                                     # ділянка джерело → ворота
                q = s / 0.25
                x = src[j][0] + (gate[j][0] - src[j][0]) * q
                y = src[j][1] + jit * 6 * k
            else:
                if bad:                                      # браковані зупиняються біля воріт і зникають
                    q = min(1.0, (s - 0.25) / 0.12)
                    if q >= 1:
                        continue
                    x, y = gate[j][0] - 10 * k * (1 - q), gate[j][1] + jit * 10 * k
                    stops.append((j, 1 - q))
                    g = halo(int(14 * k), int(120 * (1 - q) * opacity))
                    _paste(frame, g, x - g.width / 2, y - g.height / 2)
                    sp = _fade(sphere(int(11 * k), "hot"), (1 - q) * opacity)
                    _paste(frame, sp, x - sp.width / 2, y - sp.height / 2)
                    continue
                x, y = paths[j]((s - 0.25) / 0.75)
            r = int(11 * k)
            sp = sphere(r, "hot" if bad else "clear")
            _paste(frame, _fade(sp, opacity), x - sp.width / 2, y - sp.height / 2)
        # ворота перевірки: кільця, що спалахують, коли зупиняють брак
        for j, (x, y) in enumerate(gate):
            flash = max([a for (jj, a) in stops if jj == j] or [0])
            r = int(22 * k)
            d = ImageDraw.Draw(frame)
            col = (255, int(140 + 100 * (1 - flash)), int(150 + 90 * (1 - flash)), int((150 + 100 * flash) * opacity))
            d.ellipse([x - r * 0.45, y - r, x + r * 0.45, y + r], outline=col, width=max(2, int(3 * k)))
            if flash > 0:
                g = halo(r, int(90 * flash * opacity))
                _paste(frame, g, x - g.width / 2, y - g.height / 2)


# ---------------------------------------------------------------- реєстр записів
class Table(Stage):
    def __init__(self, *a):
        super().__init__(*a)
        rng = self.rng
        self.rows = [(rng.uniform(0.35, 0.75), rng.uniform(0.2, 0.5), int(rng.integers(0, 3))) for _ in range(40)]
        nseg = len(self.bounds) - 1
        self.pairs = [int(rng.integers(1, 4)) for _ in range(nseg)]     # пара дублікатів на слайді: рядки i та i+pairs

    def draw(self, frame, t, beat=0.0, opacity=1.0):
        self.backdrop(frame, t, opacity)
        i, u, L = self.seg(t)
        bx, by, bw, bh = self.box(t)
        k = self.w / 1080 * self.scale
        rh = max(30 * k, min(64 * k, bh / 5.2))
        visible = int(bh // (rh * 1.15)) + 1
        first = i * 2                                        # на кожному слайді список прокручується
        scroll = _smooth(u / 0.8) * 2 * rh * 1.15 if i else 0
        a_row, b_row = first + 1, first + 1 + self.pairs[i]
        merge = _smooth((u - 1.0) / 0.8)
        gone = _smooth((u - 1.9) / 0.4)
        d = ImageDraw.Draw(frame)
        y = by - scroll + (2 * rh * 1.15 if i else 0)
        for r in range(first - (2 if i else 0), first + visible + 2):
            if r < 0 or r >= len(self.rows):
                continue
            yy = by + (r - first) * rh * 1.15 + (2 * rh * 1.15 - scroll if i else 0)
            if r == b_row:                                   # дублікат з'їжджає до пари і зникає
                ya = by + (a_row - first) * rh * 1.15 + (2 * rh * 1.15 - scroll if i else 0)
                yy = yy + (ya + rh * 0.25 - yy) * merge
            if yy > by + bh - rh * 0.4 or yy < by - rh * 0.6:
                continue
            w1, w2, chip = self.rows[r if r != b_row else a_row]
            dup = r in (a_row, b_row) and u > 0.6
            al = opacity * (1 - gone if r == b_row else 1)
            if al <= 0.02:
                continue
            _paste(frame, _fade(panel(int(bw), int(rh), int(rh * 0.3), 170 if dup else 140), al), bx, yy)
            if dup:
                g = halo(int(rh * 0.9), int(70 * al))
                _paste(frame, g, bx + rh * 0.6 - g.width / 2, yy + rh / 2 - g.height / 2)
            s = sphere(int(rh * 0.28), "hot" if dup else ("ruby" if chip == 0 else "clear"))
            _paste(frame, _fade(s, al), bx + rh * 0.6 - s.width / 2, yy + rh / 2 - s.height / 2)
            col = (255, 170, 180) if dup else (190, 198, 212)
            x0 = bx + rh * 1.2
            d.rounded_rectangle([x0, yy + rh * 0.3, x0 + bw * 0.45 * w1, yy + rh * 0.44], 4, fill=(*col, int(220 * al)))
            d.rounded_rectangle([x0, yy + rh * 0.56, x0 + bw * 0.45 * w2, yy + rh * 0.68], 4, fill=(*col, int(120 * al)))
            cx = bx + bw - rh * 2.2
            d.rounded_rectangle([cx, yy + rh * 0.3, cx + rh * 1.5, yy + rh * 0.7], int(rh * 0.2),
                                fill=(*(brand.RUBY if dup else (60, 66, 80)), int(230 * al)))
            if r == a_row and u > 1.9:                       # злиття підтверджено: галочка
                ok = _smooth((u - 1.9) / 0.3)
                q = rh * 0.12
                d.line([cx + rh * 0.5, yy + rh * 0.5, cx + rh * 0.68, yy + rh * 0.62, cx + rh * 1.0, yy + rh * 0.36],
                       fill=(255, 255, 255, int(255 * ok * al)), width=max(2, int(q * 0.5)))
