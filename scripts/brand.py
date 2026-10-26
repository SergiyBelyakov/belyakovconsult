"""Бренд Belyakov Consult для всіх візуалів конвеєра: палітра, шрифти, логотип, підпис.

Джерела (не дублюються вручну):
- логотип: site/assets/bc-master-negative-brandbook.png (майстер-файл з брендбука);
- палітра: site/BRANDBOOK_CHANGELOG.txt, пункт 1;
- шрифти: як на сайті, Montserrat для заголовків, Inter для тексту.

check() перевіряє, що логотип і шрифти справжні. Якщо чогось бракує, збірка зупиняється
з помилкою, а не мовчки малює запасним шрифтом чи текстовим «BC.».
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "fonts"
LOGO_MASTER = ROOT / "site" / "assets" / "bc-master-negative-brandbook.png"

# Офіційна палітра брендбука
GRAPHITE = (5, 7, 10)        # #05070A  фон
MIDNIGHT = (9, 13, 20)       # #090D14
STEEL = (16, 21, 29)         # #10151D
WHITE = (244, 246, 248)      # #F4F6F8  текст
SILVER = (168, 176, 188)     # #A8B0BC  другорядний текст
RUBY = (217, 4, 41)          # #D90429  акцент
BODY = (205, 212, 220)       # основний текст на темному (між White і Silver)
LINE = (30, 38, 50)

TAGLINE = "BI • Data Architecture • Data Governance"
HANDLES = "belyakovconsult.com  ·  @belyakovconsult"


class BrandError(RuntimeError):
    pass


@lru_cache(maxsize=None)
def _font_path(kind: str) -> tuple[Path, int | None]:
    table = {
        "head": ("Montserrat-Variable.ttf", 800),
        "head-semi": ("Montserrat-Variable.ttf", 700),
        "body": ("Inter-Regular.otf", None),
        "body-semi": ("Inter-SemiBold.otf", None),
    }
    name, weight = table[kind]
    p = FONTS / name
    if not p.exists():
        raise BrandError(f"Немає шрифту бренду {p.name} у fonts/")
    return p, weight


@lru_cache(maxsize=512)
def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    p, weight = _font_path(kind)
    f = ImageFont.truetype(str(p), size)
    if weight is not None:
        f.set_variation_by_axes([weight])
    return f


@lru_cache(maxsize=None)
def logo_mark() -> Image.Image:
    """Знак BC. з майстер-файлу, на прозорому фоні."""
    if not LOGO_MASTER.exists():
        raise BrandError(f"Немає майстер-файлу логотипа {LOGO_MASTER.relative_to(ROOT)}")
    im = Image.open(LOGO_MASTER).convert("RGB")
    mask = im.point(lambda v: 255 if v > 60 else 0).convert("L")
    box = mask.getbbox()
    if not box:
        raise BrandError("Не вдалося знайти знак на майстер-файлі логотипа")
    im = im.crop(box)
    # Прозорість: відстань від кольору фону, з м'якими краями
    r, g, b = im.split()
    alpha = Image.merge("RGB", (r, g, b)).convert("L").point(lambda v: max(0, min(255, (v - 8) * 3)))
    red_alpha = r.point(lambda v: max(0, min(255, (v - 8) * 3)))
    alpha = Image.composite(red_alpha, alpha, red_alpha)  # червона крапка темна в L, беремо з R
    out = im.convert("RGBA")
    out.putalpha(alpha)
    return out


def logo(height: int) -> Image.Image:
    m = logo_mark()
    w = round(m.width * height / m.height)
    return m.resize((w, height), Image.LANCZOS)


def lockup(height: int) -> Image.Image:
    """Знак + тонкий розділювач + «Belyakov Consult» і сигнатура компетенцій, як у шапці сайту."""
    mark = logo(height)
    name_f = font("body-semi", max(12, round(height * 0.36)))
    tag_f = font("body", max(10, round(height * 0.22)))
    gap = round(height * 0.42)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    text_w = max(probe.textlength("Belyakov Consult", font=name_f), probe.textlength(TAGLINE, font=tag_f))
    w = int(mark.width + gap * 2 + 2 + text_w + 4)
    img = Image.new("RGBA", (w, height), (0, 0, 0, 0))
    img.alpha_composite(mark, (0, 0))
    x = mark.width + gap
    d = ImageDraw.Draw(img)
    d.line([x, round(height * 0.12), x, round(height * 0.88)], fill=(*SILVER, 110), width=2)
    x += gap
    d.text((x, round(height * 0.18)), "Belyakov Consult", font=name_f, fill=WHITE)
    d.text((x, round(height * 0.60)), TAGLINE, font=tag_f, fill=SILVER)
    return img


def wrap(text: str, f: ImageFont.FreeTypeFont, width: int) -> list[str]:
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    lines = []
    for para in str(text).split("\n"):
        cur = ""
        for w in para.split():
            trial = f"{cur} {w}".strip()
            if probe.textlength(trial, font=f) <= width:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = w
        lines.append(cur)
    return lines


def fit(text: str, kind: str, width: int, max_size: int, min_size: int, max_lines: int):
    """Найбільший шрифт, з яким текст вміщається в max_lines рядків і жодне слово не виходить за ширину.

    Якщо довге слово не вміщається навіть на min_size, шрифт зменшується далі: слово ніколи не обрізається.
    """
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    fits = lambda f, ls: all(probe.textlength(l, font=f) <= width for l in ls)  # noqa: E731
    for size in range(max_size, min_size - 1, -2):
        f = font(kind, size)
        lines = wrap(text, f, width)
        if len(lines) <= max_lines and fits(f, lines):
            return f, lines
    for size in range(min_size - 2, 9, -2):     # довге слово: зменшуємо нижче мінімуму, але не ріжемо
        f = font(kind, size)
        lines = wrap(text, f, width)
        if fits(f, lines) and len(lines) <= max_lines:
            return f, lines
    f = font(kind, min_size)
    lines = wrap(text, f, width)[:max_lines]
    lines[-1] = lines[-1].rstrip(".,; ") + "…"
    return f, lines


def check() -> list[str]:
    """Повертає список проблем бренду (порожній, якщо все гаразд)."""
    problems = []
    for kind in ("head", "head-semi", "body", "body-semi"):
        try:
            font(kind, 20)
        except Exception as e:  # noqa: BLE001
            problems.append(f"шрифт {kind}: {e}")
    try:
        m = logo_mark()
        if m.width < 200:
            problems.append("логотип замалий (менше 200 px): перевірте майстер-файл")
        # знак має містити рубіновий колір крапки
        px = m.convert("RGB").getcolors(1 << 20) or []
        if not any(c[1][0] > 180 and c[1][1] < 60 and c[1][2] < 80 for c in px):
            problems.append("на знаку не знайдено рубінової крапки: можливо, підмінено файл логотипа")
    except Exception as e:  # noqa: BLE001
        problems.append(f"логотип: {e}")
    return problems
