"""Каталог демо на сторінці Лабораторії даних (/cases/) з маніфесту shared/demos.json.

Компактні картки (напрям, назва, що всередині, «Відкрити демо» і «Детальніше») стоять одразу під
заголовком групи «Демо» між маркерами <!-- lab-catalog:start --> і <!-- lab-catalog:end -->.
Демо без версії мовою сторінки показується англійською з позначкою (EN).
Після демо йдуть експонати з розділу "exhibits" маніфесту (наприклад, 3D-сцена «Шлях даних»):
у них власна адреса (href). Експонат завжди останній: і в каталозі карток, і в групі «Демо», де його
опис (маркери <!-- lab-exhibits:start/end -->) ставиться перед групою «Кейси за напрямами»,
хоч би скільки демо додали вище. Чергування «reverse» рахується від кількості демо.

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
    "uk": {"open": "Відкрити демо", "more": "Детальніше", "count": "демо в лабораторії", "scene": "Відкрити сцену"},
    "en": {"open": "Open the demo", "more": "Details", "count": "demos in the lab", "scene": "Open the scene"},
    "pt": {"open": "Abrir a demo", "more": "Detalhes", "count": "demos no laboratório", "scene": "Abrir a cena"},
}
START, END = "<!-- lab-catalog:start -->", "<!-- lab-catalog:end -->"
XSTART, XEND = "<!-- lab-exhibits:start -->", "<!-- lab-exhibits:end -->"
CASES_HEAD = '<div class="lab-group-head" id="cases-by-domain">'


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


def exhibit(d: dict, lang: str) -> str:
    use = lang if lang in d["langs"] else "en"
    t, x = T[lang], d["lang"][use]
    mark = "" if use == lang else " (EN)"
    e = lambda s: html.escape(s, quote=True)  # noqa: E731
    href = d["href"][use]
    more = f'<a href="#{d["anchor"]}">{t["more"]}</a>' if d.get("anchor") else ""
    return (f'<article class="lab-cat-card lab-cat-exhibit"><span class="lab-cat-kind">{e(x["kind"])}</span>'
            f'<h3><a href="{href}">{e(x["name"])}{mark}</a></h3><p>{e(x["teaser"])}</p>'
            f'<div class="lab-cat-links"><a class="lab-cat-open" href="{href}">{t["scene"]} →</a>{more}</div></article>')


def exhibit_detail(d: dict, lang: str, reverse: bool) -> str:
    use = lang if lang in d["langs"] else "en"
    x = d["detail"][lang]
    e = lambda s: html.escape(s, quote=True)  # noqa: E731
    href = d["href"][use]
    links = "".join(f'<a href="{e(u)}">{e(n)}</a>' for u, n in x.get("links", []))
    return (f'<article class="case-detail case-demo{" reverse" if reverse else ""}" id="{d["anchor"]}">'
            f'<a class="case-detail-media case-demo-media" href="{href}"><img alt="{e(x["alt"])}" loading="lazy" src="{d["image"]}" width="1600" height="1000" style="object-position:center"/></a>'
            f'<div class="case-detail-copy"><span class="case-index">{e(x["kicker"])}</span><h2>{e(x["title"])}</h2><p>{e(x["text"])}</p>'
            f'<h3>{e(x["inside_h"])}</h3><p>{e(x["inside"])}</p>'
            f'<div class="case-demo-actions"><a class="btn btn-primary" href="{href}">{e(x["open"])}</a><a class="btn btn-secondary" href="#contact">{e(x["discuss"])}</a></div>'
            f'<div class="case-links">{links}</div></div></article>')


def main() -> None:
    manifest = json.loads((ROOT / "shared" / "demos.json").read_text(encoding="utf-8"))
    demos = [d for d in manifest["demos"] if d.get("status") == "live"]
    extras = [d for d in manifest.get("exhibits", []) if d.get("status") == "live"]
    for lang, p in PREFIX.items():
        f = SITE / p.strip("/") / "cases" / "index.html"
        s = f.read_text(encoding="utf-8")
        s = re.sub(rf"{re.escape(START)}.*?{re.escape(END)}", "", s, flags=re.S)
        m = re.search(r'<div class="lab-group-head" id="demos">.*?</div>', s, re.S)
        if not m:
            raise SystemExit(f"{f}: не знайдено заголовок групи демо")
        cards = "".join(card(d, lang) for d in demos) + "".join(exhibit(d, lang) for d in extras)
        block = f'{START}<div class="lab-catalog" data-count="{len(demos)}">{cards}</div>{END}'
        s = s[:m.end()] + block + s[m.end():]
        # опис експонатів: останнім у групі «Демо», перед групою кейсів
        s = re.sub(rf"{re.escape(XSTART)}.*?{re.escape(XEND)}", "", s, flags=re.S)
        details = [d for d in extras if d.get("detail")]
        if details:
            at = s.find(CASES_HEAD)
            if at < 0:
                raise SystemExit(f"{f}: не знайдено заголовок групи кейсів")
            n = s[s.find('<div class="lab-group-head" id="demos">'):at].count('<article class="case-detail case-demo')
            xblock = XSTART + "".join(exhibit_detail(d, lang, (n + i) % 2 == 1) for i, d in enumerate(details)) + XEND
            s = s[:at] + xblock + s[at:]
        f.write_text(s, encoding="utf-8")
        print(f.relative_to(ROOT), "←", len(demos), "демо,", len(extras), "експонат")


if __name__ == "__main__":
    main()
