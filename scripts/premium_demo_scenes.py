"""Ще 10 заставок преміум-формату в стилістиці основних демо сайту (cases/*).

Темний інтерфейс, рубінові акценти, сині, блакитні, рожеві й фіолетові лінії графіків, червоні хвилі сайту.
Кожна сцена тривимірна, з рухом камери; на фонах лише «скелетні» елементи інтерфейсу, без цифр.

  dashboard  панель керівника лежить у перспективі, графіки домальовуються (executive / data quality)
  anomaly    хмара платежів по місяцях, рубінові аномалії пульсують, камера обертається (anomaly detection)
  fraud      матриця отримувачів, промінь сканує, підозрілі спалахують і з'єднуються (fraud analytics)
  network    кластери графа зв'язків у 3D, вузли різних типів, обертання (graph analytics)
  relief     тривимірний блок рельєфу з річкою, повільний облет (community terrain)
  isochrone  карта громади з ізохронами, що пульсують від центру (transport accessibility)
  routes     мережа маршрутів, рух машин, нахилена карта (route planning)
  twin       шари цифрового двійника громади, що «дихають» (community twin)
  gallery    стіна мініграфіків, що пливе в перспективі (chart gallery)
  waves      фірмові червоні хвилі сайту на всю глибину кадру
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from make_nightdrive import GRAPHITE, H, PINK, RUBY, T_DROP, WHITE, W, clamp, comp, ease, kick_pulse, lerp
from premium_scenes import Base, halo_img, sky

BLUE, CYAN, PURPLE, YELLOW, HOTPINK = (70, 140, 255), (56, 214, 230), (150, 96, 255), (245, 196, 70), (255, 80, 160)
SLATE, PANEL = (110, 122, 150), (14, 17, 25)

SCENES = ["dashboard", "anomaly", "fraud", "network", "relief", "isochrone", "routes", "twin", "gallery", "waves"]


# ---------------------------------------------------------------- 3D і перспектива
def project(P, yaw, pitch, dist, f, cx, cy):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    cyw, syw = math.cos(yaw), math.sin(yaw)
    x1, z1 = x * cyw + z * syw, -x * syw + z * cyw
    cp, sp = math.cos(pitch), math.sin(pitch)
    y2, z2 = y * cp - z1 * sp, y * sp + z1 * cp
    zz = z2 + dist
    s = f / np.maximum(zz, 1e-3)
    return cx + x1 * s, cy - y2 * s, s, zz


def coeffs(dst, src):
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    return np.linalg.solve(np.array(m, float), np.array(src, float).reshape(8))


def warp(fr, tex, quad, a=1.0):
    xs, ys = [p[0] for p in quad], [p[1] for p in quad]
    x0, y0 = max(0, int(min(xs))), max(0, int(min(ys)))
    x1, y1 = min(W, int(max(xs)) + 1), min(H, int(max(ys)) + 1)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return
    local = [(px - x0, py - y0) for px, py in quad]
    tw, th = tex.size
    out = tex.transform((x1 - x0, y1 - y0), Image.PERSPECTIVE, coeffs(local, [(0, 0), (tw, 0), (tw, th), (0, th)]), Image.BILINEAR)
    comp(fr, out, x0, y0, a)


def plane_quad(w, d, yaw, pitch, dist, f, cx, cy, y=0.0):
    P = np.array([[-w / 2, y, d / 2], [w / 2, y, d / 2], [w / 2, y, -d / 2], [-w / 2, y, -d / 2]], float)
    sx, sy, _, _ = project(P, yaw, pitch, dist, f, cx, cy)
    return list(zip(sx, sy))


def site_waves(fr, t, y0=1180, amp=110, n=26, a=1.0, spread=1.0):
    """Фірмові червоні хвилі сайту: тонкі нитки зі світінням."""
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    xs = np.linspace(-40, W + 40, 90)
    p = kick_pulse(t)
    for i in range(n):
        ph = i * 0.21 + t * (0.55 + 0.02 * i)
        env = np.exp(-((xs - (620 + 120 * math.sin(t * 0.3))) / (520 * spread)) ** 2)
        ys = y0 + (i - n / 2) * 7 + amp * (1 + 0.15 * p) * env * np.sin(xs * 0.0062 + ph) + 30 * np.sin(xs * 0.013 - ph * 0.7)
        col = lerp(RUBY, PINK, i / n * 0.6)
        d.line(list(zip(xs, ys)), fill=(*col, int((40 + 120 * (1 - abs(i - n / 2) / (n / 2))) * a)), width=2)
    fr.alpha_composite(lay.filter(ImageFilter.GaussianBlur(6)))
    fr.alpha_composite(lay)


def skel(d, x, y, w, h=10, a=60, col=WHITE):
    d.rounded_rectangle([x, y, x + w, y + h], h // 2, fill=(*col, a))


# ---------------------------------------------------------------- сцени
class DemoBase(Base):
    def __init__(self, seed):
        super().__init__(seed)
        self.bg = sky(horizon=2600, top=GRAPHITE, low=(22, 8, 20), glow=0.0, refl_x=None)

    def start(self, fr, t):
        fr.alpha_composite(self.bg)


class Dashboard(DemoBase):
    name = "dashboard"

    def __init__(self):
        super().__init__(31)
        tw, th = 1600, 1100
        tex = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        d = ImageDraw.Draw(tex)
        d.rounded_rectangle([0, 0, tw - 1, th - 1], 34, fill=(*PANEL, 238), outline=(255, 255, 255, 40), width=3)
        skel(d, 50, 44, 360, 22, 90)
        skel(d, 1360, 40, 190, 34, 255, RUBY)
        self.cards = [(50 + i * 382, 120, 352, 200) for i in range(4)]
        for x, y, w, h in self.cards:
            d.rounded_rectangle([x, y, x + w, y + h], 22, fill=(255, 255, 255, 12), outline=(255, 255, 255, 30), width=2)
            skel(d, x + 26, y + 26, 150, 14, 70)
            skel(d, x + 26, y + 62, 200, 34, 200)
        d.rounded_rectangle([50, 350, 1010, 1050], 22, fill=(255, 255, 255, 10), outline=(255, 255, 255, 30), width=2)
        skel(d, 80, 380, 260, 16, 80)
        d.rounded_rectangle([1040, 350, 1550, 1050], 22, fill=(255, 255, 255, 10), outline=(255, 255, 255, 30), width=2)
        skel(d, 1070, 380, 200, 16, 80)
        for k in range(5):
            d.line([90, 470 + k * 120, 980, 470 + k * 120], fill=(255, 255, 255, 22), width=2)
        self.tex = tex
        rng = np.random.default_rng(3)
        self.series = np.cumsum(rng.normal(0.4, 1.0, 60)) + np.linspace(0, 10, 60)
        self.sparks = [np.cumsum(rng.normal(0, 1, 18)) for _ in range(4)]

    def draw(self, fr, t):
        self.start(fr, t)
        site_waves(fr, t, 1560, 90, 22, 0.8)
        tex = self.tex.copy()
        d = ImageDraw.Draw(tex)
        prog = clamp(0.15 + t / 6.0)
        for (x, y, w, h), sp, good in zip(self.cards, self.sparks, (True, False, True, False)):
            pts = [(x + 26 + i * (w - 52) / 17, y + h - 30 - (v - sp.min()) / (np.ptp(sp) + 1e-6) * 60) for i, v in enumerate(sp)]
            n = max(2, int(len(pts) * prog))
            d.line(pts[:n], fill=(*((90, 220, 150) if good else RUBY), 255), width=4)
        s = self.series
        n = max(2, int(len(s) * prog))
        pts = [(90 + i * 890 / 59, 1010 - (v - s.min()) / (np.ptp(s)) * 520) for i, v in enumerate(s)]
        area = Image.new("RGBA", tex.size, (0, 0, 0, 0))
        ImageDraw.Draw(area).polygon(pts[:n] + [(pts[n - 1][0], 1010), (pts[0][0], 1010)], fill=(*BLUE, 70))
        tex.alpha_composite(area)
        d.line(pts[:n], fill=(*BLUE, 255), width=5)
        d.ellipse([pts[n - 1][0] - 9, pts[n - 1][1] - 9, pts[n - 1][0] + 9, pts[n - 1][1] + 9], fill=(*WHITE, 255))
        cx, cy, r = 1295, 720, 170
        start = -90
        for frac, col in ((0.42, CYAN), (0.27, HOTPINK), (0.18, PURPLE), (0.13, BLUE)):
            sweep = 360 * frac * prog
            d.arc([cx - r, cy - r, cx + r, cy + r], start, start + sweep, fill=(*col, 255), width=46)
            start += 360 * frac
        yaw = 0.16 * math.sin(t * 0.32)
        dist = 2350 - 380 * ease(t / 24)
        q = plane_quad(1600, 1100, yaw, 1.02, dist, 1150, 540, 1110)
        h = halo_img(1400, 90)
        comp(fr, h, 540 - 700, 1150 - 700, 0.8)
        warp(fr, tex, [q[3], q[2], q[1], q[0]])


class Anomaly(DemoBase):
    name = "anomaly"

    def __init__(self):
        super().__init__(32)
        rng = np.random.default_rng(7)
        pts = []
        for m in range(12):
            base = 30 * math.sin(m * 0.6)
            for _ in range(150):
                pts.append(((m - 5.5) * 78, base + rng.normal(0, 38), rng.uniform(-70, 70)))
        self.P = np.array(pts)
        self.A = np.array([((m - 5.5) * 78, rng.uniform(170, 300), rng.uniform(-60, 60)) for m in rng.integers(0, 12, 14)])

    def draw(self, fr, t):
        self.start(fr, t)
        site_waves(fr, t, 1700, 70, 18, 0.6)
        yaw = 0.35 + self.p(t) * 0.05
        dist = 1500 - 250 * ease(t / 24)
        lay = Image.new("RGBA", (W * 2, H * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        base = np.array([[x, -160, z] for x in np.linspace(-470, 470, 2) for z in (-90, 90)])
        for m in range(12):
            q = np.array([[(m - 5.5) * 78, -160, -90], [(m - 5.5) * 78, -160, 90]])
            sx, sy, _, _ = project(q, yaw, 0.18, dist, 1750, 540, 1060)
            d.line([(sx[0] * 2, sy[0] * 2), (sx[1] * 2, sy[1] * 2)], fill=(255, 255, 255, 30), width=2)
        sx, sy, s, zz = project(self.P, yaw, 0.18, dist, 1750, 540, 1060)
        for x, y, sc in zip(sx, sy, s):
            r = max(2.0, 3.4 * sc * 1.2)
            d.ellipse([x * 2 - r, y * 2 - r, x * 2 + r, y * 2 + r], fill=(*SLATE, int(90 + 110 * clamp(sc))))
        ax, ay, asc, _ = project(self.A, yaw, 0.18, dist, 1750, 540, 1060)
        for i, (x, y, sc) in enumerate(zip(ax, ay, asc)):
            pulse = 0.5 + 0.5 * math.sin(t * 3 + i)
            r = 7 * sc * 2 + 4
            d.ellipse([x * 2 - r * 2.4, y * 2 - r * 2.4, x * 2 + r * 2.4, y * 2 + r * 2.4], outline=(*RUBY, int(120 * pulse)), width=3)
            d.ellipse([x * 2 - r, y * 2 - r, x * 2 + r, y * 2 + r], fill=(*lerp(RUBY, PINK, pulse * 0.5), 255))
        lay = lay.reduce(2)
        fr.alpha_composite(lay.filter(ImageFilter.GaussianBlur(5)))
        fr.alpha_composite(lay)


class Fraud(DemoBase):
    name = "fraud"

    def __init__(self):
        super().__init__(33)
        rng = np.random.default_rng(9)
        gx, gz = np.meshgrid(np.linspace(-520, 520, 34), np.linspace(-420, 420, 26))
        self.P = np.stack([gx.ravel(), np.zeros(gx.size), gz.ravel()], 1)
        self.flag = rng.random(gx.size) < 0.07
        idx = np.where(self.flag)[0]
        self.links = [(a, b) for a in idx for b in idx if a < b and np.linalg.norm(self.P[a] - self.P[b]) < 190]

    def draw(self, fr, t):
        self.start(fr, t)
        yaw = 0.22 * math.sin(t * 0.25) + 0.15
        dist = 1700 - 260 * ease(t / 24)
        sx, sy, s, _ = project(self.P, yaw, 0.95, dist, 1500, 540, 1150)
        beam = -560 + ((self.p(t) * 260) % 1300)
        lay = Image.new("RGBA", (W * 2, H * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        lit = self.flag & (self.P[:, 0] < beam)
        for a, b in self.links:
            if lit[a] and lit[b]:
                d.line([(sx[a] * 2, sy[a] * 2), (sx[b] * 2, sy[b] * 2)], fill=(*RUBY, 150), width=3)
        for i in range(len(sx)):
            r = 4.2 * s[i] * 2
            if lit[i]:
                d.ellipse([sx[i] * 2 - r * 2.2, sy[i] * 2 - r * 2.2, sx[i] * 2 + r * 2.2, sy[i] * 2 + r * 2.2], fill=(*RUBY, 70))
                d.ellipse([sx[i] * 2 - r, sy[i] * 2 - r, sx[i] * 2 + r, sy[i] * 2 + r], fill=(*PINK, 255))
            else:
                d.ellipse([sx[i] * 2 - r * 0.7, sy[i] * 2 - r * 0.7, sx[i] * 2 + r * 0.7, sy[i] * 2 + r * 0.7], fill=(*SLATE, 150))
        q = np.array([[beam, 0, -440], [beam, 0, 440]])
        bx, by, _, _ = project(q, yaw, 0.95, dist, 1500, 540, 1150)
        d.line([(bx[0] * 2, by[0] * 2), (bx[1] * 2, by[1] * 2)], fill=(255, 230, 235, 230), width=5)
        lay = lay.reduce(2)
        fr.alpha_composite(lay.filter(ImageFilter.GaussianBlur(7)))
        fr.alpha_composite(lay)
        site_waves(fr, t, 1720, 60, 16, 0.5)


class Network(DemoBase):
    name = "network"

    def __init__(self):
        super().__init__(34)
        rng = np.random.default_rng(12)
        centers = np.array([[-260, 120, 0], [250, 160, -80], [0, -150, 120], [300, -120, 160]])
        cols = [RUBY, YELLOW, PURPLE, BLUE]
        nodes, kinds = [], []
        for ci, c in enumerate(centers):
            for _ in range(32):
                nodes.append(c + rng.normal(0, 85, 3))
                kinds.append(rng.choice(4, p=[0.4, 0.2, 0.2, 0.2]) if ci else 0)
        self.P = np.array(nodes)
        self.cols = [cols[k] for k in kinds]
        self.hub = rng.random(len(nodes)) < 0.08
        dists = np.linalg.norm(self.P[:, None] - self.P[None], axis=2)
        self.edges = [(i, j) for i in range(len(nodes)) for j in np.argsort(dists[i])[1:3] if i < j]
        self.edges += [(int(rng.integers(0, 32)), int(rng.integers(32, 128))) for _ in range(10)]

    def draw(self, fr, t):
        self.start(fr, t)
        site_waves(fr, t, 1680, 70, 18, 0.6)
        yaw = self.p(t) * 0.12
        dist = 1500 - 220 * ease(t / 24)
        sx, sy, s, zz = project(self.P, yaw, 0.25, dist, 1350, 540, 1100)
        lay = Image.new("RGBA", (W * 2, H * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        for i, j in self.edges:
            d.line([(sx[i] * 2, sy[i] * 2), (sx[j] * 2, sy[j] * 2)], fill=(255, 255, 255, 45), width=2)
        for i in np.argsort(-zz):
            r = (9 if self.hub[i] else 5) * s[i] * 2.4
            c = self.cols[i]
            if self.hub[i]:
                pulse = 0.5 + 0.5 * math.sin(t * 2.5 + i)
                d.ellipse([sx[i] * 2 - r * 2.2, sy[i] * 2 - r * 2.2, sx[i] * 2 + r * 2.2, sy[i] * 2 + r * 2.2], outline=(*c, int(160 * pulse)), width=3)
            d.ellipse([sx[i] * 2 - r, sy[i] * 2 - r, sx[i] * 2 + r, sy[i] * 2 + r], fill=(*c, 255))
        lay = lay.reduce(2)
        fr.alpha_composite(lay.filter(ImageFilter.GaussianBlur(6)))
        fr.alpha_composite(lay)


class Relief(DemoBase):
    name = "relief"

    def __init__(self):
        super().__init__(35)
        n = 30
        xs = np.linspace(-430, 430, n)
        X, Z = np.meshgrid(xs, xs)
        h = (np.sin(X * 0.009 + 0.6) * np.cos(Z * 0.011 - 0.4) * 70 + np.sin(X * 0.021 + Z * 0.017) * 30
             + np.exp(-((X + 120) ** 2 + (Z - 90) ** 2) / 26000) * 120 + 60)
        river = np.exp(-((X - 60 * np.sin(Z * 0.009)) / 55) ** 2)
        self.h = np.maximum(h - river * 90, 6)
        self.X, self.Z, self.n = X, Z, n
        self.river = [(60 * math.sin(z * 0.009), z) for z in xs]

    def draw(self, fr, t):
        self.start(fr, t)
        site_waves(fr, t, 1720, 60, 16, 0.5)
        yaw = 0.6 + self.p(t) * 0.07
        dist = 1900 - 300 * ease(t / 24)
        X, Z, h, n = self.X, self.Z, self.h, self.n
        P = np.stack([X.ravel(), h.ravel(), Z.ravel()], 1)
        sx, sy, s, zz = project(P, yaw, 0.62, dist, 1400, 540, 1150)
        sx, sy, zz = sx.reshape(n, n), sy.reshape(n, n), zz.reshape(n, n)
        B = np.stack([X.ravel(), np.zeros(n * n), Z.ravel()], 1)
        bx, by, _, _ = project(B, yaw, 0.62, dist, 1400, 540, 1150)
        bx, by = bx.reshape(n, n), by.reshape(n, n)
        lay = Image.new("RGBA", (W * 2, H * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        quads = []
        for i in range(n - 1):
            for j in range(n - 1):
                quads.append((zz[i:i + 2, j:j + 2].mean(), i, j))
        lo, hi = h.min(), h.max()
        for side in ((0, slice(None)), (n - 1, slice(None)), (slice(None), 0), (slice(None), n - 1)):
            ex, ey, ebx, eby = sx[side], sy[side], bx[side], by[side]
            poly = [(x * 2, y * 2) for x, y in zip(ex, ey)] + [(x * 2, y * 2) for x, y in zip(ebx[::-1], eby[::-1])]
            d.polygon(poly, fill=(28, 22, 30, 255), outline=(*RUBY, 160))
        for _, i, j in sorted(quads, reverse=True):
            hv = (h[i, j] + h[i + 1, j + 1]) / 2
            u = (hv - lo) / (hi - lo)
            dzx = h[i, j + 1] - h[i, j]
            shade = clamp(0.75 + dzx * 0.012, 0.45, 1.15)
            c = lerp((52, 70, 86), (176, 150, 116), clamp(u * 1.4)) if u < 0.7 else lerp((176, 150, 116), (232, 214, 186), (u - 0.7) / 0.3)
            c = tuple(int(clamp(v * shade, 0, 255)) for v in c)
            poly = [(sx[i, j] * 2, sy[i, j] * 2), (sx[i, j + 1] * 2, sy[i, j + 1] * 2), (sx[i + 1, j + 1] * 2, sy[i + 1, j + 1] * 2), (sx[i + 1, j] * 2, sy[i + 1, j] * 2)]
            d.polygon(poly, fill=(*c, 255), outline=(*lerp(c, (20, 20, 26), 0.35), 255))
        R = np.array([[x, 12, z] for x, z in self.river])
        rx, ry, _, _ = project(R, yaw, 0.62, dist, 1400, 540, 1150)
        d.line([(x * 2, y * 2) for x, y in zip(rx, ry)], fill=(*BLUE, 255), width=9)
        lay = lay.reduce(2)
        comp(fr, halo_img(1200, 80), 540 - 600, 1150 - 600, 0.8)
        fr.alpha_composite(lay)


class Isochrone(DemoBase):
    name = "isochrone"

    def __init__(self):
        super().__init__(36)
        rng = np.random.default_rng(15)
        S = 1400
        tex = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(tex)
        d.ellipse([20, 20, S - 20, S - 20], fill=(12, 16, 28, 235), outline=(255, 255, 255, 30), width=3)
        for k in range(16):
            a = rng.uniform(0, 6.28)
            pts = [(S / 2 + math.cos(a + 0.2 * math.sin(r * 0.01)) * r, S / 2 + math.sin(a + 0.2 * math.sin(r * 0.01)) * r) for r in range(0, 660, 20)]
            d.line(pts, fill=(80, 92, 120, 180), width=4)
        river = [(x, S / 2 + 260 + 80 * math.sin(x * 0.006)) for x in range(60, S - 60, 20)]
        d.line(river, fill=(40, 90, 170, 255), width=14)
        for _ in range(30):
            a, r = rng.uniform(0, 6.28), rng.uniform(80, 600)
            x, y = S / 2 + math.cos(a) * r, S / 2 + math.sin(a) * r
            d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(*WHITE, 200))
        self.tex, self.S = tex, S

    def draw(self, fr, t):
        self.start(fr, t)
        site_waves(fr, t, 1650, 70, 18, 0.55)
        S = self.S
        tex = self.tex.copy()
        ov = Image.new("RGBA", tex.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        for k, (R, col) in enumerate(((560, PURPLE), (380, BLUE), (210, CYAN))):
            pts = []
            for a in np.linspace(0, 2 * math.pi, 120):
                rr = R * (1 + 0.12 * math.sin(3 * a + k + t * 0.4) + 0.05 * math.sin(7 * a))
                pts.append((S / 2 + math.cos(a) * rr, S / 2 + math.sin(a) * rr))
            d.polygon(pts, fill=(*col, 34), outline=(*col, 200))
        ph = (t / 1.2) % 1.0
        rr = 40 + ph * 640
        d.ellipse([S / 2 - rr, S / 2 - rr, S / 2 + rr, S / 2 + rr], outline=(*RUBY, int(220 * (1 - ph))), width=6)
        d.ellipse([S / 2 - 26, S / 2 - 26, S / 2 + 26, S / 2 + 26], fill=(*RUBY, 255), outline=(*WHITE, 255), width=5)
        tex.alpha_composite(ov)
        yaw = 0.35 * math.sin(t * 0.18) + self.p(t) * 0.02
        dist = 2200 - 350 * ease(t / 24)
        warp(fr, tex, plane_quad(1400, 1400, yaw, 0.98, dist, 1500, 540, 1130))


class Routes(DemoBase):
    name = "routes"

    def __init__(self):
        super().__init__(37)
        rng = np.random.default_rng(18)
        S = 1400
        base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(base)
        d.rounded_rectangle([20, 20, S - 20, S - 20], 60, fill=(10, 14, 26, 235), outline=(255, 255, 255, 30), width=3)
        for k in range(22):
            x0, y0 = rng.uniform(60, S - 60, 2)
            pts = [(x0 + i * 30 * math.cos(k), y0 + i * 30 * math.sin(k) + 40 * math.sin(i * 0.4)) for i in range(40)]
            d.line(pts, fill=(60, 70, 96, 160), width=3)
        depots = [(S * 0.3, S * 0.55), (S * 0.68, S * 0.4)]
        self.routes = []
        glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        dg = ImageDraw.Draw(glow)
        for r in range(7):
            dx, dy = depots[r % 2]
            pts = [(dx, dy)]
            for _ in range(5):
                lx, ly = pts[-1]
                pts.append((clamp(lx + rng.uniform(-240, 240), 80, S - 80), clamp(ly + rng.uniform(-240, 240), 80, S - 80)))
            pts.append((dx, dy))
            dense = []
            for a, b in zip(pts[:-1], pts[1:]):
                for u in np.linspace(0, 1, 16, endpoint=False):
                    dense.append((a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u))
            col = BLUE if r % 2 else HOTPINK
            self.routes.append((dense, col))
            dg.line(dense, fill=(*col, 255), width=6)
        base.alpha_composite(glow.filter(ImageFilter.GaussianBlur(12)))
        base.alpha_composite(glow)
        for x, y in depots:
            d = ImageDraw.Draw(base)
            d.rounded_rectangle([x - 22, y - 22, x + 22, y + 22], 6, fill=(*WHITE, 255))
        self.base, self.S = base, S

    def draw(self, fr, t):
        self.start(fr, t)
        site_waves(fr, t, 1700, 60, 16, 0.5)
        tex = self.base.copy()
        d = ImageDraw.Draw(tex)
        for k, (pts, col) in enumerate(self.routes):
            n = len(pts)
            pos = (self.p(t) * 9 + k * 13) % n
            for trail in range(6):
                i = int(pos - trail * 1.2) % n
                x, y = pts[i]
                r = 14 - trail * 2
                d.ellipse([x - r, y - r, x + r, y + r], fill=(*lerp(WHITE, col, trail / 6), 255 - trail * 38))
        yaw = -0.5 + 0.25 * math.sin(t * 0.2)
        dist = 2200 - 300 * ease(t / 24)
        warp(fr, tex, plane_quad(1400, 1400, yaw, 1.0, dist, 1500, 540, 1140))


class Twin(DemoBase):
    name = "twin"

    def __init__(self):
        super().__init__(38)
        rng = np.random.default_rng(21)
        self.marks = [[(rng.uniform(-300, 300), rng.uniform(-300, 300)) for _ in range(int(rng.integers(3, 8)))] for _ in range(6)]

    def draw(self, fr, t):
        self.start(fr, t)
        site_waves(fr, t, 1700, 60, 16, 0.5)
        yaw = 0.75 + self.p(t) * 0.05
        dist = 2300 - 300 * ease(t / 24)
        gap = 85 + 35 * math.sin(t * 0.8) + 20 * kick_pulse(t)
        lay = Image.new("RGBA", (W * 2, H * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        for li in range(6):
            y = (li - 2.5) * gap
            sq = np.array([[-360, y, -360], [360, y, -360], [360, y, 360], [-360, y, 360]], float)
            sx, sy, _, _ = project(sq, yaw, 0.6, dist, 2100, 540, 1120)
            top = li == 5
            d.polygon([(x * 2, yv * 2) for x, yv in zip(sx, sy)], fill=(20, 32, 58, 150 if not top else 190),
                      outline=(*(lerp(BLUE, WHITE, 0.3) if not top else RUBY), 220))
            for g in np.linspace(-360, 360, 7)[1:-1]:
                for P in (np.array([[g, y, -360], [g, y, 360]]), np.array([[-360, y, g], [360, y, g]])):
                    gx, gy, _, _ = project(P, yaw, 0.6, dist, 2100, 540, 1120)
                    d.line([(gx[0] * 2, gy[0] * 2), (gx[1] * 2, gy[1] * 2)], fill=(120, 160, 230, 40), width=2)
            for k, (mx, mz) in enumerate(self.marks[li]):
                P = np.array([[mx, y, mz], [mx, y + 34, mz]])
                gx, gy, gs, _ = project(P, yaw, 0.6, dist, 2100, 540, 1120)
                d.line([(gx[0] * 2, gy[0] * 2), (gx[1] * 2, gy[1] * 2)], fill=(*PINK, 200), width=3)
                r = 7 * gs[1] * 2
                pulse = 0.6 + 0.4 * math.sin(t * 2 + k + li)
                d.ellipse([gx[1] * 2 - r, gy[1] * 2 - r, gx[1] * 2 + r, gy[1] * 2 + r], fill=(*lerp(RUBY, PINK, pulse * 0.4), 255))
        lay = lay.reduce(2)
        fr.alpha_composite(lay.filter(ImageFilter.GaussianBlur(6)))
        fr.alpha_composite(lay)


class Gallery(DemoBase):
    name = "gallery"

    def __init__(self):
        super().__init__(39)
        rng = np.random.default_rng(24)
        TW, TH = 1300, 2600
        tex = Image.new("RGBA", (TW, TH), (0, 0, 0, 0))
        d = ImageDraw.Draw(tex)
        cw, ch = 400, 300
        kinds = ["bars", "line", "heat", "area", "stack", "scatter"]
        for row in range(8):
            for col in range(3):
                x, y = 25 + col * (cw + 25), 25 + row * (ch + 25)
                d.rounded_rectangle([x, y, x + cw, y + ch], 22, fill=(16, 19, 28, 240), outline=(255, 255, 255, 30), width=2)
                skel(d, x + 22, y + 20, 140, 12, 70)
                k = kinds[(row * 3 + col) % 6]
                x0, y0, x1, y1 = x + 24, y + 54, x + cw - 24, y + ch - 24
                if k == "bars":
                    for i in range(9):
                        hh = rng.uniform(0.2, 1) * (y1 - y0)
                        d.rectangle([x0 + i * 38, y1 - hh, x0 + i * 38 + 24, y1], fill=(*BLUE, 230))
                elif k == "line":
                    v = np.cumsum(rng.normal(0, 1, 30))
                    pts = [(x0 + i * (x1 - x0) / 29, y1 - (vv - v.min()) / np.ptp(v) * (y1 - y0)) for i, vv in enumerate(v)]
                    d.line(pts, fill=(*HOTPINK, 255), width=4)
                elif k == "heat":
                    for i in range(12):
                        for j in range(6):
                            a = int(rng.uniform(40, 255))
                            d.rectangle([x0 + i * 29, y0 + j * 36, x0 + i * 29 + 26, y0 + j * 36 + 32], fill=(*BLUE, a))
                elif k == "area":
                    v = np.cumsum(rng.normal(0.2, 1, 30))
                    pts = [(x0 + i * (x1 - x0) / 29, y1 - (vv - v.min()) / np.ptp(v) * (y1 - y0)) for i, vv in enumerate(v)]
                    d.polygon(pts + [(x1, y1), (x0, y1)], fill=(*PURPLE, 120))
                    d.line(pts, fill=(*PURPLE, 255), width=3)
                elif k == "stack":
                    for i in range(9):
                        b = y1
                        for c in (RUBY, PINK, BLUE):
                            hh = rng.uniform(0.08, 0.3) * (y1 - y0)
                            d.rectangle([x0 + i * 38, b - hh, x0 + i * 38 + 24, b], fill=(*c, 230))
                            b -= hh
                else:
                    for _ in range(40):
                        px, py = rng.uniform(x0, x1), rng.uniform(y0, y1)
                        d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(*CYAN, 210))
        self.tex = tex

    def draw(self, fr, t):
        self.start(fr, t)
        off = int((self.p(t) * 70) % 1300)
        win = self.tex.crop((0, off, 1300, off + 1300))
        yaw = 0.12 * math.sin(t * 0.25)
        quad = plane_quad(1300, 1300, yaw, 1.05, 2050 - 250 * ease(t / 24), 1500, 540, 1150)
        warp(fr, win, quad)
        top = Image.new("RGBA", (W, 260), (0, 0, 0, 0))
        g = Image.linear_gradient("L").resize((W, 260)).point(lambda v: 255 - v)
        top.paste(Image.new("RGBA", (W, 260), (*GRAPHITE, 255)), (0, 0), g)
        fr.alpha_composite(top, (0, 760))
        site_waves(fr, t, 1720, 60, 16, 0.5)


class Waves(DemoBase):
    name = "waves"

    def __init__(self):
        super().__init__(40)

    def draw(self, fr, t):
        self.start(fr, t)
        comp(fr, halo_img(1400, 70), 540 - 700, 1150 - 700, 0.8)
        site_waves(fr, t * 1.2 + self.p(t) * 0.3, 900, 150, 34, 0.9, 1.2)
        site_waves(fr, t * 0.9 + 3 + self.p(t) * 0.3, 1250, 190, 40, 1.0, 1.4)
        site_waves(fr, t * 1.4 + 7, 1640, 120, 26, 0.7, 1.0)


CLASSES = {c.name: c for c in (Dashboard, Anomaly, Fraud, Network, Relief, Isochrone, Routes, Twin, Gallery, Waves)}
