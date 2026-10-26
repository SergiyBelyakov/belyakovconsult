"""Спільні функції конвеєра: конфіг, статті, дописи, посилання, час."""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content" / "articles"
STATE_FILE = ROOT / "state" / "published.json"

CHANNELS = ("linkedin", "linkedinpage", "threads", "telegram", "instagram")
NEXT_MARK = "<!-- next -->"  # розділювач частин треду в Threads


def load_config() -> dict:
    with open(ROOT / "config.yml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def tz(cfg: dict) -> ZoneInfo:
    return ZoneInfo(cfg.get("timezone", "Europe/Kyiv"))


def now(cfg: dict) -> datetime:
    override = os.environ.get("PIPELINE_NOW")  # для тестів: "2026-10-27 10:05"
    if override:
        return datetime.strptime(override, "%Y-%m-%d %H:%M").replace(tzinfo=tz(cfg))
    return datetime.now(tz(cfg))


def split_front_matter(text: str, path: Path) -> tuple[dict, str]:
    if not text.startswith("---"):
        raise ValueError(f"{path}: файл має починатися з блоку --- ... ---")
    parts = text.split("\n---", 1)
    if len(parts) != 2:
        raise ValueError(f"{path}: не закритий блок --- ... ---")
    meta = yaml.safe_load(parts[0][3:]) or {}
    body = parts[1].lstrip("-").lstrip("\n")
    return meta, body.strip() + "\n"


@dataclass
class Article:
    slug: str
    lang: str
    path: Path
    title: str
    description: str
    date: date
    body: str
    services: list = field(default_factory=list)
    tags: list = field(default_factory=list)
    draft: bool = False
    carousel: list = field(default_factory=list)
    updated: date | None = None
    # Додаткові відео для дописів 2, 3…: [{title, text, carousel}], episodes[0] іде до допису 2
    episodes: list = field(default_factory=list)

    @property
    def words(self) -> int:
        return len(re.findall(r"\w+", self.body))

    @property
    def read_minutes(self) -> int:
        return max(1, round(self.words / 200))


@dataclass
class Post:
    slug: str
    channel: str
    lang: str
    path: Path
    publish_at: datetime
    body: str
    link: bool = True
    images: list = field(default_factory=list)
    media: str | None = None     # motion | carousel | none (за замовчуванням із config.yml)
    n: int = 1                   # номер допису в тижні теми: 1 — основне відео статті, 2+ — episodes статті
    auto_time: bool = False      # publish_at обчислено з cadence у config.yml

    @property
    def key(self) -> str:
        return f"{self.slug}/{self.channel}-{self.lang}" + (f"-{self.n}" if self.n > 1 else "")

    def parts(self) -> list[str]:
        return [p.strip() for p in self.body.split(NEXT_MARK) if p.strip()]


def _as_date(v, path) -> date:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    try:
        return datetime.strptime(str(v), "%Y-%m-%d").date()
    except ValueError as e:
        raise ValueError(f"{path}: дата має бути у форматі РРРР-ММ-ДД, отримано {v!r}") from e


def load_articles(cfg: dict, include_drafts: bool = False) -> list[Article]:
    out = []
    for f in sorted(CONTENT.glob("*/*.md")):
        lang = f.stem
        if lang not in cfg["languages"]:
            continue
        meta, body = split_front_matter(f.read_text(encoding="utf-8"), f)
        a = Article(
            slug=f.parent.name,
            lang=lang,
            path=f,
            title=str(meta.get("title", "")).strip(),
            description=str(meta.get("description", "")).strip(),
            date=_as_date(meta.get("date"), f),
            body=body,
            services=list(meta.get("services") or []),
            tags=list(meta.get("tags") or []),
            draft=bool(meta.get("draft", False)),
            carousel=list(meta.get("carousel") or []),
            updated=_as_date(meta["updated"], f) if meta.get("updated") else None,
            episodes=list(meta.get("episodes") or []),
        )
        if a.draft and not include_drafts:
            continue
        out.append(a)
    return out


def is_live(a: Article, cfg: dict) -> bool:
    """Стаття видима на сайті: не чернетка і дата публікації настала."""
    return not a.draft and a.date <= now(cfg).date()


POST_NAME = re.compile(r"^(?P<channel>[a-z]+)-(?P<lang>[a-z]{2})(?:-(?P<n>\d+))?$")
WEEKDAYS = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


def _article_date(slug: str, lang: str) -> date | None:
    for name in (lang, "uk"):
        f = CONTENT / slug / f"{name}.md"
        if f.exists():
            meta, _ = split_front_matter(f.read_text(encoding="utf-8"), f)
            if meta.get("date"):
                return _as_date(meta["date"], f)
    return None


def cadence_phase(cfg: dict, d: date) -> dict:
    """Етап ритму для статті з датою d: перший етап, у якого until >= d (або без until)."""
    cad = cfg.get("cadence") or {}
    for ph in cad.get("phases") or []:
        if not ph.get("until") or d <= _as_date(ph["until"], "config.yml"):
            return {**cad, **ph}
    return cad


def scheduled_at(cfg: dict, slug: str, channel: str, lang: str, n: int) -> datetime | None:
    """Час допису за ритмом із config.yml (cadence): дата статті + post_days[n], час каналу й мови."""
    d = _article_date(slug, lang)
    if not d:
        return None
    cad = cadence_phase(cfg, d)
    days = (cad.get("post_days") or {}).get(n)
    hhmm = ((cad.get("times") or {}).get(channel) or {}).get(lang)
    if days is None or not hhmm:
        return None
    h, m = (int(x) for x in str(hhmm).split(":"))
    return datetime(d.year, d.month, d.day, h, m) + timedelta(days=int(days))


def load_posts(cfg: dict) -> list[Post]:
    out = []
    for f in sorted(CONTENT.glob("*/posts/*.md")):
        meta, body = split_front_matter(f.read_text(encoding="utf-8"), f)
        m = POST_NAME.match(f.stem)
        if not m and not (meta.get("channel") and meta.get("lang")):
            raise ValueError(f"{f}: назва має бути <канал>-<мова>.md або <канал>-<мова>-<номер>.md")
        channel = meta.get("channel") or m["channel"]
        lang = meta.get("lang") or m["lang"]
        n = int(meta.get("n") or (m and m["n"]) or 1)
        slug = f.parent.parent.name
        raw = meta.get("publish_at")
        auto = raw is None
        if auto:
            dt = scheduled_at(cfg, slug, channel, lang, n)
            if dt is None:
                raise ValueError(f"{f}: немає publish_at, і ритм cadence у config.yml не дає часу для {channel}-{lang}, допис {n}")
        elif isinstance(raw, datetime):
            dt = raw
        else:
            try:
                dt = datetime.strptime(str(raw), "%Y-%m-%d %H:%M")
            except ValueError as e:
                raise ValueError(f"{f}: publish_at має бути «РРРР-ММ-ДД ГГ:ХХ», отримано {raw!r}") from e
        dt = dt.replace(tzinfo=tz(cfg)) if dt.tzinfo is None else dt
        out.append(Post(
            slug=slug,
            channel=channel,
            lang=lang,
            path=f,
            publish_at=dt,
            body=body.strip(),
            link=bool(meta.get("link", True)),
            images=list(meta.get("images") or []),
            media=meta.get("media"),
            n=n,
            auto_time=auto,
        ))
    return out


def channel_of(key: str) -> str:
    """Канал із ключа журналу «<slug>/<канал>-<мова>[-N]»."""
    m = POST_NAME.match(key.split("/", 1)[1])
    return m["channel"] if m else key.split("/", 1)[1].split("-")[0]


def article_path(cfg: dict, lang: str, slug: str | None = None) -> str:
    prefix = cfg["languages"][lang]["prefix"]
    base = prefix + cfg["site"]["insights_path"]
    return base + (f"{slug}/" if slug else "")


def article_url(cfg: dict, lang: str, slug: str | None = None, channel: str | None = None) -> str:
    url = cfg["site"]["base_url"].rstrip("/") + article_path(cfg, lang, slug)
    if channel and cfg.get("utm", {}).get("enabled"):
        q = {"utm_source": channel, "utm_medium": cfg["utm"].get("medium", "social"),
             "utm_campaign": slug or "insights"}
        url += "?" + urlencode(q)
    return url


def service_link(cfg: dict, key: str, lang: str) -> tuple[str, str] | None:
    s = cfg["services"].get(key)
    if not s:
        return None
    href = cfg["languages"][lang]["prefix"] + s["path"]
    return s.get(lang) or s["en"], href


def render_post_text(post: Post, cfg: dict, part: str | None = None) -> str:
    text = part if part is not None else post.body
    return text.replace("{{link}}", article_url(cfg, post.lang, post.slug, post.channel))


def signature(cfg: dict, channel: str, lang: str) -> str:
    sig = (cfg.get("signatures") or {}).get(channel) or {}
    if isinstance(sig, str):
        return sig
    return sig.get(lang) or sig.get("uk") or ""


def _is_hashtags(par: str) -> bool:
    words = par.split()
    return bool(words) and all(w.startswith("#") for w in words)


def post_parts(post: Post, cfg: dict) -> list[str]:
    """Готові частини допису: {{link}} підставлено, підпис з посиланнями на інші канали додано.

    Підпис стає перед рядком хештегів, якщо він є. У Threads підпис іде в останню частину,
    а якщо там не вміщається, окремою частиною.
    """
    parts = [render_post_text(post, cfg, p) for p in post.parts()]
    sig = signature(cfg, post.channel, post.lang)
    if not sig or not parts:
        return parts
    last = parts[-1]
    pars = last.split("\n\n")
    if _is_hashtags(pars[-1]):
        new_last = "\n\n".join(pars[:-1] + [sig, pars[-1]])
    else:
        new_last = last + "\n\n" + sig
    limit = cfg["channels"].get(post.channel, {}).get("max_chars", 10_000)
    if post.channel == "threads" and len(new_last) > limit:
        return parts + [sig]
    return parts[:-1] + [new_last]


def media_kind(post: Post, cfg: dict) -> str:
    return post.media or cfg["channels"].get(post.channel, {}).get("media", "none")


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8") or "{}")
    return {}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _lang_sub(lang: str | None) -> str:
    return "" if not lang or lang == "uk" else f"/{lang}"


def social_asset_dir(cfg: dict, slug: str, lang: str | None = None) -> Path:
    """Візуали статті: українська версія в assets/insights/<slug>/, інші мови в підпапці <slug>/<lang>/."""
    return ROOT / cfg["site"]["output_dir"] / "assets" / "insights" / (slug + _lang_sub(lang))


def social_asset_url(cfg: dict, slug: str, name: str, lang: str | None = None) -> str:
    return f"{cfg['site']['base_url'].rstrip('/')}/assets/insights/{slug}{_lang_sub(lang)}/{name}"


def episode_sub(n: int) -> str:
    """Підпапка відео допису N: основне відео лежить у папці статті, відео дописів 2+ у e2/, e3/…"""
    return "" if n <= 1 else f"e{n}/"


def fmt_dt(d: datetime) -> str:
    return d.strftime("%Y-%m-%d %H:%M")


def within(d: datetime, start: datetime, days: int) -> bool:
    return start <= d < start + timedelta(days=days)
