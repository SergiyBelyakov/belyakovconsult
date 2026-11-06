"""Статичний HTML етапів «Шляху даних»: тексти 13 етапів, результат кожного, посилання на напрям і демо.

3D-сцена малює етапи лише в JavaScript, тож пошуковики й читачі без WebGL їх не бачили.
Скрипт бере тексти з site/data-journey/story-data*.js і вставляє блок між маркерами
<!-- journey-static:start --> і <!-- journey-static:end --> перед підсумковим рядком сторінки.
Повторний запуск замінює блок.

Запуск: python scripts/make_journey_static.py
"""
from __future__ import annotations

import html
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
LANGS = {
    "uk": {"prefix": "", "data": "story-data.js"},
    "en": {"prefix": "/en", "data": "story-data.en.js"},
}
# етап → демо в Лабораторії даних (з маніфесту shared/demos.json)
DEMO = {stage: d["slug"] for d in json.loads((ROOT / "shared" / "demos.json").read_text(encoding="utf-8"))["demos"]
        if d.get("status") == "live" for stage in d["stages"]}
T = {
    "uk": {"kicker": "Етапи шляху", "title": "13 етапів від джерела до рішення", "lead": "Те саме, що показує сцена вище, текстом: що відбувається на кожному етапі і що він дає.",
           "result": "Результат", "service": "Про напрям", "demo": "Подивитися в лабораторії",
           "cta_k": "Ваш шлях даних", "cta_t": "На якому етапі зараз ваша організація?",
           "cta_p": "Розберемо, де записи втрачають якість, контекст чи довіру, і з чого почати, щоб показник на екрані відповідав реальності.",
           "cta_main": "Обговорити задачу", "cta_lab": "Лабораторія даних"},
    "en": {"kicker": "Stages of the journey", "title": "13 stages from source to decision", "lead": "What the scene above shows, in text: what happens at each stage and what it delivers.",
           "result": "Result", "service": "About the service", "demo": "See it in the Data Lab",
           "cta_k": "Your data journey", "cta_t": "Which stage is your organisation at?",
           "cta_p": "We will look at where records lose quality, context or trust, and where to start so that the measure on screen matches reality.",
           "cta_main": "Discuss your project", "cta_lab": "Data Lab"},
}
START, END = "<!-- journey-static:start -->", "<!-- journey-static:end -->"
ANCHOR = '<div class="journey-endnote">'


def story(file: str) -> dict:
    js = f"global.window={{}};require({json.dumps(str(SITE / 'data-journey' / file))});process.stdout.write(JSON.stringify(window.BCData))"
    return json.loads(subprocess.run(["node", "-e", js], check=True, capture_output=True, text=True).stdout)


def text(s: str) -> str:
    return html.escape(re.sub(r"\s+", " ", re.sub(r"<br\s*/?>", " ", s)).strip())


def block(lang: str) -> str:
    t, p = T[lang], LANGS[lang]["prefix"]
    d = story(LANGS[lang]["data"])
    services = {key: (name, slug) for key, name, slug in d["services"]}
    items = []
    for n, s in enumerate([s for s in d["scenes"] if s["id"] != "intro"], 1):
        links = []
        svc = services.get(s.get("service") or "")
        if svc:
            links.append(f'<a href="{p}/{svc[1]}/">{t["service"]}: {html.escape(svc[0])}</a>')
        if s["id"] in DEMO:
            links.append(f'<a class="js-demo" href="{p}/cases/{DEMO[s["id"]]}/">{t["demo"]} →</a>')
        items.append(
            f'<li class="js-stage" id="stage-{s["id"]}"><span class="js-num">{n:02d}</span><div>'
            f'<span class="js-tag">{text(s["tag"])}</span><h3>{text(s["title"])}</h3><p>{text(s["text"])}</p>'
            f'<p class="js-result"><b>{t["result"]}.</b> {text(s["result"])}</p>'
            + (f'<div class="js-links">{"".join(links)}</div>' if links else "") + "</div></li>")
    return (f'{START}<section class="journey-static" aria-labelledby="journey-static-title"><div class="js-wrap">'
            f'<span class="js-kicker">{t["kicker"]}</span><h2 id="journey-static-title">{t["title"]}</h2><p class="js-lead">{t["lead"]}</p>'
            f'<ol class="js-list">{"".join(items)}</ol>'
            f'<div class="js-cta"><span class="js-kicker">{t["cta_k"]}</span><h2>{t["cta_t"]}</h2><p>{t["cta_p"]}</p>'
            f'<div class="js-cta-actions"><a class="js-btn" href="{p}/#contact">{t["cta_main"]}</a><a class="js-btn js-btn-ghost" href="{p}/cases/">{t["cta_lab"]}</a></div></div>'
            f'</div></section>'
            # коли блок етапів на екрані, ховаємо фіксовані елементи сцени (рейка, кнопки етапів, сцена на телефоні)
            '<script>(()=>{const s=document.querySelector(".journey-static");if(!s||!("IntersectionObserver"in window))return;'
            'new IntersectionObserver(e=>document.body.classList.toggle("static-in-view",e[0].isIntersecting),{rootMargin:"0px 0px -35% 0px"}).observe(s)})()</script>'
            f'{END}\n')


def main() -> None:
    for lang, cfg in LANGS.items():
        f = SITE / cfg["prefix"].strip("/") / "data-journey" / "index.html"
        s = f.read_text(encoding="utf-8")
        s = re.sub(rf"{re.escape(START)}.*?{re.escape(END)}\n?", "", s, flags=re.S)
        if ANCHOR not in s:
            raise SystemExit(f"{f}: не знайдено місце для блоку")
        s = s.replace(ANCHOR, block(lang) + ANCHOR, 1)
        f.write_text(s, encoding="utf-8")
        print(f.relative_to(ROOT), "оновлено")


if __name__ == "__main__":
    main()
