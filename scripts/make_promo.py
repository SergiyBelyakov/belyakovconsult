"""Промо-ролики англійською: кінетична типографіка + 3D-композиція з дизайн-системи.

Два формати з одного рушія:
  reels    1080×1920 (9:16)  англійські Reels в Instagram          → promo.mp4, promo-cover.jpg
  linkedin 1080×1350 (4:5)   тригер-відео для сторінки в LinkedIn → linkedin.mp4, linkedin-cover.jpg
LinkedIn вмикає відео без звуку, тож увесь зміст читається з екрана; музика лише підсилює.

Сцени (~17 с, 30 fps):
  1. Гачок (0–2,6 с): 2–4 величезні слова капсом «влітають» по одному, друга половина рубінова, кадр здригається.
  2. Герой (2,6–7,2 с): центральна 3D-іконка наближається, навколо вилітають 4 інші іконки, світні лінії
     з'єднують їх із центром, по лініях біжать «іскри» даних; гачок зменшується в заголовок угорі.
  3. Тези (7,2–14,4 с): три тези великим шрифтом, перехід «свайпом» з розмиттям руху.
  4. Заклик (14,4–17 с): логотип, заклик (для LinkedIn питання в коментарі), адреса сайту.
Зміст береться зі статті чи епізоду автоматично; сильніше задати явно полем `promo:` в статті чи епізоді:
  promo:
    hook: "Valid format. Wrong payment."
    tag: "ISO 8000-8 · three levels of data quality"
    points: [{label: Syntax, text: "Does it match the format?"}, "…", "…"]
    cta: "Which level does your register actually measure?"
Картинки ніколи не обрізаються: іконки вписуються цілком.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_cards  # noqa: E402
import music  # noqa: E402

FPS = 30
SCENES = [("hook", 2.6), ("hero", 4.6), ("p1", 2.4), ("p2", 2.4), ("p3", 2.4), ("cta", 2.6)]
VERSION = "promo-v2"
ASSETS = Path(__file__).resolve().parent.parent / "site" / "assets"
ALL_ICONS = ["service-quality.webp", "service-architecture.webp", "service-bi.webp", "service-governance.webp",
             "service-data-analysis.webp", "service-consulting.webp", "service-financial-analytics.webp",
             "service-management-analytics.webp", "service-geospatial.webp"]

# Розкладка кожного формату (у пікселях кадру)
FORMATS = {
    "reels": dict(W=1080, H=1920, top=230, bottom=360, hook_cy=900, max_hook=250, glow_cy=1050,
                  hero_cy=1150, hero_scale=1.0, orbit=(380, 430), dim_cy=1380, dim_scale=0.62,
                  head_y=360, head_scale=0.45, tag_y=1440, pt_num_y=520, pt_txt_y=620, pt_size=128,
                  logo_y=620, cta_y=820, handle_y=960, handle=["@belyakovconsult", "belyakovconsult.com"],
                  files=("promo.mp4", "promo-cover.jpg", "promo.json")),
    "linkedin": dict(W=1080, H=1350, top=70, bottom=80, hook_cy=650, max_hook=215, glow_cy=800,
                     hero_cy=830, hero_scale=0.62, orbit=(400, 300), dim_cy=1090, dim_scale=0.46,
                     head_y=175, head_scale=0.34, tag_y=1205, pt_num_y=330, pt_txt_y=410, pt_size=104,
                     logo_y=470, cta_y=630, handle_y=880, handle=["belyakovconsult.com"],
                     cover_t=2.45,      # обкладинка LinkedIn: кадр із великим гачком (стрічка без звуку)
                     files=("linkedin.mp4", "linkedin-cover.jpg", "linkedin.json")),
}


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
    words = [w_ for w_ in hook.upper().replace(",", "").replace(".", "").split() if w_]
    if len(words) > 4:                      # одне величезне слово на рядок, як «DATA / QUALITY»
        words = [w_ for w_ in words if len(w_) > 3][:4] or words[:4]
    points = p.get("points") or [c.get("title", "") for c in article.carousel][:3]
    hero = style.get("icon") or "service-quality.webp"
    k = int(hashlib.sha256(article.slug.encode()).hexdigest()[:4], 16)
    sats = [i for i in ALL_ICONS if i != hero]
    sats = [sats[(k + j * 2) % len(sats)] for j in range(4)]
    return {"hook": words, "points": [x for x in points if x][:3], "hero": hero, "sats": sats,
            "tag": p.get("tag") or (article.description if len(article.description) <= 60 else ""),
            "cta": p.get("cta") or "More data notes every week"}


class Promo:
    def __init__(self, spec: dict, style: dict, seed: int, fmt: str = "reels"):
        L = self.L = FORMATS[fmt]
        self.W, self.H = W, H = L["W"], L["H"]
        self.s = spec
        self.beat = music.beat_of(style.get("music"))
        self.bg = make_cards.background(W, H, glow=(0.5, 0.5), strength=26, grid=False).convert("RGBA")
        rng = np.random.default_rng(seed)
        n_dust = int(70 * H / 1920)
        self.dust = rng.uniform([0, 0], [W, H], (n_dust, 2))
        self.dv = rng.uniform(-12, 12, (n_dust, 2)) + [0, -14]
        self.ds = rng.uniform(1.5, 4.0, n_dust)
        self.hero = self._icon(spec["hero"], 440)
        self.sats = [self._icon(n, 190) for n in spec["sats"]]
        self.glow = Image.new("L", (900, 900), 0)
        gd = ImageDraw.Draw(self.glow)
        for i in range(30, 0, -1):
            r = 450 * i // 30
            gd.ellipse([450 - r, 450 - r, 450 + r, 450 + r], fill=int(110 * (1 - i / 30) ** 1.8))
        # гачок: одне слово на рядок, друга половина рубінова
        hl = spec["hook"]
        size = min(L["max_hook"], fit_size(hl, W - 140, L["max_hook"]))
        self.hook_words = []          # (img, x, y, delay)
        y = L["hook_cy"] - int(len(hl) * size * 0.92) // 2
        dly = 0.0
        for li, word in enumerate(hl):
            col = brand.RUBY if li >= (len(hl) + 1) // 2 else brand.WHITE
            self.hook_words.append((text_img([word], size, col), 70, y, dly))
            dly += 0.32
            y += int(size * 0.92)
        self.hook_block_h = y
        tag = spec.get("tag") or ""
        if tag:
            ft, tl = brand.fit(tag, "body-semi", W - 140, 40, 28, 2)
            self.tag = make_cards._text_block(tl, ft, brand.SILVER, 1.3)
        else:
            self.tag = None
        self.points = []
        for i, pt in enumerate(spec["points"]):
            label = pt.get("label", "") if isinstance(pt, dict) else ""
            ptxt = pt.get("text", "") if isinstance(pt, dict) else str(pt)
            words = ptxt.split()
            s2 = fit_size(words, W - 180, L["pt_size"])
            fl, lines = brand.fit(ptxt, "head", W - 180, s2, 56, 3)
            head = f"{i + 1:02d}" + (f"  ·  {label.upper()}" if label else "")
            self.points.append((text_img([head], 54 if label else 64, brand.RUBY), make_cards._text_block(lines, fl, brand.WHITE, 1.08)))
        self.logo = brand.logo(230 if H > 1500 else 190)
        self.lock = brand.lockup(56)
        fc, cl = brand.fit(spec["cta"], "head", W - 160, 64, 44, 3)
        self.cta = make_cards._text_block(cl, fc, brand.WHITE, 1.12)
        self.handle = make_cards._text_block(L["handle"], brand.font("body-semi", 44), brand.SILVER, 1.5)

    @staticmethod
    def _icon(name, h):
        im = Image.open(ASSETS / name).convert("RGBA")
        # м'яко прибираємо майже чорний фон, щоб іконка «висіла» в кадрі без прямокутника
        a = np.asarray(im).astype(np.float32)
        lum = a[..., :3].max(axis=2)
        a[..., 3] = np.minimum(a[..., 3], np.clip((lum - 10) * 9, 0, 255))
        im = Image.fromarray(a.astype(np.uint8), "RGBA")
        r = h / im.height
        return im.resize((int(im.width * r), h), Image.LANCZOS)

    # ---------- шари ----------
    def base(self, T, punch=0.0):
        W, H = self.W, self.H
        f = self.bg.copy()
        beat = np.exp(-((T % self.beat) / 0.2))
        g = Image.new("RGBA", (900, 900), (*brand.RUBY, 0))
        g.putalpha(self.glow.point(lambda v: int(v * (0.65 + 0.35 * beat + punch))))
        f.alpha_composite(g, (W // 2 - 450, self.L["glow_cy"] - 450 + int(30 * np.sin(T * 0.4))))
        d = ImageDraw.Draw(f)
        pos = (self.dust + self.dv * T) % [W, H]
        for (x, y), r in zip(pos, self.ds):
            d.ellipse([x - r, y - r, x + r, y + r], fill=(*brand.RUBY, 150) if r > 3.3 else (*brand.SILVER, 90))
        return f

    def constellation(self, f, T, k_in, scale, cy, dim=1.0, orbit=1.0):
        """Герой у центрі, супутники на орбіті, світні лінії й іскри."""
        W, H = self.W, self.H
        cx = W // 2
        n = len(self.sats)
        ang0 = T * 0.22
        rx0, ry0 = self.L["orbit"]
        pts = []
        for i in range(n):
            a = ang0 + i * 2 * np.pi / n + np.pi / 4
            rx, ry = rx0 * orbit, ry0 * orbit
            kk = ease_back((k_in - 0.15 * i) / 0.6)
            px = cx + np.cos(a) * rx * kk + (1 - kk) * np.cos(a) * 900
            py = cy + np.sin(a) * ry * kk + (1 - kk) * np.sin(a) * 900
            pts.append((px, py, kk))
        ln = Image.new("L", (W // 2, H // 2), 0)              # лінії зі світінням (половинна роздільність)
        ld = ImageDraw.Draw(ln)
        for px, py, kk in pts:
            if kk > 0.3:
                ld.line([cx // 2, cy // 2, px / 2, py / 2], fill=int(255 * min(1, kk) * dim), width=3)
        glow = ln.filter(ImageFilter.GaussianBlur(7)).resize((W, H), Image.BILINEAR)
        sharp = ln.resize((W, H), Image.BILINEAR)
        layer = Image.new("RGBA", (W, H), (*brand.RUBY, 0))
        layer.putalpha(glow.point(lambda v: min(255, v * 4)))
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
        L, W = self.L, self.W
        T = t
        bounds = np.cumsum([0] + [d for _, d in SCENES])
        si = min(int(np.searchsorted(bounds, t, side="right") - 1), len(SCENES) - 1)
        name, dur = SCENES[si]
        u = t - bounds[si]
        punch = 0.0
        if name == "hook":
            for _, _, _, dl in self.hook_words:       # удар кожного слова: короткий спалах і здригання
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
                f.alpha_composite(alpha(self.tag, ease((u - 1.6) / 0.5)), (70, self.hook_block_h + 30))
        elif name == "hero":
            k = ease(u / 0.9)                                # гачок їде вгору й зменшується в заголовок
            s = 1.0 - (1 - L["head_scale"]) * k
            y0 = self.hook_words[0][2]
            for im, x, y, _ in self.hook_words:
                si_ = scaled(im, s)
                ny = y * (1 - k) + (L["head_y"] + (y - y0) * L["head_scale"]) * k
                f.alpha_composite(si_, (int(70 + (x - 70) * s), int(ny)))
            self.constellation(f, T, u / 1.6, L["hero_scale"], L["hero_cy"])
            if self.tag:
                f.alpha_composite(alpha(self.tag, ease((u - 1.2) / 0.5)), (70, L["tag_y"]))
        elif name in ("p1", "p2", "p3"):
            i = int(name[1]) - 1
            self.constellation(f, T, 3.0, L["dim_scale"], L["dim_cy"], dim=0.45, orbit=L["dim_scale"] / L["hero_scale"] * 0.8)
            if i < len(self.points):
                num, txt = self.points[i]
                kin = ease(u / 0.35)
                kout = ease((u - (dur - 0.3)) / 0.3) if name != "p3" else 0.0
                off = int((1 - kin) * W * 0.9 - kout * W * 0.9)
                blur = abs(off) > 30
                for j, (im, yy) in enumerate(((num, L["pt_num_y"]), (txt, L["pt_txt_y"]))):
                    x = 90 + off + j * int(40 * (1 - kin))
                    if blur:                                   # розмиття руху: кілька напівпрозорих копій
                        for g in (-40, -20):
                            f.alpha_composite(alpha(im, 0.25), (x + g * (1 if off > 0 else -1), yy))
                    f.alpha_composite(im, (x, yy))
                bar_w = int((W - 180) * ease((u - 0.25) / 0.6))
                if bar_w > 0:
                    by = L["pt_txt_y"] + txt.height + 30
                    ImageDraw.Draw(f).rectangle([90 + off, by, 90 + off + bar_w, by + 8], fill=(*brand.RUBY, 255))
        else:   # cta
            k = ease_back(u / 0.5)
            fade = max(0.0, 1 - ease(u / 0.45))
            if fade > 0.12:                                # композиція згортається й зникає, без залишків
                self.constellation(f, T, 3.0, L["dim_scale"] * fade, L["dim_cy"], dim=0.45 * fade,
                                   orbit=L["dim_scale"] / L["hero_scale"] * 0.8 * fade)
            lg = scaled(self.logo, 0.6 + 0.4 * k)
            f.alpha_composite(alpha(lg, min(1, u * 3)), ((W - lg.width) // 2, L["logo_y"] - lg.height // 2))
            if u > 0.4:
                f.alpha_composite(alpha(self.cta, ease((u - 0.4) / 0.4)), ((W - self.cta.width) // 2, L["cta_y"]))
            if u > 0.7:
                f.alpha_composite(alpha(self.handle, ease((u - 0.7) / 0.4)), ((W - self.handle.width) // 2, L["handle_y"]))
        if name != "cta":                                  # знак бренду в кадрі весь час
            f.alpha_composite(self.lock, (70, L["top"] + 10))
        ImageDraw.Draw(f).rectangle([0, 0, int(W * t / bounds[-1]), 8], fill=(*brand.RUBY, 255))   # прогрес
        return f


def fingerprint(spec, style, fmt) -> str:
    h = hashlib.sha256(VERSION.encode())
    h.update(json.dumps([spec, fmt, {k: v for k, v in (style or {}).items() if k != "k"}], sort_keys=True, ensure_ascii=False).encode())
    for mod in (Path(__file__), Path(music.__file__), Path(brand.__file__)):
        h.update(mod.read_bytes())
    return h.hexdigest()[:16]


def build(cfg, article, style: dict, out_dir: Path, seed: str, force: bool = False, fmt: str = "reels") -> Path | None:
    if not article.carousel or not shutil.which("ffmpeg"):
        return None
    L = FORMATS[fmt]
    W, H = L["W"], L["H"]
    spec = spec_for(cfg, article, style or {})
    out_dir.mkdir(parents=True, exist_ok=True)
    name_mp4, name_cover, name_meta = L["files"]
    mp4, meta = out_dir / name_mp4, out_dir / name_meta
    fp = fingerprint(spec, style, fmt)
    if not force and mp4.exists() and meta.exists() and json.loads(meta.read_text()).get("fingerprint") == fp:
        return mp4
    pr = Promo(spec, style or {}, int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16), fmt)
    total = sum(d for _, d in SCENES)
    cuts = list(np.cumsum([d for _, d in SCENES])[:-1])
    wav = out_dir / f"{fmt}.music.tmp.wav"
    music.generate(total, cuts, seed + "#promo", wav, (style or {}).get("music") or "pulse")
    tmp = out_dir / f"{fmt}.tmp.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
           "-movflags", "+faststart", str(tmp)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    cover_t = L.get("cover_t", SCENES[0][1] + 2.4)   # кадр-обкладинка: Reels герой і заголовок, LinkedIn гачок
    try:
        for i in range(int(total * FPS)):
            t = i / FPS
            img = pr.frame(t).convert("RGB")
            if abs(t - cover_t) < 0.5 / FPS:
                img.save(out_dir / name_cover, "JPEG", quality=92)
            proc.stdin.write(img.tobytes())
    finally:
        proc.stdin.close()
        code = proc.wait()
    if code != 0:
        raise RuntimeError(f"ffmpeg завершився з кодом {code}")
    tmp.replace(mp4)
    wav.unlink(missing_ok=True)
    meta.write_text(json.dumps({"fingerprint": fp, "format": fmt, "seconds": total, "spec": spec}, ensure_ascii=False, indent=2) + "\n")
    return mp4
