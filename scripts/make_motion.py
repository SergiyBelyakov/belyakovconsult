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
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_cards  # noqa: E402
import music  # noqa: E402
from common import ROOT, episode_sub, load_articles, load_config, social_asset_dir  # noqa: E402

W, H, FPS = 1080, 1920, 30
TOP, BOTTOM = 230, 360          # безпечні зони під інтерфейс соцмереж
TRANS = 0.5                     # тривалість переходу між слайдами, с
DUR = {"cover": 4.6, "point": 5.0, "cta": 5.6}
VERSION = "motion-v3"
BEAT = music.BEAT
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

    def __init__(self, seed: int):
        self.base = make_cards.background(W, H, glow=(0.8, 0.12), strength=22, grid=False).convert("RGBA")
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

    def frame(self, T: float) -> Image.Image:
        f = self.base.copy()
        ox, oy = int(T * 14) % 54, int(T * 9) % 54
        f.alpha_composite(self.grid.crop((ox, oy, ox + W, oy + H)))
        # світло: повільний дрейф + пульсація на долю такту
        beat = np.exp(-((T % BEAT) / 0.22))
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


def render_content(slide, t: float, T: float, dur: float, chrome: bool) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for vi, e in enumerate(slide.elements):
        if (e.name in CHROME) != chrome:
            continue
        if chrome:
            layer.alpha_composite(e.image, e.xy)
            continue
        start = 0.2 + (e.order - 1) * 0.26 + e.delay
        x, y = e.xy
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
    frame = scene.frame(T)
    slide, dur = slides[idx], durs[idx]
    drift = int(np.sin(T * 0.6) * 6)
    trans = idx + 1 < len(slides) and t > dur - TRANS
    k = ease((t - (dur - TRANS)) / TRANS) if trans else 0.0
    # Локальний час слайда: наступний слайд починає анімацію ще під час переходу
    # і продовжує її без стрибка, тому до слайдів після першого додається TRANS.
    u = t + (TRANS if idx > 0 else 0.0)
    cur = render_content(slide, u, T, dur, chrome=False)
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


def build_all(cfg, article, force: bool = False) -> list[Path]:
    """Основне відео статті й відео кожного епізоду (для дописів 2, 3…)."""
    out = []
    for n in range(1, len(article.episodes) + 2):
        a = article if n == 1 else episode(article, n)
        d = social_asset_dir(cfg, article.slug, article.lang) / episode_sub(n)
        mp4 = build(cfg, a, force, out_dir=d, seed=article.slug if n == 1 else f"{article.slug}#{n}")
        if mp4:
            frames = [Image.open(f) for f in sorted(d.glob("motion-frame-*.jpg"), key=lambda x: int(x.stem.split("-")[-1]))]
            make_cards.brand_sheet(cfg, a, frames, out_dir=d)
            out.append(mp4)
    return out


def build(cfg, article, force: bool = False, out_dir: Path | None = None, seed: str | None = None) -> Path | None:
    if not article.carousel:
        return None
    if not shutil.which("ffmpeg"):
        raise RuntimeError("Немає ffmpeg: відео не зібрати")
    out = out_dir or social_asset_dir(cfg, article.slug, article.lang)
    seed = seed or article.slug
    out.mkdir(parents=True, exist_ok=True)
    mp4, meta = out / "motion.mp4", out / "motion.json"
    specs = make_cards.slide_specs(cfg, article)
    fp = fingerprint(cfg, article, specs + [{"seed": seed}])
    if not force and mp4.exists() and meta.exists() and json.loads(meta.read_text()).get("fingerprint") == fp:
        return mp4
    scene = Scene(int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16))
    slides = [make_cards.layout(cfg, article, s, i, len(specs), W, H, TOP, BOTTOM) for i, s in enumerate(specs, 1)]
    durs = [DUR.get(s.kind, 4.4) for s in slides]
    tmp = out / "motion.tmp.mp4"
    total_s = sum(durs)
    cuts = [sum(durs[:i]) for i in range(1, len(durs))]
    wav = out / "motion.music.tmp.wav"
    music.generate(total_s, cuts, seed, wav)  # однакова музика для всіх мовних версій, своя для кожного допису
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
    for a in load_articles(cfg, include_drafts=True):
        if (only and a.slug != only) or not a.carousel:
            continue
        for p in build_all(cfg, a, force=bool(only)):
            print(f"{a.slug}: {p.relative_to(ROOT)} ({p.stat().st_size // 1024} КБ)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
