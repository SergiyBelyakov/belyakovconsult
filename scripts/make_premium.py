"""Шаблон преміум-роликів (9:16, 24 с) у форматі тестового «Night Drive», затвердженого власником 13.11.2026.

Стиль: Ruby Glass у нічній synthwave-сцені (графітове небо, рубінове сонце, перспективна сітка, матові скляні панелі),
типографіка Montserrat та Inter, музика-мікс vaporwave, synthwave, phonkwave, dreamwave з make_nightdrive (тональність
можна зсунути для різноманіття).

Сюжет завжди йде за схемою міні-історії, а перший кадр є хуком-болем, який може бути в керівництва:
  0.0  хук (мітка, велике число чи слово, підрядок зі ставкою)
  2.4  питання до керівника
  4.8  перевірка або крок 1 (одна візуальна механіка: rows, flow чи columns), події на 6.0, 7.8, 9.6
  11.0 перевірка або крок 2, події на 12.6, 13.8, 15.0
  15.6 результат; 16.8 висновок; 19.2 фінал з логотипом і однією дією
Картка KPI внизу показує стан, що змінюється на подіях (значення, пігулка, «добре» чи «ризик»).
Тексти історій: scripts/premium_stories.py.

Запуск: python scripts/make_premium.py <slug> <n> <мова> <папка>
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
from make_nightdrive import (BODY, EATS, FPS, GRAPHITE, H, HY, PINK, RUBY, SILVER, T_BAND, T_DROP, T_DUPES, T_END,  # noqa: E402
                             T_Q, T_REAL, TOP_Y, TOTAL, WHITE, W, ZAPS, bwrap, clamp, comp, ease, glass_column,
                             tracked)
from premium_stories import STORIES  # noqa: E402

CARD = (90, 1392, 930, 1520)
PANEL_BOTTOM = 1376
EV = {1: ZAPS, 2: EATS}
STARTS = {1: T_DROP, 2: T_DUPES}
PHASES = [(0.0, "hook"), (T_Q, "q"), (T_DROP, "c1"), (T_DUPES, "c2"), (T_REAL, "result"), (T_BAND, "takeaway"), (T_END, None)]


def ev_time(ref):
    """Посилання на подію: 'start', 'c1e0'..'c2e2', 'c1' (початок перевірки 1), 'c2'."""
    if ref == "start":
        return 0.0
    c = int(ref[1])
    if len(ref) == 2:
        return STARTS[c]
    return EV[c][int(ref[3])]


def fit_font(kind, size, text, maxw, min_size=30):
    while size > min_size and brand.font(kind, size).getlength(text) > maxw:
        size -= 4
    return brand.font(kind, size)


@lru_cache(maxsize=None)
def block(key, lang, name):
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
    img = Image.new("RGBA", (W, 700), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    y = 0
    if label:
        fl = fit_font("body-semi", 30, label, 900, 22)
        tracked(d, label, fl, W / 2, y, (*SILVER, 255), 6)
        y += 64
    if style in ("num", "true"):
        f = fit_font("head", 236, big, 960, 90)
        col, lines = (RUBY if style == "num" else WHITE), [big]
    elif style == "word":
        f = fit_font("head", 132, big, 960, 70)
        col, lines = WHITE, [big]
    else:
        col = WHITE
        for size in ((86, 78, 70, 64) if style == "q" else (76, 70, 64, 58)):
            f = brand.font("head", size)
            lines = [ln for part in big.split("\n") for ln in bwrap(part, f, 960)]
            if len(lines) <= 2:
                break
    asc, desc = f.getmetrics()
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dl = ImageDraw.Draw(lay)
    for i, ln in enumerate(lines):
        c = RUBY if (style == "q2" and i == len(lines) - 1) else col
        dl.text(((W - f.getlength(ln)) / 2, y), ln, font=f, fill=(*c, 255))
        y += int((asc + desc) * (0.86 if style in ("num", "true") else 1.02))
    if style in ("num", "true"):
        glow = lay.filter(ImageFilter.GaussianBlur(26))
        img.alpha_composite(glow)
        img.alpha_composite(glow)
    img.alpha_composite(lay)
    y += 18
    if sub:
        fs = brand.font("body", 44)
        for ln in bwrap(sub, fs, 900):
            d.text(((W - fs.getlength(ln)) / 2, y), ln, font=fs, fill=(*BODY, 255))
            y += 58
    return img.crop((0, 0, W, y + 30))


class Story(nd.Premium):
    """Сцена Night Drive (небо, сонце, сітка, пил) + механіки перевірок із опису історії."""

    def __init__(self, key: str, lang: str):
        super().__init__("en")
        self.key, self.lang = key, lang
        self.S = STORIES[key][lang]
        self.f_cap = brand.font("body", 26)
        self.f_v = brand.font("body-semi", 36)
        self.f_step = brand.font("body-semi", 30)
        self.f_colv = brand.font("head", 46)
        self.f_colc = brand.font("body-semi", 28)

    # -------- спільне: панель знизу над карткою
    def panel(self, fr, t, c, h):
        start, end = STARTS[c] - 0.4, (T_DUPES if c == 1 else T_REAL) + 0.5
        if not (start <= t < end):
            return None, 0.0
        k = ease((t - start) / 0.4) * clamp((end - t) / 0.4)
        box = (90, PANEL_BOTTOM - h, 930, PANEL_BOTTOM)
        glass.frosted(fr, box, 30, k)
        return box, k

    def rows(self, fr, t, c, spec):
        rows = spec["rows"]
        h = 84 + len(rows) * 76 + 10
        box, k = self.panel(fr, t, c, h)
        if not box:
            return
        x0, y0, x1, y1 = box
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        tracked(d, spec["table"], self.f_lab, lay.width / 2, 26, (*SILVER, 255), 4)
        d.line([40, 70, lay.width - 40, 70], fill=(255, 255, 255, 40), width=1)
        y = 82
        for r in rows:
            te = EV[c][r["at"]] if "at" in r else None
            on = te is not None and t >= te - 0.25
            u = clamp((t - (te - 0.25)) / 0.35) if te is not None else 0.0
            bad = r.get("bad", True)
            accent = RUBY if bad else WHITE
            if on:
                pulse = 0.5 + 0.5 * math.sin((t - te) * 9) if bad else 0.6
                d.rounded_rectangle([24, y - 4, lay.width - 24, y + 70], 10, fill=(*accent, int((22 + 30 * pulse) * u)))
            fcap = fit_font("body", 26, r["l"], 440 if r.get("flag") else 700, 18)
            d.text((44, y + 2), r["l"], font=fcap, fill=(*SILVER, 255))
            val = r["v"]
            fv = fit_font("body-semi", 36, val, 470, 24)
            if "v2" in r and on:
                a2 = u
                d.text((44, y + 30), val, font=fv, fill=(*WHITE, int(255 * (1 - a2))))
                fv2 = fit_font("body-semi", 36, r["v2"], 470, 24)
                d.text((44, y + 30 + (1 - a2) * 10), r["v2"], font=fv2, fill=(*(PINK if bad else WHITE), int(255 * a2)))
            else:
                d.text((44, y + 30), val, font=fv, fill=(*WHITE, 255))
            if on and r.get("flag"):
                fp = fit_font("body-semi", 24, r["flag"], 230, 16)
                tw = fp.getlength(r["flag"])
                px1 = lay.width - 44
                px0 = px1 - tw - 40
                if bad:
                    d.rounded_rectangle([px0, y + 18, px1, y + 56], 19, outline=(*PINK, int(255 * u)), width=2)
                    d.text((px0 + 20, y + 25), r["flag"], font=fp, fill=(*PINK, int(255 * u)))
                else:
                    d.rounded_rectangle([px0, y + 18, px1, y + 56], 19, fill=(*WHITE, int(235 * u)))
                    d.text((px0 + 20, y + 25), r["flag"], font=fp, fill=(*GRAPHITE, int(255 * u)))
            y += 76
        comp(fr, lay, x0, y0, k)

    def flow(self, fr, t, c, spec):
        steps = spec["steps"]
        h = 84 + len(steps) * 66 + 10
        box, k = self.panel(fr, t, c, h)
        if not box:
            return
        x0, y0, x1, y1 = box
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        tracked(d, spec["table"], self.f_lab, lay.width / 2, 26, (*SILVER, 255), 4)
        y = 84
        for i, st in enumerate(steps):
            lit_at = STARTS[c] + 0.3 if i == 0 else EV[c][min(i - 1, 2)]
            u = clamp((t - lit_at) / 0.35)
            last = i == len(steps) - 1
            col = RUBY if (last and spec.get("last_bad")) else WHITE
            if i:
                d.line([80, y - 18, 80, y + 6], fill=(255, 255, 255, int(60 + 150 * u)), width=3)
            d.rounded_rectangle([40, y + 6, lay.width - 40, y + 54], 24, fill=(*col, int(26 + 40 * u)),
                                outline=(*col, int(60 + 180 * u)), width=2)
            d.ellipse([58, y + 14, 102, y + 46], fill=(*(RUBY if u > 0.5 else (60, 66, 80)), 255))
            fn = brand.font("body-semi", 22)
            num = str(i + 1)
            d.text((80 - fn.getlength(num) / 2, y + 17), num, font=fn, fill=(*WHITE, 255))
            fs = fit_font("body-semi", 30, st, 620, 20)
            d.text((124, y + 14), st, font=fs, fill=(*(WHITE if u > 0.5 else SILVER), 255))
            y += 66
        comp(fr, lay, x0, y0, k)

    def columns(self, fr, t, c, spec):
        start, end = STARTS[c] - 0.2, (T_DUPES if c == 1 else T_REAL) + 0.6
        if not (start <= t < end):
            return
        out = clamp((end - t) / 0.5)
        hl = H - HY
        s = 0.30
        base = HY + hl * s
        tops = []
        d = ImageDraw.Draw(fr)
        for i, col in enumerate(spec["cols"]):
            te = EV[c][i]
            u = ease((t - (te - 0.5)) / 0.6)
            cx = W / 2 + (-520 if i == 0 else 520) * s * 2.0
            w = 340 * s * 1.15
            hfull = 1060 * s * col["h"]
            h = max(2, hfull * u)
            top = base - h
            tops.append((cx, base - hfull, w))
            if u > 0:
                comp(fr, glass_column(w, h, hot=0.2 if i == 1 else 0.0), cx - w / 2, top, out)
                fv = self.f_colv
                d.text((cx - fv.getlength(col["v"]) / 2, top - 62), col["v"], font=fv, fill=(*WHITE, int(255 * u * out)),
                       stroke_width=4, stroke_fill=(*GRAPHITE, int(200 * u * out)))
            fc = fit_font("body-semi", 28, col["c"], 300, 18)
            d.text((cx - fc.getlength(col["c"]) / 2, base + 12), col["c"], font=fc, fill=(*SILVER, int(255 * out)))
        if spec.get("tag") and t >= EV[c][2] - 0.2:
            u = ease((t - (EV[c][2] - 0.2)) / 0.4) * out
            (ax, atop, aw), (bx, btop, bw) = tops
            yy = min(atop, btop) - 92
            d.line([ax, yy + 20, bx, yy + 20], fill=(*PINK, int(255 * u)), width=3)
            for x in (ax, bx):
                d.line([x, yy + 20, x, yy + 34], fill=(*PINK, int(255 * u)), width=3)
            ft = fit_font("body-semi", 30, spec["tag"], 760, 20)
            tw = ft.getlength(spec["tag"])
            d.rounded_rectangle([W / 2 - tw / 2 - 22, yy - 30, W / 2 + tw / 2 + 22, yy + 12], 21, fill=(*RUBY, int(235 * u)))
            d.text((W / 2 - tw / 2, yy - 24), spec["tag"], font=ft, fill=(*WHITE, int(255 * u)))

    def check(self, fr, t, c):
        spec = self.S[f"c{c}"]
        getattr(self, spec["type"])(fr, t, c, spec)

    # -------- картка стану
    def card(self, fr, t):
        if t < T_DROP - 0.2 or t >= T_END + 0.4:
            return
        k = ease((t - (T_DROP - 0.2)) / 0.45) * clamp((T_END + 0.4 - t) / 0.4)
        x0, y0, x1, y1 = CARD
        dy = (1 - k) * 30
        glass.frosted(fr, (x0, y0 + dy, x1, y1 + dy), 28, k)
        lay = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        kp = self.S["kpi"]
        cur, prev, t_cur = kp["states"][0], None, 0.0
        for st in kp["states"]:
            if t >= ev_time(st[0]):
                prev, cur, t_cur = cur, st, ev_time(st[0])
        _, val, pill, ok = cur
        u = ease((t - t_cur) / 0.35) if prev is not cur else 1.0
        d.text((40, 22), kp["label"], font=self.f_lab, fill=(*SILVER, 255))
        fp = self.f_pill
        tw = fp.getlength(pill)
        px1 = lay.width - 36
        px0 = px1 - tw - 44
        fv = fit_font("head", 74, val, px0 - 70, 34)
        asc, _ = fv.getmetrics()
        d.text((38, 50 + (74 - asc) * 0.6 + (1 - u) * 12), val, font=fv, fill=(*(WHITE if ok else RUBY), int(255 * u)))
        if ok:
            d.rounded_rectangle([px0, 64, px1, 106], 21, fill=(*WHITE, int(235 * u)))
            d.text((px0 + 22, 72), pill, font=fp, fill=(*GRAPHITE, int(255 * u)))
        else:
            d.rounded_rectangle([px0, 64, px1, 106], 21, outline=(*RUBY, int(255 * u)), width=2)
            d.text((px0 + 22, 72), pill, font=fp, fill=(*PINK, int(255 * u)))
        comp(fr, lay, x0, y0 + dy, k)

    def header(self, fr, t):
        for j, (t0, name) in enumerate(PHASES):
            if name is None:
                continue
            t1 = PHASES[j + 1][0]
            if not (t0 <= t < t1):
                continue
            a_in = 1.0 if name == "hook" else ease((t - t0) / 0.38)
            a_out = clamp((t1 - t) / 0.2)
            comp(fr, block(self.key, self.lang, name), 0, TOP_Y + (1 - a_in) * 30, a_in * a_out)

    def end(self, fr, t):
        self.T = {"end": self.S["end"]}
        super().end(fr, t)

    def frame(self, t):
        fr = self.bg.copy()
        self.scene(fr, t)
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
        for hit in nd.COW_HITS:
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
                elif kind == "rows":
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


def render(key: str, lang: str, out: Path) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    v = Story(key, lang)
    wav = out.with_suffix(".wav")
    nd.soundtrack(wav, story_sfx(key), STORIES[key].get("transpose", 0))
    v.frame(1.2).save(out.with_name(out.stem + "-cover.jpg"), "JPEG", quality=92)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for k in range(int(TOTAL * FPS)):
            proc.stdin.write(v.frame(k / FPS).tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    wav.unlink(missing_ok=True)
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")
    return out


if __name__ == "__main__":
    slug, n, lang, folder = sys.argv[1], int(sys.argv[2]), sys.argv[3], Path(sys.argv[4])
    print(render(f"{slug}:{n}", lang, folder / f"premium-e{n}-9x16.mp4"))
