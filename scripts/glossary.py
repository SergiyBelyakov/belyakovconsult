"""Словник термінів сайту: дані в content/glossary/terms.yml, сторінки /glossary/ і /glossary/<slug>/ для uk, en, pt.

Що робить:
  * load_terms()         читає й перевіряє словник
  * Linker.autolink()    у тексті статті перетворює першу згадку терміна на посилання на його сторінку
                         (не чіпає заголовки, наявні посилання, код і заголовки таблиць; до 12 посилань на статтю)
  * build()              збирає покажчик А–Я і сторінку кожного терміна з розміткою schema.org DefinedTermSet / DefinedTerm,
                         hreflang і хлібними крихтами; повертає рядки для sitemap
  * problems()           помилки для validate.py

Без важких залежностей (лише yaml і стандартна бібліотека), бо модуль імпортує build_site у CI.
"""
from __future__ import annotations

import html
import re
import unicodedata
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
TERMS_FILE = ROOT / "content" / "glossary" / "terms.yml"
LANGS = ("uk", "en", "pt")
FIELDS = ("term", "short", "why", "aliases")
LINK_LIMIT = 12
SKIP_TAGS = {"a", "h1", "h2", "h3", "h4", "h5", "h6", "code", "pre", "th", "script", "style", "title"}
UK_ALPHABET = "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя"

UI = {
    "uk": dict(path="/glossary/", label="Словник термінів", kicker="Словник",
               heading="Словник термінів: дані, BI й аналітика простими словами",
               lead="Короткі визначення термінів, які я вживаю в матеріалах: від якості й управління даними до Power BI та Microsoft Fabric. "
                    "Для кожного терміна пояснення, чому він важливий для бізнесу, і де про нього почитати докладніше.",
               title="Словник термінів даних і аналітики",
               description="Що таке семантична модель, Direct Lake, lakehouse, якість даних і інші терміни: визначення простими словами і чому це важливо для бізнесу.",
               term_title="Що таке {term}: визначення простими словами", why="Чому це важливо", related="Пов'язані терміни",
               read="Де про це читати", service="Напрям", all_terms="Усі терміни словника", count="термінів"),
    "en": dict(path="/glossary/", label="Glossary", kicker="Glossary",
               heading="Glossary: data, BI and analytics in plain words",
               lead="Short definitions of the terms I use in my articles, from data quality and governance to Power BI and Microsoft Fabric. "
                    "Each term explains why it matters for the business and where to read more.",
               title="Data and analytics glossary",
               description="What a semantic model, Direct Lake, a lakehouse, data quality and other terms mean: plain-word definitions and why they matter for the business.",
               term_title="{term}: definition and why it matters", why="Why it matters", related="Related terms",
               read="Read more", service="Service", all_terms="All glossary terms", count="terms"),
    "pt": dict(path="/glossary/", label="Glossário", kicker="Glossário",
               heading="Glossário: dados, BI e análise em palavras simples",
               lead="Definições curtas dos termos que uso nos artigos, da qualidade e governação de dados ao Power BI e ao Microsoft Fabric. "
                    "Cada termo explica porque importa para o negócio e onde ler mais.",
               title="Glossário de dados e análise",
               description="O que são um modelo semântico, o Direct Lake, um lakehouse, a qualidade dos dados e outros termos: definições simples e porque importam para o negócio.",
               term_title="{term}: definição e porque importa", why="Porque importa", related="Termos relacionados",
               read="Onde ler mais", service="Serviço", all_terms="Todos os termos do glossário", count="termos"),
}


def load_terms(path: Path = TERMS_FILE) -> list[dict]:
    if not path.exists():
        return []
    return yaml.safe_load(path.read_text(encoding="utf-8")) or []


def problems(terms: list[dict], services: dict | None = None) -> list[str]:
    out, slugs = [], set()
    for i, t in enumerate(terms):
        slug = t.get("slug")
        if not slug or not re.fullmatch(r"[a-z0-9-]+", slug):
            out.append(f"глосарій: запис {i + 1} без коректного slug")
            continue
        if slug in slugs:
            out.append(f"глосарій: slug {slug} повторюється")
        slugs.add(slug)
        if services is not None and t.get("service") and t["service"] not in services:
            out.append(f"глосарій {slug}: невідомий service {t['service']}")
        for lang in LANGS:
            v = t.get(lang) or {}
            for f in FIELDS:
                if not v.get(f):
                    out.append(f"глосарій {slug}: бракує {lang}.{f}")
            for f in ("short", "why", "term"):
                if v.get(f) and re.search("[–—]", v[f]):
                    out.append(f"глосарій {slug}: тире в {lang}.{f}")
            for a in v.get("aliases") or []:
                try:
                    alias_regex(a)
                except re.error as e:
                    out.append(f"глосарій {slug}: поганий псевдонім {a!r} ({e})")
    for t in terms:
        for r in t.get("related") or []:
            if r not in slugs:
                out.append(f"глосарій {t.get('slug')}: пов'язаний термін {r} не існує")
    return out


def alias_regex(alias: str) -> re.Pattern:
    if alias.startswith("re:"):
        return re.compile(alias[3:])
    parts = [re.escape(p) for p in alias.split("*")]
    body = r"\w*".join(parts)
    flags = re.IGNORECASE if any(c.islower() for c in alias) else 0
    return re.compile(r"(?<![\w-])" + body + r"(?![\w-])", flags)


def term_path(cfg: dict, lang: str, slug: str | None = None) -> str:
    base = cfg["languages"][lang]["prefix"] + UI[lang]["path"]
    return base + (f"{slug}/" if slug else "")


class Linker:
    """Автопосилання на терміни в HTML статті."""

    def __init__(self, cfg: dict, terms: list[dict], lang: str):
        rows = []
        for t in terms:
            v = t.get(lang) or {}
            href = term_path(cfg, lang, t["slug"])
            for a in v.get("aliases") or []:
                rows.append(((a.startswith("re:"), -len(a.replace("*", ""))), t["slug"], alias_regex(a), href, v.get("short", "")))
        rows.sort(key=lambda r: r[0])   # спершу звичайні псевдоніми від довших до коротших, потім регулярні (BI, ETL, Fabric)
        self.rows = rows

    def autolink(self, text_html: str, limit: int = LINK_LIMIT) -> tuple[str, list[str]]:
        parts = re.split(r"(<[^>]+>)", text_html)
        depth, linked, out = 0, [], []
        for p in parts:
            if p.startswith("<"):
                m = re.match(r"<\s*(/)?\s*([a-zA-Z0-9]+)", p)
                if m and m.group(2).lower() in SKIP_TAGS and not p.endswith("/>"):
                    depth += -1 if m.group(1) else 1
                    depth = max(depth, 0)
                out.append(p)
                continue
            if depth or not p.strip() or len(linked) >= limit:
                out.append(p)
                continue
            spans = []
            for _, slug, rx, href, short in self.rows:
                if slug in linked or len(linked) >= limit:
                    continue
                for m in rx.finditer(p):
                    s, e = m.span()
                    if s == e or any(not (e <= a or s >= b) for a, b, *_ in spans):
                        continue
                    spans.append((s, e, slug, href, short))
                    linked.append(slug)
                    break
            spans.sort()
            buf, pos = [], 0
            for s, e, slug, href, short in spans:
                buf.append(p[pos:s])
                buf.append(f'<a class="bc-term" href="{href}" title="{html.escape(short, quote=True)}">{p[s:e]}</a>')
                pos = e
            buf.append(p[pos:])
            out.append("".join(buf))
        return "".join(out), linked


def sort_key(lang: str, word: str):
    w = unicodedata.normalize("NFD", word.strip().lower())
    w = "".join(c for c in w if not unicodedata.combining(c)) if lang != "uk" else unicodedata.normalize("NFC", word.strip().lower())
    key = []
    for c in w:
        if lang == "uk" and c in UK_ALPHABET:
            key.append((1, UK_ALPHABET.index(c)))
        elif c.isalpha():
            key.append((0, ord(c)))
        else:
            key.append((2, ord(c)))
    return key


def letter(lang: str, word: str) -> str:
    c = word.strip()[0].upper()
    if lang == "uk" and c.lower() not in UK_ALPHABET:
        return "A-Z"                                        # латинські терміни окремою групою, щоб A і А не дублювались
    if lang != "uk":
        c = "".join(ch for ch in unicodedata.normalize("NFD", c) if not unicodedata.combining(ch)) or c
    return c


def build(cfg, env, shells, out: Path, base: str, terms: list[dict], mentions: dict, meta_block, service_link) -> list[tuple]:
    """Збирає сторінки словника. mentions: {(lang, slug): [(title, href), ...]}. Повертає записи для sitemap."""
    site = cfg["site"]
    langs_cfg = cfg["languages"]
    by_slug = {t["slug"]: t for t in terms}
    sitemap = []
    og = base + "/assets/og-belyakov-consult.jpg"
    langs = [l for l in LANGS if l in shells and l in langs_cfg]

    # прибрати старі згенеровані сторінки
    for lang in langs:
        d = out / term_path(cfg, lang).strip("/")
        if d.exists():
            for child in d.iterdir():
                if child.is_dir() and (child / ".generated").exists():
                    import shutil
                    shutil.rmtree(child)

    index_alts = [(l, base + term_path(cfg, l)) for l in langs] + [("x-default", base + term_path(cfg, "uk"))]
    for lang in langs:
        U, L = UI[lang], langs_cfg[lang]
        items = sorted((t for t in terms if t.get(lang)), key=lambda t: sort_key(lang, t[lang]["term"]))
        groups = []
        for t in items:
            ch = letter(lang, t[lang]["term"])
            if not groups or groups[-1][0] != ch:
                groups.append((ch, []))
            groups[-1][1].append({"term": t[lang]["term"], "short": t[lang]["short"], "href": term_path(cfg, lang, t["slug"])})
        url = base + term_path(cfg, lang)
        set_id = url + "#set"
        jsonld = {"@context": "https://schema.org", "@graph": [
            {"@type": "DefinedTermSet", "@id": set_id, "url": url, "name": U["title"], "description": U["description"],
             "inLanguage": lang, "isPartOf": {"@id": base + "/#website"},
             "hasDefinedTerm": [{"@type": "DefinedTerm", "@id": base + term_path(cfg, lang, t["slug"]) + "#term",
                                 "name": t[lang]["term"], "description": t[lang]["short"],
                                 "url": base + term_path(cfg, lang, t["slug"])} for t in items]},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": site["name"], "item": base + L["prefix"] + "/"},
                {"@type": "ListItem", "position": 2, "name": U["label"], "item": url}]}]}
        main_html = env.get_template("glossary_index.html").render(L=L, U=U, site=site, home=L["prefix"] + "/", groups=groups,
                                                                    total=len(items), insights_home=L["prefix"] + site["insights_path"])
        meta = meta_block(cfg, lang, title=f"{U['title']} | {site['name']}", description=U["description"], url=url,
                          alternates=index_alts, og_type="website", og_image=og,
                          feed=base + L["prefix"] + site["insights_path"] + "feed.xml", jsonld=jsonld)
        switch = [(l, langs_cfg[l]["label"], term_path(cfg, l), l == lang) for l in langs_cfg]
        d = out / term_path(cfg, lang).strip("/")
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(shells[lang].render(meta=meta, main=main_html, lang_links=switch), encoding="utf-8")
        sitemap.append((url, "", [x for x in index_alts if x[0] != "x-default"]))

        for t in items:
            v = t[lang]
            turl = base + term_path(cfg, lang, t["slug"])
            alts = [(l, base + term_path(cfg, l, t["slug"])) for l in langs if t.get(l)] + \
                   [("x-default", base + term_path(cfg, "uk" if t.get("uk") else langs[0], t["slug"]))]
            related = [(by_slug[r][lang]["term"], term_path(cfg, lang, r)) for r in t.get("related") or [] if r in by_slug and by_slug[r].get(lang)]
            svc = service_link(cfg, t["service"], lang) if t.get("service") else None
            reads = mentions.get((lang, t["slug"]), [])[:8]
            title = U["term_title"].format(term=v["term"])
            desc = v["short"] if len(v["short"]) <= 160 else v["short"][:157].rsplit(" ", 1)[0] + "…"
            jsonld = {"@context": "https://schema.org", "@graph": [
                {"@type": "DefinedTerm", "@id": turl + "#term", "name": v["term"], "description": v["short"], "url": turl,
                 "inLanguage": lang, "inDefinedTermSet": {"@id": set_id}},
                {"@type": "WebPage", "@id": turl + "#webpage", "url": turl, "name": title, "description": desc, "inLanguage": lang,
                 "about": {"@id": turl + "#term"}, "isPartOf": {"@id": base + "/#website"}},
                {"@type": "BreadcrumbList", "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": site["name"], "item": base + L["prefix"] + "/"},
                    {"@type": "ListItem", "position": 2, "name": U["label"], "item": url},
                    {"@type": "ListItem", "position": 3, "name": v["term"], "item": turl}]}]}
            main_html = env.get_template("glossary_term.html").render(
                L=L, U=U, site=site, home=L["prefix"] + "/", glossary_home=term_path(cfg, lang), v=v,
                related=related, service=svc, reads=reads)
            meta = meta_block(cfg, lang, title=f"{title} | {site['name']}", description=desc, url=turl, alternates=alts,
                              og_type="article", og_image=og, feed=base + L["prefix"] + site["insights_path"] + "feed.xml", jsonld=jsonld)
            switch = [(l, langs_cfg[l]["label"], term_path(cfg, l, t["slug"]) if t.get(l) else term_path(cfg, l), l == lang)
                      for l in langs_cfg]
            td = out / term_path(cfg, lang, t["slug"]).strip("/")
            td.mkdir(parents=True, exist_ok=True)
            (td / "index.html").write_text(shells[lang].render(meta=meta, main=main_html, lang_links=switch), encoding="utf-8")
            (td / ".generated").write_text("Створено scripts/glossary.py. Не редагуйте вручну.\n", encoding="utf-8")
            sitemap.append((turl, "", [x for x in alts if x[0] != "x-default"]))
    return sitemap
