"""Блок «Досвід» на сторінці «Про мене» (/sergiy-belyakov/, UA, EN, PT): одна інтерактивна лінія часу.

Дані й тексти лежать у shared/about.json: етапи (організація, місяці початку й кінця, хто фінансував),
підписи трьома мовами і тихий рядок фактів під лінією (освіта, сертифікати, мови).
Скрипт малює розділ і ставить його між маркерами <!-- about-experience:start --> і
<!-- about-experience:end --> на кожній мовній сторінці. Решту сторінки (перший екран із портретом,
вступ, послуги) скрипт не чіпає.

На широкому екрані (від 1100 px, зі скриптом site/profile.js) це горизонтальна лінія від першого року
до сьогодні. Кожен етап стоїть точкою у місяці свого початку, підписи чергуються над і під лінією.
Вибраний етап підсвічує на лінії свою тривалість, курсор року показує, що йшло паралельно,
фільтр донорів пригашує решту. На вузькому екрані й без JavaScript це вертикальний список
від найновішого етапу з поясненнями в рядках. Вигляд описано в site/profile.css.

Сторінка має власні файли site/profile.css і site/profile.js. Браузер тримає їх у кеші кілька годин,
а сторінку перечитує щоразу, тож після оновлення відвідувач міг би побачити нову розмітку зі старими
стилями. Тому скрипт дописує до адрес цих файлів версію ?v=<перші 10 знаків SHA-1 вмісту>, так само
як shared/build-demo.mjs робить для демо. Після будь-якої зміни profile.css чи profile.js
запустіть скрипт ще раз: він оновить версії на трьох сторінках.

Запуск: python scripts/make_about.py            (оновити три сторінки)
        python scripts/make_about.py --check    (лише перевірити, що сторінки відповідають даним і файлам)
"""
from __future__ import annotations

import hashlib
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
ASSETS = ("profile.css", "profile.js")   # власні файли сторінки: їхні адреси позначаємо версією вмісту
LABEL = 0.18   # ширина підпису як частка лінії: сусіди з одного боку мають стояти не ближче
e = lambda s: html.escape(str(s), quote=True)  # noqa: E731

ARROW_PREV = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
ARROW_NEXT = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9.5 5.5 16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>'


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


def layout(data: dict) -> tuple[dict[str, dict], list[str]]:
    """Місце кожного підпису на горизонтальній лінії.

    За порядком у часі підписи чергуються: над лінією, під лінією. Підпис починається від своєї точки
    і йде праворуч. Якщо наступна точка з того самого боку ближче за ширину підпису, а ліворуч місце є,
    підпис стає праворуч впритул до точки й іде ліворуч (клас is-end). Якщо місця немає з обох боків,
    скрипт попереджає: тоді варто скоротити назву або перенести етап на інший бік.
    """
    lo, hi, _ = scale(data)
    items = [{"id": st["id"], "x": (month(st["start"]) - lo) / (hi - lo)} for st in data["stages"]]
    order = sorted(items, key=lambda i: i["x"])
    warns = []
    for n, it in enumerate(order):
        it["side"] = "up" if n % 2 == 0 else "down"
    for side in ("up", "down"):
        same = [i for i in order if i["side"] == side]
        for k, it in enumerate(same):
            ahead = same[k + 1]["x"] - it["x"] if k + 1 < len(same) else 1.0
            prev_edge = same[k - 1]["x"] + (0 if same[k - 1].get("end") else LABEL) if k else -1.0
            it["end"] = ahead < LABEL
            if it["end"] and it["x"] - LABEL < prev_edge:
                warns.append(f'{it["id"]}: підпис не вміщається на лінії, сусідні етапи надто близько')
    return {i["id"]: i for i in items}, warns


def render(data: dict, lang: str) -> str:
    t = data["lang"][lang]
    lo, hi, now = scale(data)
    place, _ = layout(data)
    pct = lambda v: f"{v / (hi - lo) * 100:.3f}%"  # noqa: E731

    chips = f'<button aria-pressed="true" class="exp-chip" data-donor="" type="button">{e(t["all"])}</button>'
    chips += "".join(f'<button aria-pressed="false" class="exp-chip" data-donor="{d}" type="button">{e(t["donors"][d])}</button>'
                     for d in data["donors"])

    rows, span = [], ""
    for st in data["stages"]:
        start = month(st["start"])
        end = month(st["end"], True) if st["end"] else None
        stop = now if end is None else end
        x = t["stages"][st["id"]]
        p = place[st["id"]]
        cls = f'exp-row is-{p["side"]}' + (" is-end" if p["end"] else "") + (" is-now" if end is None else "")
        attrs = f' data-start="{start}"' + (f' data-end="{end}"' if end is not None else "")
        attrs += f' data-donors="{" ".join(st["donors"])}"' + (" data-default" if st.get("default") else "")
        if st.get("default"):
            span = f"--sx:{pct(start - lo)};--sw:{pct(stop - start)}"
        rows.append(
            f'<li class="{cls}"{attrs} style="--x:{pct(start - lo)}">'
            f'<button aria-pressed="{"true" if st.get("default") else "false"}" class="exp-item" type="button">'
            f'<span aria-hidden="true" class="exp-node"></span>'
            f'<span class="exp-label"><span class="exp-name">{e(x["name"])}</span>'
            f'<span class="exp-years">{e(years(t, start, end))}</span></span>'
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
        f'<div class="exp-stage"><div aria-hidden="true" class="exp-line" style="{span}">'
        '<span class="exp-rail"></span><span class="exp-ticks"></span><span class="exp-span"></span>'
        f'<span class="exp-now"><i></i><b>{e(t["today"])}</b></span></div>\n'
        f'<ol aria-label="{e(t["rows_label"])}" class="exp-rows">\n' + "\n".join(rows) + "\n</ol></div>\n"
        '<div class="exp-card"><div aria-hidden="true" class="exp-detail"><div class="exp-detail-years"></div>'
        '<div><p class="exp-detail-name"></p><p class="exp-detail-note"></p></div>'
        '<div class="exp-detail-tags"></div></div>'
        f'<div class="exp-nav"><button aria-label="{e(t["prev"])}" class="exp-prev" type="button">{ARROW_PREV}</button>'
        f'<button aria-label="{e(t["next"])}" class="exp-next" type="button">{ARROW_NEXT}</button></div></div></div>\n'
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
        for key in ("kicker", "title", "lead", "filter", "all", "hint", "prev", "next", "today", "rows_label", "since"):
            if not t.get(key):
                out.append(f"{lang}: немає тексту {key}")
        for sid in ids:
            if sid not in t["stages"]:
                out.append(f"{lang}: немає тексту для етапу {sid}")
        for d in data["donors"]:
            if d not in t["donors"]:
                out.append(f"{lang}: немає назви донора {d}")
        if re.search("[—–]", json.dumps(t, ensure_ascii=False)):
            out.append(f"{lang}: у текстах є тире «—» або «–», на сайті їх не використовуємо")
    return out


def stamp(text: str) -> tuple[str, list[str]]:
    """Адреси власних файлів сторінки з версією вмісту, щоб браузер не брав застарілу копію з кешу."""
    lost = []
    for name in ASSETS:
        version = hashlib.sha1((SITE / name).read_bytes()).hexdigest()[:10]
        text, found = re.subn(rf'(?<=")/{re.escape(name)}(?:\?v=[0-9a-f]+)?(?=")', f"/{name}?v={version}", text)
        if not found:
            lost.append(name)
    return text, lost


def main() -> int:
    check = "--check" in sys.argv
    data = json.loads(DATA.read_text(encoding="utf-8"))
    bad = problems(data)
    if not bad:
        for warn in layout(data)[1]:
            print("Увага:", warn)
    for lang, page in PAGES.items():
        if bad:
            break
        f = SITE / page
        s = f.read_text(encoding="utf-8")
        if s.count(START) != 1 or s.count(END) != 1:
            bad.append(f"site/{page}: немає маркерів блоку {START} … {END}")
            continue
        new = re.sub(rf"{re.escape(START)}.*?{re.escape(END)}", lambda m: render(data, lang), s, flags=re.S)
        new, lost = stamp(new)
        if lost:
            bad.append(f"site/{page}: сторінка не підключає {', '.join(lost)}")
            continue
        if check:
            if new != s:
                bad.append(f"site/{page}: блок «Досвід» або версії profile.css, profile.js застаріли, запустіть python scripts/make_about.py")
            continue
        if new != s:
            f.write_text(new, encoding="utf-8")
        print(f"site/{page}: блок «Досвід», етапів: {len(data['stages'])}" + ("" if new != s else " (без змін)"))
    if bad:
        print("\n".join(bad))
        return 1
    if check:
        print("Блок «Досвід»: сторінки відповідають shared/about.json, версії profile.css і profile.js актуальні")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
