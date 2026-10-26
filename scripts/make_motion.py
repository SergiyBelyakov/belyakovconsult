"""Моушн-відео статті: ті самі слайди, що й у каруселі, але з анімацією (1080×1920, 30 fps, H.264).

Анімація: поява елементів каскадом знизу вгору, «прорисування» рубінової лінії, повільний рух
рубінового світла на фоні, сегментований прогрес угорі (як у сторіз), м'який перехід між слайдами.
Безпечні зони зверху й знизу лишаються вільними під інтерфейс Reels/Threads/Telegram.

Відео перебудовується лише коли змінився текст слайдів або файли бренду (motion.json зберігає відбиток).

Запуск окремо: python scripts/make_motion.py [slug]
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_cards  # noqa: E402
import music  # noqa: E402
from common import load_articles, load_config, social_asset_dir  # noqa: E402

W, H, FPS = 1080, 1920, 30
TOP, BOTTOM = 230, 360          # безпечні зони під інтерфейс соцмереж
TRANS = 0.45                    # тривалість переходу між слайдами, с
DUR = {"cover": 4.2, "point": 4.6, "cta": 5.2}
VERSION = "motion-v2"


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def with_alpha(img: Image.Image, a: float) -> Image.Image:
    if a >= 0.999:
        return img
    out = img.copy()
    out.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
    return out


def glow_sprite(size: int = 1300, strength: int = 46) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    c = size // 2
    for i in range(30, 0, -1):
        r = c * i // 30
        d.ellipse([c - r, c - r, c + r, c + r], fill=int(strength * (1 - i / 30) ** 1.7))
    sprite = Image.new("RGBA", (size, size), (*brand.RUBY, 0))
    sprite.putalpha(mask)
    return sprite


def render_slide_frame(base: Image.Image, glow: Image.Image, slide, t: float, total_t: float,
                       idx: int, n: int, dur: float) -> Image.Image:
    frame = base.copy()
    # Рух світла: повільна траєкторія через увесь ролик
    p = total_t / max(1.0, n * 4.5)
    gx = int(W * (0.95 - 0.55 * p)) - glow.width // 2
    gy = int(H * (0.12 + 0.18 * p)) - glow.height // 2
    frame.paste(glow, (gx, gy), glow)
    # Прогрес-сегменти
    d = ImageDraw.Draw(frame)
    seg_gap, x0, x1, y = 10, 88, W - 88, TOP - 40
    seg_w = (x1 - x0 - seg_gap * (n - 1)) / n
    for i in range(n):
        sx = x0 + i * (seg_w + seg_gap)
        d.rounded_rectangle([sx, y, sx + seg_w, y + 6], 3, fill=(255, 255, 255, 46))
        fill = 1.0 if i < idx else (min(1.0, t / dur) if i == idx else 0.0)
        if fill > 0:
            d.rounded_rectangle([sx, y, sx + seg_w * fill, y + 6], 3, fill=(*brand.RUBY, 255))
    # Елементи слайда
    for e in slide.elements:
        if e.order == 0:
            a = ease(t / 0.5) if idx == 0 else 1.0
            frame.alpha_composite(with_alpha(e.image, a), e.xy)
            continue
        start = 0.25 + (e.order - 1) * 0.28 + e.delay
        k = ease((t - start) / 0.6)
        if k <= 0:
            continue
        x, y = e.xy
        if e.name == "rule" or e.anim == "grow-x":
            w = max(1, int(e.image.width * k))
            frame.alpha_composite(e.image.crop((0, 0, w, e.image.height)), (x, y))
        elif e.anim == "fade":
            frame.alpha_composite(with_alpha(e.image, k), (x, y))
        elif e.anim == "pop":
            sc = 0.9 + 0.1 * k
            im = e.image.resize((max(1, int(e.image.width * sc)), max(1, int(e.image.height * sc))), Image.BILINEAR)
            frame.alpha_composite(with_alpha(im, k), (x + (e.image.width - im.width) // 2, y + (e.image.height - im.height) // 2))
        elif e.anim == "zoom":
            sc = 1.0 + 0.06 * min(1.0, t / dur)          # повільне наближення, як у кадрі камери
            im = e.image.resize((int(e.image.width * sc), int(e.image.height * sc)), Image.BILINEAR)
            ox, oy = (im.width - e.image.width) // 2, (im.height - e.image.height) // 2
            im = im.crop((ox, oy, ox + e.image.width, oy + e.image.height))
            frame.alpha_composite(with_alpha(im, k), (x, y))
        else:
            dy = int((1 - k) * 46)
            frame.alpha_composite(with_alpha(e.image, k), (x, y + dy))
    return frame


def fingerprint(cfg, article, specs) -> str:
    h = hashlib.sha256(VERSION.encode())
    h.update(json.dumps(specs, ensure_ascii=False, sort_keys=True).encode())
    for p in [brand.LOGO_MASTER, *sorted(brand.FONTS.glob("*.*"))]:
        h.update(p.name.encode()); h.update(str(p.stat().st_size).encode())
    for mod in (Path(__file__), Path(make_cards.__file__), Path(music.__file__), Path(make_cards.visuals.__file__)):
        h.update(mod.read_bytes())
    return h.hexdigest()[:16]


def build(cfg, article, force: bool = False) -> Path | None:
    if not article.carousel:
        return None
    if not shutil.which("ffmpeg"):
        raise RuntimeError("Немає ffmpeg: відео не зібрати")
    out = social_asset_dir(cfg, article.slug, article.lang)
    out.mkdir(parents=True, exist_ok=True)
    mp4, meta = out / "motion.mp4", out / "motion.json"
    specs = make_cards.slide_specs(cfg, article)
    fp = fingerprint(cfg, article, specs)
    if not force and mp4.exists() and meta.exists() and json.loads(meta.read_text()).get("fingerprint") == fp:
        return mp4
    base = make_cards.background(W, H, glow=(0.8, 0.12), strength=22).convert("RGBA")
    base.alpha_composite(Image.new("RGBA", (W, 10), (*brand.RUBY, 255)), (0, 0))
    glow = glow_sprite()
    slides = [make_cards.layout(cfg, article, s, i, len(specs), W, H, TOP, BOTTOM) for i, s in enumerate(specs, 1)]
    durs = [DUR.get(s.kind, 4.4) for s in slides]
    tmp = out / "motion.tmp.mp4"
    total_s = sum(durs)
    cuts = [sum(durs[:i]) for i in range(1, len(durs))]
    wav = out / "motion.music.tmp.wav"
    music.generate(total_s, cuts, article.slug, wav)  # однакова музика для всіх мовних версій
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
                img = render_slide_frame(base, glow, slide, t, total_t + t, idx, len(slides), dur)
                # Перехід: останні TRANS секунд змішуємо з першим кадром наступного слайда
                if idx + 1 < len(slides) and t > dur - TRANS:
                    k = ease((t - (dur - TRANS)) / TRANS)
                    nxt = render_slide_frame(base, glow, slides[idx + 1], 0.0, total_t + t, idx + 1, len(slides), durs[idx + 1])
                    img = Image.blend(img, nxt, k)
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
        p = build(cfg, a, force=bool(only))
        if p:
            frames = [Image.open(f) for f in sorted(p.parent.glob("motion-frame-*.jpg"), key=lambda x: int(x.stem.split("-")[-1]))]
            make_cards.brand_sheet(cfg, a, frames)
            print(f"{a.slug}: {p.relative_to(p.parents[4])} ({p.stat().st_size // 1024} КБ)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
