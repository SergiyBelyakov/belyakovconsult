"""Сторінка Лабораторії даних (/cases/, UA, EN, PT) з маніфесту shared/demos.json: навігація, демо, ігри, кейси.

Генератор володіє всім вмістом div.case-detail-stack на /cases/:
- липка навігація розділу «Демо · Ігри · Кейси» з лічильниками і пошуком;
- група «Демо» (id="demos"): фільтр «для кого» за полем audiences, картки з мініатюрами, далі описи демо;
- група «Ігри» (id="games"): демо з "group": "games" у маніфесті;
- група «Кейси» (id="cases-by-domain"): картки реальних задач і їхні описи.
Експонати (розділ exhibits маніфесту, наприклад 3D-сцена «Шлях даних») стоять у групі з поля group:
"cases" ставить експонат першим у «Кейсах», без поля експонат іде останнім у «Демо».

Описи (article.case-detail) лишаються в HTML. Без JavaScript їх видно один за одним під картками, як раніше.
З JavaScript вони сховані, а «Детальніше» відкриває опис у діалоговому вікні з гортанням «попередній/наступний»;
адреса /cases/#<anchor> відкриває потрібний опис одразу. Пошук і фільтр працюють лише з JavaScript.

Описи демо (article.case-detail.case-demo з id = anchor у маніфесті) пишуться вручну для кожної мови й можуть стояти
будь-де в стеку (новий опис досить вставити перед <!-- lab-dialog -->): генератор збирає їх і розставляє за групами
в порядку маніфесту, чергування reverse рахується окремо в кожній групі. Описи реальних кейсів (article.case-detail без
case-demo) теж збираються зі сторінки й отримують id case-01, case-02… за номером у span.case-index.
Мініатюри карток: site/assets/cases/thumbs/<назва картинки>.webp, 640×400; якщо файлу немає, він робиться з картинки
опису (потрібен Pillow). Скрипт навігації стоїть усередині стеку, до підвалу: shell.py бере підвал і все після нього
для статей, тож туди нічого з Лабораторії не потрапляє.

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
AUDS = ["communities", "public", "business", "learning", "donors"]
T = {
    "uk": {
        "open": "Відкрити демо", "play": "Грати", "scene": "Відкрити сцену", "read": "Читати кейс", "more": "Детальніше",
        "nav": "Розділи лабораторії", "demos": "Демо", "games": "Ігри", "cases": "Кейси",
        "search": "Пошук: прогноз, карта, якість даних…", "search_label": "Пошук у лабораторії",
        "for": "Для кого", "all": "Усі",
        "aud": {"communities": "Громадам", "public": "Держсектору", "business": "Бізнесу", "learning": "Навчання", "donors": "Донорам"},
        "empty": "Нічого не знайдено. Спробуйте інше слово або скиньте фільтр.",
        "demos_kicker": "Демо на синтетичних даних", "demos_title": "Демо, які можна покрутити самому",
        "games_kicker": "Навчальні ігри", "games_title": "Ігри, які вчать читати й чистити дані",
        "cases_kicker": "Кейси", "cases_title": "Реальні задачі за напрямами", "case": "Кейс",
        "prev": "Попередній опис", "next": "Наступний опис", "close": "Закрити",
        "lead": "Інтерактивні демо на синтетичних даних, навчальні ігри про дані й реальні задачі, з якими я працював. Нові демо додаються поетапно.",
    },
    "en": {
        "open": "Open the demo", "play": "Play", "scene": "Open the scene", "read": "Read the case", "more": "Details",
        "nav": "Data Lab sections", "demos": "Demos", "games": "Games", "cases": "Cases",
        "search": "Search: forecast, map, data quality…", "search_label": "Search the Data Lab",
        "for": "Who it is for", "all": "All",
        "aud": {"communities": "Communities", "public": "Public sector", "business": "Business", "learning": "Learning", "donors": "Donors"},
        "empty": "Nothing found. Try another word or reset the filter.",
        "demos_kicker": "Demos on synthetic data", "demos_title": "Demos you can explore yourself",
        "games_kicker": "Learning games", "games_title": "Games that teach you to read and clean data",
        "cases_kicker": "Cases", "cases_title": "Real problems by domain", "case": "Case",
        "prev": "Previous description", "next": "Next description", "close": "Close",
        "lead": "Interactive demos on synthetic data, learning games about data and real problems I have worked on. New demos are added step by step.",
    },
    "pt": {
        "open": "Abrir a demo", "play": "Jogar", "scene": "Abrir a cena", "read": "Ler o caso", "more": "Detalhes",
        "nav": "Secções do laboratório", "demos": "Demos", "games": "Jogos", "cases": "Casos",
        "search": "Pesquisar: previsão, mapa, qualidade…", "search_label": "Pesquisar no laboratório",
        "for": "Para quem", "all": "Todas",
        "aud": {"communities": "Municípios", "public": "Setor público", "business": "Empresas", "learning": "Formação", "donors": "Doadores"},
        "empty": "Nada encontrado. Experimente outra palavra ou limpe o filtro.",
        "demos_kicker": "Demos com dados sintéticos", "demos_title": "Demos para explorar por conta própria",
        "games_kicker": "Jogos didáticos", "games_title": "Jogos que ensinam a ler e limpar dados",
        "cases_kicker": "Casos", "cases_title": "Problemas reais por área", "case": "Caso",
        "prev": "Descrição anterior", "next": "Descrição seguinte", "close": "Fechar",
        "lead": "Demos interativas com dados sintéticos, jogos didáticos sobre dados e problemas reais em que trabalhei. Novas demos são adicionadas por etapas.",
    },
}
STACK = re.compile(r'<div class="container case-detail-stack(?: lab-stack)?">')
STACK_END = '</div></section><footer class="footer section"'
DEMO_ART = re.compile(r'<article class="case-detail case-demo(?: reverse)?" id="([^"]+)">.*?</article>', re.S)
CASE_ART = re.compile(r'<article class="case-detail(?: reverse)?"(?: id="[^"]*")?>(.*?)</article>', re.S)
HERO = re.compile(r'<section class="detail-hero compact-hero(?: lab-hero)?">')
HERO_P = re.compile(r'(<section class="detail-hero compact-hero lab-hero">.*?</h1><p>)(.*?)(</p>)', re.S)
e = lambda s: html.escape(str(s), quote=True)  # noqa: E731


def thumb(src: str) -> str:
    """Мініатюра 640×400 для картки; робиться з картинки опису, якщо її ще немає."""
    name = Path(src).stem
    rel = f"/assets/cases/thumbs/{name}.webp"
    out = SITE / rel.lstrip("/")
    if not out.exists():
        from PIL import Image  # лише коли треба зробити нову мініатюру
        im = Image.open(SITE / src.lstrip("/")).convert("RGB")
        w, h = im.size
        if w / h > 1.6:  # ширша за 16:10: обрізати з боків
            nw = round(h * 1.6)
            im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        elif w / h < 1.6:  # вища: обрізати знизу, верх картинки важливіший
            im = im.crop((0, 0, w, round(w / 1.6)))
        out.parent.mkdir(parents=True, exist_ok=True)
        im.resize((640, 400), Image.LANCZOS).save(out, "WEBP", quality=74, method=6)
    return rel


def img_of(block: str) -> str:
    m = re.search(r'<img [^>]*src="([^"]+)"', block)
    if not m:
        raise SystemExit("в описі немає картинки: " + block[:120])
    return m.group(1)


def reversed_(block: str, rev: bool) -> str:
    """Чергування сторін картинки в описі (видно без JavaScript)."""
    return re.sub(r'^<article class="case-detail( case-demo)?(?: reverse)?"', lambda m: f'<article class="case-detail{m.group(1) or ""}{" reverse" if rev else ""}"', block, count=1)


def card(d: dict, lang: str, block: str, kind: str) -> str:
    use = lang if lang in d["langs"] else "en"
    t, x = T[lang], d["lang"][use]
    mark = "" if use == lang else " (EN)"
    href = d["href"][use] if kind == "scene" else f'{PREFIX[use]}/cases/{d["slug"]}/'
    src = d["image"] if kind == "scene" else img_of(block)
    action = {"demo": t["open"], "game": t["play"], "scene": t["scene"]}[kind]
    aud = " ".join(a for a in d.get("audiences", ["learning"] if kind == "scene" else []) if a in AUDS)
    return (f'<article class="lab-cat-card" data-aud="{aud}"><a class="lab-cat-thumb" href="{href}" tabindex="-1" aria-hidden="true">'
            f'<img alt="" decoding="async" loading="lazy" src="{thumb(src)}" width="640" height="400"/></a>'
            f'<div class="lab-cat-body"><span class="lab-cat-kind">{e(x["kind"])}</span><h3><a href="{href}">{e(x["name"])}{mark}</a></h3>'
            f'<p>{e(x["teaser"])}</p><div class="lab-cat-links"><a class="lab-cat-open" href="{href}">{action} →</a>'
            f'<a class="lab-cat-more" href="#{d["anchor"]}" data-detail="{d["anchor"]}">{t["more"]}</a></div></div></article>')


def case_card(cid: str, num: str, title: str, text: str, src: str, lang: str) -> str:
    t = T[lang]
    return (f'<article class="lab-cat-card lab-cat-case"><a class="lab-cat-thumb" href="#{cid}" data-detail="{cid}" tabindex="-1" aria-hidden="true">'
            f'<img alt="" decoding="async" loading="lazy" src="{thumb(src)}" width="640" height="400"/></a>'
            f'<div class="lab-cat-body"><span class="lab-cat-kind">{t["case"]} · {num}</span><h3><a href="#{cid}" data-detail="{cid}">{title}</a></h3>'
            f'<p>{text}</p><div class="lab-cat-links"><a class="lab-cat-open" href="#{cid}" data-detail="{cid}">{t["read"]} →</a></div></div></article>')


def exhibit_detail(d: dict, lang: str, reverse: bool) -> str:
    use = lang if lang in d["langs"] else "en"
    x = d["detail"][lang]
    href = d["href"][use]
    links = "".join(f'<a href="{e(u)}">{e(n)}</a>' for u, n in x.get("links", []))
    return (f'<article class="case-detail case-demo{" reverse" if reverse else ""}" id="{d["anchor"]}">'
            f'<a class="case-detail-media case-demo-media" href="{href}"><img alt="{e(x["alt"])}" loading="lazy" src="{d["image"]}" width="1600" height="1000" style="object-position:center"/></a>'
            f'<div class="case-detail-copy"><span class="case-index">{e(x["kicker"])}</span><h2>{e(x["title"])}</h2><p>{e(x["text"])}</p>'
            f'<h3>{e(x["inside_h"])}</h3><p>{e(x["inside"])}</p>'
            f'<div class="case-demo-actions"><a class="btn btn-primary" href="{href}">{e(x["open"])}</a><a class="btn btn-secondary" href="#contact">{e(x["discuss"])}</a></div>'
            f'<div class="case-links">{links}</div></div></article>')


def group(gid: str, kicker: str, title: str, cards: list[str], details: list[str], lang: str, filters: str = "") -> str:
    t = T[lang]
    body = "".join(reversed_(b, i % 2 == 1) for i, b in enumerate(details))
    return (f'<section class="lab-group" id="{gid}" data-group="{gid}" aria-labelledby="{gid}-title">'
            f'<div class="lab-group-head"><span class="section-kicker">{kicker}</span><h2 class="section-title" id="{gid}-title">{title}</h2></div>'
            f'{filters}<div class="lab-catalog">{"".join(cards)}</div><p class="lab-empty" hidden>{t["empty"]}</p>'
            f'<div class="lab-details">{body}</div></section>')


SEARCH_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'

SCRIPT = """<script>(function(){var root=document.querySelector('.lab-stack'),dlg=root&&root.querySelector('.lab-dialog');if(!root||!dlg||typeof dlg.showModal!=='function')return;
root.classList.add('lab-js');
var nav=root.querySelector('.lab-nav'),links=[].slice.call(nav.querySelectorAll('.lab-nav-links a')),groups=[].slice.call(root.querySelectorAll('.lab-group')),body=dlg.querySelector('.lab-dialog-body'),cnt=dlg.querySelector('.lab-dialog-count'),q=nav.querySelector('input'),aud='',lists={},cur=null,home=null;
[].forEach.call(root.querySelectorAll('.lab-filters,.lab-search,.lab-search-toggle'),function(x){x.hidden=false});
var tg=nav.querySelector('.lab-search-toggle');tg.addEventListener('click',function(){var on=!nav.classList.contains('is-search')||!!q.value;nav.classList.toggle('is-search',on);tg.setAttribute('aria-expanded',String(on));if(on)q.focus()});
groups.forEach(function(g){var ids=[].map.call(g.querySelectorAll('.lab-details > article[id]'),function(a){return a.id});ids.forEach(function(id){lists[id]=ids})});
function top(){var h=document.querySelector('header');root.style.setProperty('--lab-top',(h?Math.round(h.getBoundingClientRect().height):80)+'px')}top();addEventListener('resize',top);
function put(){if(cur&&home){home.parentNode.insertBefore(cur,home);home.parentNode.removeChild(home)}cur=home=null}
function open(id,keep){var a=document.getElementById(id);if(!a||!lists[id])return false;put();home=document.createComment('lab');a.parentNode.insertBefore(home,a);body.appendChild(a);cur=a;var h=a.querySelector('h2'),l=lists[id];dlg.setAttribute('aria-label',h?h.textContent:id);cnt.textContent=(l.indexOf(id)+1)+' / '+l.length;if(!dlg.open)dlg.showModal();body.scrollTop=0;if(!keep&&history.replaceState)history.replaceState(null,'','#'+id);return true}
function step(k){if(!cur)return;var l=lists[cur.id],i=l.indexOf(cur.id);open(l[(i+k+l.length)%l.length])}
dlg.addEventListener('close',function(){put();if(location.hash&&history.replaceState)history.replaceState(null,'',location.pathname+location.search)});
dlg.addEventListener('click',function(ev){if(ev.target===dlg){dlg.close();return}var b=ev.target.closest('button[data-step]');if(b){step(+b.getAttribute('data-step'));return}if(ev.target.closest('.lab-dialog-close')){dlg.close();return}var a=ev.target.closest('a[href^="#"]');if(a&&!a.hasAttribute('data-detail')){var h=a.getAttribute('href');dlg.close();if(h.length>1){ev.preventDefault();var t=document.querySelector(h);if(t)t.scrollIntoView({behavior:'smooth'})}}});
dlg.addEventListener('keydown',function(ev){if(ev.key==='ArrowRight'&&!ev.target.closest('input,textarea')){step(1)}else if(ev.key==='ArrowLeft'&&!ev.target.closest('input,textarea')){step(-1)}});
root.addEventListener('click',function(ev){var a=ev.target.closest('[data-detail]');if(!a||dlg.contains(a))return;if(open(a.getAttribute('data-detail')))ev.preventDefault()});
function fromHash(){var id=decodeURIComponent(location.hash.slice(1));if(id&&lists[id])open(id,true)}fromHash();addEventListener('hashchange',fromHash);
function apply(){var t=(q.value||'').trim().toLowerCase();groups.forEach(function(g){var n=0;[].forEach.call(g.querySelectorAll('.lab-cat-card'),function(c){var ok=(!aud||g.id!=='demos'||(' '+(c.getAttribute('data-aud')||'')+' ').indexOf(' '+aud+' ')>=0)&&(!t||c.textContent.toLowerCase().indexOf(t)>=0);c.hidden=!ok;if(ok)n++});g.querySelector('.lab-empty').hidden=n>0;var s=nav.querySelector('a[href="#'+g.id+'"] span');if(s)s.textContent=n})}
q.addEventListener('input',apply);
[].forEach.call(root.querySelectorAll('.lab-filters button'),function(b,i,all){b.addEventListener('click',function(){aud=b.getAttribute('data-aud');[].forEach.call(all,function(x){x.setAttribute('aria-pressed',String(x===b))});apply()})});
var ticking=false;function spy(){ticking=false;var y=(parseFloat(getComputedStyle(root).getPropertyValue('--lab-top'))||80)+nav.offsetHeight+40,on=groups[0];groups.forEach(function(g){if(g.getBoundingClientRect().top<=y)on=g});links.forEach(function(a){var x=a.getAttribute('href')==='#'+on.id;a.classList.toggle('is-active',x);if(x)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current')})}
addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(spy)}},{passive:true});spy();
})();</script>"""


def build(s: str, lang: str, manifest: dict) -> tuple[str, dict]:
    t = T[lang]
    m = STACK.search(s)
    if not m:
        raise SystemExit(f"{lang}: не знайдено div.case-detail-stack")
    a = m.end()
    z = s.find(STACK_END, a)
    if z < 0:
        raise SystemExit(f"{lang}: не знайдено кінця стеку перед підвалом")
    region = s[a:z]
    blocks = {mm.group(1): mm.group(0) for mm in DEMO_ART.finditer(region)}
    cases = []
    for mm in CASE_ART.finditer(region):
        inner = mm.group(1)
        num = re.search(r'<span class="case-index">(.*?)</span>', inner).group(1)
        title = re.search(r'<h2>(.*?)</h2>', inner, re.S).group(1)
        text = re.search(r'</h2><p>(.*?)</p>', inner, re.S).group(1)
        cid = "case-" + re.sub(r"\D", "", num).zfill(2)
        cases.append((cid, num, title, text, img_of(inner), f'<article class="case-detail" id="{cid}">{inner}</article>'))
    demos = [d for d in manifest["demos"] if d.get("status") == "live"]
    extras = [d for d in manifest.get("exhibits", []) if d.get("status") == "live"]
    missing = [d["anchor"] for d in demos if d["anchor"] not in blocks]
    if missing:
        raise SystemExit(f"{lang}: немає опису на сторінці для {missing}")
    plain = [d for d in demos if d.get("group") != "games"]
    games = [d for d in demos if d.get("group") == "games"]
    ex_demo = [x for x in extras if x.get("group") != "cases"]
    ex_case = [x for x in extras if x.get("group") == "cases"]
    demo_cards = [card(d, lang, blocks[d["anchor"]], "demo") for d in plain] + [card(x, lang, "", "scene") for x in ex_demo]
    demo_details = [blocks[d["anchor"]] for d in plain] + [exhibit_detail(x, lang, False) for x in ex_demo if x.get("detail")]
    counts = {a_: sum(1 for d in plain if a_ in d.get("audiences", [])) + sum(1 for x in ex_demo if a_ in x.get("audiences", ["learning"])) for a_ in AUDS}
    chips = (f'<div class="lab-filters" role="group" aria-label="{t["for"]}" hidden>'
             f'<button type="button" data-aud="" aria-pressed="true">{t["all"]}<b>{len(demo_cards)}</b></button>'
             + "".join(f'<button type="button" data-aud="{a_}" aria-pressed="false">{t["aud"][a_]}<b>{counts[a_]}</b></button>' for a_ in AUDS if counts[a_])
             + '</div>')
    n = {"demos": len(demo_cards), "games": len(games), "cases-by-domain": len(cases) + len(ex_case)}
    nav = (f'<nav class="lab-nav" aria-label="{t["nav"]}"><div class="lab-nav-links">'
           + "".join(f'<a href="#{gid}">{t[key]}<span>{n[gid]}</span></a>' for gid, key in (("demos", "demos"), ("games", "games"), ("cases-by-domain", "cases")) if n[gid])
           + f'</div><button type="button" class="lab-search-toggle" aria-label="{e(t["search_label"])}" aria-expanded="false" hidden>{SEARCH_ICON}</button>'
           f'<label class="lab-search" hidden>{SEARCH_ICON}<input type="search" placeholder="{e(t["search"])}" aria-label="{e(t["search_label"])}" autocomplete="off"/></label></nav>')
    parts = [nav, group("demos", t["demos_kicker"], t["demos_title"], demo_cards, demo_details, lang, chips)]
    if games:
        parts.append(group("games", t["games_kicker"], t["games_title"], [card(d, lang, blocks[d["anchor"]], "game") for d in games], [blocks[d["anchor"]] for d in games], lang))
    if cases or ex_case:
        parts.append(group("cases-by-domain", t["cases_kicker"], t["cases_title"],
                           [card(x, lang, "", "scene") for x in ex_case] + [case_card(c[0], c[1], c[2], c[3], c[4], lang) for c in cases],
                           [exhibit_detail(x, lang, False) for x in ex_case if x.get("detail")] + [c[5] for c in cases], lang))
    dialog = (f'<!-- lab-dialog --><dialog class="lab-dialog"><div class="lab-dialog-bar"><span class="lab-dialog-count"></span>'
              f'<button type="button" data-step="-1" aria-label="{t["prev"]}">←</button><button type="button" data-step="1" aria-label="{t["next"]}">→</button>'
              f'<button type="button" class="lab-dialog-close" aria-label="{t["close"]}" autofocus>×</button></div><div class="lab-dialog-body"></div></dialog>')
    out = s[:m.start()] + '<div class="container case-detail-stack lab-stack">' + "".join(parts) + dialog + SCRIPT + s[z:]
    out = HERO.sub('<section class="detail-hero compact-hero lab-hero">', out, count=1)
    out = HERO_P.sub(lambda mm: mm.group(1) + t["lead"] + mm.group(3), out, count=1)
    return out, n


def main() -> None:
    manifest = json.loads((ROOT / "shared" / "demos.json").read_text(encoding="utf-8"))
    for lang, p in PREFIX.items():
        f = SITE / p.strip("/") / "cases" / "index.html"
        s, n = build(f.read_text(encoding="utf-8"), lang, manifest)
        f.write_text(s, encoding="utf-8")
        print(f.relative_to(ROOT), "←", n["demos"], "демо,", n["games"], "ігор,", n["cases-by-domain"], "у кейсах")


if __name__ == "__main__":
    main()
