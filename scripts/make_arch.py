"""Порівняльний преміум-ролик «4 архітектури BI» (22.11.2026), 9:16, 24 с, EN і UA.

Стаття: content/articles/bi-architecture-options. Хронометраж (не стандартний шаблон, бо тут порівняння):
  0.0   хук на кадрі 0: «4 шляхи», якір болю
  2.4   питання: яка підходить вашій компанії
  4.2, 7.8, 11.4, 15.0   чотири картки по 3.6 с: назва й «для кого» в заголовку, схема потоку даних,
        плюс (шампань) і мінус (рубін); картки змінюються виїздом убік
  18.6  Power BI: три правила (якір полегшення)
  21.4  фінал: логотип, дія, сайт, фраза бренду (звуковий логотип)
Заставка, музика, шрифти й якорі з преміум-шаблону (make_premium, premium_scenes, premium_anchors).

Запуск: python scripts/make_arch.py <en|uk> <out.mp4>
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import glass  # noqa: E402
import make_nightdrive as nd  # noqa: E402
import premium_scenes as ps  # noqa: E402
import premium_anchors as pa  # noqa: E402
import make_premium as mp  # noqa: E402
from make_nightdrive import CHAMPAGNE, FPS, GRAPHITE, H, RUBY, SILVER, TOTAL, W, WHITE, bwrap, clamp, comp, ease, tracked  # noqa: E402

KEY = "bi-architecture-options"
SCENE, TRACK = "network", 3
T_Q, T_CARDS, CARD_LEN, T_RULES, T_FIN = 2.4, 4.2, 3.6, 18.6, 21.4
TOP_Y = mp.TOP_Y
PANEL = (90, 640, 990, 1370)

TEXT = {
    "en": dict(
        hook=("BI ARCHITECTURE", "4 paths", "Slow dashboards often start here."),
        q=("Which one fits your company?", "Pros, cons and when to pick each."),
        cards=[
            dict(name="Self-service on sources", best="Best for: pilots, one team", flow=["Sources", "Power BI"],
                 plus="Live in days", minus="Breaks as data grows"),
            dict(name="Classic data warehouse", best="Best for: finance, regulated reporting", flow=["Sources", "ETL", "Warehouse", "Model"],
                 plus="One version of the truth", minus="Slow to change"),
            dict(name="Cloud warehouse + ELT", best="Best for: many sources, fast growth", flow=["Sources", "ELT", "Cloud DWH", "Model"],
                 plus="Scales on demand", minus="Bill grows with usage"),
            dict(name="Lakehouse in Fabric", best="Best for: big volumes on Microsoft", flow=["Bronze", "Silver", "Gold", "Direct Lake"],
                 plus="One copy, fresh data", minus="Needs Fabric capacity"),
        ],
        rules_label="POWER BI", rules_title="3 rules", rules_sub="that always pay off",
        rules=["Star schema", "One shared semantic model", "Import by default"],
        end="Send this to whoever picks your BI architecture."),
    "uk": dict(
        hook=("АРХІТЕКТУРА BI", "4 шляхи", "Повільні дашборди часто починаються тут."),
        q=("Яка підходить вашій компанії?", "Плюси, мінуси і коли яку обирати."),
        cards=[
            dict(name="Self-service з джерел", best="Для: пілоти, одна команда", flow=["Джерела", "Power BI"],
                 plus="Старт за кілька днів", minus="Ламається з ростом даних"),
            dict(name="Класичне сховище", best="Для: фінанси, регуляторна звітність", flow=["Джерела", "ETL", "Сховище", "Модель"],
                 plus="Одна версія правди", minus="Повільно змінюється"),
            dict(name="Хмарне сховище + ELT", best="Для: багато джерел, швидкий ріст", flow=["Джерела", "ELT", "Хмара", "Модель"],
                 plus="Масштаб на вимогу", minus="Рахунок росте з обсягом"),
            dict(name="Lakehouse у Fabric", best="Для: великі обсяги в Microsoft", flow=["Bronze", "Silver", "Gold", "Direct Lake"],
                 plus="Одна копія, свіжі дані", minus="Потрібна ємність Fabric"),
        ],
        rules_label="POWER BI", rules_title="3 правила", rules_sub="що окупаються завжди",
        rules=["Схема «зірка»", "Одна спільна семантична модель", "Import за замовчуванням"],
        end="Перешліть тому, хто обирає вашу BI-архітектуру."),
}


def register():
    """Заголовки рендерить mp.block з преміум-шаблону: реєструємо для нього тексти."""
    for lang, T in TEXT.items():
        mp.STORIES.setdefault(KEY, {"style": {"scene": SCENE, "track": TRACK, "layout": "center", "reveal": "slide",
                                              "outro": "fade", "panel": "frost"}})
        mp.STORIES[KEY][lang] = {"hook": T["hook"], "q": T["q"]}
        for i, c in enumerate(T["cards"]):
            k = f"{KEY}#{i}"
            mp.STORIES.setdefault(k, {})
            mp.STORIES[k][lang] = {"c1": {"label": f"{i + 1} / 4", "title": c["name"], "sub": c["best"]}}
        mp.STORIES.setdefault(f"{KEY}#rules", {})
        mp.STORIES[f"{KEY}#rules"][lang] = {"c1": {"label": T["rules_label"], "title": T["rules_title"], "sub": T["rules_sub"]}}


register()


def card_t(i):
    return T_CARDS + i * CARD_LEN


class Arch:
    def __init__(self, lang):
        self.lang = lang
        self.T = TEXT[lang]
        self.scene = ps.make(SCENE)
        self.cow = nd.cow_hits(TRACK)
        self.lock = brand.lockup(52)
        self.logo = brand.logo(200)
        self.f_box = brand.font("body-semi", 30)
        self.f_row = brand.font("body-semi", 46)
        self.f_rule = brand.font("body-semi", 50)
        self.f_lab = brand.font("body-semi", 26)
        self.f_end = brand.font("body", 46)
        self.f_url = brand.font("body-semi", 34)
        self.heads = {}

    def head(self, name):
        if name not in self.heads:
            if name in ("hook", "q"):
                self.heads[name] = mp.block(KEY, self.lang, name, "center")
            else:
                self.heads[name] = mp.block(f"{KEY}#{name}", self.lang, "c1", "center")
        return self.heads[name]

    # ---- заголовки
    def header(self, fr, t):
        segs = [(0.0, T_Q, "hook"), (T_Q, T_CARDS, "q")] + \
               [(card_t(i), card_t(i + 1), str(i)) for i in range(4)] + [(T_RULES, T_FIN, "rules")]
        for t0, t1, name in segs:
            if not (t0 <= t < t1):
                continue
            img = self.head(name)
            u = 1.0 if name == "hook" else ease((t - t0) / 0.4)
            a = clamp((t1 - t) / 0.2) if t1 < T_FIN or name != "rules" else 1.0
            comp(fr, img, 0, TOP_Y + (1 - u) * 30, u * a)
            if name == "hook":
                sh = mp.sheen(img, (t - 0.5) / 0.9)
                if sh:
                    comp(fr, sh, 0, TOP_Y)

    # ---- картка архітектури
    def card(self, fr, t, i, dx, k):
        C = self.T["cards"][i]
        x0, y0, x1, y1 = PANEL
        box = (x0 + dx, y0, x1 + dx, y1)
        glass.frosted(fr, box, 30, k)
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        u = t - card_t(i)
        # схема потоку даних: блоки з'являються по черзі, крапка «даних» біжить стрілками
        n = len(C["flow"])
        gap = 26
        bw = (x1 - x0 - 80 - gap * (n - 1)) / n
        by0, by1 = y0 + 80, y0 + 200
        centers = []
        for j, lab in enumerate(C["flow"]):
            kj = ease((u - 0.15 * j) / 0.35) * k
            bx = x0 + 40 + j * (bw + gap) + dx
            last = j == n - 1
            d.rounded_rectangle([bx, by0, bx + bw, by1], 18, fill=(255, 255, 255, int(18 * kj)),
                                outline=(*(CHAMPAGNE if last else SILVER), int(200 * kj)), width=3 if last else 2)
            f = mp.fit_font("body-semi", 30, lab, bw - 20, 18)
            d.text((bx + bw / 2, (by0 + by1) / 2), lab, font=f, fill=(*WHITE, int(255 * kj)), anchor="mm")
            centers.append((bx + bw, (by0 + by1) / 2))
            if j < n - 1:
                ax = bx + bw + 3
                d.line([ax, (by0 + by1) / 2, ax + gap - 6, (by0 + by1) / 2], fill=(*SILVER, int(200 * kj)), width=3)
        if n > 1 and k > 0.5:
            p = ((u - 0.6) % 1.4) / 1.4 if u > 0.6 else -1
            if 0 <= p < 1:
                xa = x0 + 40 + dx + bw / 2
                xb = x0 + 40 + dx + (n - 1) * (bw + gap) + bw / 2
                px = xa + (xb - xa) * ease(p)
                py = (by0 + by1) / 2
                for r, al in ((22, 50), (12, 120), (6, 255)):
                    d.ellipse([px - r, py - r + 72, px + r, py + r + 72], fill=(*CHAMPAGNE, al))
                d.line([xa, py + 72, xb, py + 72], fill=(255, 255, 255, 30), width=2)
        # плюс і мінус
        rows = [(C["plus"], True, 0.9), (C["minus"], False, 1.5)]
        y = y0 + 300
        for text, good, at in rows:
            kr = ease((u - at) / 0.35) * k
            cx, cy = x0 + 90 + dx, y + 40
            col = CHAMPAGNE if good else RUBY
            d.ellipse([cx - 32, cy - 32, cx + 32, cy + 32], outline=(*col, int(255 * kr)), width=4)
            if good:
                d.line([(cx - 14, cy + 1), (cx - 4, cy + 12), (cx + 16, cy - 12)], fill=(*col, int(255 * kr)), width=5)
            else:
                d.line([(cx - 11, cy - 11), (cx + 11, cy + 11)], fill=(*col, int(255 * kr)), width=5)
                d.line([(cx - 11, cy + 11), (cx + 11, cy - 11)], fill=(*col, int(255 * kr)), width=5)
            tracked(d, ("PLUS" if good else "MINUS") if self.lang == "en" else ("ПЛЮС" if good else "МІНУС"),
                    self.f_lab, x0 + 140 + dx + 40, y - 6, (*col, int(230 * kr)), 4)
            yy = y + 30
            for ln in bwrap(text, self.f_row, x1 - x0 - 190):
                d.text((x0 + 150 + dx + (1 - kr) * 24, yy), ln, font=self.f_row, fill=(*WHITE, int(255 * kr)))
                yy += 58
            y = max(yy, y + 100) + 70
        # прогрес 1..4
        for j in range(4):
            cx = 540 - 54 + j * 36 + dx
            on = j == i
            d.ellipse([cx - (8 if on else 5), y1 - 60 - (8 if on else 5), cx + (8 if on else 5), y1 - 60 + (8 if on else 5)],
                      fill=(*(CHAMPAGNE if on else SILVER), int((255 if on else 120) * k)))
        fr.alpha_composite(lay)

    def cards(self, fr, t):
        for i in range(4):
            t0, t1 = card_t(i), card_t(i + 1)
            if not (t0 - 0.35 <= t < t1 + 0.35):
                continue
            if t < t0:                                     # виїзд справа
                v = ease((t - (t0 - 0.35)) / 0.35)
                dx, k = (1 - v) * 380, v
            elif t >= t1:                                  # виїзд вліво
                v = ease((t - t1) / 0.35)
                dx, k = -v * 380, 1 - v
            else:
                dx, k = 0, 1.0
            if i == 0 and t < t0:
                dx = (1 - v) * 120
            if i == 3 and t >= t1:
                dx = 0
            self.card(fr, t, i, dx, k)

    def rules(self, fr, t):
        if t < T_RULES - 0.3:
            return
        k = ease((t - (T_RULES - 0.3)) / 0.4) * (1 - ease((t - T_FIN) / 0.4))
        if k <= 0:
            return
        x0, y0, x1, y1 = PANEL
        glass.frosted(fr, (x0, y0, x1, y0 + 520), 30, k)
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        for j, rule in enumerate(self.T["rules"]):
            kr = ease((t - T_RULES - 0.25 - 0.55 * j) / 0.35) * k
            cy = y0 + 110 + j * 160
            d.ellipse([x0 + 58, cy - 32, x0 + 122, cy + 32], fill=(*CHAMPAGNE, int(255 * kr)))
            d.line([(x0 + 76, cy + 1), (x0 + 86, cy + 12), (x0 + 106, cy - 12)], fill=(*GRAPHITE, int(255 * kr)), width=5)
            f = mp.fit_font("body-semi", 50, rule, x1 - x0 - 200, 30)
            d.text((x0 + 150 + (1 - kr) * 24, cy), rule, font=f, fill=(*WHITE, int(255 * kr)), anchor="lm")
        fr.alpha_composite(lay)
        if 0 <= t - T_RULES < 0.9:                         # якір полегшення: є чіткий порядок дій
            pa.relief_sweep(fr, (x0, y0, x1, y0 + 520), (t - T_RULES) / 0.9)

    def end(self, fr, t):
        u = t - T_FIN
        dark = Image.new("RGBA", (W, H), (*GRAPHITE, int(205 * ease(u / 0.5))))
        fr.alpha_composite(dark)
        k = ease((u - 0.2) / 0.5)
        comp(fr, self.logo, W / 2 - self.logo.width / 2, 600 + (1 - k) * 30, k)
        sh = mp.sheen(self.logo, (u - 0.6) / 0.8, 40, 150)
        if sh:
            comp(fr, sh, W / 2 - self.logo.width / 2, 600)
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        k2 = ease((u - 0.45) / 0.5)
        y = 900 + (1 - k2) * 20
        for ln in bwrap(self.T["end"], self.f_end, 900):
            d.text(((W - self.f_end.getlength(ln)) / 2, y), ln, font=self.f_end, fill=(*WHITE, int(255 * k2)))
            y += 62
        k3 = ease((u - 0.75) / 0.5)
        tracked(d, "BELYAKOVCONSULT.COM", self.f_url, W / 2, y + 40, (*SILVER, int(255 * k3)), 6)
        d.line([W / 2 - 60 * k3, y + 22, W / 2 + 60 * k3, y + 22], fill=(*RUBY, int(255 * k3)), width=3)
        k4 = ease((u - 1.0) / 0.5)
        tracked(d, pa.TAGLINE[self.lang], brand.font("body-semi", 26), W / 2, y + 104, (*pa.CHAMPAGNE, int(235 * k4)), 5)
        fr.alpha_composite(lay)

    def frame(self, t):
        fr = Image.new("RGBA", (W, H), (*GRAPHITE, 255))
        self.scene.draw(fr, t)
        if 0 <= t - nd.T_DROP < 0.45:
            uu = (t - nd.T_DROP) / 0.45
            comp(fr, ps.halo_img(1800, 255, (255, 225, 230)), 540 - 900, 1060 - 900, (1 - uu) ** 2 * 0.45)
        self.cards(fr, t)
        self.rules(fr, t)
        if t < 0.8:                                        # якір болю на хуку, кадр 0
            pa.pain_rings(fr, 540, TOP_Y + 190, t / 0.8, 1.0)
        self.header(fr, t)
        if t >= T_FIN:
            self.end(fr, t)
        else:
            fr.alpha_composite(self.lock, (72, 116))
        out = fr.convert("RGB")
        if t < nd.T_DROP:
            out = nd.vhs(out, t)
        return out


def sfx(dry, send):
    dry.put(pa.pain(), 0.0, 0.5)
    for i in range(4):
        send.put(nd.scan_sfx(), card_t(i) - 0.3, 0.12, pan=0.2)
        for k in range(2):
            dry.put(nd.tick_sfx(1700 + 300 * k), card_t(i) + 0.9 + k * 0.08, 0.06)
        dry.put(nd.tick_sfx(1300), card_t(i) + 1.5, 0.06)
    for j in range(3):
        dry.put(nd.tick_sfx(1900 + 200 * j), T_RULES + 0.25 + 0.55 * j, 0.07)
    dry.put(pa.relief(), T_RULES, 0.3, pan=0.1)
    send.put(pa.logo(), T_FIN + 0.35, 0.4)


def render(lang, out: Path):
    out.parent.mkdir(parents=True, exist_ok=True)
    v = Arch(lang)
    wav = out.with_suffix(".wav")
    nd.soundtrack(wav, sfx, 0, TRACK)
    v.frame(9.0).save(out.with_name(out.stem + "-cover.jpg"), "JPEG", quality=92)
    mp.encode(out, wav, (v.frame(k / FPS) for k in range(int(TOTAL * FPS))))
    return out


if __name__ == "__main__":
    print(render(sys.argv[1], Path(sys.argv[2])))
