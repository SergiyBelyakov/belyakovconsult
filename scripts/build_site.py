"""Збирає розділ «Матеріали» всередині сайту: сторінки статей, списки, RSS, sitemap і картинки.

Запуск: python scripts/build_site.py
Шапка, підвал і стилі беруться з наявної сторінки cases/ (див. scripts/shell.py),
тому статті виглядають так само, як решта сайту.
"""
from __future__ import annotations

import html
import json
import shutil
import sys
from collections import defaultdict
from datetime import datetime, time
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

import markdown
from jinja2 import Environment, FileSystemLoader, select_autoescape

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_cards  # noqa: E402
import make_motion  # noqa: E402
from common import (ROOT, article_path, is_live, load_articles, load_config,  # noqa: E402
                    service_link, social_asset_url, tz)
from shell import Shell  # noqa: E402

MONTHS = {
    "uk": ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    "pt": ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
}
GENERATED = ".generated"


def human_date(d, lang):
    m = MONTHS.get(lang, MONTHS["en"])[d.month - 1]
    return f"{d.day} {m} {d.year}"


def meta_block(cfg, lang, *, title, description, url, alternates, og_type, og_image, feed, jsonld) -> str:
    e = lambda v: html.escape(str(v), quote=True)  # noqa: E731
    L = cfg["languages"][lang]
    site = cfg["site"]
    rows = [
        f"<title>{e(title)}</title>",
        f'<meta content="{e(description)}" name="description"/>',
        '<meta content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" name="robots"/>',
        f'<meta content="{e(L["author"])}" name="author"/>',
        f'<link href="{e(url)}" rel="canonical"/>',
        *[f'<link href="{e(u)}" hreflang="{h}" rel="alternate"/>' for h, u in alternates],
        f'<link href="{e(feed)}" rel="alternate" title="{e(site["name"])} · {e(L["insights_title"])}" type="application/rss+xml"/>',
        f'<meta content="{L["locale"]}" property="og:locale"/>',
        f'<meta content="{og_type}" property="og:type"/>',
        f'<meta content="{e(site["name"])}" property="og:site_name"/>',
        f'<meta content="{e(title)}" property="og:title"/>',
        f'<meta content="{e(description)}" property="og:description"/>',
        f'<meta content="{e(url)}" property="og:url"/>',
        f'<meta content="{e(og_image)}" property="og:image"/>',
        '<meta content="1200" property="og:image:width"/><meta content="630" property="og:image:height"/>',
        '<meta content="summary_large_image" name="twitter:card"/>',
        f'<meta content="{e(title)}" name="twitter:title"/>',
        f'<meta content="{e(description)}" name="twitter:description"/>',
        f'<meta content="{e(og_image)}" name="twitter:image"/>',
        f'<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>',
    ]
    return "\n".join(rows)


def main() -> int:
    problems = brand.check()
    if problems:
        print("ПОМИЛКА БРЕНДУ, збірку зупинено:\n- " + "\n- ".join(problems))
        return 1
    cfg = load_config()
    site = cfg["site"]
    base = site["base_url"].rstrip("/")
    out = ROOT / site["output_dir"]
    langs_cfg = cfg["languages"]
    env = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]))

    shells = {}
    for lang, L in langs_cfg.items():
        page = out / L["prefix"].strip("/") / "cases" / "index.html"
        if page.exists():
            shells[lang] = Shell(page)
    if not shells:
        print(f"ПОМИЛКА: не знайдено жодної сторінки cases/index.html у {out}. Перевірте site.output_dir у config.yml.")
        return 1

    articles = [a for a in load_articles(cfg) if is_live(a, cfg) and a.lang in shells]
    by_slug, by_lang = defaultdict(dict), defaultdict(list)
    for a in articles:
        by_slug[a.slug][a.lang] = a
        by_lang[a.lang].append(a)

    # Видаляємо раніше згенеровані сторінки статей, щоб знята з публікації стаття зникла.
    for lang, L in langs_cfg.items():
        d = out / article_path(cfg, lang).strip("/")
        if d.exists():
            for child in d.iterdir():
                if child.is_dir() and (child / GENERATED).exists():
                    shutil.rmtree(child)

    css_dir = out / "assets" / "insights"
    css_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / "templates" / "insights.css", css_dir / "insights.css")

    sitemap, pages = [], 0
    for slug, versions in by_slug.items():
        main_version = versions.get("uk") or next(iter(versions.values()))
        make_cards.og_image(cfg, main_version)
        make_cards.carousel(cfg, main_version)
        if main_version.carousel:
            mp4 = make_motion.build(cfg, main_version)
            frames = [make_cards.Image.open(f) for f in sorted(mp4.parent.glob("motion-frame-*.jpg"),
                                                             key=lambda x: int(x.stem.split("-")[-1]))]
            make_cards.brand_sheet(cfg, main_version, frames)
        og = social_asset_url(cfg, slug, "og.png")
        alternates = [(l, base + article_path(cfg, l, slug)) for l in langs_cfg if l in versions]
        if len(alternates) > 1:
            alternates.append(("x-default", base + article_path(cfg, "uk" if "uk" in versions else alternates[0][0], slug)))
        for lang, a in versions.items():
            L = langs_cfg[lang]
            url = base + article_path(cfg, lang, slug)
            body = markdown.markdown(a.body, extensions=["tables", "fenced_code", "sane_lists", "attr_list"])
            jsonld = {"@context": "https://schema.org", "@graph": [
                {"@type": "Article", "@id": url + "#article", "headline": a.title, "description": a.description,
                 "datePublished": a.date.isoformat(), "dateModified": (a.updated or a.date).isoformat(),
                 "inLanguage": lang, "image": og, "mainEntityOfPage": url, "wordCount": a.words,
                 **({"keywords": ", ".join(a.tags)} if a.tags else {}),
                 "author": {"@type": "Person", "name": L["author"], "url": base + L["prefix"] + "/sergiy-belyakov/",
                            "sameAs": [site["links"]["linkedin"]]},
                 "publisher": {"@type": "Organization", "name": site["name"], "url": base + "/",
                               "logo": base + "/assets/logo-original.png"},
                 "isPartOf": {"@id": base + "/#website"}},
                {"@type": "BreadcrumbList", "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": site["name"], "item": base + L["prefix"] + "/"},
                    {"@type": "ListItem", "position": 2, "name": L["insights_title"], "item": base + article_path(cfg, lang)},
                    {"@type": "ListItem", "position": 3, "name": a.title, "item": url}]}]}
            main_html = env.get_template("article_main.html").render(
                L=L, site=site, a=a, html=body, date_human=human_date(a.date, lang),
                services=[s for s in (service_link(cfg, k, lang) for k in a.services) if s],
                home=L["prefix"] + "/", insights_home=article_path(cfg, lang))
            meta = meta_block(cfg, lang, title=f"{a.title} | {site['name']}", description=a.description, url=url,
                              alternates=alternates, og_type="article", og_image=og,
                              feed=base + article_path(cfg, lang) + "feed.xml", jsonld=jsonld)
            switch = [(l, langs_cfg[l]["label"], article_path(cfg, l, slug) if l in versions else article_path(cfg, l), l == lang)
                      for l in langs_cfg]
            target = out / article_path(cfg, lang, slug).strip("/")
            target.mkdir(parents=True, exist_ok=True)
            (target / "index.html").write_text(shells[lang].render(meta=meta, main=main_html, lang_links=switch), encoding="utf-8")
            (target / GENERATED).write_text("Створено scripts/build_site.py. Не редагуйте вручну.\n", encoding="utf-8")
            sitemap.append((url, (a.updated or a.date).isoformat(), [x for x in alternates if x[0] != "x-default"]))
            pages += 1

    index_alts = [(l, base + article_path(cfg, l)) for l in langs_cfg if by_lang.get(l)]
    if len(index_alts) > 1:
        index_alts.append(("x-default", base + article_path(cfg, "uk")))
    for lang, items in by_lang.items():
        L = langs_cfg[lang]
        items.sort(key=lambda a: (a.date, a.slug), reverse=True)
        url = base + article_path(cfg, lang)
        jsonld = {"@context": "https://schema.org", "@graph": [
            {"@type": "CollectionPage", "@id": url + "#webpage", "url": url, "name": L["insights_page_title"],
             "description": L["insights_description"], "inLanguage": lang, "isPartOf": {"@id": base + "/#website"},
             "hasPart": [{"@type": "Article", "headline": a.title, "url": base + article_path(cfg, lang, a.slug)} for a in items]},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": site["name"], "item": base + L["prefix"] + "/"},
                {"@type": "ListItem", "position": 2, "name": L["insights_page_title"], "item": url}]}]}
        main_html = env.get_template("index_main.html").render(
            L=L, site=site, home=L["prefix"] + "/",
            items=[{"a": a, "href": article_path(cfg, lang, a.slug), "date_human": human_date(a.date, lang)} for a in items])
        meta = meta_block(cfg, lang, title=f"{L['insights_page_title']} | {site['name']}", description=L["insights_description"],
                          url=url, alternates=index_alts, og_type="website", og_image=base + "/assets/og-belyakov-consult.jpg",
                          feed=url + "feed.xml", jsonld=jsonld)
        switch = [(l, langs_cfg[l]["label"], article_path(cfg, l), l == lang) for l in langs_cfg]
        d = out / article_path(cfg, lang).strip("/")
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(shells[lang].render(meta=meta, main=main_html, lang_links=switch), encoding="utf-8")
        (d / "feed.xml").write_text(rss(cfg, lang, items), encoding="utf-8")
        sitemap.append((url, max(a.updated or a.date for a in items).isoformat(), [x for x in index_alts if x[0] != "x-default"]))

    (out / "sitemap-insights.xml").write_text(sitemap_xml(sitemap), encoding="utf-8")
    ensure_robots(out, base)
    print(f"Зібрано: {pages} сторінок статей, {len(by_lang)} списків → {out.relative_to(ROOT)}/")
    return 0


def ensure_robots(out: Path, base: str) -> None:
    robots = out / "robots.txt"
    line = f"Sitemap: {base}/sitemap-insights.xml"
    if robots.exists() and line not in robots.read_text(encoding="utf-8"):
        text = robots.read_text(encoding="utf-8").rstrip("\n") + "\n" + line + "\n"
        robots.write_text(text, encoding="utf-8")


def rss(cfg, lang, items) -> str:
    base = cfg["site"]["base_url"].rstrip("/")
    L = cfg["languages"][lang]
    rows = []
    for a in items[:30]:
        url = base + article_path(cfg, lang, a.slug)
        pub = format_datetime(datetime.combine(a.date, time(9, 0), tz(cfg)))
        rows.append(f"<item><title>{escape(a.title)}</title><link>{url}</link><guid>{url}</guid>"
                    f"<pubDate>{pub}</pubDate><description>{escape(a.description)}</description></item>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>'
            f"<title>{escape(cfg['site']['name'])} · {escape(L['insights_title'])}</title>"
            f"<link>{base + article_path(cfg, lang)}</link><description>{escape(L['insights_description'])}</description>"
            f"<language>{lang}</language>{''.join(rows)}</channel></rss>\n")


def sitemap_xml(entries) -> str:
    rows = []
    for url, lastmod, alts in entries:
        links = "".join(f'<xhtml:link rel="alternate" hreflang="{h}" href="{u}"/>' for h, u in alts) if len(alts) > 1 else ""
        rows.append(f"<url><loc>{url}</loc><lastmod>{lastmod}</lastmod>{links}</url>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
            + "\n".join(rows) + "\n</urlset>\n")


if __name__ == "__main__":
    sys.exit(main())
