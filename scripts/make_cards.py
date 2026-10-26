"""Візуали статті в бренді Belyakov Consult.

- og.png: прев'ю для сайту й соцмереж (1200×630);
- slide-N.png / slide-N.jpg: картки каруселі (1080×1350);
- motion.mp4: анімовані слайди (1080×1920), див. make_motion.py;
- brand-check.png: аркуш для візуальної перевірки бренду (усі картки й кадри відео).

Слайди будуються з поля `carousel` статті. Розкладка кожного слайда описана як набір
елементів (elements), тому картки й відео мають однаковий вигляд.

Запуск окремо: python scripts/make_cards.py [slug]
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import visuals  # noqa: E402
from common import load_articles, load_config, social_asset_dir  # noqa: E402


@dataclass
class Element:
    name: str            # kicker, num, title, rule, body, footer, lockup, logo
    image: Image.Image   # RGBA
    xy: tuple[int, int]
    order: int = 0       # порядок появи в анімації
    delay: float = 0.0   # додаткова затримка в межах свого кроку (частини схеми)
    anim: str = "rise"   # rise | grow-x | fade | pop | zoom


@dataclass
class Slide:
    kind: str            # cover | point | cta
    w: int
    h: int
    elements: list[Element] = field(default_factory=list)


def _text_block(lines, f, fill, spacing=1.2) -> Image.Image:
    step = int(f.size * spacing)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    w = int(max((probe.textlength(l, font=f) for l in lines), default=1)) + 4
    h = step * (len(lines) - 1) + int(f.size * 1.25)
    img = Image.new("RGBA", (max(w, 1), max(h, 1)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lines):
        d.text((0, i * step), l, font=f, fill=fill)
    return img


def background(w: int, h: int, glow: tuple[float, float] = (0.82, 0.18), strength: int = 34) -> Image.Image:
    """Графітовий фон із ледь помітною сіткою й стриманим рубіновим світлом (як hero на сайті)."""
    img = Image.new("RGB", (w, h), brand.GRAPHITE)
    d = ImageDraw.Draw(img)
    step = 54
    for x in range(0, w, step):
        d.line([x, 0, x, h], fill=(9, 12, 17))
    for y in range(0, h, step):
        d.line([0, y, w, y], fill=(9, 12, 17))
    gx, gy = int(w * glow[0]), int(h * glow[1])
    r = int(max(w, h) * 0.55)
    glow_img = Image.new("L", (w, h), 0)
    gd = ImageDraw.Draw(glow_img)
    for i in range(24, 0, -1):
        rr = r * i // 24
        gd.ellipse([gx - rr, gy - rr, gx + rr, gy + rr], fill=int(strength * (1 - i / 24) ** 1.6))
    ruby = Image.new("RGB", (w, h), brand.RUBY)
    return Image.composite(ruby, img, glow_img)


def layout(cfg: dict, article, spec: dict, index: int, total: int, w: int, h: int,
           top: int, bottom: int) -> Slide:
    """Розкладка слайда в межах безпечної зони [top, h-bottom]."""
    M = 88
    k = 1.18 if h >= 1800 else 1.0          # вертикальне відео: крупніший текст
    z = lambda v: int(round(v * k))  # noqa: E731
    s = Slide(spec.get("kind", "point"), w, h)
    host = cfg["site"]["base_url"].split("//")[-1].removeprefix("www.")
    L = cfg["languages"][article.lang]
    lock = brand.lockup(z(64))
    s.elements.append(Element("lockup", lock, (M, top + 8), 0))
    counter = _text_block([f"{index}/{total}"], brand.font("body-semi", z(26)), brand.SILVER)
    s.elements.append(Element("counter", counter, (w - M - counter.width, top + 26), 0))

    blocks: list[tuple[str, object, int]] = []   # (name, image або ("visual", spec), gap_after)
    vis_spec = spec.get("visual")
    if s.kind == "cover":
        img_src = visuals.service_image(article.services)
        if img_src and vis_spec is None:
            vis_spec = {"type": "image", "src": img_src}
        if vis_spec:
            blocks.append(("visual", vis_spec, 44))
        blocks.append(("kicker", _text_block([L["insights_title"].upper()], brand.font("body-semi", z(30)), brand.RUBY), 30))
        f, lines = brand.fit(spec["title"], "head", w - 2 * M, z(84), z(52), 4 if vis_spec else 6)
        blocks.append(("title", _text_block(lines, f, brand.WHITE, 1.12), 34))
        f2, lines2 = brand.fit(spec.get("text", ""), "body", w - 2 * M, z(38), z(28), 4 if vis_spec else 6)
        blocks.append(("body", _text_block(lines2, f2, brand.SILVER, 1.42), 0))
    elif s.kind == "cta":
        blocks.append(("logo", brand.logo(z(150)), 64))
        f, lines = brand.fit(spec["title"], "head", w - 2 * M, z(72), z(48), 4)
        blocks.append(("title", _text_block(lines, f, brand.WHITE, 1.15), 34))
        rule = Image.new("RGBA", (120, 6), (*brand.RUBY, 255))
        blocks.append(("rule", rule, 40))
        f2, lines2 = brand.fit(spec.get("text", ""), "body", w - 2 * M, z(40), z(30), 6)
        blocks.append(("body", _text_block(lines2, f2, brand.BODY, 1.45), 48))
        links = ["belyakovconsult.com", "Telegram  ·  Instagram  ·  Threads  ·  LinkedIn", "@belyakovconsult"]
        blocks.append(("links", _text_block(links, brand.font("body-semi", z(34)), brand.WHITE, 1.5), 0))
    else:
        if vis_spec is None:
            vis_spec = visuals.auto(spec)
        replaces = bool(vis_spec) and vis_spec.get("type") in visuals.TEXT_TYPES and not vis_spec.get("items")
        blocks.append(("num", _text_block([f"{index - 1:02d}"], brand.font("head", z(50)), brand.RUBY), 26))
        f, lines = brand.fit(spec.get("title", ""), "head", w - 2 * M, z(76), z(48), 3 if vis_spec else 4)
        blocks.append(("title", _text_block(lines, f, brand.WHITE, 1.15), 32))
        rule = Image.new("RGBA", (120, 6), (*brand.RUBY, 255))
        blocks.append(("rule", rule, 40))
        if vis_spec:
            blocks.append(("visual", vis_spec, 36 if not replaces else 0))
        if not replaces and spec.get("text"):
            f2, lines2 = brand.fit(spec.get("text", ""), "body", w - 2 * M, z(44 if vis_spec else 50), z(28), 4 if vis_spec else 12)
            blocks.append(("body", _text_block(lines2, f2, brand.BODY, 1.4), 0))

    area_top, area_bottom = top + 150, h - bottom - 120
    text_h = sum((0 if name == "visual" else img.height) + gap for name, img, gap in blocks)
    vis_h = 0
    if any(name == "visual" for name, _, _ in blocks):
        min_v = z(160) if s.kind == "cover" else z(220)
        vis_h = max(min_v, min(z(600), area_bottom - area_top - text_h))
        if text_h + vis_h > area_bottom - area_top:      # не залазити на підвал
            area_top = max(top + 120, area_bottom - text_h - vis_h)
    content_h = text_h + vis_h
    y = max(area_top, area_top + (area_bottom - area_top - content_h) // 2)
    for order, (name, img, gap) in enumerate(blocks, start=1):
        if name == "visual":
            vw = w - 2 * M
            parts, _ = visuals.render(img, spec, vw, vis_h, z)
            used_h = max((p.xy[1] + p.image.height for p in parts), default=0)
            dy = (vis_h - used_h) // 2 if used_h < vis_h else 0
            for p in parts:
                s.elements.append(Element("visual", p.image, (M + p.xy[0], y + dy + p.xy[1]), order, p.delay, p.anim))
            y += vis_h + gap
            continue
        s.elements.append(Element(name, img, (M, y), order))
        y += img.height + gap

    foot_f = brand.font("body-semi", z(28))
    foot = _text_block([brand.HANDLES], foot_f, brand.SILVER)
    s.elements.append(Element("footer", foot, (M, h - bottom - 70), 0))
    arrow = _text_block(["→" if index < total else ""], foot_f, brand.SILVER) if index < total else None
    if arrow:
        s.elements.append(Element("arrow", arrow, (w - M - arrow.width, h - bottom - 70), 0))
    _ = host
    return s


def slide_specs(cfg, article) -> list[dict]:
    L = cfg["languages"][article.lang]
    specs = [{"kind": "cover", "title": article.title, "text": article.description}]
    specs += [{"kind": "point", **c} for c in article.carousel]
    specs.append({"kind": "cta", "title": L["cta_title"], "text": L["cta_text"]})
    return specs


def compose(slide: Slide, bg: Image.Image | None = None) -> Image.Image:
    img = (bg or background(slide.w, slide.h)).convert("RGBA")
    accent = Image.new("RGBA", (slide.w, 10), (*brand.RUBY, 255))
    img.alpha_composite(accent, (0, 0))
    for e in slide.elements:
        img.alpha_composite(e.image, e.xy)
    return img.convert("RGB")


def og_image(cfg, article) -> Path:
    W, H, M = 1200, 630, 72
    img = background(W, H, glow=(0.9, 0.1), strength=40).convert("RGBA")
    img.alpha_composite(Image.new("RGBA", (10, H), (*brand.RUBY, 255)), (0, 0))
    src = visuals.service_image(article.services)
    if src:   # ілюстрація напряму праворуч, із плавним переходом у фон
        iw = int(W * .42)
        ph = visuals.v_image({"src": src}, iw, H, lambda v: v)[0].image
        fade = Image.linear_gradient("L").rotate(90).resize((iw, H)).point(lambda v: min(255, int(v * 1.6)))
        ph.putalpha(Image.composite(ph.getchannel("A"), Image.new("L", (iw, H), 0), fade))
        img.alpha_composite(ph, (W - iw, 0))
    img.alpha_composite(brand.lockup(58), (M, 52))
    kicker = _text_block([cfg["languages"][article.lang]["insights_title"].upper()], brand.font("body-semi", 22), brand.RUBY)
    img.alpha_composite(kicker, (M, 156))
    f, lines = brand.fit(article.title, "head", int(W * .62) - M, 58, 36, 4)
    img.alpha_composite(_text_block(lines, f, brand.WHITE, 1.14), (M, 196))
    d = ImageDraw.Draw(img)
    d.line([M, H - 96, W - M, H - 96], fill=brand.LINE, width=2)
    d.text((M, H - 74), f"{brand.HANDLES}   ·   {cfg['languages'][article.lang]['author']}",
           font=brand.font("body", 23), fill=brand.SILVER)
    out = social_asset_dir(cfg, article.slug, article.lang)
    out.mkdir(parents=True, exist_ok=True)
    p = out / "og.png"
    img.convert("RGB").save(p, optimize=True)
    return p


def carousel(cfg, article) -> list[Path]:
    if not article.carousel:
        return []
    W, H = 1080, 1350
    specs = slide_specs(cfg, article)
    out = social_asset_dir(cfg, article.slug, article.lang)
    out.mkdir(parents=True, exist_ok=True)
    bg = background(W, H)
    paths = []
    for i, spec in enumerate(specs, 1):
        img = compose(layout(cfg, article, spec, i, len(specs), W, H, top=60, bottom=40), bg)
        p = out / f"slide-{i}.png"
        img.save(p, optimize=True)
        img.save(out / f"slide-{i}.jpg", "JPEG", quality=92, optimize=True)  # API Instagram приймає лише JPEG
        paths.append(p)
    for extra in sorted(out.glob("slide-*.*")):   # прибрати зайві слайди, якщо їх стало менше
        n = extra.stem.split("-")[-1]
        if n.isdigit() and int(n) > len(specs):
            extra.unlink()
    return paths


def brand_sheet(cfg, article, frames: list[Image.Image] | None = None) -> Path:
    """Аркуш для перевірки бренду: прев'ю, усі картки, кадри відео."""
    out = social_asset_dir(cfg, article.slug, article.lang)
    tiles = [Image.open(out / "og.png")]
    tiles += [Image.open(p) for p in sorted(out.glob("slide-*.png"), key=lambda p: int(p.stem.split("-")[1]))]
    tiles += frames or []
    th = 420
    scaled = [t.convert("RGB").resize((round(t.width * th / t.height), th)) for t in tiles]
    row_w, rows, cur = 0, [], []
    for t in scaled:
        if cur and row_w + t.width > 2600:
            rows.append(cur); cur, row_w = [], 0
        cur.append(t); row_w += t.width + 16
    if cur:
        rows.append(cur)
    W = max(sum(t.width + 16 for t in r) for r in rows) + 16
    sheet = Image.new("RGB", (W, len(rows) * (th + 16) + 16), (40, 44, 52))
    y = 16
    for r in rows:
        x = 16
        for t in r:
            sheet.paste(t, (x, y)); x += t.width + 16
        y += th + 16
    p = out / "brand-check.png"
    sheet.save(p, optimize=True)
    return p


def main() -> int:
    problems = brand.check()
    if problems:
        print("ПОМИЛКА БРЕНДУ:\n- " + "\n- ".join(problems))
        return 1
    cfg = load_config()
    only = sys.argv[1] if len(sys.argv) > 1 else None
    arts = load_articles(cfg, include_drafts=True)
    n = 0
    for a in arts:
        if only and a.slug != only:
            continue
        if a.lang == "uk" or a.carousel or not any(x.slug == a.slug and x.lang == "uk" for x in arts):
            og_image(cfg, a)
            n += 1 + len(carousel(cfg, a))
            brand_sheet(cfg, a)
    print(f"Створено зображень: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
