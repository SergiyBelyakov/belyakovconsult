"""Хайп-ролик про старт GTA VI (20.11.2026) у преміум-шаблоні make_premium.py, у кольорах обкладинки гри.

Гра вийшла 19.11.2026. Перша цифра продажів (24,58 млн копій, $2,36 млрд за першу добу) це оцінка Sensor Tower;
Take-Two і Rockstar офіційних цифр не оприлюднювали (VGC, 20.11.2026). GTA V у 2013 році: близько $815 млн за першу добу.
Кут для бренду: величезне число, яке поки лише оцінка. Перевіряйте джерело до того, як число потрапить у презентацію.

Кольори обкладинки (захід сонця, рожевий, помаранчевий, фіолетовий, бірюзовий) лише як палітра: без логотипа, шрифтів,
персонажів чи арту гри. Заставка «vice»: захід над океаном, пальми, силует міста; усе намальовано процедурно.

Запуск: python scripts/make_gta.py <en|uk> <out.mp4>
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_nightdrive as nd  # noqa: E402
import premium_scenes as ps  # noqa: E402
import premium_stories  # noqa: E402
import make_premium as mp  # noqa: E402
from make_nightdrive import H, W, kick_pulse  # noqa: E402

KEY = "gta-vi-day-one:1"
VIOLET = (52, 18, 92)
MAGENTA = (196, 42, 128)
HOT = (255, 64, 132)
ORANGE = (255, 146, 64)
GOLD = (255, 212, 120)
TEAL = (38, 196, 214)
NIGHT = (12, 10, 34)
HORIZON = 1060

# акценти шаблону в кольорах обкладинки (якорі лишаються незмінними, як вимагає правило)
mp.RUBY = HOT
mp.PINK = ORANGE


def gradient(stops, n):
    ys = np.linspace(0, 1, n)
    out = np.zeros((n, 3), np.float32)
    pos = [p for p, _ in stops]
    for c in range(3):
        out[:, c] = np.interp(ys, pos, [col[c] for _, col in stops])
    return out


class Vice(ps.Base):
    """Захід сонця над океаном: сонце зі смугами, бірюзові відблиски, силует міста, пальми, що гойдаються."""
    name = "vice"

    def __init__(self):
        super().__init__(21)
        sky = gradient([(0.0, NIGHT), (0.28, VIOLET), (0.6, MAGENTA), (0.85, HOT), (1.0, ORANGE)], HORIZON)
        sea = gradient([(0.0, (70, 40, 90)), (0.25, (20, 40, 80)), (1.0, (6, 12, 28))], H - HORIZON)
        col = np.concatenate([sky, sea])[:, None, :]
        base = np.broadcast_to(col, (H, W, 3)).copy()
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        base += np.exp(-(((xx - 540) / 520) ** 2 + ((yy - HORIZON) / 260) ** 2))[..., None] * np.array([90, 40, 10], np.float32)
        teal = np.exp(-(((xx - 820) / 500) ** 2 + ((yy - 330) / 260) ** 2))[..., None] * np.array(TEAL, np.float32) * 0.22
        base += teal                                       # бірюзовий відсвіт неба, як на обкладинці
        img = Image.fromarray(base.clip(0, 255).astype(np.uint8)).convert("RGBA")
        d = ImageDraw.Draw(img)
        rng = np.random.default_rng(8)
        x = -20                                            # силует міста на обрії
        while x < W + 20:
            w = int(rng.uniform(24, 70))
            h = int(rng.uniform(30, 150) * (1.5 if 330 < x < 760 else 1.0))
            d.rectangle([x, HORIZON - h, x + w, HORIZON], fill=(44, 14, 58, 255))
            for wy in range(HORIZON - h + 8, HORIZON - 6, 14):
                for wx in range(x + 5, x + w - 5, 11):
                    if rng.uniform() < 0.18:
                        d.rectangle([wx, wy, wx + 4, wy + 5], fill=(*rng.choice([GOLD, TEAL, HOT]), 200))
            x += w + int(rng.uniform(2, 12))
        self.bg = img
        self.sun = self.make_sun(250)
        self.halo = ps.halo_img(1300, 120, ORANGE)
        self.shimmer = [(rng.uniform(0, W), rng.uniform(HORIZON + 8, H), rng.uniform(20, 90), rng.uniform(0, 6)) for _ in range(90)]
        self.palms = [dict(x=-70, base=H + 40, h=1080, lean=0.06, fr=9, ph=0.0, sc=0.78),
                      dict(x=1150, base=H + 40, h=960, lean=-0.06, fr=9, ph=0.9, sc=0.72)]

    def make_sun(self, r):
        n = 2 * r
        g = gradient([(0.0, GOLD), (0.45, ORANGE), (1.0, HOT)], n)
        img = Image.fromarray(np.broadcast_to(g[:, None, :], (n, n, 3)).astype(np.uint8)).convert("RGBA")
        m = Image.new("L", (n, n), 0)
        md = ImageDraw.Draw(m)
        md.ellipse([0, 0, n - 1, n - 1], fill=255)
        for k in range(7):                                  # смуги в нижній половині сонця
            y = int(n * (0.52 + 0.07 * k))
            md.rectangle([0, y, n, y + 4 + 2 * k], fill=0)
        img.putalpha(m)
        return img

    def palm(self, d, p, t):
        sway = 0.035 * math.sin(t * 0.9 + p["ph"]) + 0.01 * kick_pulse(t)
        x0, y0, h, lean = p["x"], p["base"], p["h"], p["lean"] + sway
        pts = []
        for i in range(25):                                 # вигнутий стовбур
            u = i / 24
            pts.append((x0 + lean * h * u ** 1.6 + 30 * math.sin(u * 3), y0 - h * u))
        for i in range(24):
            a, b = pts[i], pts[i + 1]
            w = (34 - 22 * i / 24) * p["sc"]
            d.line([a, b], fill=(18, 6, 26, 255), width=int(w))
        top = pts[-1]
        for k in range(p["fr"]):                            # листя
            ang = -math.pi / 2 + (k - (p["fr"] - 1) / 2) * 0.62 + 0.15 * math.sin(t * 1.3 + k + p["ph"])
            L = (330 + 60 * math.sin(k * 2.3)) * p["sc"]
            spine = []
            for j in range(16):
                u = j / 15
                droop = 260 * p["sc"] * u ** 2
                spine.append((top[0] + L * u * math.cos(ang), top[1] + L * u * math.sin(ang) + droop))
            left, right = [], []
            for j in range(1, 16):
                u = j / 15
                w = 34 * p["sc"] * math.sin(math.pi * u) ** 0.8
                dx, dy = spine[j][0] - spine[j - 1][0], spine[j][1] - spine[j - 1][1]
                ln = math.hypot(dx, dy) or 1
                nx, ny = -dy / ln, dx / ln
                left.append((spine[j][0] + nx * w, spine[j][1] + ny * w))
                right.append((spine[j][0] - nx * w * 0.6, spine[j][1] - ny * w * 0.6))
            d.polygon([top] + left + right[::-1], fill=(18, 6, 26, 255))

    def draw(self, fr, t):
        fr.alpha_composite(self.bg)
        pulse = kick_pulse(t)
        sy = HORIZON - 150 + 6 * math.sin(t * 0.4)
        nd.comp(fr, self.halo, 540 - 650, sy - 650, 0.55 + 0.35 * pulse)
        sun = self.sun.crop((0, 0, 500, int(HORIZON - (sy - 250))))
        fr.alpha_composite(sun, (290, int(sy - 250)))
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        d.line([0, HORIZON, W, HORIZON], fill=(*GOLD, 200), width=2)
        for x, y, w, ph in self.shimmer:                    # відблиски на воді
            dist = abs(x - 540) / 540
            col = ORANGE if dist < 0.3 else (HOT if dist < 0.6 else TEAL)
            yy = y + 4 * math.sin(t * 1.5 + ph)
            a = int((150 - 100 * (yy - HORIZON) / (H - HORIZON)) * (0.6 + 0.4 * math.sin(t * 2.2 + ph)))
            xx = (x + t * 12 * (1 if ph > 3 else -1)) % W
            d.line([xx - w / 2, yy, xx + w / 2, yy], fill=(*col, max(0, a)), width=3)
        fr.alpha_composite(lay)
        ps.dust(fr, t, self.dust)
        pl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dp = ImageDraw.Draw(pl)
        for p in self.palms:
            self.palm(dp, p, t)
        fr.alpha_composite(pl)


ps.CLASSES["vice"] = Vice
if "vice" not in ps.SCENES:
    ps.SCENES.append("vice")

premium_stories.STORIES[KEY] = {
    "style": {"scene": "vice", "track": 0, "layout": "center", "reveal": "slide", "outro": "wipe", "panel": "frost"},
    "en": {
        "hook": ("GTA VI · DAY ONE", "$2.36B", "in 24 hours. An estimate nobody official has confirmed."),
        "q": ("Would you put it in a board deck?", "Read the source first."),
        "c1": {"label": "THE COMPARISON", "title": "Almost 3× GTA V", "sub": "Day-one revenue, worldwide.",
               "type": "columns", "tag": "ESTIMATE  ·  SENSOR TOWER",
               "cols": [{"c": "GTA V, 2013", "v": "$815M", "h": 0.32}, {"c": "GTA VI, 2026 (est.)", "v": "$2.36B", "h": 0.92}]},
        "c2": {"label": "WHO SAYS SO", "title": "Check the source", "sub": "An analytics firm's estimate. The publisher has not reported yet.",
               "type": "rows", "table": "DAY-ONE NUMBER, 20 NOVEMBER",
               "rows": [{"l": "Sensor Tower", "v": "$2.36B", "v2": "Estimate", "flag": "ESTIMATE", "bad": False, "at": 0},
                        {"l": "Take-Two and Rockstar", "v": "?", "v2": "Not reported", "flag": "UNCONFIRMED", "at": 1}]},
        "kpi": {"label": "GTA VI, DAY-ONE REVENUE", "states": [("start", "$2.36B", "HEADLINE", True),
                                                             ("c2e1", "$2.36B", "UNCONFIRMED", False),
                                                             ("c2e2", "$2.36B (est.)", "SOURCE LABELLED", True)]},
        "result": ("RESULT", "Same number", "Labelled: estimate, Sensor Tower, 20 Nov. Now it can go in the deck."),
        "takeaway": "Huge number.\nWho counted it?",
        "end": "Send this to whoever builds the board deck.",
    },
    "uk": {
        "hook": ("GTA VI · ПЕРША ДОБА", "$2,36 млрд", "за 24 години. Оцінка, яку офіційно ніхто не підтвердив."),
        "q": ("Ви б поставили це в презентацію раді?", "Спершу прочитайте джерело."),
        "c1": {"label": "ПОРІВНЯННЯ", "title": "Майже 3× GTA V", "sub": "Виторг за першу добу, світ.",
               "type": "columns", "tag": "ОЦІНКА  ·  SENSOR TOWER",
               "cols": [{"c": "GTA V, 2013", "v": "$815 млн", "h": 0.32}, {"c": "GTA VI, 2026 (оцінка)", "v": "$2,36 млрд", "h": 0.92}]},
        "c2": {"label": "ХТО ЦЕ КАЖЕ", "title": "Перевірте джерело", "sub": "Оцінка аналітичної компанії. Видавець цифр ще не оприлюднив.",
               "type": "rows", "table": "ЦИФРА ПЕРШОЇ ДОБИ, 20 ЛИСТОПАДА",
               "rows": [{"l": "Sensor Tower", "v": "$2,36 млрд", "v2": "Оцінка", "flag": "ОЦІНКА", "bad": False, "at": 0},
                        {"l": "Take-Two і Rockstar", "v": "?", "v2": "Не оприлюднено", "flag": "НЕ ПІДТВЕРДЖЕНО", "at": 1}]},
        "kpi": {"label": "GTA VI, ВИТОРГ ЗА ДОБУ", "states": [("start", "$2,36 млрд", "ЗАГОЛОВОК", True),
                                                           ("c2e1", "$2,36 млрд", "НЕ ПІДТВЕРДЖЕНО", False),
                                                           ("c2e2", "$2,36 млрд (оцінка)", "ДЖЕРЕЛО ПІДПИСАНО", True)]},
        "result": ("РЕЗУЛЬТАТ", "Те саме число", "З підписом: оцінка, Sensor Tower, 20.11. Тепер можна в презентацію."),
        "takeaway": "Величезне число.\nХто його порахував?",
        "end": "Перешліть тому, хто збирає презентацію для ради.",
    },
}


if __name__ == "__main__":
    print(mp.render(KEY, sys.argv[1], Path(sys.argv[2])))
