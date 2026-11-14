"""Блок «Досвід» на сторінці «Про мене» (/sergiy-belyakov/, UA, EN, PT): інтерактивна шкала етапів.

Дані й тексти лежать у shared/about.json: етапи (організація, місяці початку й кінця, хто фінансував),
підписи трьома мовами і тихий рядок фактів під шкалою (освіта, сертифікати, мови).
Скрипт малює розділ і ставить його між маркерами <!-- about-experience:start --> і
<!-- about-experience:end --> на кожній мовній сторінці. Решту сторінки (перший екран із портретом,
вступ, послуги) скрипт не чіпає.

Без JavaScript розділ читається як список: назва, роки, пояснення і статична шкала на місяць as_of.
Зі скриптом site/profile.js шкала рахується від поточної дати, працюють вибір етапу, фільтр донорів
і курсор року. Вигляд описано в site/profile.css.

Запуск: python scripts/make_about.py            (оновити три сторінки)
        python scripts/make_about.py --check    (лише перевірити, що сторінки відповідають даним)
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
DATA = ROOT / "shared" / "about.json"
PAGES = {"uk": "sergiy-belyakov/index.html", "en": "en/sergiy-belyakov/index.html", "pt": "pt/sergiy-belyakov/index.html"}
START, END = "<!-- about-experience:start -->", "<!-- about-experience:end -->"
SHORT = 0.6   # етап, коротший за це число років, показано одним вузлом без лінії
e = lambda s: html.escape(str(s), quote=True)  # noqa: E731


def month(value: str, end: bool = False) -> float:
    """РРРР-ММ у роки з дробом: початок місяця або його кінець."""
    y, m = (int(x) for x in value.split("-"))
    return round(y + (m if end else m - 1) / 12, 3)


def scale(data: dict) -> tuple[int, int, float]:
    """Шкала для сторінки без скриптів: перший рік, рік після поточного і «сьогодні» на місяць as_of."""
    y, m = (int(x) for x in data["as_of"].split("-"))
    now = round(y + (m - 0.5) / 12, 3)
    return int(data["min_year"]), int(now) + 1, now


def years(t: dict, start: float, end: float | None) -> str:
    y0 = int(start)
    if end is None:
        return t["since"].format(y=y0)
    y1 = int(end - 1e-6)
    return str(y0) if y1 == y0 else f"{y0}-{y1}"


def render(data: dict, lang: str) -> str:
    t = data["lang"][lang]
    lo, hi, now = scale(data)
    pct = lambda v: f"{v / (hi - lo) * 100:.3f}%"  # noqa: E731

    chips = f'<button aria-pressed="true" class="exp-chip" data-donor="" type="button">{e(t["all"])}</button>'
    chips += "".join(f'<button aria-pressed="false" class="exp-chip" data-donor="{d}" type="button">{e(t["donors"][d])}</button>'
                     for d in data["donors"])
    # підпис року, що впритул до «сьогодні», пропускаємо: там стоїть сама позначка
    ticks = "".join(f'<span style="left:{pct(y - lo)}">{y}</span>' for y in range(lo, hi, 2) if now - y >= 1.7)
    ticks += f'<span class="exp-today" style="left:{pct(now - lo)}">{e(t["today"])}</span>'

    rows = []
    for st in data["stages"]:
        start = month(st["start"])
        end = month(st["end"], True) if st["end"] else None
        stop = now if end is None else end
        x = t["stages"][st["id"]]
        cls = "exp-row" + (" is-now" if end is None else "") + (" is-short" if stop - start < SHORT else "")
        attrs = f' data-start="{start}"' + (f' data-end="{end}"' if end is not None else "")
        attrs += f' data-donors="{" ".join(st["donors"])}"' + (" data-default" if st.get("default") else "")
        rows.append(
            f'<li class="{cls}"{attrs} style="--l:{pct(start - lo)};--w:{pct(stop - start)}">'
            f'<button aria-pressed="{"true" if st.get("default") else "false"}" class="exp-item" type="button">'
            f'<span class="exp-label"><span class="exp-name">{e(x["name"])}</span>'
            f'<span class="exp-years">{e(years(t, start, end))}</span></span>'
            f'<span aria-hidden="true" class="exp-track"><span class="exp-bar"></span></span>'
            f'<span class="exp-note">{e(x["note"])}</span></button></li>'
        )
    meta = "".join(f'<div><span>{e(m["label"])}</span><p>{"<br/>".join(e(v) for v in m["values"])}</p></div>' for m in t["meta"])

    return (
        f'{START}<section class="section detail-section exp-section" id="experience"><div class="container">'
        f'<span class="section-kicker">{e(t["kicker"])}</span>'
        f'<h2 class="section-title">{e(t["title"])}</h2>'
        f'<p class="exp-lead">{e(t["lead"])}</p>\n'
        f'<div class="exp" data-exp="" data-min="{lo}" style="--years:{hi - lo};--now:{pct(now - lo)}">'
        f'<div aria-label="{e(t["filter"])}" class="exp-filter" role="group">'
        f'<span aria-hidden="true" class="exp-filter-label">{e(t["filter"])}</span>{chips}'
        f'<span aria-hidden="true" class="exp-hint">{e(t["hint"])}</span></div>\n'
        f'<div aria-hidden="true" class="exp-axis" data-today="{e(t["today"])}">{ticks}</div>\n'
        f'<div class="exp-body"><ol aria-label="{e(t["rows_label"])}" class="exp-rows">\n' + "\n".join(rows) + "\n</ol></div>\n"
        '<div aria-hidden="true" class="exp-detail"><div class="exp-detail-years"></div>'
        '<div><p class="exp-detail-name"></p><p class="exp-detail-note"></p></div>'
        '<div class="exp-detail-tags"></div></div></div>\n'
        f'<div class="exp-meta">{meta}</div>'
        f'</div></section>{END}'
    )


def problems(data: dict) -> list[str]:
    """Перевірки даних до малювання: мови, етапи, донори, дати, тире."""
    out = []
    ids = [st["id"] for st in data["stages"]]
    if len(set(ids)) != len(ids):
        out.append("однакові id етапів")
    if sum(1 for st in data["stages"] if st.get("default")) != 1:
        out.append("позначка default має стояти рівно на одному етапі")
    for st in data["stages"]:
        if st["end"] and month(st["end"], True) <= month(st["start"]):
            out.append(f'{st["id"]}: кінець раніше за початок')
        if month(st["start"]) < data["min_year"]:
            out.append(f'{st["id"]}: початок раніше за min_year')
        for d in st["donors"]:
            if d not in data["donors"]:
                out.append(f'{st["id"]}: невідомий донор {d}')
    for lang in PAGES:
        t = data["lang"].get(lang)
        if not t:
            out.append(f"немає мови {lang}")
            continue
        for sid in ids:
            if sid not in t["stages"]:
                out.append(f"{lang}: немає тексту для етапу {sid}")
        for d in data["donors"]:
            if d not in t["donors"]:
                out.append(f"{lang}: немає назви донора {d}")
        if re.search("[—–]", json.dumps(t, ensure_ascii=False)):
            out.append(f"{lang}: у текстах є тире «—» або «–», на сайті їх не використовуємо")
    return out


def main() -> int:
    check = "--check" in sys.argv
    data = json.loads(DATA.read_text(encoding="utf-8"))
    bad = problems(data)
    for lang, page in PAGES.items():
        if bad:
            break
        f = SITE / page
        s = f.read_text(encoding="utf-8")
        if s.count(START) != 1 or s.count(END) != 1:
            bad.append(f"site/{page}: немає маркерів блоку {START} … {END}")
            continue
        new = re.sub(rf"{re.escape(START)}.*?{re.escape(END)}", lambda m: render(data, lang), s, flags=re.S)
        if check:
            if new != s:
                bad.append(f"site/{page}: блок «Досвід» не відповідає shared/about.json, запустіть python scripts/make_about.py")
            continue
        if new != s:
            f.write_text(new, encoding="utf-8")
        print(f"site/{page}: блок «Досвід», етапів: {len(data['stages'])}" + ("" if new != s else " (без змін)"))
    if bad:
        print("\n".join(bad))
        return 1
    if check:
        print("Блок «Досвід»: сторінки відповідають shared/about.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
