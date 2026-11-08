"""Блок «Подивитися в лабораторії» на сторінках послуг: які демо показують цей напрям у дії.

Назви й описи беруться з самих сторінок демо (title і meta description), прев'ю з їхніх og-картинок.
Блок стоїть перед «Пов'язаними напрямами» між маркерами <!-- lab:start --> і <!-- lab:end -->,
тож повторний запуск замінює його, а не дублює.

Запуск: python scripts/make_service_lab.py
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
LANGS = {"uk": "", "en": "/en", "pt": "/pt"}

# напрям → демо з маніфесту shared/demos.json (порядок демо як у маніфесті)
MANIFEST = json.loads((ROOT / "shared" / "demos.json").read_text(encoding="utf-8"))
MAP: dict[str, list[str]] = {}
for _d in MANIFEST["demos"]:
    if _d.get("status") == "live":
        for _svc in _d["services"]:
            # поле featured: напрями, де демо стоїть першим (новіші демо інакше не влазять у три картки)
            if _svc in _d.get("featured", []):
                MAP.setdefault(_svc, []).insert(0, _d["slug"])
            else:
                MAP.setdefault(_svc, []).append(_d["slug"])
MAX_CARDS = 3                                   # не більше трьох демо на сторінці послуги (перші за маніфестом)
MAP = {k: v[:MAX_CARDS] for k, v in MAP.items()}
T = {
    "uk": {"kicker": "Подивитися в лабораторії", "title": "Цей напрям у дії на синтетичних даних", "open": "Відкрити демо"},
    "en": {"kicker": "See it in the lab", "title": "This service in action on synthetic data", "open": "Open the demo"},
    "pt": {"kicker": "Ver no laboratório", "title": "Este serviço em ação com dados sintéticos", "open": "Abrir a demo"},
}
START, END = "<!-- lab:start -->", "<!-- lab:end -->"
ANCHOR = '<section class="section detail-related">'


def demo_info(slug: str, lang: str) -> tuple[str, str, str, str]:
    """Назва, опис, прев'ю й мова демо; якщо версії мовою сторінки немає, береться англійська."""
    f = SITE / LANGS[lang].strip("/") / "cases" / slug / "index.html"
    if not f.exists():
        lang = "en"
        f = SITE / "en" / "cases" / slug / "index.html"
    s = f.read_text(encoding="utf-8")
    title = html.unescape(re.search(r"<title>(.*?)</title>", s, re.S).group(1)).split(" | ")[0].strip()
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', s).group(1))
    img = f"/assets/cases/{slug}-og{'' if lang == 'uk' else '-' + lang}.jpg"
    return title, desc, img, lang


def block(service: str, lang: str) -> str:
    t, p = T[lang], LANGS[lang]
    cards = []
    for slug in MAP[service]:
        title, desc, img, used = demo_info(slug, lang)
        href = f"{LANGS[used]}/cases/{slug}/"
        mark = "" if used == lang else " (EN)"
        e = lambda x: html.escape(x, quote=True)  # noqa: E731
        cards.append(
            f'<a class="lab-card" href="{href}"><img alt="" loading="lazy" decoding="async" width="1200" height="630" src="{img}"/>'
            f'<span class="lab-card-body"><strong>{e(title)}{mark}</strong><small>{e(desc)}</small><em>{t["open"]} →</em></span></a>')
    return (f'{START}<section class="section detail-section lab-section"><div class="container"><span class="section-kicker">{t["kicker"]}</span>'
            f'<h2 class="section-title">{t["title"]}</h2><div class="lab-grid">{"".join(cards)}</div></div></section>{END}\n')


def main() -> None:
    for service in MAP:
        for lang in LANGS:
            f = SITE / LANGS[lang].strip("/") / service / "index.html"
            s = f.read_text(encoding="utf-8")
            s = re.sub(rf"{re.escape(START)}.*?{re.escape(END)}\n?", "", s, flags=re.S)
            if ANCHOR not in s:
                raise SystemExit(f"{f}: не знайдено місце для блоку")
            s = s.replace(ANCHOR, block(service, lang) + ANCHOR, 1)
            f.write_text(s, encoding="utf-8")
            print(f.relative_to(ROOT), "←", ", ".join(MAP[service]))


if __name__ == "__main__":
    main()
