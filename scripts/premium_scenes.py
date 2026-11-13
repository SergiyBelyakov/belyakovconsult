"""Десять заставок преміум-формату: різна перспектива й динаміка камери в одній палітрі (графіт, рубін, шампань).

Кожна сцена малює тло ролика під заголовками й панелями. Зона заголовків (y 268..740) лишається темною й спокійною,
зона панелей (y 1000..1520) читається поверх будь-якої сцени. Рух прив'язаний до музики: повільно в інтро,
швидко після дропу (4.8 с), стримано у фіналі.

  sunset    рубінове сонце, рух уперед по сітці (dolly)
  sunrise   кран: горизонт опускається, сонце сходить
  drone     висока точка: густа сітка, легкий крен і дрейф камери
  tunnel    політ крізь спіральний тунель рамок
  city      скляне місто, паралакс трьох планів (панорама вбік)
  orbit     дротовий глобус, що обертається, з кільцем
  terrain   дротові гори обабіч дороги, рух уперед
  mirror    сонце над водою, віддзеркалення й брижі
  glass     поле скляних куль бренду, політ крізь глибину
  dutch     нахилена камера, що вирівнюється на дропі
"""
from __future__ import annotations

import math
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import brand
import glass
from make_nightdrive import (CHAMPAGNE, COOL, GRAPHITE, H, PINK, RUBY, T_BAND, T_DROP, T_END, T_PHONK, WHITE, W, clamp,
                             comp, ease, kick_pulse, lerp, speed)

SCENES = ["sunset", "sunrise", "drone", "tunnel", "city", "orbit", "terrain", "mirror", "glass", "dutch"]


@lru_cache(maxsize=None)
def sun_img(r: int):
    ss = 2
    n = 2 * r * ss
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5 - n / 2) / (r * ss)
    inside = np.clip((1 - np.sqrt(xx ** 2 + yy ** 2)) * r * ss, 0, 1)
    u = np.clip((yy + 1) / 2, 0, 1)[..., None]
    top, mid, bot = np.array(CHAMPAGNE), np.array((255, 96, 96)), np.array(RUBY)
    col = np.where(u < 0.5, top + (mid - top) * (u / 0.5), mid + (bot - mid) * ((u - 0.5) / 0.5))
    return Image.fromarray(np.dstack([col, inside * 255]).astype(np.uint8), "RGBA").resize((2 * r, 2 * r), Image.LANCZOS)


@lru_cache(maxsize=None)
def halo_img(n: int, strength: int = 150, col=RUBY):
    yy, xx = (np.mgrid[0:n, 0:n] - n / 2) / (n / 2)
    m = np.clip(1 - np.sqrt(xx ** 2 + yy ** 2), 0, 1) ** 2.6 * strength
    img = Image.new("RGBA", (n, n), (*col, 0))
    img.putalpha(Image.fromarray(m.astype(np.uint8), "L"))
    return img


def draw_sun(fr, cx, cy, r, t, horizon=None, slats=True, pulse=0.0, halo=True):
    if halo:
        h = halo_img(int(r * 5))
        comp(fr, h, cx - h.width / 2, cy - h.height / 2, clamp(0.75 + 0.35 * pulse, 0, 1))
    disk = sun_img(int(r)).copy()
    if slats:
        a = np.asarray(disk.getchannel("A")).copy()
        off = (t * 14) % 26
        rr = int(r)
        for yy in range(rr - 40, 2 * rr):
            dy = yy - (rr - 40)
            if (dy + off) % 26 < 2 + dy / (rr + 40) * 16:
                a[yy, :] = 0
        if horizon is not None:
            cut = int(horizon - (cy - rr))
            if 0 <= cut < 2 * rr:
                a[cut:, :] = 0
        disk.putalpha(Image.fromarray(a))
    comp(fr, disk, cx - r, cy - r)


def sky(horizon=1060, top=GRAPHITE, low=(44, 8, 30), floor=(7, 6, 12), glow=0.42, refl_x=540):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    base = np.zeros((H, W, 3), np.float32)
    u = np.clip(yy / horizon, 0, 1)[..., None]
    base[:] = np.array(top, np.float32) + (np.array(low, np.float32) - np.array(top, np.float32)) * u ** 2.2
    fl = yy >= horizon
    base[fl] = np.array(floor, np.float32)
    base += np.exp(-((yy - horizon) / 90) ** 2)[..., None] * np.array(RUBY, np.float32) * glow
    if refl_x is not None:
        refl = (np.exp(-((xx - refl_x) / 150) ** 2) * np.exp(-np.clip(yy - horizon, 0, None) / 260) * fl)[..., None]
        base += refl * np.array((255, 70, 90), np.float32) * 0.28
    vign = np.clip(1 - (((xx - W / 2) / (W * 0.9)) ** 2 + ((yy - H * 0.5) / (H * 0.8)) ** 2), 0, 1) ** 0.6
    base *= (0.55 + 0.45 * vign)[..., None]
    grain = np.random.default_rng(5).normal(0, 2.6, (H // 2, W // 2)).astype(np.float32)
    base += np.asarray(Image.fromarray(grain).resize((W, H), Image.BILINEAR))[..., None]
    return Image.fromarray(base.clip(0, 255).astype(np.uint8), "RGB").convert("RGBA")


def grid(fr, t, pos, horizon=1060, vp_x=540, col=RUBY, spacing=230, rows=18, bright=1.0, roll=0.0, fade=6.0):
    hl = H - int(horizon)
    if hl <= 4:
        return
    lay = Image.new("RGBA", (W * 2, hl * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    frac = pos % 1.0
    for i in range(rows):
        z = i + 1 - frac
        if z <= 0.12:
            continue
        y = hl / z
        if y >= hl:
            continue
        a = int(clamp(2.4 / z, 0.2, 1.0) * 235 * bright)
        d.line([0, y * 2, W * 2, y * 2], fill=(*lerp(col, PINK, 0.25), a), width=2)
    n = int(W / spacing) + 8
    for k in range(-n, n + 1):
        d.line([vp_x * 2, 0, (vp_x + k * spacing) * 2, hl * 2], fill=(*col, int(165 * bright)), width=2)
    lay = lay.reduce(2)
    f = Image.linear_gradient("L").resize((W, hl)).point(lambda v: min(255, int(v * fade)))
    lay.putalpha(Image.composite(lay.getchannel("A"), Image.new("L", lay.size, 0), f))
    if roll:
        big = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        big.alpha_composite(lay, (0, int(horizon)))
        big = big.rotate(roll, resample=Image.BICUBIC, center=(vp_x, horizon))
        fr.alpha_composite(big)
    else:
        fr.alpha_composite(lay, (0, int(horizon)))


def dust(fr, t, specs, ymin=250, span=760):
    for x, y, r, sp, ph in specs:
        yy = (y - t * sp) % span + ymin
        comp(fr, glass.dust(int(r), 60), x - 2 * r, yy - 2 * r, 0.5 + 0.5 * math.sin(t * 1.3 + ph))


def grid_col(t):
    if T_PHONK <= t < T_BAND:
        return lerp(RUBY, COOL, 0.75)
    return RUBY


class Base:
    name = "base"

    def __init__(self, seed=11):
        ts = np.arange(0, 25, 1 / 240)
        self.ts, self.pos = ts, np.cumsum([speed(t) for t in ts]) / 240
        rng = np.random.default_rng(seed)
        self.dust = [(rng.uniform(40, 1040), rng.uniform(250, 980), rng.uniform(3, 9), rng.uniform(18, 50), rng.uniform(0, 6)) for _ in range(16)]

    def p(self, t):
        return float(np.interp(t, self.ts, self.pos))

    def line(self, fr, y, a=230):
        ImageDraw.Draw(fr).line([0, y, W, y], fill=(*lerp(RUBY, WHITE, 0.45), a), width=2)


class Sunset(Base):
    name = "sunset"

    def __init__(self):
        super().__init__()
        self.bg = sky()

    def draw(self, fr, t):
        fr.alpha_composite(self.bg)
        dust(fr, t, self.dust)
        draw_sun(fr, 540, 1004, 236, t, horizon=1060, pulse=kick_pulse(t))
        grid(fr, t, self.p(t), 1060, col=grid_col(t), bright=0.75 + 0.25 * kick_pulse(t))
        self.line(fr, 1060)


class Sunrise(Base):
    """Кран: камера піднімається, горизонт опускається з 1440 до 1060, сонце сходить."""
    name = "sunrise"

    def __init__(self):
        super().__init__(12)
        self.bg = sky(refl_x=None)

    def hy(self, t):
        return 1060 + 380 * (1 - ease(t / T_DROP))

    def draw(self, fr, t):
        hy = self.hy(t)
        dy = int(hy - 1060)
        fr.alpha_composite(self.bg.crop((0, 0, W, H - max(0, dy))), (0, max(0, dy)))
        if dy > 0:
            ImageDraw.Draw(fr).rectangle([0, 0, W, dy], fill=(*GRAPHITE, 255))
        dust(fr, t, self.dust)
        rise = ease(t / (T_DROP + 1.2))
        cy = hy + 120 - 220 * rise
        draw_sun(fr, 540, cy, 250, t, horizon=hy, pulse=kick_pulse(t))
        ImageDraw.Draw(fr).rectangle([0, hy, W, H], fill=(7, 6, 12, 255))
        glow = halo_img(1400, 110)
        comp(fr, glow.crop((0, 700, 1400, 1400)), -160, hy - 2, 0.5)
        grid(fr, t, self.p(t), hy, col=grid_col(t), bright=0.75 + 0.25 * kick_pulse(t))
        self.line(fr, int(hy))


class Drone(Base):
    """Висока точка: горизонт високо, густа сітка, крен і дрейф камери."""
    name = "drone"

    def __init__(self):
        super().__init__(13)
        self.bg = sky(horizon=850, low=(52, 10, 34))

    def draw(self, fr, t):
        fr.alpha_composite(self.bg)
        dust(fr, t, self.dust, 250, 520)
        drift = 70 * math.sin(t * 0.35)
        roll = 3.2 * math.sin(t * 0.45 + 0.6)
        draw_sun(fr, 540 + drift * 0.3, 850, 128, t, horizon=850, pulse=kick_pulse(t))
        grid(fr, t, self.p(t) * 1.4, 850, vp_x=540 + drift, col=grid_col(t), spacing=150, rows=26,
             bright=0.8 + 0.2 * kick_pulse(t), roll=roll, fade=4.0)
        self.line(fr, 850, 200)


class Tunnel(Base):
    """Політ крізь спіральний тунель неонових рамок."""
    name = "tunnel"

    def __init__(self):
        super().__init__(14)
        self.bg = sky(horizon=2400, top=(4, 5, 9), low=(30, 6, 22), glow=0.0, refl_x=None)

    def draw(self, fr, t):
        fr.alpha_composite(self.bg)
        vx, vy = 540, 1040
        h = halo_img(900, 170)
        comp(fr, h, vx - 450, vy - 450, clamp(0.7 + 0.4 * kick_pulse(t), 0, 1))
        draw_sun(fr, vx, vy, 70, t, slats=False, halo=False)
        lay = Image.new("RGBA", (W * 2, H * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        pos = self.p(t) * 1.3
        frac = pos % 1.0
        col = grid_col(t)
        for i in range(26, 0, -1):
            z = (i - frac) * 0.55
            if z < 0.22:
                continue
            hw, hh = 620 / z, 980 / z
            ang = 0.11 * (i + math.floor(pos)) + t * 0.12
            pts = []
            for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                x, y = sx * hw, sy * hh
                pts.append(((vx + x * math.cos(ang) - y * math.sin(ang)) * 2, (vy + x * math.sin(ang) + y * math.cos(ang)) * 2))
            a = int(clamp(1.5 / z, 0.1, 1.0) * 240)
            d.line(pts + [pts[0]], fill=(*lerp(col, PINK, 0.3 if i % 3 else 0.7), a), width=4 if z > 2 else 6)
        lay = lay.reduce(2)
        glow = lay.filter(ImageFilter.GaussianBlur(14))
        fr.alpha_composite(glow)
        fr.alpha_composite(glow)
        fr.alpha_composite(lay)


class City(Base):
    """Скляне місто з трьома планами, що рухаються з різною швидкістю (панорама)."""
    name = "city"

    def __init__(self):
        super().__init__(15)
        self.bg = sky(horizon=1090)
        rng = np.random.default_rng(21)
        self.layers = []
        for li, (col, hmin, hmax, wmin, wmax, sp) in enumerate([((40, 14, 46), 50, 170, 50, 110, 8),
                                                                  ((24, 12, 32), 90, 260, 70, 150, 18),
                                                                  ((13, 12, 20), 120, 330, 90, 190, 34)]):
            strip = Image.new("RGBA", (2400, 620), (0, 0, 0, 0))
            d = ImageDraw.Draw(strip)
            x = 0
            while x < 2400:
                w = int(rng.integers(wmin, wmax))
                h = int(rng.integers(hmin, hmax))
                d.rectangle([x, 620 - h, x + w - 6, 620], fill=(*col, 255))
                for k in range(10):                                  # скляна грань: світліший лівий край
                    d.line([x + k, 620 - h, x + k, 620], fill=(*lerp(col, PINK, 0.35), int(70 * (1 - k / 10))))
                d.line([x, 620 - h, x + w - 6, 620 - h], fill=(*lerp(RUBY, PINK, 0.4), 140 + 45 * li), width=2)
                if li:
                    for wy in range(620 - h + 14, 600, 22):
                        for wx in range(x + 8, x + w - 14, 16):
                            if rng.random() < 0.18:
                                c = CHAMPAGNE if rng.random() < 0.7 else PINK
                                d.rectangle([wx, wy, wx + 4, wy + 6], fill=(*c, int(rng.integers(90, 200))))
                x += w
            self.layers.append((strip, sp))

    def draw(self, fr, t):
        fr.alpha_composite(self.bg)
        dust(fr, t, self.dust, 250, 500)
        draw_sun(fr, 540, 990, 250, t, horizon=1090, pulse=kick_pulse(t))
        pos = self.p(t)
        for strip, sp in self.layers:
            off = int((pos * sp * 2.2) % 1200)
            comp(fr, strip.crop((off, 0, off + W, 620)), 0, 1090 - 620)
        grid(fr, t, pos * 0.6, 1090, col=grid_col(t), bright=0.45, fade=4.0)
        self.line(fr, 1090, 180)


class Orbit(Base):
    """Дротовий глобус, що обертається, з кільцем; камера повільно наближається."""
    name = "orbit"

    def __init__(self):
        super().__init__(16)
        self.bg = sky(horizon=2400, top=(4, 5, 9), low=(34, 7, 26), glow=0.0, refl_x=None)
        rng = np.random.default_rng(31)
        self.stars = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(0.3, 1)) for _ in range(140)]

    def draw(self, fr, t):
        fr.alpha_composite(self.bg)
        d = ImageDraw.Draw(fr)
        for x, y, b in self.stars:
            a = int(160 * b * (0.6 + 0.4 * math.sin(t * 2 + x)))
            d.point((x, y), fill=(230, 225, 245, a))
        cx, cy = 540, 1300
        R = 470 * (1 + 0.05 * ease(t / 24))
        h = halo_img(int(R * 3.2), 120)
        comp(fr, h, cx - h.width / 2, cy - h.height / 2, clamp(0.7 + 0.3 * kick_pulse(t), 0, 1))
        rot = self.p(t) * 0.35
        tilt = 0.32
        col = grid_col(t)
        lay = Image.new("RGBA", (W * 2, H * 2), (0, 0, 0, 0))
        dl = ImageDraw.Draw(lay)

        def ring(front):
            rx, ry = R * 1.62, R * 0.28
            pts = []
            for k in range(181):
                a = math.pi * k / 180 + (0 if front else math.pi)
                pts.append(((cx + rx * math.cos(a)) * 2, (cy - 60 + ry * math.sin(a)) * 2))
            dl.line(pts, fill=(*lerp(col, CHAMPAGNE, 0.45), 245 if front else 90), width=7)
        ring(False)
        dl.ellipse([(cx - R) * 2, (cy - R) * 2, (cx + R) * 2, (cy + R) * 2], fill=(10, 6, 14, 235))
        for lat in range(-75, 90, 15):
            la = math.radians(lat)
            ry = R * math.cos(la)
            yc = cy - R * math.sin(la) * math.cos(tilt)
            dl.ellipse([(cx - ry) * 2, (yc - ry * math.sin(tilt)) * 2, (cx + ry) * 2, (yc + ry * math.sin(tilt)) * 2],
                       outline=(*col, 130), width=3)
        for k in range(12):
            lon = rot + k * math.pi / 12
            pts = []
            vis = math.cos(lon)
            for j in range(61):
                la = -math.pi / 2 + math.pi * j / 60
                x = R * math.cos(la) * math.sin(lon)
                y = -R * math.sin(la) * math.cos(tilt) + R * math.cos(la) * math.cos(lon) * math.sin(tilt) * 0.0
                pts.append(((cx + x) * 2, (cy + y) * 2))
            dl.line(pts, fill=(*lerp(col, PINK, 0.3), int(80 + 170 * max(0, vis))), width=4)
        dl.ellipse([(cx - R) * 2, (cy - R) * 2, (cx + R) * 2, (cy + R) * 2], outline=(*lerp(col, WHITE, 0.4), 200), width=4)
        ring(True)
        lay = lay.reduce(2)
        fr.alpha_composite(lay.filter(ImageFilter.GaussianBlur(8)))
        fr.alpha_composite(lay)


class Terrain(Base):
    """Дротові гори обабіч дороги, що наближаються (класичний outrun-рельєф)."""
    name = "terrain"

    def __init__(self):
        super().__init__(17)
        self.bg = sky(horizon=1040, refl_x=None)

    @staticmethod
    def height(xw, zw):
        side = clamp((abs(xw) - 260) / 700, 0, 1) ** 1.3
        n = (math.sin(xw * 0.011 + zw * 0.9) * math.cos(xw * 0.006 - zw * 0.55) + 0.6 * math.sin(zw * 1.7 + xw * 0.02)) * 0.5 + 0.55
        return side * max(0.0, n) * 620

    def draw(self, fr, t):
        fr.alpha_composite(self.bg)
        dust(fr, t, self.dust, 250, 500)
        hy = 1040
        draw_sun(fr, 540, 975, 230, t, horizon=hy, pulse=kick_pulse(t))
        ImageDraw.Draw(fr).rectangle([0, hy, W, H], fill=(7, 6, 12, 255))
        pos = self.p(t)
        frac, base = pos % 1.0, math.floor(pos)
        span = H - hy
        col = grid_col(t)
        xs = list(range(-1500, 1501, 100))
        lay = Image.new("RGBA", (W * 2, H * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        rows = []
        for i in range(18, 0, -1):
            z = i - frac
            if z < 0.2:
                continue
            s = 1 / z
            zw = base + i
            pts = []
            for xw in xs:
                x = 540 + xw * s * 0.9
                y = hy + span * s * 0.55 - self.height(xw, zw) * s * 1.05
                pts.append((x * 2, y * 2))
            rows.append((z, pts))
        for z, pts in rows:                      # від дальніх до ближніх, ближні перекривають
            a = int(clamp(2.2 / z, 0.1, 1.0) * 230)
            poly = pts + [(pts[-1][0], H * 2), (pts[0][0], H * 2)]
            d.polygon(poly, fill=(7, 6, 12, 255))
            d.line(pts, fill=(*lerp(col, PINK, 0.25), a), width=3)
        for j in range(len(xs)):
            col_pts = [pts[j] for _, pts in rows]
            d.line(col_pts, fill=(*col, 110), width=2)
        lay = lay.reduce(2)
        fr.alpha_composite(lay)
        self.line(fr, hy, 200)


class Mirror(Base):
    """Сонце над спокійною водою: віддзеркалення з брижами, повільне наближення."""
    name = "mirror"

    def __init__(self):
        super().__init__(18)
        self.bg = sky(horizon=1060, floor=(5, 5, 10), glow=0.5, refl_x=None)
        rng = np.random.default_rng(41)
        self.glints = [(rng.uniform(80, 1000), rng.uniform(1075, 1700), rng.uniform(20, 90), rng.uniform(0, 6)) for _ in range(60)]

    def draw(self, fr, t):
        fr.alpha_composite(self.bg)
        dust(fr, t, self.dust)
        r = int(236 * (1 + 0.06 * ease(t / 24)))
        sky_part = Image.new("RGBA", (W, 1060), (0, 0, 0, 0))
        draw_sun(sky_part, 540, 1000, r, t, horizon=1060, pulse=kick_pulse(t))
        fr.alpha_composite(sky_part)
        refl = sky_part.crop((0, 1060 - 520, W, 1060)).transpose(Image.FLIP_TOP_BOTTOM)
        a = np.asarray(refl).copy()
        out = np.zeros_like(a)
        amp_t = 1.0 + 0.6 * kick_pulse(t)
        for y in range(a.shape[0]):
            sh = int(math.sin(y * 0.09 + t * 3.2) * (2 + y * 0.05) * amp_t)
            out[y] = np.roll(a[y], sh, axis=0)
            out[y, :, 3] = (out[y, :, 3] * (0.55 * (1 - y / a.shape[0]) ** 1.4) * (0.75 + 0.25 * math.sin(y * 0.7 + t * 6))).astype(np.uint8)
        fr.alpha_composite(Image.fromarray(out, "RGBA"), (0, 1062))
        d = ImageDraw.Draw(fr)
        for x, y, w, ph in self.glints:
            a_ = int(90 * max(0, math.sin(t * 1.6 + ph)) * (1 - (y - 1060) / 700))
            if a_ > 4:
                d.line([x - w / 2, y, x + w / 2, y], fill=(*CHAMPAGNE, a_), width=2)
        self.line(fr, 1060, 160)


class GlassField(Base):
    """Поле скляних куль бренду: камера летить крізь глибину, далекі кулі в розфокусі."""
    name = "glass"

    def __init__(self):
        super().__init__(19)
        self.bg = sky(horizon=1150, top=(5, 7, 10), low=(26, 8, 22), floor=(8, 8, 13), glow=0.3, refl_x=None)
        rng = np.random.default_rng(51)
        kinds = ["clear", "clear", "ruby", "clear", "hot"]
        self.balls = [(rng.uniform(-900, 900), rng.uniform(-420, 520), rng.uniform(1.2, 9.0), kinds[i % 5]) for i in range(30)]

    def draw(self, fr, t):
        fr.alpha_composite(self.bg)
        cx, cy = 540, 1240
        pos = self.p(t) * 0.55
        items = []
        for x, y, z0, kind in self.balls:
            z = (z0 - pos) % 8.6 + 0.9
            items.append((z, x, y, kind))
        for z, x, y, kind in sorted(items, reverse=True):
            s = 1 / z
            r = int(max(6, min(150, 120 * s)) // 4 * 4)
            px, py = cx + x * s * 1.25, cy + y * s * 1.25
            a = clamp((9.4 - z) / 1.5) * clamp((z - 0.9) / 0.4)
            blur = 3 if z > 5.5 else (0 if z > 1.6 else 2)
            img = glass.sphere(r, kind, blur)
            if kind != "clear" and r > 20:
                hl = glass.halo(r, 60)
                comp(fr, hl, px - hl.width / 2, py - hl.height / 2, a)
            comp(fr, img, px - img.width / 2, py - img.height / 2, a)
        dust(fr, t, self.dust)


class Dutch(Sunset):
    """Нахилена камера: у інтро кадр завалений, на дропі різко вирівнюється, далі ледь гойдається."""
    name = "dutch"

    def roll(self, t):
        if t < T_DROP - 0.25:
            return -11 + 4 * ease(t / T_DROP)
        if t < T_DROP + 0.2:
            return -7 * (1 - ease((t - (T_DROP - 0.25)) / 0.45))
        return 1.4 * math.sin((t - T_DROP) * 0.9)

    def draw(self, fr, t):
        lay = Image.new("RGBA", (W, H), (*GRAPHITE, 255))
        super().draw(lay, t)
        ang = self.roll(t)
        lay = lay.resize((int(W * 1.32), int(H * 1.32)), Image.BILINEAR).rotate(ang, resample=Image.BICUBIC)
        ox, oy = (lay.width - W) // 2, (lay.height - H) // 2
        fr.alpha_composite(lay.crop((ox, oy, ox + W, oy + H)))


CLASSES = {c.name: c for c in (Sunset, Sunrise, Drone, Tunnel, City, Orbit, Terrain, Mirror, GlassField, Dutch)}


def make(name: str):
    return CLASSES[name]()
