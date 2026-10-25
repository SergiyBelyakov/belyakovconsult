"""Бере шапку, підвал і підключення стилів з наявної сторінки сайту, щоб статті виглядали як решта сайту.

Джерело — сторінка cases/ потрібної мови (її конвеєр ніколи не перезаписує).
Якщо дизайн сайту зміниться, статті підхоплять його під час наступної збірки.
"""
from __future__ import annotations

import html
import re
from pathlib import Path

PAGE_SPECIFIC = [
    r"<title>.*?</title>",
    r"<meta\b[^>]*\bname=\"(?:description|robots|googlebot|author|twitter:[^\"]*)\"[^>]*>",
    r"<meta\b[^>]*\bproperty=\"og:[^\"]*\"[^>]*>",
    r"<link\b[^>]*\brel=\"(?:canonical|alternate)\"[^>]*>",
    r"<script type=\"application/ld\+json\">.*?</script>",
]
LANG_SWITCH = re.compile(r"<div aria-label=\"[^\"]*\" class=\"lang-switch\">.*?</div>", re.S)


class Shell:
    def __init__(self, page: Path):
        s = page.read_text(encoding="utf-8")
        try:
            h0, h1 = s.index("<head>"), s.index("</head>")
            hd0, hd1 = s.index("<header"), s.index("</header>") + len("</header>")
            f0 = s.index('<footer class="footer section"')
            m1 = s.index("</main>")
        except ValueError as e:
            raise RuntimeError(f"{page}: не знайдено очікуваної структури сторінки (head/header/footer/main)") from e
        self.doc_open = s[:h0]
        head = s[h0 + len("<head>"):h1]
        for p in PAGE_SPECIFIC:
            head = re.sub(p, "", head, flags=re.S)
        self.head_static = re.sub(r"\n{2,}", "\n", head).strip()
        self.body_open = s[h1:hd0]          # </head><body ...>
        self.header = s[hd0:hd1]
        self.footer = s[f0:m1]
        self.tail = s[m1:]                  # </main></body></html>

    def render(self, *, meta: str, main: str, lang_links: list[tuple[str, str, str, bool]]) -> str:
        """lang_links: (код мови, підпис, href, поточна?)"""
        switch = '<div aria-label="Language" class="lang-switch">' + "".join(
            f'<a{" aria-current=\"page\" class=\"active\"" if cur else ""} href="{html.escape(href)}" lang="{code}">{label}</a>'
            for code, label, href, cur in lang_links) + "</div>"
        header = LANG_SWITCH.sub(lambda _: switch, self.header, count=1)
        return (f"{self.doc_open}<head>{self.head_static}\n{meta}\n"
                f'<link href="/assets/insights/insights.css" rel="stylesheet"/>\n'
                f"{self.body_open}{header}<main>{main}{self.footer}{self.tail}")
