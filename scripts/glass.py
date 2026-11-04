"""Стиль «Ruby Glass Graph» (з 04.11.2026): жива мережа графа зі скляних рубінових куль.

Візуальна мова для відео Belyakov Consult (Data Architecture, Data Governance, Graph Analysis):
  • матеріали: напівпрозорі скляні кулі рубінового металіку (вузли-хаби) і безбарвне скло з рубіновим
    ядром (листки) на темному матовому графіті із тонким зерном; рубін лише акцентом;
  • кінетика: розкладка force-directed (відштовхування, пружини зв'язків, м'яке тяжіння до центру) з
    природним загасанням. На початку ролика вузли розлітаються з центру й самоорганізуються в граф; на
    кожній зміні слайда один листок «перепідключається» до іншого хаба і плавно мігрує, граф знову
    знаходить рівновагу; мережа повільно обертається в 3D, тож кулі пливуть із паралаксом;
  • світло й глибина: дзеркальні відблиски і френелівський обідок на склі, м'яке рубінове світіння під
    хабами, розмиття далеких куль (глибина різкості), матове скло (frosted glass blur) під текстом;
  • стриманість: жодних спалахів, тремтіння, частинок і неонових кольорів; імпульси даних ледь помітно
    пробігають ребрами.
Лише Pillow і numpy, без нових залежностей для CI.
"""
from __future__ import annotations

from functools import lru_cache

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

import brand

DEEP = (92, 0, 18)          # тінь рубінового скла
PINK = (255, 92, 112)       # світло, що пройшло крізь рубін


def _smooth(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


@lru_cache(maxsize=None)
def sphere(r: int, kind: str = "ruby", blur: int = 0) -> Image.Image:
    """Скляна куля радіусом r (RGBA, з полем під світіння). kind: ruby (рубіновий металік) або clear (скло)."""
    ss = 3                                             # суперсемплінг для гладкого краю
    pad = max(4, r // 3) + blur * 2
    R = r * ss
    n = 2 * (R + pad * ss)
    c = n / 2
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5 - c) / R
    d2 = xx ** 2 + yy ** 2
    inside = d2 <= 1.0
    nz = np.sqrt(np.clip(1 - d2, 0, 1))
    nx, ny = xx, yy
    L = np.array([-0.45, -0.68, 0.58]); L /= np.linalg.norm(L)
    diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    # відбитий вектор погляду (0,0,1): r = 2(n·v)n - v
    rx, ry, rz = 2 * nz * nx, 2 * nz * ny, 2 * nz * nz - 1
    spec = np.clip(rx * L[0] + ry * L[1] + rz * L[2], 0, 1)
    fres = (1 - nz) ** 2.4
    # «вікно» студійного світла: м'яка смуга у верхній півсфері (металік)
    env = np.exp(-((ry + 0.55) / 0.22) ** 2) * np.exp(-((rx + 0.15) / 0.75) ** 2)
    # світло, що пройшло крізь скло, збирається внизу праворуч (каустика)
    caus = np.exp(-(((nx - 0.34) / 0.38) ** 2 + ((ny - 0.42) / 0.30) ** 2))
    if kind == "ruby":
        base = np.array(DEEP)[None, None, :] * (1 - diff[..., None]) + np.array(brand.RUBY)[None, None, :] * diff[..., None]
        col = base + np.array(PINK) * (0.55 * caus)[..., None] + np.array([255, 150, 160]) * (0.5 * fres)[..., None]
        col += 255 * (0.55 * env)[..., None]
        alpha = 0.9 + 0.1 * fres
    else:
        tint = np.array([196, 204, 216])
        col = tint * (0.10 + 0.25 * diff)[..., None] + np.array(brand.RUBY) * (0.85 * caus)[..., None]
        col += np.array([235, 240, 246]) * (0.75 * fres)[..., None] + 255 * (0.6 * env)[..., None]
        alpha = 0.22 + 0.55 * fres + 0.35 * caus + 0.4 * env
    col += 255 * (spec ** 80)[..., None] * 1.0 + 255 * (spec ** 14)[..., None] * 0.18
    alpha = np.clip(alpha + spec ** 60, 0, 1) * inside
    rgba = np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA").resize((n // ss, n // ss), Image.LANCZOS)
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    return img


@lru_cache(maxsize=None)
def halo(r: int, strength: int = 70) -> Image.Image:
    """М'яке рубінове світіння під кулею (адитивно)."""
    n = r * 6
    yy, xx = (np.mgrid[0:n, 0:n] - n / 2) / (n / 2)
    m = np.clip(1 - np.sqrt(xx ** 2 + yy ** 2), 0, 1) ** 2.2 * strength
    img = Image.new("RGBA", (n, n), (*brand.RUBY, 0))
    img.putalpha(Image.fromarray(m.astype(np.uint8), "L"))
    return img


def matte(w: int, h: int, seed: int = 7) -> Image.Image:
    """Темний матовий графіт: ледь світліший центр, віньєтка, нерухоме тонке зерно."""
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w * 0.5) / (w * 0.85)) ** 2 + ((yy - h * 0.45) / (h * 0.75)) ** 2)
    mix = np.clip(1 - r, 0, 1) ** 1.5
    base = np.zeros((h, w, 3), np.float32)
    for c in range(3):
        base[..., c] = brand.GRAPHITE[c] + (brand.STEEL[c] + 5 - brand.GRAPHITE[c]) * mix
    rng = np.random.default_rng(seed)
    grain = rng.normal(0, 3.2, (h // 2, w // 2)).astype(np.float32)
    grain = np.asarray(Image.fromarray(grain).resize((w, h), Image.BILINEAR))
    base += grain[..., None]
    return Image.fromarray(base.clip(0, 255).astype(np.uint8), "RGB").convert("RGBA")


class Graph:
    """Граф із force-directed фізикою. Положення всіх кадрів рахуються наперед (детерміновано від seed)."""

    def __init__(self, seed: int, w: int, h: int, total: float, cuts: list[float], fps: int = 30,
                 hubs: int = 4, leaves: tuple[int, int] = (4, 7), scale: float = 1.0,
                 anchors: list[tuple[float, float]] | None = None):
        self.w, self.h, self.fps, self.scale = w, h, fps, scale
        rng = np.random.default_rng(seed)
        self.rng = rng
        kind, edges, parent = [], [], []
        for hh in range(hubs):
            kind.append("hub"); parent.append(-1)
        for hh in range(hubs):
            for _ in range(int(rng.integers(leaves[0], leaves[1] + 1))):
                kind.append("leaf"); parent.append(hh)
                edges.append((hh, len(kind) - 1))
        for hh in range(hubs - 1):                         # хребет між хабами + одна поперечна зв'язка
            edges.append((hh, hh + 1))
        if hubs > 2:
            edges.append((0, hubs - 1))
        leaves_idx = [i for i, k in enumerate(kind) if k == "leaf"]
        for _ in range(max(2, len(leaves_idx) // 7)):      # кілька зв'язків між листками різних хабів
            a, b = rng.choice(leaves_idx, 2, replace=False)
            if parent[a] != parent[b]:
                edges.append((int(a), int(b)))
        self.kind = kind
        self.n = n = len(kind)
        self.radius = np.array([rng.uniform(30, 40) if k == "hub" else rng.uniform(12, 21) for k in kind]) * scale
        self.edges0 = edges
        # перепідключення на кожній зміні слайда: листок переходить до іншого хаба
        self.rewires = []
        for t in cuts:
            leaf = int(rng.choice(leaves_idx))
            new = int(rng.choice([x for x in range(hubs) if x != parent[leaf]]))
            self.rewires.append((t, leaf, new))
            parent[leaf] = new
        self.anchors = anchors or [(0.5, 0.5)]
        self.cuts = cuts
        self._simulate(total)

    def _edges_at(self, t: float):
        parent = {}
        out = []
        for a, b in self.edges0:
            if self.kind[a] == "hub" and self.kind[b] == "leaf":
                parent[b] = a
            else:
                out.append((a, b))
        for (tc, leaf, new) in self.rewires:
            if t >= tc:
                parent[leaf] = new
        out += [(p, l) for l, p in parent.items()]
        return out

    def _simulate(self, total: float):
        n, s = self.n, self.scale
        rng = self.rng
        frames = int(total * self.fps) + 2
        pos = rng.normal(0, 18 * s, (n, 3))                # стартують стиснутими в центрі
        vel = np.zeros((n, 3))
        dt, sub = 1 / self.fps, 3
        hub = np.array([k == "hub" for k in self.kind])
        mass = np.where(hub, 2.6, 1.0)[:, None]
        out = np.zeros((frames, n, 3))
        for f in range(frames):
            t = f / self.fps
            E = self._edges_at(t)
            ea = np.array([a for a, _ in E]); eb = np.array([b for _, b in E])
            rest = np.array([(250 if hub[a] and hub[b] else 170 if hub[a] or hub[b] else 210) * s for a, b in E])
            for _ in range(sub):
                h = dt / sub
                d = pos[:, None, :] - pos[None, :, :]
                dist2 = (d ** 2).sum(-1) + (30 * s) ** 2
                rep = (d / dist2[..., None] ** 1.5 * (2.4e6 * s ** 3)).sum(1)
                ev = pos[eb] - pos[ea]
                el = np.linalg.norm(ev, axis=1) + 1e-6
                fs = ((el - rest) * 2.2 / el)[:, None] * ev
                spring = np.zeros_like(pos)
                np.add.at(spring, ea, fs)
                np.add.at(spring, eb, -fs)
                grav = -pos * np.array([0.55, 0.42, 0.9])
                # ледь відчутне «дихання» системи, щоб вона ніколи не завмирала повністю
                breath = np.stack([np.sin(t * 0.7 + np.arange(n)), np.cos(t * 0.55 + 2 * np.arange(n)),
                                   np.sin(t * 0.4 + 3 * np.arange(n))], 1) * 14 * s
                acc = (rep + spring + grav + breath) / mass
                vel = (vel + acc * h) * (1 - 2.4 * h)
                sp = np.linalg.norm(vel, axis=1, keepdims=True)
                vel = np.where(sp > 900 * s, vel / sp * 900 * s, vel)
                pos = pos + vel * h
            out[f] = pos
        self.pos = out

    def anchor(self, t: float) -> tuple[float, float, float, float]:
        """Центр мережі в кадрі й масштаб (x, y, sx, sy): плавно переходить між слайдами, щоб не стояти під текстом."""
        def full(a):
            return tuple(a) + (1.0, 1.0)[len(a) - 2:] if len(a) < 4 else tuple(a)
        idx = sum(1 for c in self.cuts if t >= c)
        a = full(self.anchors[min(idx, len(self.anchors) - 1)])
        if idx == 0:
            return a
        prev = full(self.anchors[min(idx - 1, len(self.anchors) - 1)])
        k = _smooth((t - self.cuts[idx - 1] + 0.5) / 1.8)   # рух починається разом із переходом слайда
        return tuple(p + (q - p) * k for p, q in zip(prev, a))

    def project(self, t: float):
        f = min(len(self.pos) - 1, int(t * self.fps))
        p = self.pos[f]
        ang = t * 0.16                                     # повільне обертання навколо вертикальної осі
        ca, sa = np.cos(ang), np.sin(ang)
        x = p[:, 0] * ca + p[:, 2] * sa
        z = -p[:, 0] * sa + p[:, 2] * ca
        y = p[:, 1] + 0.18 * z
        foc = 1100 * self.scale
        k = foc / (foc + z)
        ax, ay, fx, fy = self.anchor(t)
        sx = self.w * ax + x * k * fx
        sy = self.h * ay + y * k * fy
        return sx, sy, k, z

    def draw(self, frame: Image.Image, t: float, beat: float = 0.0, opacity: float = 1.0) -> None:
        sx, sy, k, z = self.project(t)
        W, H = frame.size
        ss = 2
        # ребра: згладжені лінії (малюємо вдвічі більшими й зменшуємо)
        m = Image.new("L", (W * ss, H * ss), 0)
        dm = ImageDraw.Draw(m)
        E = self._edges_at(t)
        for a, b in E:
            depth = float(np.clip(1.15 - (z[a] + z[b]) / 2 / (520 * self.scale), 0.35, 1.0))
            dm.line([sx[a] * ss, sy[a] * ss, sx[b] * ss, sy[b] * ss], fill=int(120 * depth * opacity), width=3)
        m = m.resize((W, H), Image.BOX)
        lines = Image.new("RGBA", (W, H), (*brand.SILVER, 0))
        lines.putalpha(m)
        # рубінове підсвічування під хабами (під ребрами й кулями)
        for i in range(self.n):
            if self.kind[i] == "hub":
                g = halo(int(self.radius[i] * k[i] * 1.6), int(46 + 26 * beat))
                frame.alpha_composite(_fade(g, opacity), (int(sx[i] - g.width / 2), int(sy[i] - g.height / 2)))
        frame.alpha_composite(lines)
        # імпульси даних: ледь помітна рубінова іскра пробігає кількома ребрами
        d = ImageDraw.Draw(frame)
        for j, (a, b) in enumerate(E):
            if j % 3:
                continue
            u = (t * 0.45 + j * 0.37) % 1.0
            px, py = sx[a] + (sx[b] - sx[a]) * u, sy[a] + (sy[b] - sy[a]) * u
            al = int(150 * np.sin(np.pi * u) * opacity)
            g = halo(7, al)
            frame.alpha_composite(g, (int(px - g.width / 2), int(py - g.height / 2)))
            d.ellipse([px - 2.2, py - 2.2, px + 2.2, py + 2.2], fill=(*PINK, al))
        # кулі: від далеких до близьких; далекі менші й розмиті (глибина різкості)
        for i in np.argsort(-z):
            r = max(4, int(round(self.radius[i] * k[i])))
            blur = int(np.clip((z[i] - 120 * self.scale) / (110 * self.scale), 0, 3))
            spr = sphere(r, "ruby" if self.kind[i] == "hub" else "clear", blur)
            if opacity < 1 or z[i] > 300 * self.scale:
                spr = _fade(spr, opacity * float(np.clip(1.25 - z[i] / (900 * self.scale), 0.45, 1.0)))
            frame.alpha_composite(spr, (int(sx[i] - spr.width / 2), int(sy[i] - spr.height / 2)))


def _fade(img: Image.Image, a: float) -> Image.Image:
    if a >= 0.999:
        return img
    out = img.copy()
    out.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
    return out


def frosted(frame: Image.Image, box: tuple[int, int, int, int], radius: int = 34, k: float = 1.0) -> None:
    """Матове скло під текстом: розмиття того, що позаду, затемнення, тонкий світлий кант зверху."""
    x0, y0, x1, y1 = (int(v) for v in box)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(frame.width, x1), min(frame.height, y1)
    if x1 - x0 < 10 or y1 - y0 < 10 or k <= 0:
        return
    reg = frame.crop((x0, y0, x1, y1)).convert("RGB")
    q = 4
    small = reg.resize((max(1, reg.width // q), max(1, reg.height // q)), Image.BILINEAR).filter(ImageFilter.GaussianBlur(7))
    blur = small.resize(reg.size, Image.BILINEAR)
    tint = Image.new("RGB", reg.size, brand.MIDNIGHT)
    glass = Image.blend(blur, tint, 0.62)
    glass = ImageChops.add(glass, Image.new("RGB", reg.size, (7, 8, 10)))
    mask = Image.new("L", reg.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, reg.width - 1, reg.height - 1], radius, fill=int(255 * k))
    out = glass.convert("RGBA")
    out.putalpha(mask)
    frame.alpha_composite(out, (x0, y0))
    edge = Image.new("RGBA", reg.size, (0, 0, 0, 0))
    de = ImageDraw.Draw(edge)
    de.rounded_rectangle([0, 0, reg.width - 1, reg.height - 1], radius, outline=(255, 255, 255, int(30 * k)), width=2)
    # відблиск угорі скла: світліший кант, що згасає донизу
    fade = Image.linear_gradient("L").resize(reg.size).point(lambda v: 255 - v)
    edge.putalpha(ImageChops.multiply(edge.getchannel("A"), fade.point(lambda v: min(255, int(v * 1.6)))))
    frame.alpha_composite(edge, (x0, y0))
