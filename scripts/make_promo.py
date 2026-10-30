"""Промо-ролики англійською у преміальному стилі: типографіка, один 3D-об'єкт, фірмова хвиля.

Два формати з одного рушія:
  reels    1080×1920 (9:16)  англійські Reels в Instagram          → promo.mp4, promo-cover.jpg
  linkedin 1080×1350 (4:5)   тригер-відео для сторінки в LinkedIn → linkedin.mp4, linkedin-cover.jpg
LinkedIn вмикає відео без звуку, тож увесь зміст читається з екрана; музика лише підсилює.

Принципи (premium-v3): стриманість і повітря; рух з довгим загасанням (expo/quint), без тремтіння,
спалахів і частинок; рубін лише як акцент (одне слово, тонка лінія, позначка); один 3D-об'єкт із
«фокусуванням» як у кіно; фірмова хвиля з банера дизайн-системи як підкладка; легке плівкове зерно
й м'який відблиск світла.

Сцени (~18 с, 30 fps):
  1. Гачок (0–3,2 с): тег дрібними літерами, потім 2–4 величезні слова виїжджають з-під маски,
     міжлітерна відстань стискається; під блоком малюється тонка рубінова лінія.
  2. Об'єкт (3,2–7,2 с): гачок плавно стає заголовком угорі; 3D-об'єкт з'являється розмитим,
     фокусується й повільно наближається над хвилею.
  3. Тези (7,2–15 с): позначка рівня, теза рядок за рядком з-під маски, лінія-прогрес;
     на фоні великий контурний номер ледь помітним шаром.
  4. Заклик (15–18 с): знак бренду, питання до аудиторії, адреса сайту, тонка лінія.
Зміст береться зі статті чи епізоду автоматично; сильніше задати явно полем `promo:`:
  promo:
    hook: "Valid format. Wrong payment."
    tag: "ISO 8000-8: three levels of data quality"
    points: [{label: Syntax, text: "Does the value match the format?"}, "…", "…"]
    cta: "Which level does your register actually measure?"
Картинки ніколи не обрізаються: об'єкт і хвиля вписуються цілком, краї хвилі м'яко розчиняються.
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
SCENES = [("hook", 3.2), ("object", 4.0), ("p1", 2.6), ("p2", 2.6), ("p3", 2.6), ("cta", 3.0)]
VERSION = "promo-v3-premium"
ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "site" / "assets"
BG_DIR = ROOT / "brand-assets" / "bg"
CALM_MUSIC = ("cinematic", "ambient", "analytic")      # преміальний ролик: лише спокійні стилі

FORMATS = {
    "reels": dict(W=1080, H=1920, top=230, bottom=360, M=84, hook_cy=900, max_hook=230,
                  head_y=330, head_scale=0.40, obj_cy=1150, obj_h=620, pt_cy=900, pt_size=112,
                  cta_cy=900, tag_bottom=1460,
                  files=("promo.mp4", "promo-cover.jpg", "promo.json")),
    "linkedin": dict(W=1080, H=1350, top=64, bottom=64, M=84, hook_cy=650, max_hook=200,
                     head_y=150, head_scale=0.38, obj_cy=850, obj_h=500, pt_cy=600, pt_size=96,
                     cta_cy=640, tag_bottom=1230, cover_t=2.9,
                     files=("linkedin.mp4", "linkedin-cover.jpg", "linkedin.json")),
}


# ---------- криві руху ----------
def clamp(x):
    return min(1.0, max(0.0, x))


def expo(x):                      # швидкий старт, дуже довге загасання
    x = clamp(x)
    return 1.0 if x >= 1 else 1 - 2 ** (-10 * x)


def quint_io(x):                  # плавно розганяється й плавно зупиняється
    x = clamp(x)
    return 16 * x ** 5 if x < 0.5 else 1 - (-2 * x + 2) ** 5 / 2


def with_alpha(img, a):
    if a >= 0.999:
        return img
    im = img.copy()
    im.putalpha(im.getchannel("A").point(lambda v: int(v * max(0.0, a))))
    return im


def scaled(img, s):
    s = max(0.02, s)
    return img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.LANCZOS if s < 1 else Image.BICUBIC)


def tracked(text, size, fill, kind="head", tracking=0.0):
    """Текст із заданою міжлітерною відстанню (px), для анімації «стискання» літер."""
    f = brand.font(kind, size)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    adv = [probe.textlength(ch, font=f) for ch in text]
    w = int(sum(adv) + tracking * max(0, len(text) - 1)) + 12
    img = Image.new("RGBA", (max(1, w), int(size * 1.22)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = 0.0
    for ch, a in zip(text, adv):
        d.text((x, 0), ch, font=f, fill=fill)
        x += a + tracking
    return img


def masked(layer, img, x, y, k, rise=1.0):
    """Поява з-під маски: зображення виїжджає знизу у власні межі (видно лише всередині)."""
    if k <= 0:
        return
    h = img.height
    off = int((1 - k) * h * rise)
    if off >= h:
        return
    layer.alpha_composite(img.crop((0, 0, img.width, h - off)), (int(x), int(y + off)))


def fit_size(words, width, start, kind="head"):
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    size = start
    while size > 40:
        f = brand.font(kind, size)
        if all(probe.textlength(w, font=f) <= width for w in words):
            return size
        size -= 4
    return size


def spec_for(cfg, article, style: dict) -> dict:
    """Зміст промо: явне поле promo або автоматично з обкладинки й слайдів."""
    p = dict(getattr(article, "promo", None) or {})
    hook = p.get("hook") or article.title
    words = [w_ for w_ in hook.upper().replace(",", "").replace(".", "").split() if w_]
    if len(words) > 4:                      # одне велике слово на рядок
        words = [w_ for w_ in words if len(w_) > 3][:4] or words[:4]
    points = p.get("points") or [c.get("title", "") for c in article.carousel][:3]
    return {"hook": words, "points": [x for x in points if x][:3],
            "object": style.get("icon") or "service-quality.webp",
            "wave": style.get("wave") or "wave-2.jpg",
            "tag": p.get("tag") or (article.description if len(article.description) <= 60 else ""),
            "cta": p.get("cta") or "More data notes every week"}


class Promo:
    def __init__(self, spec: dict, style: dict, seed: int, fmt: str = "reels"):
        L = self.L = FORMATS[fmt]
        W, H = self.W, self.H = L["W"], L["H"]
        self.M = L["M"]
        self.s = spec
        self.total = sum(d for _, d in SCENES)
        rng = np.random.default_rng(seed)
        # фон: графіт із ледь світлішим «сталевим» центром і віньєткою (без рубінового світіння)
        yy, xx = np.mgrid[0:H, 0:W]
        r = np.sqrt(((xx - W * 0.5) / (W * 0.9)) ** 2 + ((yy - H * 0.42) / (H * 0.7)) ** 2)
        mix = np.clip(1 - r, 0, 1) ** 1.6
        base = np.zeros((H, W, 3), np.float32)
        for c in range(3):
            base[..., c] = brand.GRAPHITE[c] + (brand.STEEL[c] + 6 - brand.GRAPHITE[c]) * mix
        self.bg = Image.fromarray(base.clip(0, 255).astype(np.uint8), "RGB").convert("RGBA")
        # тонке зерно-фактура: нерухоме (шум, що змінюється щокадру, роздуває файл у рази)
        n = rng.normal(128, 40, (H // 2, W // 2)).clip(0, 255).astype(np.uint8)
        g = Image.fromarray(n, "L").resize((W, H), Image.BILINEAR)
        gl = Image.new("RGBA", (W, H), (255, 255, 255, 0))
        gl.putalpha(g.point(lambda v: max(0, v - 128) // 14))
        self.grain = [gl]
        # м'який відблиск: широка діагональна смуга світла
        sw = Image.new("L", (700, 10), 0)
        for x in range(700):
            sw.putpixel((x, 0), int(15 * np.exp(-((x - 350) / 160) ** 2)))
        sw = sw.resize((700, H * 2), Image.BILINEAR).rotate(-18, expand=True, resample=Image.BICUBIC)
        self.sweep = Image.new("RGBA", sw.size, (255, 255, 255, 0))
        self.sweep.putalpha(sw)
        # хвиля з банера дизайн-системи: вписана по ширині, краї розчиняються (картинка не обрізається)
        self.wave = None
        wp = BG_DIR / spec["wave"]
        if wp.exists():
            im = Image.open(wp).convert("RGB")
            im = im.resize((W, int(im.height * W / im.width)), Image.LANCZOS).convert("RGBA")
            arr = np.asarray(im).astype(np.float32)
            lum = arr[..., :3].max(axis=2)
            m = np.clip((lum - 16) / 70, 0, 1)                               # світяться лише нитки хвилі, темний фон зникає
            ty = np.linspace(0, 1, im.height)
            m *= np.clip(ty / 0.30, 0, 1)[:, None] ** 1.5                     # верх розчиняється
            tx = np.linspace(0, 1, im.width)
            m *= np.clip(np.minimum(tx, 1 - tx) / 0.08, 0, 1)[None, :]        # бічні краї
            im.putalpha(Image.fromarray((m * 255).astype(np.uint8), "L"))
            self.wave = im
        # 3D-об'єкт: без темного фону, кеш розмиття для «фокусування»
        self.obj = self._object(spec["object"], L["obj_h"])
        self._blur = {}
        # гачок
        hl = spec["hook"]
        self.hook_size = size = min(L["max_hook"], fit_size(hl, W - 2 * self.M - 30, L["max_hook"]))
        self.line_h = int(size * 0.9)
        self.hook_y0 = L["hook_cy"] - (self.line_h * len(hl)) // 2
        self.hook_colors = [brand.RUBY if i >= (len(hl) + 1) // 2 else brand.WHITE for i in range(len(hl))]
        self._tcache = {}
        self.tag = tracked(spec["tag"].upper(), 30 if H > 1500 else 28, brand.SILVER, "body-semi", 3.0) if spec.get("tag") else None
        # тези
        self.points = []
        for i, pt in enumerate(spec["points"]):
            label = pt.get("label", "") if isinstance(pt, dict) else ""
            text = pt.get("text", "") if isinstance(pt, dict) else str(pt)
            s2 = fit_size(text.split(), W - 2 * self.M, L["pt_size"])
            fl, lines = brand.fit(text, "head", W - 2 * self.M, s2, 56, 3)
            imgs = [make_cards._text_block([ln], fl, brand.WHITE, 1.0) for ln in lines]
            lab = tracked((f"{i + 1:02d}" + (f"  /  {label}" if label else "")).upper(), 30, brand.RUBY, "body-semi", 4.0)
            num = Image.new("RGBA", (900, 760), (0, 0, 0, 0))
            ImageDraw.Draw(num).text((0, 0), f"{i + 1:02d}", font=brand.font("head", 640), fill=(0, 0, 0, 0),
                                     stroke_width=3, stroke_fill=(*brand.WHITE, 26))
            self.points.append((lab, imgs, int(fl.size * 1.08), num.crop(num.getbbox() or (0, 0, 1, 1))))
        # заклик
        self.lock = brand.lockup(96 if H > 1500 else 84)
        self.small_lock = brand.lockup(48)
        fc, cl = brand.fit(spec["cta"], "head", W - 2 * self.M, 76 if H > 1500 else 68, 44, 3)
        self.cta = [make_cards._text_block([ln], fc, brand.WHITE, 1.0) for ln in cl]
        self.cta_lh = int(fc.size * 1.12)
        self.site = tracked("BELYAKOVCONSULT.COM", 30, brand.SILVER, "body-semi", 3.0)

    @staticmethod
    def _object(name, h):
        im = Image.open(ASSETS / name).convert("RGBA")
        a = np.asarray(im).astype(np.float32)
        lum = a[..., :3].max(axis=2)
        a[..., 3] = np.minimum(a[..., 3], np.clip((lum - 10) * 9, 0, 255))
        hh, ww = a.shape[:2]                                     # м'які краї: жодної прямої межі відблиску
        fy = np.clip(np.minimum(np.arange(hh), hh - 1 - np.arange(hh)) / (hh * 0.14), 0, 1) ** 1.6
        fx = np.clip(np.minimum(np.arange(ww), ww - 1 - np.arange(ww)) / (ww * 0.10), 0, 1) ** 1.6
        a[..., 3] *= fy[:, None] * fx[None, :]
        im = Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")
        r = h / im.height
        return im.resize((int(im.width * r), h), Image.LANCZOS)

    def _word(self, i, tracking):
        key = (i, int(round(tracking)))
        if key not in self._tcache:
            self._tcache[key] = tracked(self.s["hook"][i], self.hook_size, self.hook_colors[i], "head", key[1])
        return self._tcache[key]

    def _obj_blur(self, r):
        r = round(r * 2) / 2
        if r <= 0:
            return self.obj
        if r not in self._blur:
            self._blur[r] = self.obj.filter(ImageFilter.GaussianBlur(r))
        return self._blur[r]

    # ---------- кадр ----------
    def frame(self, t):
        L, W, H, M = self.L, self.W, self.H, self.M
        bounds = np.cumsum([0] + [d for _, d in SCENES])
        si = min(int(np.searchsorted(bounds, t, side="right") - 1), len(SCENES) - 1)
        name, dur = SCENES[si]
        u = t - bounds[si]
        f = self.bg.copy()
        # хвиля: з'являється разом з об'єктом і лишається підкладкою; повільно дихає по горизонталі
        if self.wave is not None:
            wk = clamp((t - bounds[1] + 0.4) / 1.6)
            wa = 0.0 if t < bounds[1] - 0.4 else (0.85 * quint_io(wk))
            if name == "cta":
                wa = 0.85 + 0.15 * quint_io(u / 1.5)
            if wa > 0:
                dx = int(18 * np.sin(t * 0.35))
                f.alpha_composite(with_alpha(self.wave, wa), (dx, H - self.wave.height))
        # відблиск світла проходить кадром раз на ~6 с
        sx = int(((t / 6.0) % 1.0) * (W + self.sweep.width * 2)) - self.sweep.width
        f.alpha_composite(self.sweep, (sx, (H - self.sweep.height) // 2))

        if name in ("hook", "object"):
            self._hook(f, t, name, u)
        if name == "object" or (name == "p1" and u < 0.6):
            self._object_layer(f, name, u)
        if name == "p1" and u < 0.5:                                  # заголовок плавно відходить угору й тане
            if not hasattr(self, "_head_layer"):
                self._head_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                self._hook(self._head_layer, 0, "object", SCENES[1][1] - 0.05)
            k = quint_io(u / 0.5)
            f.alpha_composite(with_alpha(self._head_layer, 1 - k), (0, -int(40 * k)))
        if name in ("p1", "p2", "p3"):
            self._point(f, int(name[1]) - 1, u, dur)
        if name == "cta":
            self._cta(f, u)
        if name != "cta":
            a = clamp(t / 0.8) if name == "hook" else 1.0
            f.alpha_composite(with_alpha(self.small_lock, 0.9 * a), (M, L["top"] + 12))
        f.alpha_composite(self.grain[int(t * FPS) % len(self.grain)])
        ImageDraw.Draw(f).rectangle([0, 0, int(W * t / self.total), 3], fill=(*brand.RUBY, 255))   # тонкий прогрес
        return f

    def _hook(self, f, t, name, u):
        L, M = self.L, self.M
        n = len(self.s["hook"])
        if name == "hook":
            if self.tag is not None:                                   # тег першим, дрібно й розріджено
                masked(f, with_alpha(self.tag, 0.95), M, self.hook_y0 - 70, expo(u / 0.9), 0.8)
            for i in range(n):
                k = expo((u - 0.25 - i * 0.14) / 0.9)
                tr = self.hook_size * 0.06 * (1 - expo((u - 0.25 - i * 0.14) / 1.6))
                masked(f, self._word(i, tr), M, self.hook_y0 + i * self.line_h, k)
            lw = int(240 * expo((u - 0.25 - n * 0.14 - 0.2) / 1.0))      # тонка рубінова лінія під блоком
            if lw > 0:
                ly = self.hook_y0 + (n - 1) * self.line_h + int(self.hook_size * 1.08) + 18
                ImageDraw.Draw(f).rectangle([M, ly, M + lw, ly + 5], fill=(*brand.RUBY, 255))
            return
        # object: гачок плавно стає заголовком угорі, тег над ним тане
        if self.tag is not None and u < 0.45:
            f.alpha_composite(with_alpha(self.tag, 1 - quint_io(u / 0.45)), (M, self.hook_y0 - 70 - int(30 * u)))
        k = quint_io(u / 1.1)
        s = 1 - (1 - L["head_scale"]) * k
        y0 = self.hook_y0 * (1 - k) + L["head_y"] * k
        for i in range(n):
            im = scaled(self._word(i, 0), s)
            f.alpha_composite(im, (M, int(y0 + i * self.line_h * s)))
        ly = int(y0 + ((n - 1) * self.line_h + self.hook_size * 1.08 + 18) * s)
        ImageDraw.Draw(f).rectangle([M, ly, M + int(240 * s), ly + max(2, int(5 * s))], fill=(*brand.RUBY, 255))
        if self.tag is not None:                                       # тег стає підзаголовком під лінією
            ta = expo((u - 0.9) / 0.9)
            if ta > 0:
                masked(f, self.tag, M, ly + 26, ta, 0.8)

    def _object_layer(self, f, name, u):
        L, W = self.L, self.W
        if name == "object":
            k = expo((u - 0.35) / 1.4)                                  # фокусування й поява
            blur = 16 * (1 - k)
            sc = (0.9 + 0.1 * k) * (1 + 0.035 * quint_io(u / 4.0))     # далі повільне наближення
            a = clamp((u - 0.35) / 0.6)
        else:                                                          # виходить із фокусу, тане
            k2 = quint_io(u / 0.6)
            blur = 14 * k2
            sc = 1.035 + 0.04 * k2
            a = 1 - k2
        if a <= 0:
            return
        im = scaled(self._obj_blur(blur), sc)
        bob = 6 * np.sin((u + 1.3) * 1.1)
        f.alpha_composite(with_alpha(im, a), ((W - im.width) // 2, int(L["obj_cy"] - im.height / 2 + bob)))

    def _point(self, f, i, u, dur):
        L, W, M = self.L, self.W, self.M
        if i >= len(self.points):
            return
        lab, imgs, lh, num = self.points[i]
        out = quint_io((u - (dur - 0.45)) / 0.45)                    # кожна теза йде вгору й тане перед наступною сценою
        if i == 0:
            u -= 0.25                                                  # перша теза чекає, поки розтане заголовок
        block_h = lab.height + 34 + lh * len(imgs) + 40
        y0 = L["pt_cy"] - block_h // 2 - int(60 * out)
        # великий контурний номер на фоні, ледь помітний, повільно пливе вгору
        na = expo(u / 1.2) * (1 - out)
        if na > 0:
            f.alpha_composite(with_alpha(num, na * 0.8), (W - int(num.width * 0.62), int(L["pt_cy"] - num.height * 0.35 - 30 * u)))
        masked(f, with_alpha(lab, 1 - out), M, y0, expo(u / 0.8), 0.9)
        for j, im in enumerate(imgs):
            masked(f, with_alpha(im, 1 - out), M, y0 + lab.height + 34 + j * lh, expo((u - 0.12 - j * 0.1) / 0.9))
        bw = int((W - 2 * M) * quint_io((u - 0.3) / (dur - 0.6)))     # лінія-прогрес тези
        if bw > 0:
            by = y0 + lab.height + 34 + lh * len(imgs) + 28
            d = ImageDraw.Draw(f)
            d.rectangle([M, by, W - M, by + 1], fill=(*brand.LINE, int(255 * (1 - out))))
            d.rectangle([M, by - 1, M + bw, by + 2], fill=(*brand.RUBY, int(255 * (1 - out))))

    def _cta(self, f, u):
        L, W, M = self.L, self.W, self.M
        n = len(self.cta)
        block = self.lock.height + 70 + self.cta_lh * n + 50 + self.site.height
        y = L["cta_cy"] - block // 2
        masked(f, self.lock, (W - self.lock.width) // 2, y, expo(u / 0.9), 0.7)
        y += self.lock.height + 70
        for j, im in enumerate(self.cta):
            masked(f, im, (W - im.width) // 2, y + j * self.cta_lh, expo((u - 0.35 - j * 0.12) / 0.9))
        y += self.cta_lh * n + 24
        lw = int(200 * expo((u - 0.9) / 0.9))
        if lw > 0:
            ImageDraw.Draw(f).rectangle([(W - lw) // 2, y, (W + lw) // 2, y + 3], fill=(*brand.RUBY, 255))
        masked(f, self.site, (W - self.site.width) // 2, y + 26, expo((u - 1.1) / 0.8), 0.8)


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
    style = style or {}
    spec = spec_for(cfg, article, style)
    out_dir.mkdir(parents=True, exist_ok=True)
    name_mp4, name_cover, name_meta = L["files"]
    mp4, meta = out_dir / name_mp4, out_dir / name_meta
    fp = fingerprint(spec, style, fmt)
    if not force and mp4.exists() and meta.exists() and json.loads(meta.read_text()).get("fingerprint") == fp:
        return mp4
    pr = Promo(spec, style, int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16), fmt)
    total = sum(d for _, d in SCENES)
    cuts = list(np.cumsum([d for _, d in SCENES])[:-1])
    wav = out_dir / f"{fmt}.music.tmp.wav"
    mstyle = style.get("music") if style.get("music") in CALM_MUSIC else "cinematic"
    music.generate(total, cuts, seed + "#promo", wav, mstyle)
    tmp = out_dir / f"{fmt}.tmp.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
           "-movflags", "+faststart", str(tmp)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    cover_t = L.get("cover_t", SCENES[0][1] + 2.6)   # кадр-обкладинка: Reels об'єкт і заголовок, LinkedIn гачок
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
