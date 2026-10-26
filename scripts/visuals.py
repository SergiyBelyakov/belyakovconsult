"""Візуалізації для слайдів: прості схеми й картинки в палітрі бренду.

Кожна візуалізація повертає набір частин (Part). На картці вони складаються в одну
картинку, у відео з'являються по черзі (delay) з власною анімацією (anim).

Задається в статті, у слайді каруселі:

    carousel:
      - title: Дві цифри, і обидві правильні
        text: ...
        visual:
          type: bars
          items: [{label: "Підрозділ А", value: 41200}, {label: "Підрозділ Б", value: 38900}]

Типи: bars, list, grid, flow, compare, fields, doc, image.
Для list/grid/flow без items пункти беруться з рядків text, і текст під схемою не дублюється.
Якщо visual не задано, тип вибирається автоматично (див. auto()).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

import brand

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "site" / "assets"

SERVICE_IMAGES = {
    "data-strategy": "service-consulting.webp", "data-analysis": "service-data-analysis.webp",
    "business-intelligence": "service-bi.webp", "financial-analytics": "service-financial-analytics.webp",
    "management-analytics": "service-management-analytics.webp", "data-architecture": "service-architecture.webp",
    "data-quality": "service-quality.webp", "data-governance": "service-governance.webp",
    "geospatial-analysis": "service-geospatial.webp",
}
TEXT_TYPES = {"list", "grid", "flow"}


@dataclass
class Part:
    image: Image.Image
    xy: tuple[int, int]      # відносно лівого верхнього кута області візуалізації
    delay: float = 0.0       # секунди від початку появи візуалізації
    anim: str = "rise"       # rise | grow-x | fade | pop | zoom | count
    meta: dict = field(default_factory=dict)


def _rgba(c, a=255):
    return (*c, a)


def _canvas(w, h):
    return Image.new("RGBA", (max(1, int(w)), max(1, int(h))), (0, 0, 0, 0))


def _card(w, h, radius, fill=brand.STEEL, outline=(255, 255, 255, 28), accent=False):
    img = _canvas(w, h)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius, fill=_rgba(fill, 235), outline=outline, width=2)
    if accent:
        d.rounded_rectangle([0, 0, 8, h - 1], 4, fill=_rgba(brand.RUBY))
    return img


def _text(s, f, fill):
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    w = int(probe.textlength(s, font=f)) + 4
    img = _canvas(w, int(f.size * 1.3))
    ImageDraw.Draw(img).text((0, 0), s, font=f, fill=fill)
    return img


def _fmt_num(v, sep: str = " ") -> str:
    if isinstance(v, (int, float)) and float(v).is_integer():
        return f"{int(v):,}".replace(",", sep)
    return str(v)


def icon_check(size, color=brand.RUBY):
    img = _canvas(size, size)
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, size - 1, size - 1], outline=_rgba(color), width=max(2, size // 12))
    w = max(3, size // 9)
    d.line([size * .28, size * .52, size * .44, size * .68, size * .74, size * .34], fill=_rgba(color), width=w, joint="curve")
    return img


def icon_cross(size, color=brand.SILVER):
    img = _canvas(size, size)
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, size - 1, size - 1], outline=_rgba(color, 200), width=max(2, size // 12))
    w = max(3, size // 9)
    d.line([size * .33, size * .33, size * .67, size * .67], fill=_rgba(color), width=w)
    d.line([size * .67, size * .33, size * .33, size * .67], fill=_rgba(color), width=w)
    return img


def icon_num(n, size):
    img = _canvas(size, size)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], size // 4, fill=_rgba(brand.RUBY, 40), outline=_rgba(brand.RUBY), width=2)
    f = brand.font("head", int(size * .46))
    t = str(n)
    tw = d.textlength(t, font=f)
    d.text(((size - tw) / 2, size * .2), t, font=f, fill=brand.WHITE)
    return img


def arrow_down(w, h, color=brand.RUBY):
    img = _canvas(w, h)
    d = ImageDraw.Draw(img)
    cx = w // 2
    d.line([cx, 0, cx, h - h * .35], fill=_rgba(color, 220), width=4)
    d.polygon([(cx - h * .3, h - h * .4), (cx + h * .3, h - h * .4), (cx, h)], fill=_rgba(color))
    return img


# ------------------------------------------------------------------ типи

def v_bars(spec, w, h, z):
    items = spec.get("items", [])[:4]
    if not items:
        return []
    vmax = max(float(i["value"]) for i in items) or 1
    label_f, value_f = brand.font("body-semi", z(30)), brand.font("head", z(46))
    note_h = int(z(26) * 1.6) if spec.get("note") else 0
    row_h = min((h - note_h) // len(items), z(150))
    bar_h = int(row_h * .34)
    parts = []
    for k, it in enumerate(items):
        y = k * row_h
        parts.append(Part(_text(it["label"], label_f, brand.SILVER), (0, y), k * .25, "fade"))
        val = _text(_fmt_num(it["value"], spec.get("thousands", " ")), value_f, brand.WHITE)
        bw = int((w - val.width - z(24)) * float(it["value"]) / vmax)
        bar = _canvas(bw, bar_h)
        bd = ImageDraw.Draw(bar)
        color = brand.RUBY if k == 0 else (120, 128, 140)
        bd.rounded_rectangle([0, 0, bw - 1, bar_h - 1], bar_h // 2, fill=_rgba(color))
        by = y + int(label_f.size * 1.45)
        parts.append(Part(bar, (0, by), k * .25 + .1, "grow-x"))
        parts.append(Part(val, (bw + z(20), by + (bar_h - value_f.size) // 2 - z(4)), k * .25 + .1, "count",
                          {"value": float(it["value"]), "sep": spec.get("thousands", " "), "size": value_f.size}))
    if spec.get("note"):
        nf = brand.font("body", z(26))
        parts.append(Part(_text(spec["note"], nf, brand.SILVER), (0, len(items) * row_h + z(4)), .9, "fade"))
    return parts


def v_list(spec, w, h, z, items):
    items = items[:6]
    gap = z(16)
    row_h = min((h - gap * (len(items) - 1)) // len(items), z(150))
    ic_size = min(int(row_h * .5), z(56))
    tw = w - z(28) - ic_size - z(24) - z(24)
    f, _ = brand.fit(max(items, key=len), "body-semi", tw, z(40), z(26), 2)
    parts = []
    for k, it in enumerate(items):
        card = _card(w, row_h, z(18), accent=True)
        d = ImageDraw.Draw(card)
        ic = icon_num(k + 1, ic_size) if spec.get("numbered") else icon_check(ic_size)
        card.alpha_composite(ic, (z(28), (row_h - ic.height) // 2))
        lines = brand.wrap(it, f, tw)[:2]
        lh = int(f.size * 1.2)
        y = (row_h - lh * len(lines)) // 2 - z(2)
        for ln in lines:
            d.text((z(28) + ic.width + z(24), y), ln, font=f, fill=brand.WHITE)
            y += lh
        parts.append(Part(card, (0, k * (row_h + gap)), k * .18, "rise"))
    return parts


def v_grid(spec, w, h, z, items):
    items = items[:4]
    gap = z(18)
    cw, ch = (w - gap) // 2, min((h - gap) // 2, z(290))
    f_num = brand.font("head", z(40))
    parts = []
    for k, it in enumerate(items):
        card = _card(cw, ch, z(20))
        d = ImageDraw.Draw(card)
        d.text((z(26), z(20)), f"{k + 1:02d}", font=f_num, fill=brand.RUBY)
        fl, lines = brand.fit(it, "head-semi", cw - z(52), z(42), z(26), 3)
        y = z(26) + int(f_num.size * 1.4)
        for ln in lines:
            d.text((z(26), y), ln, font=fl, fill=brand.WHITE)
            y += int(fl.size * 1.22)
        parts.append(Part(card, ((k % 2) * (cw + gap), (k // 2) * (ch + gap)), k * .2, "pop"))
    return parts


def v_flow(spec, w, h, z, items):
    items = items[:5]
    ah = z(34)
    bh = min((h - ah * (len(items) - 1)) // len(items), z(120))
    f, _ = brand.fit(max(items, key=len), "body-semi", w - int(bh * .6) - z(70), z(38), z(24), 1)
    parts, y = [], 0
    for k, it in enumerate(items):
        card = _card(w, bh, z(16), accent=(k == len(items) - 1))
        d = ImageDraw.Draw(card)
        ic = icon_num(k + 1, int(bh * .6))
        card.alpha_composite(ic, (z(22), (bh - ic.height) // 2))
        d.text((z(22) + ic.width + z(22), (bh - f.size) // 2 - z(3)), it, font=f, fill=brand.WHITE)
        parts.append(Part(card, (0, y), k * .3, "rise"))
        y += bh
        if k < len(items) - 1:
            parts.append(Part(arrow_down(z(40), ah - z(6)), (z(22) + ic.width // 2 - z(20), y + z(3)), k * .3 + .18, "fade"))
            y += ah
    return parts


def v_compare(spec, w, h, z):
    gap = z(22)
    cw, ch = (w - gap) // 2, min(h, z(330))
    parts = []
    for k, side in enumerate((spec.get("left", {}), spec.get("right", {}))):
        hot = k == 1 if spec.get("highlight", "right") == "right" else k == 0
        card = _card(cw, ch, z(22), fill=brand.STEEL, outline=_rgba(brand.RUBY, 255) if hot else (255, 255, 255, 28))
        d = ImageDraw.Draw(card)
        lf = brand.font("body-semi", z(28))
        d.text((z(26), z(26)), str(side.get("label", "")), font=lf, fill=brand.SILVER)
        vf, lines = brand.fit(str(side.get("value", "")), "head", cw - z(52), z(96), z(40), 2)
        y = z(26) + int(lf.size * 1.8)
        for ln in lines:
            d.text((z(26), y), ln, font=vf, fill=brand.RUBY if hot else brand.WHITE)
            y += int(vf.size * 1.1)
        if side.get("note"):
            nf, nl = brand.fit(str(side["note"]), "body", cw - z(52), z(26), z(20), 3)
            y += z(10)
            for ln in nl:
                d.text((z(26), y), ln, font=nf, fill=brand.BODY)
                y += int(nf.size * 1.3)
        parts.append(Part(card, (k * (cw + gap), 0), k * .45, "pop"))
    return parts


def v_fields(spec, w, h, z):
    rows = spec.get("items", [])[:5]
    gap = z(12)
    rh = min((h - gap * (len(rows) - 1)) // max(1, len(rows)), z(110))
    mono = brand.font("body-semi", z(38))
    nf = brand.font("body", z(28))
    parts = []
    for k, r in enumerate(rows):
        ok = bool(r.get("ok"))
        card = _card(w, rh, z(14), outline=_rgba(brand.RUBY, 255) if not ok else (255, 255, 255, 28))
        d = ImageDraw.Draw(card)
        ic = (icon_check(int(rh * .5), (82, 196, 140)) if ok else icon_cross(int(rh * .5), brand.RUBY))
        card.alpha_composite(ic, (z(22), (rh - ic.height) // 2))
        x = z(22) + ic.width + z(22)
        d.text((x, (rh - mono.size) // 2 - z(4)), str(r.get("value", "")), font=mono, fill=brand.WHITE)
        if r.get("note"):
            nt = str(r["note"])
            tw = d.textlength(nt, font=nf)
            d.text((w - z(24) - tw, (rh - nf.size) // 2 - z(2)), nt, font=nf, fill=brand.SILVER)
        parts.append(Part(card, (0, k * (rh + gap)), k * .22, "rise"))
    return parts


def v_doc(spec, w, h, z):
    """Стос сторінок регламенту з позначкою: «обсяг є, відповіді немає»."""
    dw, dh = int(min(w * .44, h * .8)), int(min(h * .86, w * .6))
    stack = _canvas(dw + z(60), dh + z(60))
    d = ImageDraw.Draw(stack)
    for i in range(4, -1, -1):
        off = i * z(12)
        d.rounded_rectangle([off, off, off + dw, off + dh], z(14),
                            fill=_rgba(brand.STEEL if i else (24, 30, 40), 255), outline=(255, 255, 255, 40), width=2)
    x0, y0 = z(30), z(36)
    for i in range(7):
        d.rounded_rectangle([x0, y0 + i * z(34), x0 + int(dw * (.86 if i % 3 else .6)) - z(30), y0 + i * z(34) + z(12)],
                            z(6), fill=(255, 255, 255, 38))
    label = spec.get("label", "")
    if label:
        lf, ll = brand.fit(label, "head-semi", dw - 2 * x0, z(30), z(20), 2)
        yy = dh - z(24) - int(lf.size * 1.25) * len(ll)
        for ln in ll:
            d.text((x0, yy), ln, font=lf, fill=brand.SILVER)
            yy += int(lf.size * 1.25)
    parts = [Part(stack, (0, (h - stack.height) // 2), 0, "rise")]
    q = _canvas(z(170), z(170))
    qd = ImageDraw.Draw(q)
    qd.ellipse([0, 0, z(168), z(168)], fill=_rgba(brand.RUBY))
    qf = brand.font("head", z(110))
    tw = qd.textlength("?", font=qf)
    qd.text(((z(170) - tw) / 2, z(14)), "?", font=qf, fill=brand.WHITE)
    parts.append(Part(q, (dw - z(60), (h - stack.height) // 2 - z(10)), .5, "pop"))
    if spec.get("note"):
        nf, nl = brand.fit(spec["note"], "head", w - dw - z(130), z(52), z(28), 4)
        img = _canvas(w - dw - z(110), int(nf.size * 1.3 * len(nl)) + z(10))
        dd = ImageDraw.Draw(img)
        for i, ln in enumerate(nl):
            dd.text((0, i * int(nf.size * 1.3)), ln, font=nf, fill=brand.WHITE)
        parts.append(Part(img, (dw + z(110), (h - img.height) // 2), .8, "fade"))
    return parts


def v_image(spec, w, h, z):
    src = spec.get("src")
    p = (ROOT / src) if src and not str(src).startswith("assets/") else ASSETS / str(src).removeprefix("assets/")
    if not p.exists():
        return []
    im = Image.open(p).convert("RGB")
    # cover-fit
    r = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1), Image.LANCZOS)
    left, top = (im.width - w) // 2, (im.height - h) // 2
    im = im.crop((left, top, left + w, top + h)).convert("RGBA")
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], z(26), fill=255)
    fade = Image.linear_gradient("L").resize((w, h))          # знизу затемнення в фон
    fade = fade.point(lambda v: 255 if v < 150 else int(255 - (v - 150) * 1.6))
    mask = Image.composite(mask, Image.new("L", (w, h), 0), fade)
    im.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
    return [Part(im, (0, 0), 0, "zoom")]


def auto(slide: dict) -> dict | None:
    text = slide.get("text", "") or ""
    lines = [l.strip(" .") for l in text.split("\n") if l.strip()]
    if len(lines) >= 3:
        return {"type": "list"}
    nums = re.findall(r"\d[\d\s]{2,}\d", text)
    if len(nums) >= 2:
        vals = [int(n.replace(" ", "")) for n in nums[:2]]
        return {"type": "bars", "items": [{"label": "A", "value": vals[0]}, {"label": "Б", "value": vals[1]}]}
    return None


def render(spec: dict | None, slide: dict, w: int, h: int, z) -> tuple[list[Part], bool]:
    """Повертає (частини, чи замінює візуалізація текст слайда)."""
    if spec is None:
        spec = auto(slide)
    if not spec:
        return [], False
    t = spec.get("type")
    lines = [l.strip(" .") for l in (slide.get("text") or "").split("\n") if l.strip()]
    items = spec.get("items") or lines
    replaces = t in TEXT_TYPES and not spec.get("items")
    if t in TEXT_TYPES:
        items = [i if isinstance(i, str) else i.get("label", "") for i in items]
    fn = {"bars": lambda: v_bars(spec, w, h, z), "list": lambda: v_list(spec, w, h, z, items),
          "grid": lambda: v_grid(spec, w, h, z, items), "flow": lambda: v_flow(spec, w, h, z, items),
          "compare": lambda: v_compare(spec, w, h, z), "fields": lambda: v_fields(spec, w, h, z),
          "doc": lambda: v_doc(spec, w, h, z), "image": lambda: v_image(spec, w, h, z)}.get(t)
    if not fn:
        return [], False
    return fn(), replaces


def flatten(parts: list[Part], w: int, h: int) -> Image.Image:
    img = _canvas(w, h)
    for p in parts:
        x, y = p.xy
        if x < w and y < h:
            img.alpha_composite(p.image.crop((0, 0, min(p.image.width, w - x), min(p.image.height, h - y))), (x, y))
    return img


def service_image(services: list[str]) -> str | None:
    for s in services:
        if s in SERVICE_IMAGES and (ASSETS / SERVICE_IMAGES[s]).exists():
            return f"assets/{SERVICE_IMAGES[s]}"
    return None
