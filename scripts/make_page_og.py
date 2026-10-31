"""Прев'ю (Open Graph) для статичних сторінок сайту окремо для кожної мови.

Для кожної сторінки малюється картка 1200×630 у стилі прев'ю статей: знак, рубрика, головна теза сторінки (h1)
мовою сторінки й ілюстрація напряму. Результат лежить у site/assets/og/<сторінка>-<мова>.jpg,
а мета-теги og:image і twitter:image на сторінці оновлюються.

LinkedIn, Facebook і месенджери беруть картинку з og:image. Велика спільна картинка 4000×2250
підтягувалася не завжди, тому тут легкі JPEG точного розміру 1200×630.

Запуск: python scripts/make_page_og.py            (усі сторінки)
        python scripts/make_page_og.py --check    (лише перевірити, що в кожної сторінки є своя картинка)
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_cards  # noqa: E402
import visuals  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
OUT = SITE / "assets" / "og"
BASE = "https://www.belyakovconsult.com"
LANGS = {"uk": "", "en": "/en", "pt": "/pt"}
W, H, M = 1200, 630, 72

# сторінка → (рубрика за мовами, ілюстрація)
SERVICE = {
    "data-strategy": "service-consulting.webp", "data-analysis": "service-data-analysis.webp",
    "business-intelligence": "service-bi.webp", "financial-analytics": "service-financial-analytics.webp",
    "management-analytics": "service-management-analytics.webp", "data-architecture": "service-architecture.webp",
    "data-quality": "service-quality.webp", "data-governance": "service-governance.webp",
    "geospatial-analysis": "service-geospatial.webp",
}
KICKER = {
    "": {"uk": "Аналітика даних", "en": "Data analytics", "pt": "Análise de dados"},
    "cases": {"uk": "Кейси", "en": "Cases", "pt": "Casos"},
    "sergiy-belyakov": {"uk": "Про мене", "en": "About", "pt": "Sobre mim"},
    "data-journey": {"uk": "Шлях даних", "en": "The data journey", "pt": "O percurso dos dados"},
    "insights": {"uk": "Матеріали", "en": "Insights", "pt": "Artigos"},
}
IMAGE = {"": "hero.webp", "cases": "case-social.webp", "sergiy-belyakov": "service-consulting.webp",
         "data-journey": "hero.webp", "insights": "service-data-analysis.webp", **SERVICE}
SERVICE_LABEL = {"uk": "Послуги", "en": "Services", "pt": "Serviços"}
HANDLE_AUTHOR = {"uk": "Сергій Бєляков", "en": "Sergiy Belyakov", "pt": "Sergiy Belyakov"}


def page_file(slug: str, lang: str) -> Path:
    return SITE / LANGS[lang].strip("/") / slug / "index.html" if slug else SITE / LANGS[lang].strip("/") / "index.html"


def page_url(slug: str, lang: str) -> str:
    return BASE + LANGS[lang] + ("/" + slug + "/" if slug else "/")


def clean(s: str) -> str:
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def meta(s: str, prop: str) -> str | None:
    m = re.search(rf'<meta[^>]*(?:property|name)="{re.escape(prop)}"[^>]*>', s)
    if not m:
        return None
    c = re.search(r'content="([^"]*)"', m.group(0))
    return html.unescape(c.group(1)) if c else None


def texts(slug: str, lang: str, s: str) -> tuple[str, str]:
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", s, re.S)
    title = clean(h1.group(1)) if h1 else (meta(s, "og:title") or "").split(" | ")[0]
    if slug in SERVICE:
        name = (meta(s, "og:title") or "").split(" | ")[0]
        kicker = f"{SERVICE_LABEL[lang]} · {name.split(' (')[0]}"
    else:
        kicker = KICKER[slug][lang]
    return kicker, title


def render(kicker: str, title: str, image: str, lang: str) -> Image.Image:
    img = make_cards.background(W, H, glow=(0.9, 0.1), strength=40).convert("RGBA")
    img.alpha_composite(Image.new("RGBA", (10, H), (*brand.RUBY, 255)), (0, 0))
    if image and (SITE / "assets" / image).exists():
        iw, ih = int(W * .40), H - 200
        part = visuals.v_image({"src": f"assets/{image}"}, iw, ih, lambda v: v)[0]
        img.alpha_composite(part.image, (W - M - iw + part.xy[0], 60 + part.xy[1]))
    img.alpha_composite(brand.lockup(58), (M, 52))
    k = make_cards._text_block([kicker.upper()], brand.font("body-semi", 22), brand.RUBY)
    img.alpha_composite(k, (M, 156))
    f, lines = brand.fit(title, "head", int(W * .56) - M, 54, 32, 4)
    img.alpha_composite(make_cards._text_block(lines, f, brand.WHITE, 1.14), (M, 196))
    d = ImageDraw.Draw(img)
    d.line([M, H - 96, W - M, H - 96], fill=brand.LINE, width=2)
    d.text((M, H - 74), f"{brand.HANDLES}   ·   {HANDLE_AUTHOR[lang]}", font=brand.font("body", 23), fill=brand.SILVER)
    return img.convert("RGB")


def set_meta(s: str, prop: str, value: str, after: str | None = None) -> str:
    """Замінити content у мета-тегу або додати тег після іншого (якщо його немає)."""
    attr = "name" if prop.startswith("twitter:") else "property"
    pat = re.compile(rf'<meta[^>]*{attr}="{re.escape(prop)}"[^>]*/?>')
    tag = f'<meta content="{html.escape(value, quote=True)}" {attr}="{prop}"/>'
    if pat.search(s):
        return pat.sub(lambda _: tag, s, count=1)
    anchor = re.search(rf'<meta[^>]*(?:property|name)="{re.escape(after)}"[^>]*/?>', s) if after else None
    if anchor:
        return s[:anchor.end()] + "\n" + tag + s[anchor.end():]
    i = s.index("</head>")
    return s[:i] + tag + "\n" + s[i:]


def pages() -> list[tuple[str, str]]:
    out = []
    for slug in IMAGE:
        for lang in LANGS:
            if page_file(slug, lang).exists():
                out.append((slug, lang))
    return out


def main() -> int:
    check = "--check" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    problems = []
    for slug, lang in pages():
        f = page_file(slug, lang)
        s = f.read_text(encoding="utf-8")
        name = (slug or "home") + f"-{lang}.jpg"
        url = f"{BASE}/assets/og/{name}"
        if check:
            if meta(s, "og:image") != url or not (OUT / name).exists():
                problems.append(f"{f.relative_to(ROOT)}: og:image не {url}")
            continue
        kicker, title = texts(slug, lang, s)
        render(kicker, title, IMAGE[slug], lang).save(OUT / name, "JPEG", quality=86, optimize=True, progressive=True)
        page_title = (meta(s, "og:title") or clean(re.search(r"<title>(.*?)</title>", s, re.S).group(1)))
        desc = meta(s, "og:description") or meta(s, "description") or ""
        if not meta(s, "og:title"):   # сторінки без Open Graph (шлях даних): додаємо повний набір
            s = set_meta(s, "og:type", "website")
            s = set_meta(s, "og:site_name", "Belyakov Consult", "og:type")
            s = set_meta(s, "og:title", page_title, "og:site_name")
            s = set_meta(s, "og:description", desc, "og:title")
            s = set_meta(s, "og:url", page_url(slug, lang), "og:description")
        s = set_meta(s, "og:image", url, "og:url")
        s = set_meta(s, "og:image:secure_url", url, "og:image")
        s = set_meta(s, "og:image:type", "image/jpeg", "og:image:secure_url")
        s = set_meta(s, "og:image:width", "1200", "og:image:type")
        s = set_meta(s, "og:image:height", "630", "og:image:width")
        s = set_meta(s, "og:image:alt", f"{kicker}. {title}", "og:image:height")
        s = set_meta(s, "twitter:card", "summary_large_image", "og:image:alt")
        s = set_meta(s, "twitter:title", page_title, "twitter:card")
        s = set_meta(s, "twitter:description", desc, "twitter:title")
        s = set_meta(s, "twitter:image", url, "twitter:description")
        f.write_text(s, encoding="utf-8")
        print(f"{f.relative_to(ROOT)} → assets/og/{name}  [{kicker}] {title}")
    if problems:
        print("\n".join(problems))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
