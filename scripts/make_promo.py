"""Промо-Reels для Instagram (англійські версії): кінетична типографіка + 3D-композиція з дизайн-системи.

Сцени (~17 с, 1080×1920, 30 fps):
  1. Гачок (0–2,6 с): 2–3 величезні слова капсом «влітають» по одному, друге рубінове, кадр здригається в такт.
  2. Герой (2,6–7,2 с): центральна 3D-іконка наближається, навколо вилітають 4 інші іконки, світні лінії
     з'єднують їх із центром, по лініях біжать «іскри» даних; гачок зменшується в заголовок угорі.
  3. Тези (7,2–14,4 с): три короткі тези великим шрифтом, перехід «свайпом» з розмиттям руху.
  4. Заклик (14,4–17 с): логотип, «більше нотаток», @belyakovconsult.
Зміст береться зі статті чи епізоду автоматично; можна задати явно полем `promo:` в епізоді чи статті:
  promo: {hook: "VALID FORMAT. WRONG MEANING.", points: ["…", "…", "…"], tag: "ISO 8000-8"}
Картинки ніколи не обрізаються: іконки вписуються цілком.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_cards  # noqa: E402
import music  # noqa: E402

W, H, FPS = 1080, 1920, 30
TOP, BOTTOM = 230, 360
SCENES = [("hook", 2.6), ("hero", 4.6), ("p1", 2.4), ("p2", 2.4), ("p3", 2.4), ("cta", 2.6)]
VERSION = "promo-v1"
ASSETS = Path(__file__).resolve().parent.parent / "site" / "assets"
ALL_ICONS = ["service-quality.webp", "service-architecture.webp", "service-bi.webp", "service-governance.webp",
             "service-data-analysis.webp", "service-consulting.webp", "service-financial-analytics.webp",
             "service-management-analytics.webp", "service-geospatial.webp"]


def ease(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


def ease_back(x):
    x = min(1.0, max(0.0, x))
    c = 1.70158
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def alpha(img, a):
    if a >= 1:
        return img
    im = img.copy()
    im.putalpha(im.getchannel("A").point(lambda v: int(v * max(0.0, a))))
    return im


def scaled(img, s):
    s = max(0.02, s)
    return img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.BILINEAR)


def text_img(lines, size, fill, kind="head", spacing=1.0):
    f = brand.font(kind, size)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    boxes = [probe.textbbox((0, 0), l, font=f) for l in lines]
    w = max(b[2] for b in boxes) + 8
    step = int(size * spacing)
    img = Image.new("RGBA", (w, step * (len(lines) - 1) + int(size * 1.2)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lines):
        d.text((0, i * step), l, font=f, fill=fill)
    return img


def fit_size(words: list[str], width: int, start: int, kind="head") -> int:
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    size = start
    while size > 40:
        f = brand.font(kind, size)
        if all(probe.textlength(w, font=f) <= width for w in words):
            return size
        size -= 6
    return size


def spec_for(cfg, article, style: dict) -> dict:
    """Зміст промо: явне поле promo або автоматично з обкладинки й слайдів."""
    p = dict(getattr(article, "promo", None) or {})
    hook = p.get("hook") or article.title
    words = [w_ for w_ in hook.upper().replace(",", "").replace(".", "").replace("?", "?").split() if w_]
    if len(words) > 4:                      # одне величезне слово на рядок, як «DATA / QUALITY»
        words = [w_ for w_ in words if len(w_) > 3][:4] or words[:4]
    lines = words
    points = p.get("points") or [c.get("title", "") for c in article.carousel][:3]
    hero = style.get("icon") or "service-quality.webp"
    k = int(hashlib.sha256(article.slug.encode()).hexdigest()[:4], 16)
    sats = [i for i in ALL_ICONS if i != hero]
    sats = [sats[(k + j * 2) % len(sats)] for j in range(4)]
    return {"hook": lines, "points": [x for x in points if x][:3], "hero": hero, "sats": sats,
            "tag": p.get("tag") or (article.description[:60] if len(article.description) <= 60 else ""),
            "cta": p.get("cta") or "More data notes every week"}


class Promo:
    def __init__(self, spec: dict, style: dict, seed: int):
        self.s = spec
        self.beat = music.beat_of(style.get("music"))
        self.bg = make_cards.background(W, H, glow=(0.5, 0.5), strength=26, grid=False).convert("RGBA")
        rng = np.random.default_rng(seed)
        self.dust = rng.uniform([0, 0], [W, H], (70, 2))
        self.dv = rng.uniform(-12, 12, (70, 2)) + [0, -14]
        self.ds = rng.uniform(1.5, 4.0, 70)
        self.hero = self._icon(spec["hero"], 440)
        self.sats = [self._icon(n, 190) for n in spec["sats"]]
        self.glow = Image.new("L", (900, 900), 0)
        gd = ImageDraw.Draw(self.glow)
        for i in range(30, 0, -1):
            r = 450 * i // 30
            gd.ellipse([450 - r, 450 - r, 450 + r, 450 + r], fill=int(110 * (1 - i / 30) ** 1.8))
        # гачок
        hl = spec["hook"]
        size = min(250, fit_size(hl, W - 140, 250))
        self.hook_words = []          # (img, x, y, delay)
        f = brand.font("head", size)
        probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        y = 900 - int(len(hl) * size * 0.92) // 2
        dly = 0.0
        for li, line in enumerate(hl):
            x = 70
            for w_ in line.split():
                col = brand.RUBY if li >= (len(hl) + 1) // 2 else brand.WHITE
                im = text_img([w_], size, col)
                self.hook_words.append((im, x, y, dly))
                x += int(probe.textlength(w_ + " ", font=f))
                dly += 0.32
            y += int(size * 0.92)
        self.hook_block_h = y
        tag = spec.get("tag") or ""
        self.tag = text_img([tag], 40, brand.SILVER, "body-semi") if tag else None
        self.points = []
        for i, ptxt in enumerate(spec["points"]):
            words = ptxt.split()
            s2 = fit_size(words, W - 180, 128)
            fl, lines = brand.fit(ptxt, "head", W - 180, s2, 60, 3)
            self.points.append((text_img([f"{i + 1:02d}"], 64, brand.RUBY), make_cards._text_block(lines, fl, brand.WHITE, 1.08)))
        self.logo = brand.logo(230)
        self.lock = brand.lockup(56)
        self.cta = make_cards._text_block([spec["cta"]], brand.font("head", 64), brand.WHITE, 1.1)
        self.handle = make_cards._text_block(["@belyakovconsult", "belyakovconsult.com"], brand.font("body-semi", 44), brand.SILVER, 1.5)

    @staticmethod
    def _icon(name, h):
        p = ASSETS / name
        im = Image.open(p).convert("RGBA")
        # м'яко прибираємо майже чорний фон, щоб іконка «висіла» в кадрі без прямокутника
        a = np.asarray(im).astype(np.float32)
        lum = a[..., :3].max(axis=2)
        a[..., 3] = np.minimum(a[..., 3], np.clip((lum - 10) * 9, 0, 255))
        im = Image.fromarray(a.astype(np.uint8), "RGBA")
        r = h / im.height
        return im.resize((int(im.width * r), h), Image.LANCZOS)

    # ---------- шари ----------
    def base(self, T, punch=0.0):
        f = self.bg.copy()
        beat = np.exp(-((T % self.beat) / 0.2))
        g = Image.new("RGBA", (900, 900), (*brand.RUBY, 0))
        g.putalpha(self.glow.point(lambda v: int(v * (0.65 + 0.35 * beat + punch))))
        f.alpha_composite(g, (W // 2 - 450, 1050 - 450 + int(30 * np.sin(T * 0.4))))
        d = ImageDraw.Draw(f)
        pos = (self.dust + self.dv * T) % [W, H]
        for (x, y), r in zip(pos, self.ds):
            d.ellipse([x - r, y - r, x + r, y + r], fill=(*brand.RUBY, 150) if r > 3.3 else (*brand.SILVER, 90))
        return f

    def constellation(self, f, T, k_in, scale=1.0, cy=1060, dim=1.0):
        """Герой у центрі, супутники на орбіті, світні лінії й іскри."""
        cx = W // 2
        n = len(self.sats)
        ang0 = T * 0.22
        pts = []
        for i in range(n):
            a = ang0 + i * 2 * np.pi / n + np.pi / 4
            rx, ry = 380 * scale, 430 * scale
            kk = ease_back((k_in - 0.15 * i) / 0.6)
            px = cx + np.cos(a) * rx * kk + (1 - kk) * np.cos(a) * 900
            py = cy + np.sin(a) * ry * kk + (1 - kk) * np.sin(a) * 900
            pts.append((px, py, kk))
        # лінії зі світінням (на половинній роздільності)
        ln = Image.new("L", (W // 2, H // 2), 0)
        ld = ImageDraw.Draw(ln)
        for px, py, kk in pts:
            if kk > 0.3:
                ld.line([cx // 2, cy // 2, px / 2, py / 2], fill=int(255 * min(1, kk) * dim), width=3)
        glow = ln.filter(ImageFilter.GaussianBlur(7)).resize((W, H), Image.BILINEAR)
        sharp = ln.resize((W, H), Image.BILINEAR)
        layer = Image.new("RGBA", (W, H), (*brand.RUBY, 0))
        layer.putalpha(Image.eval(Image.merge("L", [glow]), lambda v: min(255, v * 4)))
        f.alpha_composite(layer)
        layer2 = Image.new("RGBA", (W, H), (255, 120, 140, 0))
        layer2.putalpha(sharp)
        f.alpha_composite(layer2)
        d = ImageDraw.Draw(f)
        for j, (px, py, kk) in enumerate(pts):          # іскри: дані біжать від супутника до центру
            if kk < 0.8:
                continue
            for q in range(2):
                u = ((T * 0.9 + j * 0.27 + q * 0.5) % 1.0)
                sx, sy = px + (cx - px) * u, py + (cy - py) * u
                d.ellipse([sx - 7, sy - 7, sx + 7, sy + 7], fill=(255, 200, 210, int(230 * dim)))
        for (px, py, kk), im in zip(pts, self.sats):
            if kk <= 0:
                continue
            s = scale * (0.6 + 0.4 * min(1, kk))
            si = scaled(im, s)
            bob = int(8 * np.sin(T * 1.3 + px))
            f.alpha_composite(alpha(si, min(1, kk) * dim), (int(px - si.width / 2), int(py - si.height / 2 + bob)))
        kh = ease_back(k_in / 0.7)
        hs = scale * (0.55 + 0.45 * kh) * (1 + 0.02 * np.sin(T * 2 * np.pi / (self.beat * 2)))
        hi = scaled(self.hero, hs)
        f.alpha_composite(alpha(hi, min(1, k_in * 2) * dim), (cx - hi.width // 2, int(cy - hi.height / 2)))

    def frame(self, t):
        T = t
        bounds = np.cumsum([0] + [d for _, d in SCENES])
        si = int(np.searchsorted(bounds, t, side="right") - 1)
        si = min(si, len(SCENES) - 1)
        name, dur = SCENES[si]
        u = t - bounds[si]
        punch = 0.0
        if name == "hook":
            # удар кожного слова: короткий спалах і здригання
            for _, _, _, dl in self.hook_words:
                if 0 <= u - dl < 0.2:
                    punch = 0.5 * (1 - (u - dl) / 0.2)
        f = self.base(T, punch)
        if name == "hook":
            shake = int(punch * 18)
            for im, x, y, dl in self.hook_words:
                k = (u - dl) / 0.28
                if k <= 0:
                    continue
                s = 1.0 + 0.45 * (1 - ease_back(k))
                si_ = scaled(im, s)
                f.alpha_composite(alpha(si_, min(1, k * 2)), (int(x - (si_.width - im.width) / 2 + shake), int(y - (si_.height - im.height) / 2)))
            if self.tag and u > 1.6:
                f.alpha_composite(alpha(self.tag, ease((u - 1.6) / 0.5)), (70, self.hook_block_h + 40))
        elif name == "hero":
            k = ease(u / 0.9)                                # гачок їде вгору й зменшується
            s = 1.0 - 0.55 * k
            y0 = self.hook_words[0][2]
            for im, x, y, _ in self.hook_words:
                si_ = scaled(im, s)
                nx = 70 + (x - 70) * s
                ny = y * (1 - k) + (TOP + 130 + (y - y0) * 0.45) * k
                f.alpha_composite(si_, (int(nx), int(ny)))
            self.constellation(f, T, u / 1.6, 1.0, 1150)
            if self.tag:
                f.alpha_composite(alpha(self.tag, ease((u - 1.2) / 0.5)), (70, H - BOTTOM - 120))
        elif name in ("p1", "p2", "p3"):
            i = int(name[1]) - 1
            self.constellation(f, T, 3.0, 0.62, 1380, dim=0.45)
            if i < len(self.points):
                num, txt = self.points[i]
                kin = ease(u / 0.35)
                kout = ease((u - (dur - 0.3)) / 0.3) if name != "p3" else 0.0
                off = int((1 - kin) * W * 0.9 - kout * W * 0.9)
                blur = abs(off) > 30
                for j, (im, yy) in enumerate(((num, 520), (txt, 620))):
                    x = 90 + off + j * int(40 * (1 - kin))
                    if blur:                                   # розмиття руху: кілька напівпрозорих копій
                        for g in (-40, -20):
                            f.alpha_composite(alpha(im, 0.25), (x + g * (1 if off > 0 else -1), yy))
                    f.alpha_composite(im, (x, yy))
                bar_w = int((W - 180) * ease((u - 0.25) / 0.6))
                if bar_w > 0:
                    ImageDraw.Draw(f).rectangle([90 + off, 620 + txt.height + 30, 90 + off + bar_w, 620 + txt.height + 38], fill=(*brand.RUBY, 255))
        else:   # cta
            k = ease_back(u / 0.5)
            self.constellation(f, T, 3.0, max(0.05, 0.62 * (1 - ease(u / 0.6))), 1380, dim=max(0.0, 0.45 * (1 - u / 0.6)))
            lg = scaled(self.logo, 0.6 + 0.4 * k)
            f.alpha_composite(alpha(lg, min(1, u * 3)), ((W - lg.width) // 2, 620 - lg.height // 2))
            if u > 0.4:
                f.alpha_composite(alpha(self.cta, ease((u - 0.4) / 0.4)), ((W - self.cta.width) // 2, 820))
            if u > 0.7:
                f.alpha_composite(alpha(self.handle, ease((u - 0.7) / 0.4)), ((W - self.handle.width) // 2, 960))
        if name != "cta":                                  # знак бренду в кадрі весь час
            f.alpha_composite(self.lock, (70, TOP + 10))
        # тонка рубінова лінія прогресу
        ImageDraw.Draw(f).rectangle([0, 0, int(W * t / bounds[-1]), 8], fill=(*brand.RUBY, 255))
        return f


def fingerprint(spec, style) -> str:
    h = hashlib.sha256(VERSION.encode())
    h.update(json.dumps([spec, {k: v for k, v in (style or {}).items() if k != "k"}], sort_keys=True, ensure_ascii=False).encode())
    for mod in (Path(__file__), Path(music.__file__), Path(brand.__file__)):
        h.update(mod.read_bytes())
    return h.hexdigest()[:16]


def build(cfg, article, style: dict, out_dir: Path, seed: str, force: bool = False) -> Path | None:
    if not article.carousel or not shutil.which("ffmpeg"):
        return None
    spec = spec_for(cfg, article, style or {})
    out_dir.mkdir(parents=True, exist_ok=True)
    mp4, meta = out_dir / "promo.mp4", out_dir / "promo.json"
    fp = fingerprint(spec, style)
    if not force and mp4.exists() and meta.exists() and json.loads(meta.read_text()).get("fingerprint") == fp:
        return mp4
    pr = Promo(spec, style or {}, int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16))
    total = sum(d for _, d in SCENES)
    cuts = list(np.cumsum([d for _, d in SCENES])[:-1])
    wav = out_dir / "promo.music.tmp.wav"
    music.generate(total, cuts, seed + "#promo", wav, (style or {}).get("music") or "pulse")
    tmp = out_dir / "promo.tmp.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
           "-movflags", "+faststart", str(tmp)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    cover_t = SCENES[0][1] + 2.4                # кадр-обкладинка: герой і заголовок уже на місці
    try:
        for i in range(int(total * FPS)):
            t = i / FPS
            img = pr.frame(t).convert("RGB")
            if abs(t - cover_t) < 0.5 / FPS:
                img.save(out_dir / "promo-cover.jpg", "JPEG", quality=92)
            proc.stdin.write(img.tobytes())
    finally:
        proc.stdin.close()
        code = proc.wait()
    if code != 0:
        raise RuntimeError(f"ffmpeg завершився з кодом {code}")
    tmp.replace(mp4)
    wav.unlink(missing_ok=True)
    meta.write_text(json.dumps({"fingerprint": fp, "seconds": total, "spec": spec}, ensure_ascii=False, indent=2) + "\n")
    return mp4
