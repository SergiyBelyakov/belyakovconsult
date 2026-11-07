"""Блок «Пропозиції» на головній (UA, EN, PT): вкладки для громад, державного сектору, бізнесу,
навчання й лабораторії, програм і донорів.

У кожній вкладці: що пропоную, типові задачі, напрями, кнопка «Обговорити задачу» (передає тему у форму)
і приклади. Демо беруться з shared/demos.json за полем audiences (у порядку маніфесту), інші приклади
(розбори, зразки, 3D-сцена, Лабораторія) з extras у shared/offers.json. Демо без версії мовою сторінки
ведуть на англійську з позначкою (EN). Без JavaScript усі вкладки показано одна під одною.

Блок стоїть між маркерами <!-- home-offers:start --> і <!-- home-offers:end -->. Перший запуск замінює
ним стару матрицю «Напрями застосування» (section.domains-section).

Запуск: python scripts/make_home_offers.py
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
PREFIX = {"uk": "", "en": "/en", "pt": "/pt"}
START, END = "<!-- home-offers:start -->", "<!-- home-offers:end -->"
OLD = re.compile(r'<section class="section domains-section" id="cases">.*?</section>\n?', re.S)
e = lambda s: html.escape(str(s), quote=True)  # noqa: E731

SCRIPT = """<script>(function(){var s=document.getElementById('offers');if(!s)return;var bar=s.querySelector('.offer-tabs'),tabs=[].slice.call(s.querySelectorAll('[role="tab"]')),panels=[].slice.call(s.querySelectorAll('[role="tabpanel"]'));if(!bar||!tabs.length)return;
s.classList.add('is-js');bar.hidden=false;
function has(id){return panels.some(function(p){return p.id===id})}
function show(id,focus,keep){tabs.forEach(function(t){var on=t.getAttribute('aria-controls')===id;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;if(on&&focus)t.focus()});panels.forEach(function(p){p.hidden=p.id!==id});if(keep&&history.replaceState)history.replaceState(null,'','#'+id)}
tabs.forEach(function(t,i){t.addEventListener('click',function(){show(t.getAttribute('aria-controls'),false,true)});t.addEventListener('keydown',function(ev){var n=ev.key==='ArrowRight'?(i+1)%tabs.length:ev.key==='ArrowLeft'?(i-1+tabs.length)%tabs.length:ev.key==='Home'?0:ev.key==='End'?tabs.length-1:-1;if(n<0)return;ev.preventDefault();show(tabs[n].getAttribute('aria-controls'),true,true)})});
var h=location.hash.slice(1);show(has(h)?h:panels[0].id,false,false);if(has(h))s.scrollIntoView();
window.addEventListener('hashchange',function(){var x=location.hash.slice(1);if(has(x)){show(x,false,false);s.scrollIntoView({behavior:'smooth'})}});
s.addEventListener('click',function(ev){var a=ev.target.closest('[data-topic]');if(!a)return;var f=document.querySelector('#contact form');if(!f)return;var inp=f.querySelector('input[name="topic"]');if(!inp){inp=document.createElement('input');inp.type='hidden';inp.name='topic';f.appendChild(inp)}inp.value=a.getAttribute('data-topic')});
})();</script>"""


def localized(path: str, lang: str, only: list | None = None) -> tuple[str, str]:
    """Адреса з мовним префіксом; якщо сторінки цією мовою немає, англійська з позначкою (EN)."""
    use = lang if not only or lang in only else "en"
    return PREFIX[use] + path, "" if use == lang else " (EN)"


def image(name: str, lang: str) -> str:
    for suffix in ([f"-{lang}"] if lang != "uk" else []) + (["-en"] if lang == "pt" else []) + [""]:
        if (SITE / "assets" / "cases" / f"{name}{suffix}.webp").exists():
            return f"/assets/cases/{name}{suffix}.webp"
    raise SystemExit(f"немає картинки {name}")


def proofs(a: dict, demos: list, lang: str, ui: dict) -> list[dict]:
    out = []
    for d in demos:
        if a["id"] not in d.get("audiences", []):
            continue
        use = lang if lang in d["langs"] else "en"
        x = d["lang"][use]
        out.append({"kind": "demo", "href": f'{PREFIX[use]}/cases/{d["slug"]}/', "title": x["name"] + ("" if use == lang else " (EN)"), "note": x["teaser"]})
    for x in a["extras"]:
        href, mark = localized(x["path"], lang, x.get("only"))
        out.append({"kind": x["kind"], "href": href, "title": x["title"][lang] + mark, "note": ""})
    return out


def panel(a: dict, demos: list, lang: str, cfg: dict) -> str:
    ui, t = cfg["ui"][lang], a["lang"][lang]
    items = proofs(a, demos, lang, ui)
    first = items[0]["href"] if items else PREFIX[lang] + "/cases/"
    tasks = "".join(f"<li>{e(x)}</li>" for x in t["tasks"])
    services = "".join(f'<a href="{PREFIX[lang]}/{s}/">{e(cfg["services"][lang][s])}</a>' for s in a["services"])
    links = "".join(
        f'<li><a class="offer-link{" is-demo" if p["kind"] == "demo" else ""}" href="{e(p["href"])}"><span class="offer-kind">{e(ui["kinds"][p["kind"]])}</span>'
        f'<span class="offer-name">{e(p["title"])}</span><span class="offer-arrow" aria-hidden="true">→</span>'
        + (f'<span class="offer-note">{e(p["note"])}</span>' if p["note"] else "") + "</a></li>"
        for p in items)
    return (f'<article class="offer-panel" id="for-{a["id"]}" role="tabpanel" aria-labelledby="offer-tab-{a["id"]}">'
            f'<div class="offer-copy"><span class="offer-for">{e(t["tab"])}</span><h3>{e(t["title"])}</h3><p>{e(t["text"])}</p>'
            f'<h4>{e(ui["tasks"])}</h4><ul class="offer-tasks">{tasks}</ul>'
            + (f'<div class="offer-services"><span>{e(ui["services"])}:</span>{services}</div>' if services else "")
            + f'<div class="offer-actions"><a class="btn btn-primary" href="#contact" data-topic="{e(t["topic"])}">{e(ui["cta"])}</a></div></div>'
            f'<div class="offer-proof"><a class="offer-media" href="{e(first)}" tabindex="-1" aria-hidden="true"><img alt="" decoding="async" loading="lazy" src="{image(a["image"], lang)}" width="1600" height="1000"/></a>'
            f'<h4>{e(ui["proof"])}</h4><ul class="offer-links">{links}</ul></div></article>')


def block(cfg: dict, demos: list, lang: str) -> str:
    ui = cfg["ui"][lang]
    tabs = "".join(
        f'<button type="button" role="tab" id="offer-tab-{a["id"]}" aria-controls="for-{a["id"]}" aria-selected="{"true" if i == 0 else "false"}" tabindex="{0 if i == 0 else -1}">{e(a["lang"][lang]["tab"])}</button>'
        for i, a in enumerate(cfg["audiences"]))
    panels = "".join(panel(a, demos, lang, cfg) for a in cfg["audiences"])
    return (f'{START}<section class="section domains-section offers-section" id="offers" aria-labelledby="offers-title">\n<div class="container">\n'
            f'<div class="domains-heading">\n<div class="domains-kicker"><span></span>{e(ui["kicker"])}<span></span></div>\n'
            f'<h2 class="section-title" id="offers-title">{e(ui["title"])}</h2>\n<p class="domains-intro">{e(ui["intro"])}</p>\n</div>\n'
            f'<div class="offer-tabs" role="tablist" aria-label="{e(ui["tabs"])}" hidden>{tabs}</div>\n'
            f'<div class="offer-panels">{panels}</div>\n</div>\n{SCRIPT}\n</section>{END}\n')


def main() -> None:
    cfg = json.loads((ROOT / "shared" / "offers.json").read_text(encoding="utf-8"))
    demos = [d for d in json.loads((ROOT / "shared" / "demos.json").read_text(encoding="utf-8"))["demos"] if d.get("status") == "live"]
    for lang, p in PREFIX.items():
        f = SITE / p.strip("/") / "index.html"
        s = f.read_text(encoding="utf-8")
        new = block(cfg, demos, lang)
        if START in s:
            s = re.sub(rf"{re.escape(START)}.*?{re.escape(END)}\n?", lambda m: new, s, flags=re.S)
        elif OLD.search(s):
            s = OLD.sub(lambda m: new, s, count=1)
        else:
            raise SystemExit(f"{f}: не знайдено ні маркерів, ні старого блоку")
        f.write_text(s, encoding="utf-8")
        n = sum(len(proofs(a, demos, lang, cfg["ui"][lang])) for a in cfg["audiences"])
        print(f.relative_to(ROOT), "←", len(cfg["audiences"]), "вкладок,", n, "прикладів")


if __name__ == "__main__":
    main()
