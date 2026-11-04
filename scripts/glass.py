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
  • стриманість: жодних спалахів, тремтіння і неонових кольорів; імпульси даних ледь помітно пробігають ребрами;
  • драматургія за референсом 04.11.2026 (див. Graph): підвіска на нитках, світлові сліди-дуги, що
    прокреслюють зв'язки, розжарений шлях аналізу графа з ореолом, повільний наїзд камери, пил у розфокусі.
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
    elif kind == "hot":                                 # активований вузол: розжарене рубінове скло, світло зсередини
        core = np.exp(-((nx + 0.05) ** 2 + (ny + 0.05) ** 2) / 0.35)
        col = np.array(brand.RUBY) * (0.55 + 0.45 * diff)[..., None] + np.array([255, 170, 180]) * (0.9 * core)[..., None]
        col += np.array([255, 235, 238]) * (0.55 * core ** 3)[..., None] + np.array([255, 150, 160]) * (0.6 * fres)[..., None]
        col += 255 * (0.4 * env)[..., None]
        alpha = 0.95 + 0.05 * fres
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


@lru_cache(maxsize=None)
def dust(r: int, a: int) -> Image.Image:
    """Пилинка в розфокусі (боке): м'яке світле коло."""
    n = r * 4 + 4
    yy, xx = (np.mgrid[0:n, 0:n] - n / 2) / (r * 1.6)
    m = np.clip(1 - (xx ** 2 + yy ** 2), 0, 1) ** 1.4 * a
    img = Image.new("RGBA", (n, n), (235, 238, 244, 0))
    img.putalpha(Image.fromarray(m.astype(np.uint8), "L"))
    return img


def _bezier(p0, p1, bend, steps=14):
    """Точки дуги від p0 до p1 з вигином bend (частка довжини), для світлових слідів."""
    (x0, y0), (x1, y1) = p0, p1
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    dx, dy = x1 - x0, y1 - y0
    cx, cy = mx - dy * bend, my + dx * bend
    u = np.linspace(0, 1, steps)
    bx = (1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u ** 2 * x1
    by = (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u ** 2 * y1
    return list(zip(bx, by))


class Graph:
    """Граф із force-directed фізикою. Положення всіх кадрів рахуються наперед (детерміновано від seed).

    Драматургія (за референсом 04.11.2026): кулі спершу висять на тонких нитках і легко гойдаються; нитки
    зникають, і світлові сліди дугами прокреслюють зв'язки; пружина вмикається лише тоді, коли слід дійшов,
    тож кулі стягуються саме тим зв'язком, який щойно засвітився. На кожному слайді аналіз графа:
    шлях між двома вузлами по черзі розжарюється (вузли світяться зсередини, ребра з ореолом). Камера
    повільно наїжджає протягом слайда; у глибині пливе ледь помітний пил у розфокусі.
    """

    REVEAL = 0.75          # тривалість світлового сліду, с

    def __init__(self, seed: int, w: int, h: int, total: float, cuts: list[float], fps: int = 30,
                 hubs: int = 4, leaves: tuple[int, int] = (4, 7), scale: float = 1.0,
                 anchors: list[tuple[float, float]] | None = None, intro: str = "hang", paths: bool = True):
        self.w, self.h, self.fps, self.scale = w, h, fps, scale
        rng = np.random.default_rng(seed)
        self.rng = rng
        self.intro = intro
        kind, parent = [], []
        edges = []                                         # [a, b, t_on, t_off]
        t0 = 0.55 if intro == "hang" else 0.0
        for hh in range(hubs):
            kind.append("hub"); parent.append(-1)
        for hh in range(hubs - 1):                         # хребет між хабами + одна поперечна зв'язка
            edges.append([hh, hh + 1, t0 + 0.12 * hh, 1e9])
        if hubs > 2:
            edges.append([0, hubs - 1, t0 + 0.5, 1e9])
        for hh in range(hubs):
            for _ in range(int(rng.integers(leaves[0], leaves[1] + 1))):
                kind.append("leaf"); parent.append(hh)
                edges.append([hh, len(kind) - 1, t0 + 0.35 + rng.uniform(0, 1.3), 1e9])
        leaves_idx = [i for i, k in enumerate(kind) if k == "leaf"]
        for _ in range(max(2, len(leaves_idx) // 7)):      # кілька зв'язків між листками різних хабів
            a, b = rng.choice(leaves_idx, 2, replace=False)
            if parent[a] != parent[b]:
                edges.append([int(a), int(b), t0 + 1.6 + rng.uniform(0, 0.6), 1e9])
        if intro != "hang":
            for e in edges:
                e[2] = -10.0
        self.kind = kind
        self.n = n = len(kind)
        self.radius = np.array([rng.uniform(30, 40) if k == "hub" else rng.uniform(12, 21) for k in kind]) * scale
        # перепідключення на кожній зміні слайда: листок переходить до іншого хаба новим світловим слідом
        for tc in cuts:
            leaf = int(rng.choice(leaves_idx))
            new = int(rng.choice([x for x in range(hubs) if x != parent[leaf]]))
            for e in edges:
                if e[3] > 1e8 and {e[0], e[1]} == {parent[leaf], leaf}:
                    e[3] = tc + 0.3
            edges.append([new, leaf, tc + 0.15, 1e9])
            parent[leaf] = new
        self.edges = edges
        self.anchors = anchors or [(0.5, 0.5)]
        self.cuts = cuts
        self.total = total
        # шляхи аналізу: на кожному слайді свій, від листка до листка через хаби
        self.paths = []
        if paths:
            bounds = [0.0] + list(cuts) + [total]
            for i in range(len(bounds) - 1):
                a0, a1 = bounds[i], bounds[i + 1]
                st = a0 + (2.6 if (i == 0 and intro == "hang") else 0.7)
                if a1 - st < 1.4:
                    continue
                path = self._path(st, rng)
                if path:
                    self.paths.append((st, a1 - 0.35, path))
        # пил у розфокусі: екранні координати, повільний дрейф
        m = 18
        self.dust = [(rng.uniform(0, w), rng.uniform(0, h), rng.uniform(-6, 6), rng.uniform(-14, -3),
                      int(rng.integers(2, 9)), int(rng.integers(18, 60))) for _ in range(m)]
        self._simulate(total)

    def active(self, t: float):
        return [(a, b) for a, b, on, off in self.edges if on <= t < off]

    def _path(self, t: float, rng):
        adj = {}
        for a, b in self.active(t + 0.5):
            adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
        leaves = [i for i, k in enumerate(self.kind) if k == "leaf" and i in adj]
        if len(leaves) < 2:
            return None
        best = None
        for _ in range(6):                                  # найдовший із кількох випадкових шляхів
            s0, s1 = rng.choice(leaves, 2, replace=False)
            prev, q = {int(s0): None}, [int(s0)]
            while q:
                x = q.pop(0)
                for y in adj.get(x, []):
                    if y not in prev:
                        prev[y] = x; q.append(y)
            if int(s1) in prev:
                p, x = [], int(s1)
                while x is not None:
                    p.append(x); x = prev[x]
                if best is None or len(p) > len(best):
                    best = p[::-1]
        return best

    def _simulate(self, total: float):
        n, s = self.n, self.scale
        rng = self.rng
        frames = int(total * self.fps) + 2
        if self.intro == "hang":                            # кулі висять рядами, як підвіска
            pos = np.stack([rng.uniform(-430, 430, n), rng.uniform(-170, 130, n), rng.uniform(-260, 260, n)], 1) * s
        else:
            pos = rng.normal(0, 18 * s, (n, 3))            # стартують стиснутими в центрі
        self.hang0 = pos.copy()
        vel = np.zeros((n, 3))
        dt, sub = 1 / self.fps, 3
        hub = np.array([k == "hub" for k in self.kind])
        mass = np.where(hub, 2.6, 1.0)[:, None]
        phase = rng.uniform(0, 2 * np.pi, n)
        out = np.zeros((frames, n, 3))
        for f in range(frames):
            t = f / self.fps
            E = []
            for a, b, on, off in self.edges:                # пружина діє, коли світловий слід дійшов до кінця
                if on + self.REVEAL * 0.6 <= t < off:
                    E.append((a, b))
            if self.intro == "hang" and t < 0.55:
                pos = self.hang0 + np.stack([np.sin(t * 2.6 + phase) * 9 * s, np.zeros(n), np.zeros(n)], 1)
                out[f] = pos
                continue
            ea = np.array([a for a, _ in E], dtype=int); eb = np.array([b for _, b in E], dtype=int)
            rest = np.array([(250 if hub[a] and hub[b] else 170 if hub[a] or hub[b] else 210) * s for a, b in E])
            for _ in range(sub):
                h = dt / sub
                d = pos[:, None, :] - pos[None, :, :]
                dist2 = (d ** 2).sum(-1) + (30 * s) ** 2
                rep = (d / dist2[..., None] ** 1.5 * (2.4e6 * s ** 3)).sum(1)
                spring = np.zeros_like(pos)
                if len(E):
                    ev = pos[eb] - pos[ea]
                    el = np.linalg.norm(ev, axis=1) + 1e-6
                    fs = ((el - rest) * 2.2 / el)[:, None] * ev
                    np.add.at(spring, ea, fs)
                    np.add.at(spring, eb, -fs)
                grav = -pos * np.array([0.55, 0.42, 0.9]) * (0.35 if t < 1.6 and self.intro == "hang" else 1.0)
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
        """Центр мережі в кадрі й масштаб (x, y, sx, sy): плавно переходить між слайдами, щоб не стояти під текстом.
        Протягом слайда камера повільно наїжджає (до +6 %)."""
        def full(a):
            return tuple(a) + (1.0, 1.0)[len(a) - 2:] if len(a) < 4 else tuple(a)
        bounds = [0.0] + list(self.cuts) + [self.total]
        idx = sum(1 for c in self.cuts if t >= c)
        u = (t - bounds[idx]) / max(0.1, bounds[idx + 1] - bounds[idx])
        dolly = 1 + 0.06 * _smooth(u)
        a = full(self.anchors[min(idx, len(self.anchors) - 1)])
        if idx > 0:
            prev = full(self.anchors[min(idx - 1, len(self.anchors) - 1)])
            k = _smooth((t - self.cuts[idx - 1] + 0.5) / 1.8)   # рух починається разом із переходом слайда
            a = tuple(p + (q - p) * k for p, q in zip(prev, a))
            dolly = 1 + 0.06 * (1 - k) + (0.06 * _smooth(u)) * k
        return (a[0], a[1], a[2] * dolly, a[3] * dolly)

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

    def heat(self, t: float):
        """Розжарення вузлів і ребер шляху аналізу в момент t: ({вузол: 0..1}, [(a, b, від, до, сила)])."""
        nodes, edges = {}, []
        for st, en, path in self.paths:
            if not (st - 0.1 <= t <= en + 0.6):
                continue
            out = 1 - _smooth((t - en) / 0.6)
            step = min(0.26, (en - st - 0.6) / max(1, len(path)))
            for i, v in enumerate(path):
                ta = st + i * step
                h = _smooth((t - ta) / 0.25) * out
                if h > 0:
                    nodes[v] = max(nodes.get(v, 0), h)
                if i + 1 < len(path):
                    u = (t - ta) / step                    # імпульс біжить ребром до наступного вузла
                    if u > 0:
                        edges.append((v, path[i + 1], 0.0, min(1.0, u), out))
        return nodes, edges

    def draw(self, frame: Image.Image, t: float, beat: float = 0.0, opacity: float = 1.0) -> None:
        sx, sy, k, z = self.project(t)
        W, H = frame.size
        ss = 2
        # пил у розфокусі, позаду мережі
        for (x0, y0, vx, vy, r, a) in self.dust:
            x = (x0 + vx * t) % W; y = (y0 + vy * t) % H
            g = dust(r, int(a * opacity))
            frame.alpha_composite(g, (int(x - g.width / 2), int(y - g.height / 2)))
        m = Image.new("L", (W * ss, H * ss), 0)           # спокійні ребра (срібло)
        dm = ImageDraw.Draw(m)
        hm = Image.new("L", (W * ss, H * ss), 0)          # яскраві світлові сліди й розжарені ребра
        dh = ImageDraw.Draw(hm)
        # нитки підвіски на початку
        if self.intro == "hang" and t < 1.5:
            ta = int(90 * (1 - _smooth((t - 0.45) / 0.9)) * opacity)
            if ta > 0:
                for i in range(self.n):
                    dm.line([sx[i] * ss, 0, sx[i] * ss, (sy[i] - self.radius[i] * k[i]) * ss], fill=ta, width=2)
        for a, b, on, off in self.edges:
            if t < on or t >= off + 0.5:
                continue
            depth = float(np.clip(1.15 - (z[a] + z[b]) / 2 / (520 * self.scale), 0.35, 1.0))
            fade = 1 - _smooth((t - off) / 0.5) if t >= off else 1.0
            p = _smooth((t - on) / self.REVEAL)
            p0, p1 = (sx[a], sy[a]), (sx[b], sy[b])
            if p >= 1:
                dm.line([p0[0] * ss, p0[1] * ss, p1[0] * ss, p1[1] * ss], fill=int(120 * depth * fade * opacity), width=3)
                continue
            # світловий слід: дуга, що випрямляється в ребро; яскрава голова й хвіст, що згасає
            pts = _bezier(p0, p1, 0.32 * (1 - p) * (1 if (a + b) % 2 else -1))
            nseg = len(pts) - 1
            head = p * nseg
            for j in range(int(head)):
                tail = max(0.0, 1 - (head - j) / (nseg * 0.45))
                q0, q1 = pts[j], pts[j + 1]
                dm.line([q0[0] * ss, q0[1] * ss, q1[0] * ss, q1[1] * ss], fill=int(110 * depth * opacity), width=3)
                if tail > 0:
                    dh.line([q0[0] * ss, q0[1] * ss, q1[0] * ss, q1[1] * ss], fill=int(255 * tail * opacity), width=6)
            hx, hy = pts[min(nseg, int(head))]
            dh.ellipse([(hx - 6) * ss, (hy - 6) * ss, (hx + 6) * ss, (hy + 6) * ss], fill=int(255 * opacity))
        hot, hedges = self.heat(t)
        for a, b, u0, u1, strength in hedges:
            x0, y0 = sx[a], sy[a]
            x1, y1 = x0 + (sx[b] - x0) * u1, y0 + (sy[b] - y0) * u1
            dh.line([x0 * ss, y0 * ss, x1 * ss, y1 * ss], fill=int(235 * strength * opacity), width=5)
        m = m.resize((W, H), Image.BOX)
        hm = hm.resize((W, H), Image.BOX)
        lines = Image.new("RGBA", (W, H), (*brand.SILVER, 0))
        lines.putalpha(m)
        # рубінове підсвічування під хабами й розжареними вузлами (під ребрами й кулями)
        for i in range(self.n):
            hh = hot.get(i, 0.0)
            if self.kind[i] == "hub" or hh > 0:
                g = halo(int(self.radius[i] * k[i] * (1.6 + 0.6 * hh)), int((46 + 26 * beat) * (1 if self.kind[i] == "hub" else 0) + 70 * hh))
                frame.alpha_composite(_fade(g, opacity), (int(sx[i] - g.width / 2), int(sy[i] - g.height / 2)))
        frame.alpha_composite(lines)
        if hm.getbbox():
            # ореол (bloom): розмитий рубіново-рожевий шар і біле ядро сліду
            q = 4
            bl = hm.resize((W // q, H // q), Image.BILINEAR).filter(ImageFilter.GaussianBlur(6)).resize((W, H), Image.BILINEAR)
            glow = Image.new("RGBA", (W, H), (*PINK, 0))
            glow.putalpha(bl.point(lambda v: min(255, int(v * 2.3))))
            frame.alpha_composite(glow)
            core = Image.new("RGBA", (W, H), (255, 238, 242, 0))
            core.putalpha(hm)
            frame.alpha_composite(core)
        # імпульси даних: ледь помітна рубінова іскра пробігає кількома ребрами
        d = ImageDraw.Draw(frame)
        for j, (a, b) in enumerate(self.active(t - self.REVEAL)):
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
            pos = (int(sx[i] - spr.width / 2), int(sy[i] - spr.height / 2))
            frame.alpha_composite(spr, pos)
            hh = hot.get(i, 0.0)
            if hh > 0.02:
                hs = _fade(sphere(r, "hot", blur), hh * opacity)
                frame.alpha_composite(hs, pos)


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
