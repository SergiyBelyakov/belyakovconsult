"""Сторінки «Політика конфіденційності» (uk: /privacy/, en: /en/privacy/) у шаблоні сайту.

Зміст описує лише те, що сайт справді робить: форма зв'язку (ім'я, пошта, текст) через Formspree, хостинг
Cloudflare, шрифти Google Fonts, без аналітики й cookie для відстеження. Публікація в соцмережі через офіційні API
стосується лише власних матеріалів. Також додає посилання на політику під кожною формою зв'язку.

Запуск: python scripts/make_privacy.py
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_site import meta_block  # noqa: E402
from common import ROOT, load_config  # noqa: E402
from shell import Shell  # noqa: E402

UPDATED = {"uk": "2 листопада 2026", "en": "2 November 2026"}

CONTENT = {
    "uk": dict(
        title="Політика конфіденційності",
        description="Які дані збирає сайт Belyakov Consult через форму зв'язку, навіщо, хто ще їх бачить і як їх видалити.",
        lead="Коротко: сайт збирає лише те, що ви самі пишете у формі зв'язку, і лише для того, щоб відповісти.",
        updated="Оновлено",
        sections=[
            ("Хто обробляє дані", [
                "Сергій Бєляков, Belyakov Consult (belyakovconsult.com). З будь-яких питань щодо даних пишіть на "
                '<a href="mailto:hello@belyakovconsult.com">hello@belyakovconsult.com</a>.']),
            ("Які дані я отримую", [
                "Через форму зв'язку: ім'я, робочу електронну пошту і текст звернення.",
                "Якщо ви пишете на пошту, у Telegram, WhatsApp чи соцмережі: ті дані, які ви самі надсилаєте.",
                "Сайт не використовує вебаналітику, рекламні трекери чи файли cookie для відстеження відвідувачів."]),
            ("Навіщо", [
                "Щоб відповісти на ваше звернення, обговорити задачу і, якщо ми домовимося, працювати разом. "
                "Дані не використовуються для розсилок без вашої окремої згоди, не продаються і не передаються для реклами."]),
            ("Хто ще технічно бачить дані", [
                "<strong>Formspree</strong>: сервіс, який доставляє повідомлення з форми мені на пошту. Він обробляє дані форми "
                "відповідно до власної політики конфіденційності; його сервери можуть бути за межами України та ЄС.",
                "<strong>Cloudflare</strong>: хостинг сайту. Як і будь-який хостинг, веде технічні журнали запитів "
                "(IP-адреса, браузер, час) для роботи й захисту сайту.",
                "<strong>Google Fonts</strong>: шрифти сайту завантажуються із серверів Google, тому ваш браузер передає Google IP-адресу."]),
            ("Соцмережі й автоматична публікація", [
                "Матеріали Belyakov Consult публікуються в LinkedIn, Instagram, Threads і Telegram через офіційні інтерфейси цих платформ. "
                "Ці інструменти лише публікують власні дописи й відео і не збирають даних відвідувачів чи підписників. "
                "На сторінках у соцмережах діють правила відповідних платформ."]),
            ("Скільки зберігаються дані", [
                "Листування зберігається, доки воно потрібне для відповіді та співпраці. Ви можете будь-коли попросити його видалити, "
                "якщо закон не вимагає зберігати його довше."]),
            ("Ваші права", [
                "Ви можете дізнатися, які ваші дані в мене є, виправити чи видалити їх, відкликати згоду або заперечити проти обробки. "
                'Для цього напишіть на <a href="mailto:hello@belyakovconsult.com">hello@belyakovconsult.com</a>; я відповім протягом місяця.',
                "Ви також можете звернутися до Уповноваженого Верховної Ради України з прав людини або до наглядового органу "
                "з захисту даних у своїй країні."]),
            ("Зміни", [
                "Оновлена версія публікується на цій сторінці із зазначенням дати."]),
        ],
        note_old="Не додавайте конфіденційних даних.",
        note_link="Політика конфіденційності",
    ),
    "en": dict(
        title="Privacy policy",
        description="What data the Belyakov Consult website collects through the contact form, why, who else sees it and how to have it deleted.",
        lead="In short: the website collects only what you write in the contact form, and only so that I can reply.",
        updated="Updated",
        sections=[
            ("Who processes the data", [
                "Sergiy Belyakov, Belyakov Consult (belyakovconsult.com). For any question about your data, write to "
                '<a href="mailto:hello@belyakovconsult.com">hello@belyakovconsult.com</a>.']),
            ("What data I receive", [
                "Through the contact form: your name, work email and the text of your message.",
                "If you write by email, Telegram, WhatsApp or social media: the data you choose to send.",
                "The website uses no web analytics, advertising trackers or tracking cookies."]),
            ("Why", [
                "To reply to your enquiry, discuss your task and, if we agree, work together. "
                "The data is not used for newsletters without your separate consent, is not sold and is not shared for advertising."]),
            ("Who else technically sees the data", [
                "<strong>Formspree</strong>: the service that delivers form messages to my email. It processes form data under its own "
                "privacy policy; its servers may be located outside Ukraine and the EU.",
                "<strong>Cloudflare</strong>: website hosting. Like any host, it keeps technical request logs "
                "(IP address, browser, time) to run and protect the site.",
                "<strong>Google Fonts</strong>: the site's fonts load from Google servers, so your browser shares your IP address with Google."]),
            ("Social media and automated publishing", [
                "Belyakov Consult materials are published on LinkedIn, Instagram, Threads and Telegram through these platforms' official interfaces. "
                "These tools only publish our own posts and videos and do not collect data about visitors or followers. "
                "The social media pages are governed by the rules of the respective platforms."]),
            ("How long the data is kept", [
                "Correspondence is kept as long as it is needed to reply and to work together. You can ask for it to be deleted at any time, "
                "unless the law requires it to be kept longer."]),
            ("Your rights", [
                "You can find out what data I hold about you, correct or delete it, withdraw consent or object to processing. "
                'Write to <a href="mailto:hello@belyakovconsult.com">hello@belyakovconsult.com</a>; I will reply within one month.',
                "You can also contact the Ukrainian Parliament Commissioner for Human Rights or the data protection authority in your country."]),
            ("Changes", [
                "An updated version is published on this page with its date."]),
        ],
        note_old="Please do not include confidential information.",
        note_link="Privacy policy",
    ),
}


def main() -> int:
    cfg = load_config()
    out = ROOT / cfg["site"]["output_dir"]
    base = cfg["site"]["base_url"].rstrip("/")
    langs = cfg["languages"]
    urls = {lang: f"{base}{langs[lang]['prefix']}/privacy/" for lang in CONTENT}
    for lang, C in CONTENT.items():
        prefix = langs[lang]["prefix"].strip("/")
        shell = Shell(out / prefix / "cases" / "index.html")
        body = "".join(f"<h2>{html.escape(h)}</h2>" + "".join(f"<p>{p}</p>" for p in ps) for h, ps in C["sections"])
        main = (f'<section class="detail-hero compact-hero bc-article-hero"><div class="container detail-hero-grid"><div class="detail-hero-copy">'
                f'<h1>{html.escape(C["title"])}</h1><p>{html.escape(C["lead"])}</p>'
                f'<div class="bc-meta"><span>{C["updated"]}: {UPDATED[lang]}</span></div></div></div></section>'
                f'<article class="section insight-article bc-article"><div class="container prose">{body}</div></article>')
        meta = meta_block(cfg, lang, title=f'{C["title"]} · {cfg["site"]["name"]}', description=C["description"], url=urls[lang],
                          alternates=[(lng, u) for lng, u in urls.items()], og_type="website",
                          og_image=f"{base}/assets/bc-master-negative-brandbook.png", feed=f"{base}{langs[lang]['prefix']}/insights/feed.xml",
                          jsonld={"@context": "https://schema.org", "@type": "WebPage", "name": C["title"], "url": urls[lang]})
        page = shell.render(meta=meta, main=main,
                            lang_links=[(lng, lng.upper(), f"{langs[lng]['prefix']}/privacy/", lng == lang) for lng in CONTENT])
        dest = out / prefix / "privacy" / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page, encoding="utf-8")
        print(dest)
    # посилання на політику під кожною формою зв'язку
    n = 0
    for f in out.rglob("*.html"):
        s = f.read_text(encoding="utf-8")
        if "formspree" not in s or "/privacy/" in s:
            continue
        for lang in ("en", "uk"):
            C = CONTENT[lang]
            href = f"{langs[lang]['prefix']}/privacy/"
            if C["note_old"] in s:
                s = s.replace(C["note_old"], f'{C["note_old"]} <a class="text-link" href="{href}">{C["note_link"]}</a>.', 1)
                f.write_text(s, encoding="utf-8")
                n += 1
                break
    print(f"Посилання під формою додано на сторінок: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
