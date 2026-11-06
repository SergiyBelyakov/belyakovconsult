"""Швидка перевірка готового сайту перед публікацією (без браузера, лише стандартна бібліотека).

Перевіряє кожну сторінку з sitemap.xml і sitemap-insights.xml:
- файл сторінки існує, є <title>, meta description і canonical на власну адресу;
- og:image і twitter:image ведуть на наш файл, який існує;
- кожне посилання hreflang веде на сторінку, яка існує;
- внутрішні посилання (href) і ресурси (src, stylesheet, preload) ведуть на наявні файли.
А також: у site/ немає внутрішніх службових файлів.

Конвеєр запускає скрипт після збірки й до публікації дописів: якщо щось зламалося,
дописи не виходять і зламаний сайт не потрапляє в main.

Запуск: python scripts/smoke.py
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
BASE = "https://www.belyakovconsult.com"
SITEMAPS = ["sitemap.xml", "sitemap-insights.xml"]

# Службові файли, яким не місце в публічній частині
FORBIDDEN = re.compile(r"(?i)^(readme.*|.*changelog.*|image_prompts.*|.*parity_report.*|update_.*\.txt|start_local\..*|.*_updated\.html|.*\.bak)$")

errors: list[str] = []


def err(where: str, msg: str) -> None:
    errors.append(f"{where}: {msg}")


def local_file(path: str) -> Path | None:
    """Шлях сайту (/a/b/, /a/b.css) → файл у site/ або None, якщо його немає."""
    path = unquote(path.split("#")[0].split("?")[0])
    if not path.startswith("/"):
        return None
    p = SITE / path.lstrip("/")
    if path.endswith("/"):
        p = p / "index.html"
    if p.is_file():
        return p
    if (p / "index.html").is_file():
        return p / "index.html"
    return None


def redirects() -> set[str]:
    f = SITE / "_redirects"
    if not f.exists():
        return set()
    return {ln.split()[0] for ln in f.read_text(encoding="utf-8").splitlines() if ln.strip() and not ln.startswith("#")}


def attr(tag: str, name: str) -> str | None:
    m = re.search(rf'\s{name}="([^"]*)"', tag)
    return html.unescape(m.group(1)) if m else None


def meta(s: str, prop: str) -> str | None:
    for tag in re.findall(r"<meta\b[^>]*>", s):
        if attr(tag, "property") == prop or attr(tag, "name") == prop:
            return attr(tag, "content")
    return None


def strip_inline(s: str) -> str:
    """Прибрати вміст <script> і <noscript>... крім атрибутів самих тегів, щоб не ловити шаблони в JS."""
    return re.sub(r"(<script\b[^>]*>).*?(</script>)", r"\1\2", s, flags=re.S | re.I)


def check_page(url: str, ok_redirects: set[str]) -> None:
    path = urlsplit(url).path or "/"
    f = local_file(path)
    if not f:
        err(url, "сторінки немає в site/")
        return
    s = f.read_text(encoding="utf-8")
    where = str(f.relative_to(ROOT))

    if not re.search(r"<title>\s*\S", s):
        err(where, "немає <title>")
    if not meta(s, "description"):
        err(where, "немає meta description")
    canon = re.search(r'<link\b[^>]*rel="canonical"[^>]*>', s)
    if not canon or attr(canon.group(0), "href") != url:
        err(where, f"canonical не {url}")

    for prop in ("og:image", "twitter:image"):
        v = meta(s, prop)
        if not v:
            err(where, f"немає {prop}")
        elif v.startswith(BASE) and not local_file(v[len(BASE):]):
            err(where, f"{prop} веде на відсутній файл {v}")

    for tag in re.findall(r'<link\b[^>]*rel="alternate"[^>]*>', s):
        href = attr(tag, "href") or ""
        if attr(tag, "hreflang") and href.startswith(BASE) and not local_file(urlsplit(href).path or "/"):
            err(where, f"hreflang {attr(tag, 'hreflang')} веде на відсутню сторінку {href}")

    body = strip_inline(s)
    for m in re.finditer(r'\s(href|src)="([^"]+)"', body):
        v = html.unescape(m.group(2))
        if v.startswith(BASE):
            v = v[len(BASE):] or "/"
        if not v.startswith("/") or v.startswith("//"):
            continue
        clean = v.split("#")[0].split("?")[0]
        if not clean or clean in ok_redirects or clean.startswith("/cdn-cgi/"):
            continue
        if not local_file(clean):
            err(where, f"посилання на відсутній файл {v}")


def main() -> int:
    for f in SITE.iterdir():
        if f.is_file() and FORBIDDEN.match(f.name):
            err(str(f.relative_to(ROOT)), "службовий файл у публічній частині сайту")

    ok_redirects = redirects()
    urls: list[str] = []
    for sm in SITEMAPS:
        p = SITE / sm
        if not p.exists():
            err(sm, "немає файлу")
            continue
        urls += [html.unescape(u) for u in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", p.read_text(encoding="utf-8"))]
    if len(urls) < 40:
        err("sitemap", f"підозріло мало сторінок: {len(urls)}")

    for url in dict.fromkeys(urls):
        check_page(url, ok_redirects)

    if errors:
        uniq = list(dict.fromkeys(errors))
        print(f"Smoke: {len(uniq)} помилок")
        print("\n".join(uniq[:200]))
        return 1
    print(f"Smoke: ок, перевірено {len(set(urls))} сторінок")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
