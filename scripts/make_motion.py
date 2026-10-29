"""Моушн-відео статті: ті самі слайди, що й у каруселі, але з анімацією (1080×1920, 30 fps, H.264).

Анімація (motion-v3, максимально жива): рухома сітка й частинки-«дані» з лініями зв'язку на фоні,
сканувальна смуга, рубінове світло пульсує в такт музиці; рядки тексту виїжджають по одному,
лінія прорисовується з іскрою, картки з'являються з легким перестрибком і далі «дихають»,
числа рахуються від нуля, логотип пульсує; перехід між слайдами: зсув угору з рубіновою смугою.
Безпечні зони зверху й знизу лишаються вільними під інтерфейс Reels/Threads/Telegram.

Відео перебудовується лише коли змінився текст слайдів або файли бренду (motion.json зберігає відбиток).

Запуск окремо: python scripts/make_motion.py [slug]
"""
from __future__ import annotations

import dataclasses
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_cards  # noqa: E402
import music  # noqa: E402
from common import ROOT, episode_sub, load_articles, load_config, social_asset_dir  # noqa: E402

W, H, FPS = 1080, 1920, 30
TOP, BOTTOM = 230, 360          # безпечні зони під інтерфейс соцмереж
TRANS = 0.5                     # тривалість переходу між слайдами, с
DUR = {"cover": 4.6, "point": 5.0, "cta": 5.6}
DUR_SHORT = {"cover": 2.6, "point": 3.9, "cta": 3.4}   # відео до дописів 2+: коротше, ~15–18 с
HOOK = {"title", "visual", "glyph", "kicker"}           # на обкладинці видно з першого кадру (гачок)
VERSION = "motion-v3"
BEAT = music.BEAT

# ---- Вигляд відео: щоб ролики не були однакові ----
BG_DIR = ROOT / "brand-assets" / "bg"          # фони з дизайн-системи: червона хвиля, мережа-глобус
STYLE_FILE = ROOT / "state" / "video-styles.json"
LOOKS = ["grid", "wave", "globe", "beam"]       # живий фон
# обкладинка: 3D-іконка, велике число/код, заголовок на хвилі, велика лапка чи «?», рамка-видошукач, друкарська машинка
COVERS = ["icon", "type", "wave", "quote", "frame", "typewriter"]
ICONS = ["service-quality.webp", "service-architecture.webp", "service-bi.webp", "service-governance.webp",
         "service-data-analysis.webp", "service-consulting.webp", "service-financial-analytics.webp",
         "service-management-analytics.webp", "service-geospatial.webp"]
WAVES = sorted(p.name for p in BG_DIR.glob("wave-*.jpg"))
GLOBES = sorted(p.name for p in BG_DIR.glob("globe-*.jpg"))


def style_for_index(k: int) -> dict:
    """k-те відео за часом виходу: сусідні відео різняться фоном, обкладинкою, іконкою й музикою."""
    return {"look": LOOKS[k % len(LOOKS)], "cover": COVERS[(k + k // len(COVERS)) % len(COVERS)], "icon": ICONS[(k * 4) % len(ICONS)],
            "music": music.STYLE_NAMES[k % len(music.STYLE_NAMES)],
            "wave": WAVES[(k * 3) % len(WAVES)] if WAVES else None, "globe": GLOBES[k % len(GLOBES)] if GLOBES else None}


def _services_by_slug() -> dict:
    from common import load_articles, load_config
    out = {}
    for a in load_articles(load_config(), include_drafts=True):
        if a.lang == "uk" or a.slug not in out:
            out[a.slug] = a.services
    return out


def assign_styles(keys: list[str]) -> dict:
    """Стабільно призначає вигляд кожному відео (ключ «slug#N»); нові ключі отримують наступні номери.

    Іконка обкладинки: спершу іконка напряму статті, якщо попередня обкладинка-іконка була іншою; інакше з ротації."""
    data = json.loads(STYLE_FILE.read_text()) if STYLE_FILE.exists() else {}
    services = _services_by_slug()
    for key in keys:
        if key not in data:
            note = key.startswith("note-")          # каруселі нотаток мають власну чергу, щоб не збивати ротацію відео
            k = sum(1 for x in data if x.startswith("note-") == note)
            st = style_for_index(k)
            if note:
                st["cover"] = ("icon", "quote", "type", "frame")[k % 4]
                st["icon"] = ICONS[(k * 2 + 1) % len(ICONS)]
            last_icons = [v.get("icon") for x, v in data.items() if x.startswith("note-") == note][-2:]
            for sv in services.get(key.split("#")[0], []):
                cand = make_cards.visuals.SERVICE_IMAGES.get(sv)
                if cand and cand not in last_icons:
                    st["icon"] = cand
                    break
            data[key] = {"k": k, **st}
    STYLE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STYLE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    return data


def video_order(cfg) -> list[str]:
    """Ключі відео й каруселей нотаток у порядку першої публікації."""
    from common import load_posts
    first: dict[str, object] = {}
    for p in load_posts(cfg):
        if p.kind == "note" and p.channel == "instagram":
            key = f"{p.slug}#{p.path.stem}"
        elif p.kind == "article":
            key = f"{p.slug}#{p.n}"
        else:
            continue
        if key not in first or p.publish_at < first[key]:
            first[key] = p.publish_at
    return sorted(first, key=lambda k: first[k])
TEXT_NAMES = {"title", "body", "kicker", "num", "links"}
CHROME = {"lockup", "counter", "footer", "arrow"}   # не рухаються під час переходу


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def ease_back(x: float) -> float:
    """Легкий «перестрибок» для появи карток."""
    x = max(0.0, min(1.0, x))
    c = 1.6
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def with_alpha(img: Image.Image, a: float) -> Image.Image:
    if a >= 0.999:
        return img
    out = img.copy()
    out.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
    return out


def glow_sprite(size: int = 1300, strength: int = 52) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    c = size // 2
    for i in range(30, 0, -1):
        r = c * i // 30
        d.ellipse([c - r, c - r, c + r, c + r], fill=int(strength * (1 - i / 30) ** 1.7))
    sprite = Image.new("RGBA", (size, size), (*brand.RUBY, 0))
    sprite.putalpha(mask)
    return sprite


class Scene:
    """Живий фон: рухома сітка, частинки-«дані» з лініями зв'язку, сканувальна смуга, світло в такт."""

    def __init__(self, seed: int, style: dict | None = None, beat: float = BEAT):
        style = style or {}
        self.look = style.get("look", "grid")
        self.beat = beat
        glow_at = {"grid": (0.8, 0.12), "wave": (0.15, 0.85), "globe": (0.2, 0.1), "beam": (0.5, 0.45)}.get(self.look, (0.8, 0.12))
        self.base = make_cards.background(W, H, glow=glow_at, strength=22, grid=False).convert("RGBA")
        self.photo = None          # фон із дизайн-системи, вписаний цілком по ширині (без обрізання)
        name = style.get("wave") if self.look == "wave" else style.get("globe") if self.look == "globe" else None
        if name and (BG_DIR / name).exists():
            im = Image.open(BG_DIR / name).convert("RGB")
            if self.look == "globe":   # тонкі лінії мережі: підсилюємо, щоб їх було видно на телефоні
                im = ImageEnhance.Brightness(im).enhance(2.4)
            # вписуємо цілком: по висоті кадру для глобуса, по ширині для хвилі (без обрізання)
            sc = W / im.width * (1.0 if self.look == "wave" else 1.0)
            im = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS).convert("RGBA")
            fade = Image.new("L", im.size, 255)
            fd = ImageDraw.Draw(fade)
            for i in range(200):                                  # м'який верхній край (хвиля в кадрі лишається цілою)
                a = int(255 * (i / 200) ** 1.5)
                fd.line([0, i, W, i], fill=a)
                if i < 40:
                    fd.line([0, im.height - 1 - i, W, im.height - 1 - i], fill=int(255 * (i / 40)))
            im.putalpha(fade)
            self.photo = im
        self.cover_wave = None     # обкладинка «wave»: хвиля під великим заголовком першого слайда
        if style.get("cover") == "wave" and style.get("wave") and (BG_DIR / style["wave"]).exists():
            im = Image.open(BG_DIR / style["wave"]).convert("RGB")
            im = im.resize((W, int(im.height * W / im.width)), Image.LANCZOS).convert("RGBA")
            self.cover_wave = im
        self.base.alpha_composite(Image.new("RGBA", (W, 10), (*brand.RUBY, 255)), (0, 0))
        g = Image.new("RGBA", (W + 54, H + 54), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        for x in range(0, W + 54, 54):
            gd.line([x, 0, x, H + 54], fill=(255, 255, 255, 9))
        for y in range(0, H + 54, 54):
            gd.line([0, y, W + 54, y], fill=(255, 255, 255, 9))
        self.grid = g
        self.glow = glow_sprite()
        self.glow2 = glow_sprite(900, 34)
        rng = np.random.default_rng(seed)
        n = 46
        self.p0 = rng.uniform([0, 0], [W, H], (n, 2))
        ang = rng.uniform(0, 2 * np.pi, n)
        spd = rng.uniform(10, 34, n)
        self.v = np.stack([np.cos(ang) * spd, -np.abs(np.sin(ang)) * spd - 8], axis=1)   # переважно вгору
        self.size = rng.uniform(2.0, 5.0, n)
        self.red = rng.random(n) < 0.3
        band = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
        bd = ImageDraw.Draw(band)
        for i in range(160):
            a = int(16 * (1 - abs(i - 80) / 80) ** 2)
            bd.line([0, i, W, i], fill=(*brand.RUBY, a))
        self.band = band

    def frame(self, T: float, cover_k: float = 0.0) -> Image.Image:
        f = self.base.copy()
        beat = np.exp(-((T % self.beat) / 0.22))
        if self.look in ("grid", "beam"):
            ox, oy = int(T * 14) % 54, int(T * 9) % 54
            f.alpha_composite(with_alpha(self.grid.crop((ox, oy, ox + W, oy + H)), 1.0 if self.look == "grid" else 0.5))
        if self.photo is not None:
            if self.look == "wave":      # хвиля в нижній третині кадру, «дихає» в такт
                y = H - self.photo.height + 40 + int(16 * np.sin(T * 0.6))     # під текстом, біля підвалу
                f.alpha_composite(with_alpha(self.photo, 0.85 + 0.15 * beat), (0, y))
            else:                        # мережа-глобус: дві копії, вгорі й унизу, повільно пливуть
                y1 = 60 + int(18 * np.sin(T * 0.35))
                y2 = H - self.photo.height - 60 + int(18 * np.cos(T * 0.3))
                f.alpha_composite(with_alpha(self.photo, 0.9), (0, y1))
                f.alpha_composite(with_alpha(self.photo.transpose(Image.FLIP_LEFT_RIGHT), 0.6 + 0.2 * beat), (0, y2))
        if self.look == "beam":          # діагональні рубінові промені, що повільно проходять кадром
            ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            d = ImageDraw.Draw(ov)
            for j, (spd, wdt, a) in enumerate(((150, 180, 70), (95, 90, 55), (210, 50, 80))):
                x = int((T * spd + j * 520) % (W + H + 400)) - H - 200
                for q in range(wdt):
                    al = int(a * (1 - abs(q - wdt / 2) / (wdt / 2)) ** 2 * (0.8 + 0.2 * beat))
                    d.line([x + q, H, x + q + H, 0], fill=(*brand.RUBY, al))
            f.alpha_composite(ov)
        if self.cover_wave is not None and cover_k > 0:
            f.alpha_composite(with_alpha(self.cover_wave, cover_k), (0, int(H * 0.22) - self.cover_wave.height // 2 + int(8 * np.sin(T * 0.8))))
        gx = int(W * (0.82 + 0.10 * np.sin(T * 0.23))) - self.glow.width // 2
        gy = int(H * (0.16 + 0.06 * np.sin(T * 0.31))) - self.glow.height // 2
        g = with_alpha(self.glow, 0.72 + 0.28 * beat)
        f.paste(g, (gx, gy), g)
        gx2 = int(W * (0.12 + 0.08 * np.cos(T * 0.19))) - self.glow2.width // 2
        gy2 = int(H * (0.78 + 0.05 * np.sin(T * 0.27))) - self.glow2.height // 2
        f.paste(self.glow2, (gx2, gy2), self.glow2)
        # сканувальна смуга
        sy = int((T * 210) % (H + 320)) - 160
        f.alpha_composite(self.band, (0, sy)) if 0 <= sy <= H - 160 else None
        # частинки й зв'язки між близькими
        pos = (self.p0 + self.v * T) % [W, H]
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        diff = pos[:, None, :] - pos[None, :, :]
        dist = np.sqrt((diff ** 2).sum(-1))
        ii, jj = np.where((dist < 190) & (np.triu(np.ones_like(dist), 1) > 0))
        for i, j in zip(ii, jj):
            a = int(46 * (1 - dist[i, j] / 190))
            d.line([*pos[i], *pos[j]], fill=(*brand.SILVER, a), width=1)
        for k, (x, y) in enumerate(pos):
            r = self.size[k] * (1 + 0.35 * beat * self.red[k])
            col = (*brand.RUBY, 200) if self.red[k] else (*brand.SILVER, 120)
            d.ellipse([x - r, y - r, x + r, y + r], fill=col)
        f.alpha_composite(ov)
        return f


def _count_img(meta: dict, k: float) -> Image.Image:
    f = brand.font("head", int(meta["size"]))
    v = meta["value"] * k
    txt = f"{int(round(v)):,}".replace(",", meta.get("sep", " "))
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    w = int(probe.textlength(txt, font=f)) + 4
    img = Image.new("RGBA", (w, int(f.size * 1.3)), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((0, 0), txt, font=f, fill=brand.WHITE)
    return img


def draw_typed(layer: Image.Image, e, t: float, start: float) -> None:
    """Заголовок друкується зліва направо, рядок за рядком, з рубіновим курсором."""
    step = e.image.info.get("step") or e.image.height
    n = max(1, e.image.info.get("lines") or 1)
    per = 0.62
    d = ImageDraw.Draw(layer)
    for i in range(n):
        y0 = i * step
        y1 = e.image.height if i == n - 1 else (i + 1) * step
        line = e.image.crop((0, y0, e.image.width, y1))
        bbox = line.getbbox()
        lw = bbox[2] if bbox else line.width
        k = min(1.0, max(0.0, (t - start - i * per) / per))
        if k <= 0:
            break
        wv = max(1, int(lw * k))
        layer.alpha_composite(line.crop((0, 0, wv, line.height)), (e.xy[0], e.xy[1] + y0))
        done = i == n - 1 and k >= 1
        if k < 1 or (done and int(t * 2.4) % 2 == 0):
            cx = e.xy[0] + wv + 6
            d.rectangle([cx, e.xy[1] + y0 + int(step * 0.12), cx + 8, e.xy[1] + y0 + int(step * 0.92)], fill=(*brand.RUBY, 255))
        if k < 1:
            break


def draw_text_lines(layer: Image.Image, e, t: float, start: float) -> None:
    """Рядки виїжджають знизу зі своєї «щілини» один за одним."""
    step = e.image.info.get("step") or e.image.height
    n = max(1, e.image.info.get("lines") or 1)
    for i in range(n):
        y0 = i * step
        y1 = e.image.height if i == n - 1 else (i + 1) * step
        k = ease((t - start - i * 0.09) / 0.55)
        if k <= 0:
            continue
        line = e.image.crop((0, y0, e.image.width, y1))
        off = int((1 - k) * (y1 - y0))
        visible = line.crop((0, 0, line.width, line.height - off)) if off < line.height else None
        if visible is not None and visible.height > 0:
            layer.alpha_composite(with_alpha(visible, min(1.0, k * 1.4)), (e.xy[0], e.xy[1] + y0 + off))


def render_content(slide, t: float, T: float, dur: float, chrome: bool, hook: bool = False) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for vi, e in enumerate(slide.elements):
        if (e.name in CHROME) != chrome:
            continue
        if chrome:
            layer.alpha_composite(e.image, e.xy)
            continue
        start = 0.2 + (e.order - 1) * 0.26 + e.delay
        if hook and e.name in HOOK:            # перший кадр ролика вже показує заголовок і картинку
            start = -3.0
        x, y = e.xy
        if e.anim == "type" and not hook:
            draw_typed(layer, e, t, start)
            continue
        if e.name in TEXT_NAMES:
            draw_text_lines(layer, e, t, start)
            continue
        k = ease((t - start) / 0.6)
        if k <= 0:
            continue
        settled = min(1.0, max(0.0, (t - start - 0.6) / 0.6))
        bob = int(np.sin(2 * np.pi * (T * 0.55 + vi * 0.17)) * 5 * settled) if e.name == "visual" else 0
        if e.name == "rule" or e.anim == "grow-x":
            w = max(1, int(e.image.width * k))
            layer.alpha_composite(e.image.crop((0, 0, w, e.image.height)), (x, y + bob))
            if e.name == "rule" and k < 1:   # іскра на кінці лінії
                d = ImageDraw.Draw(layer)
                d.ellipse([x + w - 7, y - 4, x + w + 7, y + e.image.height + 4], fill=(*brand.RUBY, 255))
        elif e.anim == "count":
            kc = ease((t - start) / 1.1)
            layer.alpha_composite(with_alpha(_count_img(e.meta, kc), min(1.0, kc * 2)), (x, y + bob))
        elif e.anim == "fade":
            layer.alpha_composite(with_alpha(e.image, k), (x, y + bob))
        elif e.anim == "pop":
            kb = ease_back((t - start) / 0.55)
            sc = max(0.05, 0.82 + 0.18 * kb)
            im = e.image.resize((max(1, int(e.image.width * sc)), max(1, int(e.image.height * sc))), Image.BILINEAR)
            layer.alpha_composite(with_alpha(im, k), (x + (e.image.width - im.width) // 2, y + bob + (e.image.height - im.height) // 2))
        elif e.anim == "zoom":
            # плавне наближення до повного розміру: картинка завжди цілком, без обрізання країв
            sc = 0.9 + 0.1 * ease(t / (dur * 0.8))
            im = e.image.resize((max(1, int(e.image.width * sc)), max(1, int(e.image.height * sc))), Image.BILINEAR)
            layer.alpha_composite(with_alpha(im, k), (x + (e.image.width - im.width) // 2, y + (e.image.height - im.height) // 2))
        elif e.name == "logo":
            kb = ease_back((t - start) / 0.6)
            pulse = 1 + 0.025 * np.sin(2 * np.pi * T / (BEAT * 2)) * settled
            sc = max(0.05, (0.7 + 0.3 * kb) * pulse)
            im = e.image.resize((max(1, int(e.image.width * sc)), max(1, int(e.image.height * sc))), Image.BILINEAR)
            layer.alpha_composite(with_alpha(im, k), (x + (e.image.width - im.width) // 2, y + (e.image.height - im.height) // 2))
        else:   # rise з легким перестрибком
            kb = ease_back((t - start) / 0.6)
            dy = int((1 - kb) * 60)
            layer.alpha_composite(with_alpha(e.image, k), (x, y + dy + bob))
    return layer


def progress(frame: Image.Image, idx: int, n: int, t: float, dur: float) -> None:
    d = ImageDraw.Draw(frame)
    seg_gap, x0, x1, y = 10, 88, W - 88, TOP - 40
    seg_w = (x1 - x0 - seg_gap * (n - 1)) / n
    for i in range(n):
        sx = x0 + i * (seg_w + seg_gap)
        d.rounded_rectangle([sx, y, sx + seg_w, y + 6], 3, fill=(255, 255, 255, 46))
        fill = 1.0 if i < idx else (min(1.0, t / dur) if i == idx else 0.0)
        if fill > 0:
            d.rounded_rectangle([sx, y, sx + seg_w * fill, y + 6], 3, fill=(*brand.RUBY, 255))


def render_frame(scene: Scene, slides, durs, idx: int, t: float, T: float) -> Image.Image:
    slide, dur = slides[idx], durs[idx]
    trans = idx + 1 < len(slides) and t > dur - TRANS
    k = ease((t - (dur - TRANS)) / TRANS) if trans else 0.0
    frame = scene.frame(T, cover_k=(ease(t / 0.8) * (1 - k)) if idx == 0 else 0.0)
    drift = int(np.sin(T * 0.6) * 6)
    # Локальний час слайда: наступний слайд починає анімацію ще під час переходу
    # і продовжує її без стрибка, тому до слайдів після першого додається TRANS.
    u = t + (TRANS if idx > 0 else 0.0)
    cur = render_content(slide, u, T, dur, chrome=False, hook=(idx == 0))
    if trans:
        frame.alpha_composite(with_alpha(cur, 1 - k), (drift, -int(k * 150)))
        nxt = render_content(slides[idx + 1], t - (dur - TRANS), T, durs[idx + 1], chrome=False)
        frame.alpha_composite(with_alpha(nxt, k), (drift, int((1 - k) * 150)))
        # рубінова смуга, що пролітає екраном під час переходу
        by = int(TOP + k * (H - TOP - BOTTOM))
        a = int(200 * (1 - abs(2 * k - 1)))
        ImageDraw.Draw(frame).rectangle([0, by, W, by + 4], fill=(*brand.RUBY, a))
    else:
        frame.alpha_composite(cur, (drift, 0))
    chrome = render_content(slides[idx + 1] if trans and k > 0.5 else slide, t, T, dur, chrome=True)
    if idx == 0 and t < 0.7:   # шапка з'являється зверху на початку ролика
        a = ease(t / 0.6)
        frame.alpha_composite(with_alpha(chrome, a), (0, -int((1 - a) * 40)))
    else:
        frame.alpha_composite(chrome)
    progress(frame, idx + (1 if trans and k > 0.5 else 0), len(slides), t if not (trans and k > 0.5) else 0.0, dur)
    return frame


def fingerprint(cfg, article, specs) -> str:
    h = hashlib.sha256(VERSION.encode())
    h.update(json.dumps(specs, ensure_ascii=False, sort_keys=True).encode())
    for p in [brand.LOGO_MASTER, *sorted(brand.FONTS.glob("*.*"))]:
        h.update(p.name.encode()); h.update(str(p.stat().st_size).encode())
    for mod in (Path(__file__), Path(make_cards.__file__), Path(music.__file__), Path(make_cards.visuals.__file__), Path(brand.__file__)):
        h.update(mod.read_bytes())
    return h.hexdigest()[:16]


def episode(article, n: int):
    """Стаття-«епізод» для допису N (2, 3…): власна обкладинка й слайди з article.episodes[n-2]."""
    ep = article.episodes[n - 2]
    return dataclasses.replace(article, title=str(ep.get("title", article.title)),
                               description=str(ep.get("text", "")), carousel=list(ep.get("carousel") or []), episodes=[])


def build_all(cfg, article, force: bool = False, styles: dict | None = None) -> list[Path]:
    """Основне відео статті й відео кожного епізоду (для дописів 2, 3…)."""
    if styles is None:
        styles = assign_styles(video_order(cfg))
    out = []
    for n in range(1, len(article.episodes) + 2):
        a = article if n == 1 else episode(article, n)
        st = styles.get(f"{article.slug}#{n}")
        if st:
            a = dataclasses.replace(a, style=st)
        d = social_asset_dir(cfg, article.slug, article.lang) / episode_sub(n)
        mp4 = build(cfg, a, force, out_dir=d, seed=article.slug if n == 1 else f"{article.slug}#{n}", short=n > 1)
        if mp4 and article.lang == "en":        # англійські Reels для Instagram: промо-шаблон (кінетична типографіка + 3D)
            import make_promo
            make_promo.build(cfg, a, st or {}, d, f"{article.slug}#{n}", force)
        if mp4:
            frames = [Image.open(f) for f in sorted(d.glob("motion-frame-*.jpg"), key=lambda x: int(x.stem.split("-")[-1]))]
            make_cards.brand_sheet(cfg, a, frames, out_dir=d)
            out.append(mp4)
    return out


def build(cfg, article, force: bool = False, out_dir: Path | None = None, seed: str | None = None,
          short: bool = False) -> Path | None:
    if not article.carousel:
        return None
    if not shutil.which("ffmpeg"):
        raise RuntimeError("Немає ffmpeg: відео не зібрати")
    out = out_dir or social_asset_dir(cfg, article.slug, article.lang)
    seed = seed or article.slug
    out.mkdir(parents=True, exist_ok=True)
    mp4, meta = out / "motion.mp4", out / "motion.json"
    specs = make_cards.slide_specs(cfg, article)
    style = article.style or {}
    fp = fingerprint(cfg, article, specs + [{"seed": seed, "short": short, "style": {k: v for k, v in style.items() if k != "k"}}])
    if not force and mp4.exists() and meta.exists() and json.loads(meta.read_text()).get("fingerprint") == fp:
        if not (out / "cover.jpg").exists():
            make_cards.reel_cover(cfg, article, specs[0], out / "cover.jpg")
        return mp4
    scene = Scene(int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16), style, music.beat_of(style.get("music")))
    slides = [make_cards.layout(cfg, article, s, i, len(specs), W, H, TOP, BOTTOM) for i, s in enumerate(specs, 1)]
    durs = [(DUR_SHORT if short else DUR).get(s.kind, 4.4) for s in slides]
    tmp = out / "motion.tmp.mp4"
    total_s = sum(durs)
    cuts = [sum(durs[:i]) for i in range(1, len(durs))]
    wav = out / "motion.music.tmp.wav"
    music.generate(total_s, cuts, seed, wav, style.get("music"))  # однакова музика для всіх мовних версій, своя для кожного допису
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", str(wav),
           "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
           "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
           "-movflags", "+faststart", str(tmp)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    keyframes = []
    total_t = 0.0
    try:
        for idx, (slide, dur) in enumerate(zip(slides, durs)):
            frames = int(dur * FPS)
            for f in range(frames):
                t = f / FPS
                img = render_frame(scene, slides, durs, idx, t, total_t + t)
                if f == int(dur * FPS * 0.7):
                    keyframes.append(img.convert("RGB"))
                proc.stdin.write(img.convert("RGB").tobytes())
            total_t += dur
    finally:
        proc.stdin.close()
        code = proc.wait()
    if code != 0:
        raise RuntimeError(f"ffmpeg завершився з кодом {code}")
    tmp.replace(mp4)
    make_cards.reel_cover(cfg, article, specs[0], out / "cover.jpg")   # обкладинка Reels під сітку профілю 3:4
    wav.unlink(missing_ok=True)
    meta.write_text(json.dumps({"fingerprint": fp, "seconds": round(sum(durs), 1), "size": [W, H]}, indent=2) + "\n")
    # Кадри для аркуша перевірки бренду
    for i, k in enumerate(keyframes, 1):
        k.save(out / f"motion-frame-{i}.jpg", "JPEG", quality=85)
    return mp4


def main() -> int:
    problems = brand.check()
    if problems:
        print("ПОМИЛКА БРЕНДУ:\n- " + "\n- ".join(problems))
        return 1
    cfg = load_config()
    only = sys.argv[1] if len(sys.argv) > 1 else None
    styles = assign_styles(video_order(cfg))
    for a in load_articles(cfg, include_drafts=True):
        if (only and a.slug != only) or not a.carousel:
            continue
        for p in build_all(cfg, a, force=bool(only), styles=styles):
            print(f"{a.slug}: {p.relative_to(ROOT)} ({p.stat().st_size // 1024} КБ)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
