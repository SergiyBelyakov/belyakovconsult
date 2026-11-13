"""Шаблон преміум-роликів (9:16, 24 с): формат, затверджений власником 13.11.2026 після тестового «Night Drive».

Кожен ролик збирається з варіантів, щоб формат не повторювався:
  scene   одна з 10 заставок із різною перспективою й рухом камери (scripts/premium_scenes.py)
  track   одна з 5 мелодій (make_nightdrive.TRACKS: Night Drive, Neon Rain, Chrome Dawn, Glass City, Midnight Ledger)
  layout  center | left (редакторський, з рубіновою лінією)
  reveal  slide | mask | focus: як з'являються заголовки
  outro   fade | iris | wipe: перехід до фіналу з логотипом
  panel   frost (матове скло) | line (тонкий контур)
Блоки перевірок: rows, flow, columns, split, timeline, chips, stack. Скрізь: відблиск по великих числах, спалах
світла на дропі, розфокус тла під висновок, прокрутка значення в картці KPI.

Сюжет: 0 хук-біль керівника, 2.4 питання, 4.8 перевірка 1 (події 6.0, 7.8, 9.6), 11 перевірка 2 (12.6, 13.8, 15.0),
15.6 результат, 16.8 висновок, 19.2 фінал з однією дією. Тексти: scripts/premium_stories.py.

Запуск: python scripts/make_premium.py <slug> <N> <мова> <папка>
        python scripts/make_premium.py --next     (які заставка й мелодія наступні за ротацією)
        python scripts/make_premium.py --reel <файл.mp4>   (показовий ролик: 10 заставок і 5 мелодій)
"""
from __future__ import annotations

import math
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import glass  # noqa: E402
import make_nightdrive as nd  # noqa: E402
import premium_scenes as ps  # noqa: E402
from make_nightdrive import (BODY, EATS, FPS, GRAPHITE, H, HY, PINK, RUBY, SILVER, T_BAND, T_DROP, T_DUPES, T_END,  # noqa: E402
                             T_Q, T_REAL, TOP_Y, TOTAL, WHITE, W, ZAPS, bwrap, clamp, comp, ease, glass_column,
                             tracked)
from premium_stories import STORIES  # noqa: E402

CARD = (90, 1392, 930, 1520)
PANEL_BOTTOM = 1376
EV = {1: ZAPS, 2: EATS}
STARTS = {1: T_DROP, 2: T_DUPES}
ENDS = {1: T_DUPES, 2: T_REAL}
PHASES = [(0.0, "hook"), (T_Q, "q"), (T_DROP, "c1"), (T_DUPES, "c2"), (T_REAL, "result"), (T_BAND, "takeaway"), (T_END, None)]
LAYOUTS, REVEALS, OUTROS, PANELS = ["center", "left"], ["mask", "focus", "slide"], ["iris", "wipe", "fade"], ["frost", "line"]


def style_of(key):
    """Явний style історії, інакше ротація за порядком історій (сусіди не повторюють заставку й мелодію)."""
    keys = list(STORIES)
    i = keys.index(key)
    st = dict(STORIES[key].get("style") or {})
    st.setdefault("scene", ps.SCENES[(i + 1) % len(ps.SCENES)])
    st.setdefault("track", (i + 1) % len(nd.TRACKS))
    st.setdefault("layout", LAYOUTS[i % 2])
    st.setdefault("reveal", REVEALS[i % 3])
    st.setdefault("outro", OUTROS[i % 3])
    st.setdefault("panel", PANELS[(i + 1) % 2])
    return st


def suggest_next():
    """Найменш уживані заставка й мелодія серед останніх історій."""
    used_s, used_t = ["sunset"], [0]          # тестовий Night Drive
    for k in STORIES:
        st = style_of(k)
        used_s.append(st["scene"])
        used_t.append(st["track"])
    scene = min(ps.SCENES, key=lambda s: (s in used_s[-9:], -used_s[::-1].index(s) if s in used_s else -99))
    track = min(range(len(nd.TRACKS)), key=lambda t: (t in used_t[-4:], -used_t[::-1].index(t) if t in used_t else -99))
    return scene, track


def ev_time(ref):
    if ref == "start":
        return 0.0
    c = int(ref[1])
    return STARTS[c] if len(ref) == 2 else EV[c][int(ref[3])]


def fit_font(kind, size, text, maxw, min_size=30):
    while size > min_size and brand.font(kind, size).getlength(text) > maxw:
        size -= 4
    return brand.font(kind, size)


@lru_cache(maxsize=None)
def block(key, lang, name, layout):
    s = STORIES[key][lang]
    if name == "hook":
        label, big, sub, style = s["hook"][0], s["hook"][1], s["hook"][2], "num"
    elif name == "q":
        label, big, sub, style = s["hook"][0], s["q"][0], s["q"][1], "q"
    elif name in ("c1", "c2"):
        c = s[name]
        label, big, sub, style = c["label"], c["title"], c["sub"], "word"
    elif name == "result":
        label, big, sub, style = s["result"][0], s["result"][1], s["result"][2], "true"
    else:
        label, big, sub, style = "", s["takeaway"], "", "q2"
    left = layout == "left"
    x0, maxw = (104, 860) if left else (0, 960)

    def xpos(w):
        return x0 if left else (W - w) / 2
    img = Image.new("RGBA", (W, 720), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    y = 0
    if label:
        fl = fit_font("body-semi", 30, label, maxw - 60, 22)
        if left:
            tracked(d, label, fl, x0 + (sum(fl.getlength(c) for c in label) + 6 * (len(label) - 1)) / 2, y, (*SILVER, 255), 6)
        else:
            tracked(d, label, fl, W / 2, y, (*SILVER, 255), 6)
        y += 64
    if style in ("num", "true"):
        f = fit_font("head", 236, big, maxw, 90)
        col, lines = (RUBY if style == "num" else WHITE), [big]
    elif style == "word":
        f = fit_font("head", 132, big, maxw, 70)
        col, lines = WHITE, [big]
    else:
        col = WHITE
        for size in ((86, 78, 70, 64) if style == "q" else (76, 70, 64, 58)):
            f = brand.font("head", size)
            lines = [ln for part in big.split("\n") for ln in bwrap(part, f, maxw)]
            if len(lines) <= 2:
                break
    asc, desc = f.getmetrics()
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dl = ImageDraw.Draw(lay)
    for i, ln in enumerate(lines):
        c = RUBY if (style == "q2" and i == len(lines) - 1) else col
        dl.text((xpos(f.getlength(ln)), y), ln, font=f, fill=(*c, 255))
        y += int((asc + desc) * (0.86 if style in ("num", "true") else 1.02))
    if style in ("num", "true"):
        glow = lay.filter(ImageFilter.GaussianBlur(26))
        img.alpha_composite(glow)
        img.alpha_composite(glow)
    img.alpha_composite(lay)
    y += 18
    if sub:
        fs = brand.font("body", 44)
        for ln in bwrap(sub, fs, maxw - 40):
            d.text((xpos(fs.getlength(ln)), y), ln, font=fs, fill=(*BODY, 255))
            y += 58
    if left:
        d.rectangle([64, 6, 69, y - 10], fill=(*RUBY, 255))
    return img.crop((0, 0, W, y + 30))


def sheen(img, u, width=46, strength=190):
    """Діагональний відблиск, що пробігає по тексту (u від 0 до 1)."""
    if not 0 < u < 1:
        return None
    a = np.asarray(img.getchannel("A")).astype(np.float32) / 255
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    coord = xx + yy * 0.6
    c = -200 + u * (w + h * 0.6 + 400)
    band = np.exp(-((coord - c) / width) ** 2) * strength * a
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = 255
    out[..., 3] = band.clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def fade_alpha(img, a):
    if a >= 0.999:
        return img
    out = img.copy()
    out.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
    return out


class Story:
    def __init__(self, key: str, lang: str):
        self.key, self.lang = key, lang
        self.S = STORIES[key][lang]
        self.st = style_of(key)
        self.scene = ps.make(self.st["scene"])
        self.cow = nd.cow_hits(self.st["track"])
        self.lock = brand.lockup(52)
        self.logo = brand.logo(200)
        self.f_lab = brand.font("body-semi", 26)
        self.f_pill = brand.font("body-semi", 24)
        self.f_cap = brand.font("body", 26)
        self.f_end = brand.font("body", 46)
        self.f_url = brand.font("body-semi", 34)
        self.f_colv = brand.font("head", 46)

    # ---------------------------------------------------------------- панель і її стиль
    def panel(self, fr, t, c, h):
        start, end = STARTS[c] - 0.4, ENDS[c] + 0.5
        if not (start <= t < end):
            return None, 0.0
        k = ease((t - start) / 0.4) * clamp((end - t) / 0.4)
        box = (90, PANEL_BOTTOM - h, 930, PANEL_BOTTOM)
        self.surface(fr, box, k)
        return box, k

    def surface(self, fr, box, k, radius=30):
        if self.st["panel"] == "frost":
            glass.frosted(fr, box, radius, k)
        else:
            x0, y0, x1, y1 = (int(v) for v in box)
            lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
            d = ImageDraw.Draw(lay)
            d.rounded_rectangle([0, 0, lay.width - 1, lay.height - 1], radius, fill=(8, 10, 16, 175), outline=(255, 255, 255, 46), width=2)
            d.rounded_rectangle([0, 18, 5, lay.height - 18], 3, fill=(*RUBY, 255))
            comp(fr, lay, x0, y0, k)

    def title(self, d, spec, w):
        tracked(d, spec["table"], self.f_lab, w / 2, 26, (*SILVER, 255), 4)
        d.line([40, 70, w - 40, 70], fill=(255, 255, 255, 40), width=1)

    @staticmethod
    def lit(c, i, n_first=True):
        """Час, коли загоряється i-й елемент: перший на старті перевірки, далі на подіях."""
        if i == 0 and n_first:
            return STARTS[c] + 0.3
        return EV[c][min(i - (1 if n_first else 0), 2)]

    def pill(self, d, x1, y, text, bad, a):
        fp = fit_font("body-semi", 24, text, 250, 16)
        tw = fp.getlength(text)
        x0 = x1 - tw - 40
        if bad:
            d.rounded_rectangle([x0, y, x1, y + 38], 19, outline=(*PINK, int(255 * a)), width=2)
            d.text((x0 + 20, y + 7), text, font=fp, fill=(*PINK, int(255 * a)))
        else:
            d.rounded_rectangle([x0, y, x1, y + 38], 19, fill=(*WHITE, int(235 * a)))
            d.text((x0 + 20, y + 7), text, font=fp, fill=(*GRAPHITE, int(255 * a)))
        return x0

    # ---------------------------------------------------------------- блоки перевірок
    def rows(self, fr, t, c, spec):
        rows = spec["rows"]
        box, k = self.panel(fr, t, c, 84 + len(rows) * 76 + 10)
        if not box:
            return
        x0, y0, x1, y1 = box
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        self.title(d, spec, lay.width)
        y = 82
        for r in rows:
            te = EV[c][r["at"]] if "at" in r else None
            on = te is not None and t >= te - 0.25
            u = clamp((t - (te - 0.25)) / 0.35) if te is not None else 0.0
            bad = r.get("bad", True)
            if on:
                pulse = 0.5 + 0.5 * math.sin((t - te) * 9) if bad else 0.6
                d.rounded_rectangle([24, y - 4, lay.width - 24, y + 70], 10, fill=(*(RUBY if bad else WHITE), int((22 + 30 * pulse) * u)))
            fcap = fit_font("body", 26, r["l"], 440 if r.get("flag") else 700, 18)
            d.text((44, y + 2), r["l"], font=fcap, fill=(*SILVER, 255))
            fv = fit_font("body-semi", 36, r["v"], 470, 24)
            if "v2" in r and on:
                d.text((44, y + 30 - u * 12), r["v"], font=fv, fill=(*WHITE, int(255 * (1 - u))))
                fv2 = fit_font("body-semi", 36, r["v2"], 470, 24)
                d.text((44, y + 30 + (1 - u) * 12), r["v2"], font=fv2, fill=(*(PINK if bad else WHITE), int(255 * u)))
            else:
                d.text((44, y + 30), r["v"], font=fv, fill=(*WHITE, 255))
            if on and r.get("flag"):
                self.pill(d, lay.width - 44, y + 18, r["flag"], bad, u)
            y += 76
        comp(fr, lay, x0, y0, k)

    def flow(self, fr, t, c, spec):
        steps = spec["steps"]
        box, k = self.panel(fr, t, c, 84 + len(steps) * 66 + 10)
        if not box:
            return
        x0, y0, x1, y1 = box
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        tracked(d, spec["table"], self.f_lab, lay.width / 2, 26, (*SILVER, 255), 4)
        y = 84
        fn = brand.font("body-semi", 22)
        for i, st in enumerate(steps):
            u = clamp((t - self.lit(c, i)) / 0.35)
            col = RUBY if (i == len(steps) - 1 and spec.get("last_bad")) else WHITE
            if i:
                d.line([80, y - 18, 80, y + 6], fill=(255, 255, 255, int(60 + 150 * u)), width=3)
            d.rounded_rectangle([40, y + 6, lay.width - 40, y + 54], 24, fill=(*col, int(26 + 40 * u)), outline=(*col, int(60 + 180 * u)), width=2)
            d.ellipse([58, y + 14, 102, y + 46], fill=(*(RUBY if u > 0.5 else (60, 66, 80)), 255))
            num = str(i + 1)
            d.text((80 - fn.getlength(num) / 2, y + 17), num, font=fn, fill=(*WHITE, 255))
            fs = fit_font("body-semi", 30, st, 620, 20)
            d.text((124, y + 14), st, font=fs, fill=(*(WHITE if u > 0.5 else SILVER), 255))
            y += 66
        comp(fr, lay, x0, y0, k)

    def columns(self, fr, t, c, spec):
        start, end = STARTS[c] - 0.2, ENDS[c] + 0.6
        if not (start <= t < end):
            return
        out = clamp((end - t) / 0.5)
        hl = H - HY
        s = 0.30
        base = HY + hl * s
        d = ImageDraw.Draw(fr)
        d.line([150, base, 930, base], fill=(255, 210, 220, int(110 * out * ease((t - start) / 0.4))), width=2)
        tops = []
        for i, col in enumerate(spec["cols"]):
            te = EV[c][i]
            u = ease((t - (te - 0.5)) / 0.6)
            cx = W / 2 + (-520 if i == 0 else 520) * s * 2.0
            w = 340 * s * 1.15
            hfull = 1060 * s * col["h"]
            h = max(2, hfull * u)
            top = base - h
            tops.append((cx, base - hfull))
            if u > 0:
                comp(fr, glass_column(w, h, hot=0.2 if i == 1 else 0.0), cx - w / 2, top, out)
                fv = self.f_colv
                d.text((cx - fv.getlength(col["v"]) / 2, top - 62), col["v"], font=fv, fill=(*WHITE, int(255 * u * out)),
                       stroke_width=4, stroke_fill=(*GRAPHITE, int(200 * u * out)))
            fc = fit_font("body-semi", 28, col["c"], 300, 18)
            d.text((cx - fc.getlength(col["c"]) / 2, base + 12), col["c"], font=fc, fill=(*SILVER, int(255 * out)))
        if spec.get("tag") and t >= EV[c][2] - 0.2:
            u = ease((t - (EV[c][2] - 0.2)) / 0.4) * out
            (ax, atop), (bx, btop) = tops
            yy = min(atop, btop) - 92
            d.line([ax, yy + 20, bx, yy + 20], fill=(*PINK, int(255 * u)), width=3)
            for x in (ax, bx):
                d.line([x, yy + 20, x, yy + 34], fill=(*PINK, int(255 * u)), width=3)
            ft = fit_font("body-semi", 30, spec["tag"], 760, 20)
            tw = ft.getlength(spec["tag"])
            d.rounded_rectangle([W / 2 - tw / 2 - 22, yy - 30, W / 2 + tw / 2 + 22, yy + 12], 21, fill=(*RUBY, int(235 * u)))
            d.text((W / 2 - tw / 2, yy - 24), spec["tag"], font=ft, fill=(*WHITE, int(255 * u)))

    def split(self, fr, t, c, spec):
        """Дві картки, що перевертаються по черзі, і зв'язок між ними (напр. «той самий номер»)."""
        box, k = self.panel(fr, t, c, 84 + 214 + 64)
        if not box:
            return
        x0, y0, x1, y1 = box
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        self.title(d, spec, lay.width)
        cw, ch = (lay.width - 3 * 28) // 2, 190
        for i, card in enumerate(spec["cards"]):
            u = ease((t - (EV[c][i] - 0.45)) / 0.45)
            if u <= 0.02:
                continue
            ci = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            dc = ImageDraw.Draw(ci)
            bad = card.get("bad", spec.get("link_bad", True))
            dc.rounded_rectangle([0, 0, cw - 1, ch - 1], 22, fill=(255, 255, 255, 18), outline=(*(PINK if bad else WHITE), 120), width=2)
            fc = fit_font("body", 26, card["c"], cw - 48, 18)
            dc.text((24, 20), card["c"], font=fc, fill=(*SILVER, 255))
            fv = fit_font("head", 64, card["v"], cw - 48, 30)
            dc.text((24, 56), card["v"], font=fv, fill=(*WHITE, 255))
            if card.get("n"):
                fn = fit_font("body", 24, card["n"], cw - 48, 16)
                dc.text((24, ch - 44), card["n"], font=fn, fill=(*BODY, 255))
            sw = max(1, int(cw * u))                            # «переворот»: картка розкривається по ширині
            ci = ci.resize((sw, ch), Image.BILINEAR)
            px = 28 + i * (cw + 28) + (cw - sw) // 2
            lay.alpha_composite(ci, (px, 90))
        if spec.get("link") and t >= EV[c][2] - 0.3:
            u = ease((t - (EV[c][2] - 0.3)) / 0.35)
            fp = fit_font("body-semi", 26, spec["link"], 380, 18)
            tw = fp.getlength(spec["link"])
            cx, cy = lay.width / 2, 90 + ch + 40
            bad = spec.get("link_bad", True)
            d.line([28 + cw / 2, 90 + ch, 28 + cw / 2, cy, cx - tw / 2 - 24, cy], fill=(*(PINK if bad else WHITE), int(200 * u)), width=2)
            d.line([28 + cw * 1.5 + 28, 90 + ch, 28 + cw * 1.5 + 28, cy, cx + tw / 2 + 24, cy], fill=(*(PINK if bad else WHITE), int(200 * u)), width=2)
            d.rounded_rectangle([cx - tw / 2 - 24, cy - 24, cx + tw / 2 + 24, cy + 24], 24, fill=(*(RUBY if bad else WHITE), int(245 * u)))
            d.text((cx - tw / 2, cy - 16), spec["link"], font=fp, fill=(*(WHITE if bad else GRAPHITE), int(255 * u)))
        comp(fr, lay, x0, y0, k)

    def timeline(self, fr, t, c, spec):
        """Горизонтальна шкала подій: вузли загоряються, лінія проростає між ними."""
        nodes = spec["nodes"]
        box, k = self.panel(fr, t, c, 84 + 196)
        if not box:
            return
        x0, y0, x1, y1 = box
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        self.title(d, spec, lay.width)
        n = len(nodes)
        xs = [110 + i * (lay.width - 220) / (n - 1) for i in range(n)]
        ly = 168
        d.line([xs[0], ly, xs[-1], ly], fill=(255, 255, 255, 50), width=4)
        prog_x = xs[0]
        for i in range(1, n):
            u = ease((t - (self.lit(c, i) - 0.4)) / 0.4)
            if u > 0:
                prog_x = xs[i - 1] + (xs[i] - xs[i - 1]) * u
        last_bad = spec.get("last_bad")
        d.line([xs[0], ly, prog_x, ly], fill=(*PINK, 255) if last_bad else (*WHITE, 230), width=4)
        fv_base = fit_font("body-semi", 30, max((nd_["v"] for nd_ in nodes), key=len), (lay.width - 220) / (n - 1) + 40, 18)
        for i, node in enumerate(nodes):
            u = clamp((t - self.lit(c, i)) / 0.3)
            bad = last_bad and i == n - 1
            col = RUBY if bad else WHITE
            r = 10 + 4 * u
            d.ellipse([xs[i] - r, ly - r, xs[i] + r, ly + r], fill=(*(col if u > 0.4 else (60, 66, 80)), 255),
                      outline=(*col, int(120 + 135 * u)), width=3)
            fv = fv_base
            tw = fv.getlength(node["v"])
            tx = clamp(xs[i] - tw / 2, 30, lay.width - 30 - tw)
            d.text((tx, ly - 66 + (1 - u) * 10), node["v"], font=fv, fill=(*(PINK if bad else WHITE), int(80 + 175 * u)))
            fc = brand.font("body", 23)
            for j, ln in enumerate(brand.wrap(node["c"], fc, (lay.width - 220) / (n - 1) - 26)[:2]):
                cw_ = fc.getlength(ln)
                cx_ = clamp(xs[i] - cw_ / 2, 24, lay.width - 24 - cw_)
                d.text((cx_, ly + 24 + j * 28), ln, font=fc, fill=(*SILVER, int(90 + 165 * u)))
        comp(fr, lay, x0, y0, k)

    def chips(self, fr, t, c, spec):
        """Плитки 2x2, що з'являються з легким збільшенням."""
        chips = spec["chips"]
        rows_n = math.ceil(len(chips) / 2)
        box, k = self.panel(fr, t, c, 84 + rows_n * 108 + 14)
        if not box:
            return
        x0, y0, x1, y1 = box
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        self.title(d, spec, lay.width)
        cw, chh = (lay.width - 3 * 24) // 2, 92
        for i, chip in enumerate(chips):
            u = ease((t - self.lit(c, i)) / 0.4)
            if u <= 0.02:
                continue
            ci = Image.new("RGBA", (cw, chh), (0, 0, 0, 0))
            dc = ImageDraw.Draw(ci)
            bad = chip.get("bad", False)
            dc.rounded_rectangle([0, 0, cw - 1, chh - 1], 20, fill=(*(RUBY if bad else WHITE), 30), outline=(*(PINK if bad else WHITE), 150), width=2)
            fc = fit_font("body", 24, chip["c"], cw - 40, 16)
            dc.text((20, 12), chip["c"], font=fc, fill=(*SILVER, 255))
            fv = fit_font("body-semi", 32, chip["v"], cw - 40, 18)
            dc.text((20, 44), chip["v"], font=fv, fill=(*(PINK if bad else WHITE), 255))
            sc = 0.86 + 0.14 * u
            ci = fade_alpha(ci.resize((max(1, int(cw * sc)), max(1, int(chh * sc))), Image.BILINEAR), u)
            gx, gy = 24 + (i % 2) * (cw + 24), 86 + (i // 2) * 108
            lay.alpha_composite(ci, (int(gx + cw * (1 - sc) / 2), int(gy + chh * (1 - sc) / 2)))
        comp(fr, lay, x0, y0, k)

    def stack(self, fr, t, c, spec):
        """Стос карток, що «роздаються» по одній із поворотом."""
        cards = spec["cards"]
        box, k = self.panel(fr, t, c, 84 + (len(cards) - 1) * 78 + 120 + 24)
        if not box:
            return
        x0, y0, x1, y1 = box
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        self.title(d, spec, lay.width)
        angles = [-2.5, 1.8, -1.2, 2.2]
        cw, ch = lay.width - 120, 112
        for i, card in enumerate(cards):
            te = self.lit(c, i)
            u = ease((t - (te - 0.35)) / 0.5)
            if u <= 0.02:
                continue
            ci = Image.new("RGBA", (cw + 40, ch + 40), (0, 0, 0, 0))
            dc = ImageDraw.Draw(ci)
            flag = card.get("flag")
            bad = card.get("bad", True) and bool(flag)
            dc.rounded_rectangle([20, 20, cw + 19, ch + 19], 18, fill=(16, 18, 26, 245), outline=(*(PINK if bad else WHITE), 110), width=2)
            dc.text((48, 36), card["l"], font=fit_font("body", 26, card["l"], cw - 300, 16), fill=(*SILVER, 255))
            dc.text((48, 70), card["v"], font=fit_font("body-semi", 36, card["v"], cw - 300, 18), fill=(*(PINK if bad else WHITE), 255))
            if flag:
                self.pill(dc, cw - 4, 56, flag, bad, clamp((t - te) / 0.3))
            ang = angles[i % 4] * (1 + 3 * (1 - u))
            ci = fade_alpha(ci.rotate(ang, resample=Image.BICUBIC, expand=True), u)
            px = 60 - 20 + (1 - u) * 260
            py = 80 + i * 78 - 20
            lay.alpha_composite(ci, (int(px - (ci.width - cw - 40) / 2), int(py - (ci.height - ch - 40) / 2)))
        comp(fr, lay, x0, y0, k)

    def check(self, fr, t, c):
        spec = self.S[f"c{c}"]
        getattr(self, spec["type"])(fr, t, c, spec)

    # ---------------------------------------------------------------- картка стану з прокруткою значення
    def card(self, fr, t):
        if t < T_DROP - 0.2 or t >= T_END + 0.4:
            return
        k = ease((t - (T_DROP - 0.2)) / 0.45) * clamp((T_END + 0.4 - t) / 0.4)
        x0, y0, x1, y1 = CARD
        dy = (1 - k) * 30
        self.surface(fr, (x0, y0 + dy, x1, y1 + dy), k, 28)
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        kp = self.S["kpi"]
        states = kp["states"]
        idx = 0
        for i, st in enumerate(states):
            if t >= ev_time(st[0]):
                idx = i
        cur = states[idx]
        prev = states[idx - 1] if idx else None
        u = ease((t - ev_time(cur[0])) / 0.45) if prev else 1.0
        d.text((40, 22), kp["label"], font=self.f_lab, fill=(*SILVER, 255))
        _, val, pill, ok = cur
        fp = self.f_pill
        tw = fp.getlength(pill)
        px1 = lay.width - 36
        px0 = px1 - tw - 44

        def value(v, okv, yoff, a):
            fv = fit_font("head", 64, v, px0 - 70, 32)
            d.text((38, 108 + yoff), v, font=fv, anchor="ls", fill=(*(WHITE if okv else RUBY), int(255 * a)))
        if prev and u < 1:
            value(prev[1], prev[3], -22 * u, (1 - min(1, u * 1.8)) ** 2)
            value(val, ok, 46 * (1 - u), u)
        else:
            value(val, ok, 0, 1)
        if ok:
            d.rounded_rectangle([px0, 64, px1, 106], 21, fill=(*WHITE, int(235 * u)))
            d.text((px0 + 22, 72), pill, font=fp, fill=(*GRAPHITE, int(255 * u)))
        else:
            d.rounded_rectangle([px0, 64, px1, 106], 21, outline=(*RUBY, int(255 * u)), width=2)
            d.text((px0 + 22, 72), pill, font=fp, fill=(*PINK, int(255 * u)))
        comp(fr, lay, x0, y0 + dy, k)

    # ---------------------------------------------------------------- заголовки з різними прийомами появи
    def header(self, fr, t):
        for j, (t0, name) in enumerate(PHASES):
            if name is None:
                continue
            t1 = PHASES[j + 1][0]
            if not (t0 <= t < t1):
                continue
            img = block(self.key, self.lang, name, self.st["layout"])
            a_out = clamp((t1 - t) / 0.2)
            u = 1.0 if name == "hook" else ease((t - t0) / 0.42)
            y = TOP_Y
            rv = self.st["reveal"]
            if u < 1 and rv == "mask":
                h = img.height
                edge = (h + 80) * u
                yy = np.arange(h, dtype=np.float32)[:, None]
                m = np.clip((edge - yy) / 80, 0, 1)
                mask = Image.fromarray((m * np.asarray(img.getchannel("A")) ).astype(np.uint8), "L")
                img = img.copy()
                img.putalpha(mask)
                y += (1 - u) * 18
                comp(fr, img, 0, y, a_out)
            elif u < 1 and rv == "focus":
                rad = (1 - u) * 18
                comp(fr, img.filter(ImageFilter.GaussianBlur(rad)) if rad > 0.5 else img, 0, y, u * a_out)
            else:
                comp(fr, img, 0, y + (1 - u) * 30, u * a_out)
            if name in ("hook", "result"):                    # відблиск по великому числу
                s0 = 0.5 if name == "hook" else t0 + 0.45
                sh = sheen(img, (t - s0) / 0.9)
                if sh:
                    comp(fr, sh, 0, y, a_out)

    # ---------------------------------------------------------------- фінал
    def end(self, fr, t):
        u = t - T_END
        o = self.st["outro"]
        if o == "iris":
            r = 1300 * (1 - ease(u / 0.7))
            m = Image.new("L", (W, H), 205)
            ImageDraw.Draw(m).ellipse([540 - r, 900 - r, 540 + r, 900 + r], fill=0)
            dark = Image.new("RGBA", (W, H), (*GRAPHITE, 255))
            dark.putalpha(m.point(lambda v: v) if u < 0.7 else Image.new("L", (W, H), 205))
        elif o == "wipe":
            p = ease(u / 0.6)
            yy, xx = np.mgrid[0:H, 0:W]
            edge = -600 + p * (W + H * 0.5 + 800)
            m = np.clip((edge - (xx + yy * 0.5)) / 160, 0, 1) * 205
            dark = Image.new("RGBA", (W, H), (*GRAPHITE, 255))
            dark.putalpha(Image.fromarray(m.astype(np.uint8), "L"))
        else:
            dark = Image.new("RGBA", (W, H), (*GRAPHITE, int(205 * ease(u / 0.6))))
        fr.alpha_composite(dark)
        k = ease((u - 0.35) / 0.6)
        comp(fr, self.logo, W / 2 - self.logo.width / 2, 600 + (1 - k) * 30, k)
        sh = sheen(self.logo, (u - 0.9) / 0.9, 40, 150)
        if sh:
            comp(fr, sh, W / 2 - self.logo.width / 2, 600)
        d = ImageDraw.Draw(fr)
        k2 = ease((u - 0.7) / 0.6)
        y = 900 + (1 - k2) * 20
        for ln in bwrap(self.S["end"], self.f_end, 900):
            d.text(((W - self.f_end.getlength(ln)) / 2, y), ln, font=self.f_end, fill=(*WHITE, int(255 * k2)))
            y += 62
        k3 = ease((u - 1.1) / 0.6)
        tracked(d, "BELYAKOVCONSULT.COM", self.f_url, W / 2, y + 40, (*SILVER, int(255 * k3)), 6)
        d.line([W / 2 - 60 * k3, y + 22, W / 2 + 60 * k3, y + 22], fill=(*RUBY, int(255 * k3)), width=3)

    def frame(self, t):
        fr = Image.new("RGBA", (W, H), (*GRAPHITE, 255))
        self.scene.draw(fr, t)
        if 0 <= t - T_DROP < 0.45:                         # спалах світла на дропі
            u = (t - T_DROP) / 0.45
            h = ps.halo_img(1800, 255, (255, 225, 230))
            comp(fr, h, 540 - 900, 1060 - 900, (1 - u) ** 2 * 0.55)
        if T_BAND <= t < T_END + 0.3:                      # розфокус тла під висновок
            r = 7 * ease((t - T_BAND) / 0.35)
            fr = fr.filter(ImageFilter.GaussianBlur(r))
        self.check(fr, t, 1)
        self.check(fr, t, 2)
        self.card(fr, t)
        self.header(fr, t)
        if t >= T_END:
            self.end(fr, t)
        else:
            fr.alpha_composite(self.lock, (72, 116))
        out = fr.convert("RGB")
        if t < T_DROP:
            out = nd.vhs(out, t)
        for hit in self.cow:
            if 0 <= t - hit < 0.05:
                a = np.asarray(out).copy()
                a[:, :, 0] = np.roll(a[:, :, 0], 3, axis=1)
                a[:, :, 2] = np.roll(a[:, :, 2], -3, axis=1)
                out = Image.fromarray(a)
                break
        return out


def story_sfx(key):
    S = STORIES[key]["en"]

    def add(dry, send):
        for c in (1, 2):
            kind = S[f"c{c}"]["type"]
            for i, te in enumerate(EV[c]):
                if kind == "columns":
                    if i < 2:
                        dry.put(nd.scan_sfx(), te - 0.5, 0.14, pan=(-0.3 if i == 0 else 0.3))
                    else:
                        dry.put(nd.sfx_ding(1320, 1.0), te - 0.2, 0.12)
                elif kind in ("rows", "stack", "split"):
                    send.put(nd.collapse_sfx(i + c * 3), te - 0.25, 0.26, pan=-0.2)
                else:
                    dry.put(nd.scan_sfx(), te - 0.35, 0.1, pan=0.2)
                    for k in range(2):
                        dry.put(nd.tick_sfx(1700 + 300 * k), te + k * 0.08, 0.07)
        for st in S["kpi"]["states"][1:]:
            tk = ev_time(st[0])
            for k in range(3):
                dry.put(nd.tick_sfx(1700 + 200 * k), tk + 0.05 + k * 0.09, 0.06)
        dry.put(nd.sfx_ding(1320, 1.2), T_REAL, 0.16)
    return add


def encode(out: Path, wav: Path, frames):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for img in frames:
            proc.stdin.write(img.tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    wav.unlink(missing_ok=True)
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")


def render(key: str, lang: str, out: Path) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    v = Story(key, lang)
    wav = out.with_suffix(".wav")
    nd.soundtrack(wav, story_sfx(key), 0, v.st["track"])
    v.frame(1.2).save(out.with_name(out.stem + "-cover.jpg"), "JPEG", quality=92)
    encode(out, wav, (v.frame(k / FPS) for k in range(int(TOTAL * FPS))))
    return out


def reel(out: Path) -> Path:
    """Показовий ролик формату: 10 заставок по 2.4 с і 5 мелодій по 4.8 с (частина драйву кожної)."""
    import wave as wv
    out.parent.mkdir(parents=True, exist_ok=True)
    parts = []
    for i in range(len(nd.TRACKS)):
        tmp = out.with_name(f"_track{i}.wav")
        nd.soundtrack(tmp, lambda d, s: None, 0, i)
        with wv.open(str(tmp)) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, 2).astype(np.float32)
        tmp.unlink()
        a = int(T_DROP * nd.SR)
        seg = x[a:a + int(4.8 * nd.SR)].copy()
        f = int(0.08 * nd.SR)
        seg[:f] *= np.linspace(0, 1, f)[:, None]
        seg[-f:] *= np.linspace(1, 0, f)[:, None]
        parts.append(seg)
    audio = np.concatenate(parts)
    wav = out.with_suffix(".wav")
    with wv.open(str(wav), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(nd.SR)
        w.writeframes(audio.clip(-32768, 32767).astype("<i2").tobytes())
    scenes = [ps.make(n) for n in ps.SCENES]
    lock = brand.lockup(52)
    fl = brand.font("body-semi", 30)
    fn = brand.font("head", 64)

    def frames():
        for k in range(int(TOTAL * FPS)):
            t = k / FPS
            i = min(9, int(t / 2.4))
            st = 6.0 + (t - i * 2.4)                     # показуємо кожну сцену в її «драйві»
            fr = Image.new("RGBA", (W, H), (*GRAPHITE, 255))
            scenes[i].draw(fr, st)
            d = ImageDraw.Draw(fr)
            u = ease((t - i * 2.4) / 0.4)
            tracked(d, f"SCENE {i + 1:02d} / 10", fl, W / 2, 300, (*SILVER, int(255 * u)), 6)
            name = ps.SCENES[i].upper()
            d.text(((W - fn.getlength(name)) / 2, 352 + (1 - u) * 20), name, font=fn, fill=(*WHITE, int(255 * u)))
            tr = nd.TRACKS[min(4, int(t / 4.8))]["name"].upper()
            tracked(d, f"TRACK  ·  {tr}", fl, W / 2, 452, (*RUBY, int(255 * u)), 5)
            fr.alpha_composite(lock, (72, 116))
            yield fr.convert("RGB")
    encode(out, wav, frames())
    return out


if __name__ == "__main__":
    if sys.argv[1] == "--next":
        print(*suggest_next())
    elif sys.argv[1] == "--reel":
        print(reel(Path(sys.argv[2])))
    else:
        slug, n, lang, folder = sys.argv[1], int(sys.argv[2]), sys.argv[3], Path(sys.argv[4])
        print(render(f"{slug}:{n}", lang, folder / f"premium-e{n}-9x16.mp4"))
