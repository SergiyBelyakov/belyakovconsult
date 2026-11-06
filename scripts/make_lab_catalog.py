"""Каталог демо на сторінці Лабораторії даних (/cases/) з маніфесту shared/demos.json.

Компактні картки (напрям, назва, що всередині, «Відкрити демо» і «Детальніше») стоять одразу під
заголовком групи «Демо» між маркерами <!-- lab-catalog:start --> і <!-- lab-catalog:end -->.
Демо без версії мовою сторінки показується англійською з позначкою (EN).

Запуск: python scripts/make_lab_catalog.py
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
PREFIX = {"uk": "", "en": "/en", "pt": "/pt"}
T = {
    "uk": {"open": "Відкрити демо", "more": "Детальніше", "count": "демо в лабораторії"},
    "en": {"open": "Open the demo", "more": "Details", "count": "demos in the lab"},
    "pt": {"open": "Abrir a demo", "more": "Detalhes", "count": "demos no laboratório"},
}
START, END = "<!-- lab-catalog:start -->", "<!-- lab-catalog:end -->"


def card(d: dict, lang: str) -> str:
    use = lang if lang in d["langs"] else "en"
    t, x = T[lang], d["lang"][use]
    mark = "" if use == lang else " (EN)"
    e = lambda s: html.escape(s, quote=True)  # noqa: E731
    href = f'{PREFIX[use]}/cases/{d["slug"]}/'
    return (f'<article class="lab-cat-card"><span class="lab-cat-kind">{e(x["kind"])}</span>'
            f'<h3><a href="{href}">{e(x["name"])}{mark}</a></h3><p>{e(x["teaser"])}</p>'
            f'<div class="lab-cat-links"><a class="lab-cat-open" href="{href}">{t["open"]} →</a>'
            f'<a href="#{d["anchor"]}">{t["more"]}</a></div></article>')


def main() -> None:
    demos = [d for d in json.loads((ROOT / "shared" / "demos.json").read_text(encoding="utf-8"))["demos"] if d.get("status") == "live"]
    for lang, p in PREFIX.items():
        f = SITE / p.strip("/") / "cases" / "index.html"
        s = f.read_text(encoding="utf-8")
        s = re.sub(rf"{re.escape(START)}.*?{re.escape(END)}", "", s, flags=re.S)
        m = re.search(r'<div class="lab-group-head" id="demos">.*?</div>', s, re.S)
        if not m:
            raise SystemExit(f"{f}: не знайдено заголовок групи демо")
        block = f'{START}<div class="lab-catalog" data-count="{len(demos)}">{"".join(card(d, lang) for d in demos)}</div>{END}'
        s = s[:m.end()] + block + s[m.end():]
        f.write_text(s, encoding="utf-8")
        print(f.relative_to(ROOT), "←", len(demos), "демо")


if __name__ == "__main__":
    main()
