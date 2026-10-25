"""Картинки в стилі бренду: прев’ю статті (1200×630) і карусель для Instagram (1080×1350).

Запуск окремо: python scripts/make_cards.py [slug]
Карусель будується з поля `carousel` у статті (список слайдів {title, text}).
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_articles, load_config, social_asset_dir  # noqa: E402

FONTS = ROOT / "fonts"
BG = (5, 7, 10)
PANEL = (12, 17, 23)
LINE = (28, 37, 48)
TEXT = (232, 237, 242)
MUTED = (154, 167, 180)


def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    name = {"bold": "InterDisplay-Bold.otf", "semi": "Inter-SemiBold.otf", "reg": "Inter-Regular.otf"}[kind]
    return ImageFont.truetype(str(FONTS / name), size)


def wrap(draw: ImageDraw.ImageDraw, text: str, f, width: int) -> list[str]:
    lines = []
    for para in str(text).split("\n"):
        words, cur = para.split(), ""
        for w in words:
            trial = f"{cur} {w}".strip()
            if draw.textlength(trial, font=f) <= width:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = w
        lines.append(cur)
    return lines


def fit(draw, text, kind, width, max_size, min_size, max_lines):
    """Підбирає найбільший розмір шрифту, за якого текст влазить у max_lines рядків."""
    for size in range(max_size, min_size - 1, -2):
        f = font(kind, size)
        lines = wrap(draw, text, f, width)
        if len(lines) <= max_lines:
            return f, lines
    f = font(kind, min_size)
    lines = wrap(draw, text, f, width)[:max_lines]
    lines[-1] = lines[-1].rstrip(".,; ") + "…"
    return f, lines


def draw_lines(draw, xy, lines, f, fill, spacing=1.22):
    x, y = xy
    step = int(f.size * spacing)
    for ln in lines:
        draw.text((x, y), ln, font=f, fill=fill)
        y += step
    return y


def brand(draw, x, y, cfg, scale=1.0):
    accent = _hex(cfg["site"]["accent_color"])
    fb = font("bold", int(34 * scale))
    draw.text((x, y), "BC", font=fb, fill=TEXT)
    w = draw.textlength("BC", font=fb)
    draw.text((x + w, y), ".", font=fb, fill=accent)
    draw.text((x + w + int(22 * scale), y + int(6 * scale)), cfg["site"]["name"], font=font("semi", int(22 * scale)), fill=TEXT)


def og_image(cfg, article) -> Path:
    accent = _hex(cfg["site"]["accent_color"])
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 10, H], fill=accent)
    brand(d, 72, 60, cfg)
    label = cfg["languages"][article.lang]["insights_title"].upper()
    d.text((72, 150), label, font=font("semi", 22), fill=accent)
    f, lines = fit(d, article.title, "bold", W - 144, 64, 40, 4)
    draw_lines(d, (72, 196), lines, f, TEXT, 1.15)
    d.line([72, H - 96, W - 72, H - 96], fill=LINE, width=2)
    host = cfg["site"]["base_url"].split("//")[-1]
    d.text((72, H - 72), f"{host}  ·  {cfg['languages'][article.lang]['author']}", font=font("reg", 24), fill=MUTED)
    out = social_asset_dir(cfg, article.slug)
    out.mkdir(parents=True, exist_ok=True)
    p = out / "og.png"
    img.save(p, optimize=True)
    return p


def carousel(cfg, article) -> list[Path]:
    if not article.carousel:
        return []
    accent = _hex(cfg["site"]["accent_color"])
    W, H, M = 1080, 1350, 88
    slides = [{"title": article.title, "text": article.description, "cover": True}] + list(article.carousel)
    host = cfg["site"]["base_url"].split("//")[-1]
    slides.append({"title": cfg["languages"][article.lang]["cta_title"],
                   "text": cfg['languages'][article.lang]['cta_text'], "cta": True})
    out = social_asset_dir(cfg, article.slug)
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    total = len(slides)
    for i, s in enumerate(slides, 1):
        img = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, W, 10], fill=accent)
        brand(d, M, 72, cfg)
        d.text((W - M - 80, 80), f"{i}/{total}", font=font("semi", 26), fill=MUTED)
        blocks = []  # (тип, дані) — спочатку міряємо, потім малюємо по центру
        if s.get("cover"):
            blocks.append(("label", cfg["languages"][article.lang]["insights_title"].upper()))
            f, lines = fit(d, s["title"], "bold", W - 2 * M, 96, 56, 6)
            blocks.append(("text", (lines, f, TEXT, 1.12, 48)))
            f2, lines2 = fit(d, s.get("text", ""), "reg", W - 2 * M, 44, 32, 6)
            blocks.append(("text", (lines2, f2, MUTED, 1.4, 0)))
        else:
            if not s.get("cta"):
                blocks.append(("num", f"{i - 1:02d}"))
            f, lines = fit(d, s.get("title", ""), "bold", W - 2 * M, 80, 48, 4)
            blocks.append(("text", (lines, f, TEXT, 1.15, 36)))
            blocks.append(("rule", None))
            f2, lines2 = fit(d, s.get("text", ""), "reg", W - 2 * M, 48, 32, 12)
            blocks.append(("text", (lines2, f2, (211, 218, 225), 1.45, 0)))
        heights = {"label": 72, "num": 88, "rule": 52}
        content_h = sum(heights.get(k, 0) if k != "text" else int(v[1].size * v[3]) * len(v[0]) + v[4] for k, v in blocks)
        y = max(200, (H - content_h) // 2)
        for kind, v in blocks:
            if kind == "label":
                d.text((M, y), v, font=font("semi", 30), fill=accent)
            elif kind == "num":
                d.text((M, y), v, font=font("bold", 48), fill=accent)
            elif kind == "rule":
                d.line([M, y, M + 120, y], fill=accent, width=5)
            else:
                draw_lines(d, (M, y), v[0], v[1], v[2], v[3])
                y += int(v[1].size * v[3]) * len(v[0]) + v[4]
                continue
            y += heights[kind]
        d.text((M, H - 90), "→" if i < total else host, font=font("semi", 30), fill=MUTED)
        p = out / f"slide-{i}.png"
        img.save(p, optimize=True)
        paths.append(p)
    return paths


def main() -> int:
    cfg = load_config()
    only = sys.argv[1] if len(sys.argv) > 1 else None
    n = 0
    for a in load_articles(cfg, include_drafts=True):
        if only and a.slug != only:
            continue
        if a.lang == "uk" or not any(x.slug == a.slug and x.lang == "uk" for x in load_articles(cfg, True)):
            og_image(cfg, a)
            n += 1 + len(carousel(cfg, a))
    print(f"Створено зображень: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
