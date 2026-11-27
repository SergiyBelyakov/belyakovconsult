"""Моушн-ролик «6 рівнів архітектури даних» (27.11.2026), 9:16, 38.4 с, EN і UA.

Стиль креслення: сітка-блупринт, рамка з мітками, вузли-скляні картки з піктограмами (база, застосунок, файл, звіт),
з'єднання з частинками даних, що течуть, і драбина складності 1..6 унизу.
  0.0   хук на кадрі 0: «6 рівнів», драбина, якір болю
  2.4 + 4.8*i  шість архітектур: звіти з систем, репліка ODS, сховище і вітрини, озеро, lakehouse, data mesh
        (схема будується, плюс і мінус, рівень на драбині)
  31.2  порівняння: складність, свіжість, масштаб (якір полегшення)
  34.8  фінал з брендом (звуковий логотип)
Музика: фірмовий трек make_nightdrive, подовжений вставкою тактів 4.8..19.2 (межі тактів, 100 уд/хв).

Запуск: python scripts/make_data_arch.py <en|uk> <out.mp4>
"""
from __future__ import annotations

import math
import subprocess
import sys
import wave
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_nightdrive as nd  # noqa: E402
import premium_anchors as pa  # noqa: E402
from make_nightdrive import CHAMPAGNE, GRAPHITE, MIDNIGHT, RUBY, SILVER, WHITE, bwrap, clamp, comp, ease, tracked  # noqa: E402

W, H, FPS = 1080, 1920, 30
TOTAL = 38.4
T0, SCENE = 2.4, 4.8
T_CMP, T_FIN = 31.2, 34.8
TRACK = 0
STEEL = (120, 160, 205)
BRONZE, SILV, GOLD = (176, 122, 74), (178, 188, 200), (226, 184, 92)
DIAG = (90, 560, 990, 1330)

TEXT = {
    "uk": dict(
        hook=("АРХІТЕКТУРА ДАНИХ", "6 рівнів", "Від звіту з ERP до data mesh. На якому ви?"),
        level="РІВЕНЬ", simple="ПРОСТІШЕ", complex="СКЛАДНІШЕ", plus="ПЛЮС", minus="МІНУС",
        scenes=[
            dict(t="Звіти напряму з систем", s="Кожен звіт тягне дані сам", p="Старт за кілька днів", m="Хаос зв'язків, різні цифри",
                 n=dict(src=["ERP", "CRM", "Склад", "Excel"], out=["Звіт A", "Звіт B", "Звіт C"])),
            dict(t="Репліка (ODS)", s="Копія облікових баз для звітів", p="Не навантажує ERP", m="Логіка досі у звітах",
                 n=dict(src=["ERP", "CRM", "Склад"], mid="ODS · репліка", out=["Звіт A", "Звіт B", "Звіт C"])),
            dict(t="Сховище і вітрини", s="Інтеграція, історія, схема «зірка»", p="Одна версія правди", m="Зміни йдуть тижнями",
                 n=dict(src=["ERP", "CRM", "Склад"], etl="ETL", dwh="Сховище даних", marts=["Фінанси", "Продажі", "Склад"], bi="BI")),
            dict(t="Озеро даних", s="Усі дані в сирому вигляді", p="Дешево, будь-які формати", m="Без правил стає болотом",
                 n=dict(src=["ERP", "CRM", "Логи", "IoT", "Файли"], lake="Озеро даних", out=["Data science", "BI"])),
            dict(t="Lakehouse", s="Bronze, Silver, Gold в одному сховищі", p="Одна копія для BI і ML", m="Нові навички й дисципліна",
                 n=dict(src=["ERP", "CRM", "Події", "Файли"], layers=["Bronze · сирі", "Silver · очищені", "Gold · готові"], out=["BI", "ML"])),
            dict(t="Data mesh", s="Домени володіють своїми даними", p="Масштаб без вузького місця", m="Потрібна зріла організація",
                 n=dict(domains=["Продажі", "Фінанси", "Логістика", "Персонал"], core="Платформа і правила", product="продукт даних")),
        ],
        cmp=("ПОРІВНЯННЯ", "Що обрати?", "Складність має відповідати масштабу"),
        cols=["Складність", "Свіжість", "Масштаб"],
        short=["Звіти з систем", "Репліка ODS", "Сховище", "Озеро", "Lakehouse", "Data mesh"],
        note="Оцінка орієнтовна",
        end="Перешліть тому, хто відповідає за дані у вашій компанії."),
    "en": dict(
        hook=("DATA ARCHITECTURE", "6 levels", "From ERP reports to data mesh. Where are you?"),
        level="LEVEL", simple="SIMPLER", complex="MORE COMPLEX", plus="PLUS", minus="MINUS",
        scenes=[
            dict(t="Reports straight from systems", s="Every report pulls its own data", p="Live in days", m="Spaghetti links, different numbers",
                 n=dict(src=["ERP", "CRM", "Stock", "Excel"], out=["Report A", "Report B", "Report C"])),
            dict(t="Replica (ODS)", s="A copy of operational databases for reporting", p="Spares the ERP", m="Logic still lives in reports",
                 n=dict(src=["ERP", "CRM", "Stock"], mid="ODS · replica", out=["Report A", "Report B", "Report C"])),
            dict(t="Warehouse and marts", s="Integration, history, star schema", p="One version of the truth", m="Changes take weeks",
                 n=dict(src=["ERP", "CRM", "Stock"], etl="ETL", dwh="Data warehouse", marts=["Finance", "Sales", "Stock"], bi="BI")),
            dict(t="Data lake", s="All data, raw, in any format", p="Cheap, any format", m="Without rules it turns into a swamp",
                 n=dict(src=["ERP", "CRM", "Logs", "IoT", "Files"], lake="Data lake", out=["Data science", "BI"])),
            dict(t="Lakehouse", s="Bronze, Silver, Gold in one store", p="One copy for BI and ML", m="New skills and discipline",
                 n=dict(src=["ERP", "CRM", "Events", "Files"], layers=["Bronze · raw", "Silver · cleaned", "Gold · ready"], out=["BI", "ML"])),
            dict(t="Data mesh", s="Domains own their data", p="Scales without a bottleneck", m="Needs a mature organisation",
                 n=dict(domains=["Sales", "Finance", "Logistics", "HR"], core="Platform and rules", product="data product")),
        ],
        cmp=("COMPARISON", "What to choose?", "Match complexity to scale"),
        cols=["Complexity", "Freshness", "Scale"],
        short=["From systems", "ODS replica", "Warehouse", "Data lake", "Lakehouse", "Data mesh"],
        note="Indicative assessment",
        end="Send this to whoever owns data in your company."),
}
SCORES = [(1, 5, 1), (2, 4, 2), (3, 2, 3), (3, 3, 5), (4, 4, 5), (5, 4, 5)]


def F(kind, size):
    return brand.font(kind, size)


def fit(kind, size, text, maxw, minsize=20):
    while size > minsize and F(kind, size).getlength(text) > maxw:
        size -= 2
    return F(kind, size)


def seg(u, a, d=0.35):
    return ease((u - a) / d)


# ---------------------------------------------------------------- тло креслення
def blueprint():
    w, h = W + 300, H + 300
    top, bot = np.array(MIDNIGHT, np.float32), np.array(GRAPHITE, np.float32)
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    arr = np.broadcast_to(top + (bot - top) * y, (h, w, 3)).copy()
    img = Image.fromarray(arr.astype(np.uint8)).convert("RGBA")
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for x in range(0, w, 30):
        d.line([x, 0, x, h], fill=(*STEEL, 22 if x % 150 == 0 else 9), width=1)
    for yy in range(0, h, 30):
        d.line([0, yy, w, yy], fill=(*STEEL, 22 if yy % 150 == 0 else 9), width=1)
    img.alpha_composite(lay)
    return img


def frame_marks(fr):
    """Рамка креслення з мітками, як на архітектурному аркуші."""
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    m = 34
    d.rectangle([m, m, W - m, H - m], outline=(*STEEL, 60), width=1)
    for x in range(m + 60, W - m, 60):
        d.line([x, m, x, m + (10 if (x - m) % 300 == 0 else 5)], fill=(*STEEL, 70), width=1)
        d.line([x, H - m, x, H - m - (10 if (x - m) % 300 == 0 else 5)], fill=(*STEEL, 70), width=1)
    for y in range(m + 60, H - m, 60):
        d.line([m, y, m + (10 if (y - m) % 300 == 0 else 5), y], fill=(*STEEL, 70), width=1)
        d.line([W - m, y, W - m - (10 if (y - m) % 300 == 0 else 5), y], fill=(*STEEL, 70), width=1)
    for cx, cy in ((m, m), (W - m, m), (m, H - m), (W - m, H - m)):
        d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], outline=(*STEEL, 120), width=1)
    fr.alpha_composite(lay)


# ---------------------------------------------------------------- примітиви схеми
def icon(d, kind, x, y, s, col, a):
    c = (*col, int(255 * a))
    if kind == "db":
        d.ellipse([x - s, y - s * 0.95, x + s, y - s * 0.45], outline=c, width=3)
        d.line([x - s, y - s * 0.7, x - s, y + s * 0.7], fill=c, width=3)
        d.line([x + s, y - s * 0.7, x + s, y + s * 0.7], fill=c, width=3)
        d.arc([x - s, y + s * 0.45, x + s, y + s * 0.95], 0, 180, fill=c, width=3)
        d.arc([x - s, y - s * 0.1, x + s, y + s * 0.4], 0, 180, fill=(*col, int(140 * a)), width=2)
    elif kind == "app":
        d.rounded_rectangle([x - s, y - s * 0.8, x + s, y + s * 0.8], 5, outline=c, width=3)
        d.line([x - s, y - s * 0.4, x + s, y - s * 0.4], fill=c, width=2)
        for k in range(3):
            d.ellipse([x - s + 6 + k * 9, y - s * 0.68, x - s + 11 + k * 9, y - s * 0.52], fill=c)
    elif kind == "file":
        d.polygon([(x - s * 0.7, y - s), (x + s * 0.35, y - s), (x + s * 0.7, y - s * 0.6), (x + s * 0.7, y + s), (x - s * 0.7, y + s)], outline=c)
        for k in range(3):
            d.line([x - s * 0.4, y - s * 0.3 + k * s * 0.4, x + s * 0.4, y - s * 0.3 + k * s * 0.4], fill=c, width=2)
    elif kind == "chart":
        d.line([x - s, y + s, x + s, y + s], fill=c, width=3)
        for k, hh in enumerate((0.6, 1.2, 0.9, 1.6)):
            bx = x - s + 6 + k * s * 0.5
            d.rectangle([bx, y + s - hh * s, bx + s * 0.3, y + s], fill=c)
    elif kind == "gear":
        d.ellipse([x - s * 0.6, y - s * 0.6, x + s * 0.6, y + s * 0.6], outline=c, width=3)
        for k in range(8):
            ang = k * math.pi / 4
            d.line([x + math.cos(ang) * s * 0.6, y + math.sin(ang) * s * 0.6, x + math.cos(ang) * s, y + math.sin(ang) * s], fill=c, width=4)
    elif kind == "cube":
        p = [(x, y - s), (x + s, y - s * 0.5), (x + s, y + s * 0.5), (x, y + s), (x - s, y + s * 0.5), (x - s, y - s * 0.5)]
        d.polygon(p, outline=c)
        d.line([(x - s, y - s * 0.5), (x, y), (x + s, y - s * 0.5)], fill=c, width=2)
        d.line([(x, y), (x, y + s)], fill=c, width=2)


KIND = {"ERP": "app", "CRM": "app", "Склад": "app", "Stock": "app", "Excel": "file", "Файли": "file", "Files": "file",
        "Логи": "file", "Logs": "file", "IoT": "gear", "Події": "gear", "Events": "gear"}


def node(d, box, label, kind, k, col=SILVER, accent=False, fsize=30):
    if k <= 0.01:
        return
    x0, y0, x1, y1 = box
    ox = (1 - k) * 0
    d.rounded_rectangle([x0, y0 + (1 - k) * 14, x1, y1 + (1 - k) * 14], 16, fill=(255, 255, 255, int(16 * k)),
                        outline=(*(CHAMPAGNE if accent else col), int((230 if accent else 170) * k)), width=3 if accent else 2)
    cy = (y0 + y1) / 2 + (1 - k) * 14
    w = x1 - x0
    if kind and w > 150:
        icon(d, kind, x0 + 34 + ox, cy, 15, CHAMPAGNE if accent else col, k)
        f = fit("body-semi", fsize, label, w - 80, 18)
        d.text((x0 + 62, cy), label, font=f, fill=(*WHITE, int(255 * k)), anchor="lm")
    else:
        f = fit("body-semi", fsize, label, w - 20, 16)
        d.text(((x0 + x1) / 2, cy), label, font=f, fill=(*WHITE, int(255 * k)), anchor="mm")


def poly_len(pts):
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))


def point_at(pts, f):
    L = poly_len(pts) * f
    for a, b in zip(pts, pts[1:]):
        l = math.hypot(b[0] - a[0], b[1] - a[1])
        if L <= l:
            u = L / l if l else 0
            return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)
        L -= l
    return pts[-1]


def partial(pts, f):
    if f >= 1:
        return pts
    L = poly_len(pts) * f
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        l = math.hypot(b[0] - a[0], b[1] - a[1])
        if L <= l:
            u = L / l if l else 0
            out.append((a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u))
            return out
        out.append(b)
        L -= l
    return out


def edge(d, pts, k, t, col=STEEL, flow=True, n=2, speed=0.55, width=2, dot=CHAMPAGNE):
    if k <= 0.01:
        return
    pp = partial(pts, k)
    if len(pp) > 1:
        d.line(pp, fill=(*col, int(170 * min(1, k * 1.5))), width=width, joint="curve")
    if flow and k >= 1:
        for i in range(n):
            f = (t * speed + i / n + (hash(tuple(map(int, pts[0]))) % 97) / 97) % 1
            x, y = point_at(pts, f)
            for r, al in ((10, 40), (6, 110), (3, 255)):
                d.ellipse([x - r, y - r, x + r, y + r], fill=(*dot, al))
    if k >= 1 and len(pts) >= 2:                          # стрілка в кінці
        (ax, ay), (bx, by) = pts[-2], pts[-1]
        ang = math.atan2(by - ay, bx - ax)
        d.polygon([(bx, by), (bx - 12 * math.cos(ang - 0.45), by - 12 * math.sin(ang - 0.45)),
                   (bx - 12 * math.cos(ang + 0.45), by - 12 * math.sin(ang + 0.45))], fill=(*col, 200))


def elbow(x1, y1, x2, y2):
    ym = (y1 + y2) / 2
    return [(x1, y1), (x1, ym), (x2, ym), (x2, y2)]


def row(n, y, h, x0=110, x1=970, gap=22):
    w = (x1 - x0 - gap * (n - 1)) / n
    return [(x0 + i * (w + gap), y, x0 + i * (w + gap) + w, y + h) for i in range(n)]


def bc(b):
    return ((b[0] + b[2]) / 2, b[3])


def tc(b):
    return ((b[0] + b[2]) / 2, b[1])


# ---------------------------------------------------------------- сцени
def scene(d, i, N, u, t):
    """Малює схему архітектури i при локальному часі u (0..4.8)."""
    if i == 0:                                            # звіти напряму з систем: «спагеті»
        src, out = row(4, 600, 104), row(3, 1150, 104, 150, 930)
        for j, b in enumerate(src):
            node(d, b, N["src"][j], KIND.get(N["src"][j], "app"), seg(u, 0.1 * j))
        for j, b in enumerate(out):
            node(d, b, N["out"][j], "chart", seg(u, 0.5 + 0.1 * j))
        pairs = [(0, 0), (0, 1), (0, 2), (1, 0), (1, 2), (2, 1), (2, 2), (3, 0), (3, 1), (3, 2), (1, 1), (2, 0)]
        for q, (a, b) in enumerate(pairs):
            p1, p2 = bc(src[a]), tc(out[b])
            edge(d, [p1, ((p1[0] + p2[0]) / 2 + (q % 3 - 1) * 40, (p1[1] + p2[1]) / 2), p2], seg(u, 0.7 + 0.05 * q, 0.5), t,
                 col=(170, 120, 140), n=1, speed=0.8, dot=(255, 160, 170))
        k = seg(u, 1.8)                                   # ≠ між звітами
        for xa in (out[0][2] + 11, out[1][2] + 11):
            if k > 0:
                d.ellipse([xa - 22, 1202 - 22, xa + 22, 1202 + 22], fill=(*RUBY, int(230 * k)))
                d.text((xa, 1201), "≠", font=F("head", 34), fill=(*WHITE, int(255 * k)), anchor="mm")
    elif i == 1:                                          # репліка ODS
        src, out = row(3, 600, 104), row(3, 1150, 104)
        mid = (330, 860, 750, 990)
        for j, b in enumerate(src):
            node(d, b, N["src"][j], "app", seg(u, 0.1 * j))
        node(d, mid, N["mid"], "db", seg(u, 0.45), accent=True, fsize=34)
        for j, b in enumerate(out):
            node(d, b, N["out"][j], "chart", seg(u, 0.85 + 0.1 * j))
        for j, b in enumerate(src):
            edge(d, elbow(*bc(b), 540 + (j - 1) * 120, mid[1]), seg(u, 0.35 + 0.08 * j, 0.45), t)
        for j, b in enumerate(out):
            edge(d, elbow(540 + (j - 1) * 120, mid[3], *tc(b)), seg(u, 0.95 + 0.08 * j, 0.45), t)
    elif i == 2:                                          # сховище і вітрини
        src = row(3, 580, 92)
        etl = (420, 724, 660, 800)
        dwh = (270, 850, 810, 970)
        marts = row(3, 1030, 88, 150, 930)
        bi = (430, 1180, 650, 1270)
        for j, b in enumerate(src):
            node(d, b, N["src"][j], "app", seg(u, 0.08 * j))
        node(d, etl, N["etl"], "gear", seg(u, 0.35))
        node(d, dwh, N["dwh"], "db", seg(u, 0.6), accent=True, fsize=36)
        for j, b in enumerate(marts):
            node(d, b, N["marts"][j], "db", seg(u, 0.9 + 0.1 * j), fsize=28)
        node(d, bi, N["bi"], "chart", seg(u, 1.3), accent=True)
        for j, b in enumerate(src):
            edge(d, elbow(*bc(b), 540 + (j - 1) * 60, etl[1]), seg(u, 0.25 + 0.06 * j, 0.4), t)
        edge(d, [(540, etl[3]), (540, dwh[1])], seg(u, 0.5, 0.3), t)
        for j, b in enumerate(marts):
            edge(d, elbow(540 + (j - 1) * 150, dwh[3], *tc(b)), seg(u, 0.8 + 0.08 * j, 0.4), t)
            edge(d, elbow(*bc(b), 540 + (j - 1) * 60, bi[1]), seg(u, 1.15 + 0.06 * j, 0.4), t)
    elif i == 3:                                          # озеро даних
        src = row(5, 600, 92, 100, 980, 16)
        out = [(150, 1170, 500, 1262), (580, 1170, 930, 1262)]
        k = seg(u, 0.4, 0.5)
        if k > 0:                                         # озеро: хвилі
            x0, y0, x1, y1 = 130, 820, 950, 1060
            d.rounded_rectangle([x0, y0, x1, y1], 60, fill=(40, 90, 140, int(70 * k)), outline=(*STEEL, int(200 * k)), width=2)
            for r in range(5):
                yy = y0 + 50 + r * 36
                pts = [(x, yy + 8 * math.sin(x / 55 + t * 2.2 + r)) for x in range(x0 + 30, x1 - 29, 10)]
                d.line(pts, fill=(*STEEL, int((120 - r * 15) * k)), width=2)
            d.text((540, 905), N["lake"], font=F("head", 46), fill=(*WHITE, int(255 * k)), anchor="mm")
            ka = seg(u, 1.9)
            for q, (qx, qy) in enumerate(((230, 1000), (820, 975), (420, 1020), (690, 1010))):
                d.text((qx, qy + 6 * math.sin(t * 2 + q)), "?", font=F("head", 40), fill=(*RUBY, int(220 * ka)), anchor="mm")
        for j, b in enumerate(src):
            node(d, b, N["src"][j], KIND.get(N["src"][j], "app"), seg(u, 0.07 * j), fsize=26)
            edge(d, [bc(b), (bc(b)[0], 820)], seg(u, 0.3 + 0.05 * j, 0.3), t, n=2)
        for j, b in enumerate(out):
            node(d, b, N["out"][j], "chart", seg(u, 0.9 + 0.1 * j))
            edge(d, [(tc(b)[0], 1060), tc(b)], seg(u, 1.0, 0.3), t, n=1)
    elif i == 4:                                          # lakehouse: шари
        src = row(4, 580, 90)
        for j, b in enumerate(src):
            node(d, b, N["src"][j], KIND.get(N["src"][j], "app"), seg(u, 0.07 * j))
        ys = [720, 850, 980]
        for j, (lab, col) in enumerate(zip(N["layers"], (BRONZE, SILV, GOLD))):
            k = seg(u, 0.35 + 0.25 * j)
            if k > 0:
                x0, x1 = 150, 930
                y0 = ys[j] + (1 - k) * 20
                d.rounded_rectangle([x0, y0, x1, y0 + 96], 18, fill=(*col, int(60 * k)), outline=(*col, int(230 * k)), width=3)
                for s in range(4):
                    d.line([x0 + 30, y0 + 22 + s * 18, x0 + 160, y0 + 22 + s * 18], fill=(*col, int(110 * k)), width=2)
                d.text((540, y0 + 48), lab, font=F("head", 38), fill=(*WHITE, int(255 * k)), anchor="mm")
        for j, b in enumerate(src):
            edge(d, [bc(b), (bc(b)[0], 720)], seg(u, 0.3 + 0.05 * j, 0.25), t, n=1)
        for j in range(2):
            for xx in (330, 750):
                edge(d, [(xx, ys[j] + 96), (xx, ys[j + 1])], seg(u, 0.6 + 0.25 * j, 0.2), t, n=1, dot=(CHAMPAGNE if j else SILVER))
        out = [(170, 1150, 500, 1240), (580, 1150, 910, 1240)]
        for j, b in enumerate(out):
            node(d, b, N["out"][j], "chart", seg(u, 1.2 + 0.1 * j), accent=True)
            edge(d, [(tc(b)[0], 1076), tc(b)], seg(u, 1.3, 0.25), t, n=1, dot=GOLD)
    else:                                                 # data mesh
        cx, cy = 540, 945
        k0 = seg(u, 0.5)
        if k0 > 0:
            d.ellipse([cx - 150, cy - 95, cx + 150, cy + 95], fill=(255, 255, 255, int(14 * k0)), outline=(*CHAMPAGNE, int(220 * k0)), width=3)
            for q, ln in enumerate(bwrap(N["core"], F("body-semi", 30), 240)):
                d.text((cx, cy - 18 + q * 38), ln, font=F("body-semi", 30), fill=(*WHITE, int(255 * k0)), anchor="mm")
        pos = [(270, 690), (810, 690), (270, 1200), (810, 1200)]
        for j, (px, py) in enumerate(pos):
            k = seg(u, 0.1 * j)
            if k <= 0:
                continue
            r = 120
            hexp = [(px + r * math.cos(math.pi / 6 + q * math.pi / 3), py + 0.82 * r * math.sin(math.pi / 6 + q * math.pi / 3)) for q in range(6)]
            d.polygon(hexp, fill=(255, 255, 255, int(16 * k)), outline=(*SILVER, int(200 * k)))
            d.line(hexp + [hexp[0]], fill=(*SILVER, int(200 * k)), width=2)
            d.text((px, py - 22), N["domains"][j], font=fit("body-semi", 32, N["domains"][j], 200), fill=(*WHITE, int(255 * k)), anchor="mm")
            kp = seg(u, 0.9 + 0.1 * j)
            icon(d, "cube", px - 52, py + 34, 14, CHAMPAGNE, kp)
            d.text((px - 30, py + 34), N["product"], font=F("body-semi", 22), fill=(*CHAMPAGNE, int(230 * kp)), anchor="lm")
            edge(d, [(px + (60 if px < cx else -60), py + (60 if py < cy else -60)), (cx + (-110 if px < cx else 110), cy + (-55 if py < cy else 55))],
                 seg(u, 0.6 + 0.08 * j, 0.35), t, n=1)
        for a, b in ((0, 1), (2, 3)):
            pa_, pb_ = pos[a], pos[b]
            edge(d, [(pa_[0] + 125, pa_[1]), (pb_[0] - 125, pb_[1])], seg(u, 1.2, 0.4), t, col=(140, 150, 165), n=1, speed=0.4)


# ---------------------------------------------------------------- кадр
class Film:
    def __init__(self, lang):
        self.lang = lang
        self.T = TEXT[lang]
        self.bg = blueprint()
        self.lock = brand.lockup(52)
        self.logo = brand.logo(200)
        yy, xx = np.mgrid[0:H, 0:W]
        v = 1 - 0.5 * np.clip((np.hypot((xx - 540) / 760, (yy - 1000) / 1250) - 0.55) / 0.6, 0, 1) ** 1.6
        self.vig = v[..., None].astype(np.float32)
        rng = np.random.default_rng(9)
        self.grain = np.repeat(np.repeat(rng.normal(0, 2.5, (H // 2, W // 2, 1)).astype(np.float32), 2, 0), 2, 1)  # статичне зерно: стискається

    def header(self, d, label, title, sub, k, dy):
        a = int(255 * k)
        tracked(d, label, F("body-semi", 28), 540, 262 + dy, (*RUBY, a), 7)
        ft = fit("head", 84, title, 940, 50)
        d.text((540, 300 + dy), title, font=ft, fill=(*WHITE, a), anchor="ma")
        y = 300 + dy + ft.size + 26
        for ln in bwrap(sub, F("body", 40), 920)[:2]:
            d.text((540, y), ln, font=F("body", 40), fill=(*SILVER, a), anchor="ma")
            y += 50

    def ladder(self, d, level, k_all, t):
        """Драбина складності 1..6: поточний рівень світиться."""
        x0, x1, yb = 140, 940, 1800
        w = (x1 - x0) / 6
        tracked(d, self.T["simple"], F("body-semi", 22), x0 + 60, yb + 42, (*SILVER, int(170 * k_all)), 4)
        tracked(d, self.T["complex"], F("body-semi", 22), x1 - 80, yb + 42, (*SILVER, int(170 * k_all)), 4)
        for j in range(6):
            hgt = 34 + j * 26
            bx = x0 + j * w + 6
            box = [bx, yb - hgt, bx + w - 12, yb]
            if level is None:
                fill, out = (255, 255, 255, int(10 * k_all)), (*SILVER, int(140 * k_all))
            elif j < level:
                fill, out = (*CHAMPAGNE, int(55 * k_all)), (*CHAMPAGNE, int(160 * k_all))
            elif j == level:
                pulse = 0.75 + 0.25 * math.sin(t * 5)
                fill, out = (*CHAMPAGNE, int(170 * pulse * k_all)), (*CHAMPAGNE, int(255 * k_all))
            else:
                fill, out = (255, 255, 255, int(8 * k_all)), (*SILVER, int(90 * k_all))
            d.rounded_rectangle(box, 8, fill=fill, outline=out, width=2)
            d.text((bx + (w - 12) / 2, yb - hgt - 22), str(j + 1), font=F("head", 28),
                   fill=(*(WHITE if level is not None and j <= level else SILVER), int(230 * k_all)), anchor="mm")

    def proscons(self, d, sc, u):
        for q, (txt, good, at) in enumerate(((sc["p"], True, 2.0), (sc["m"], False, 2.7))):
            k = seg(u, at)
            if k <= 0:
                continue
            y = 1400 + q * 96
            col = CHAMPAGNE if good else RUBY
            cx = 140
            d.ellipse([cx - 26, y - 26, cx + 26, y + 26], outline=(*col, int(255 * k)), width=4)
            if good:
                d.line([(cx - 11, y + 1), (cx - 3, y + 10), (cx + 13, y - 10)], fill=(*col, int(255 * k)), width=5)
            else:
                d.line([(cx - 9, y - 9), (cx + 9, y + 9)], fill=(*col, int(255 * k)), width=5)
                d.line([(cx - 9, y + 9), (cx + 9, y - 9)], fill=(*col, int(255 * k)), width=5)
            f = fit("body-semi", 44, txt, 760, 30)
            d.text((190 + (1 - k) * 24, y), txt, font=f, fill=(*WHITE, int(255 * k)), anchor="lm")

    def compare(self, fr, d, t):
        u = t - T_CMP
        k = seg(u, 0.0, 0.4) * (1 - seg(t - T_FIN, 0, 0.4))
        self.header(d, *self.T["cmp"], k, (1 - seg(u, 0, 0.4)) * 20)
        x0, x1, y0 = 100, 980, 600
        d.rounded_rectangle([x0, y0, x1, y0 + 760], 26, fill=(255, 255, 255, int(16 * k)), outline=(*SILVER, int(90 * k)), width=2)
        cxs = [560, 720, 880]
        for c, name in zip(cxs, self.T["cols"]):
            d.text((c, y0 + 50), name, font=fit("body-semi", 26, name, 150), fill=(*SILVER, int(230 * k)), anchor="mm")
        for r in range(6):
            kr = seg(u, 0.25 + 0.18 * r) * k
            yy = y0 + 130 + r * 100
            d.line([x0 + 30, yy + 50, x1 - 30, yy + 50], fill=(255, 255, 255, int(20 * kr)), width=1)
            d.text((x0 + 40, yy), self.T["short"][r], font=fit("body-semi", 36, self.T["short"][r], 330), fill=(*WHITE, int(255 * kr)), anchor="lm")
            for c, v in zip(cxs, SCORES[r]):
                for q in range(5):
                    dx = c - 48 + q * 24
                    on = q < v
                    d.ellipse([dx - 8, yy - 8, dx + 8, yy + 8], fill=(*(CHAMPAGNE if on else (70, 78, 92)), int(255 * kr)))
        d.text((540, y0 + 730), self.T["note"], font=F("body", 26), fill=(*SILVER, int(180 * k)), anchor="mm")
        if 0 <= u < 0.9:
            pa.relief_sweep(fr, (x0, y0, x1, y0 + 760), u / 0.9)

    def end(self, fr, t):
        u = t - T_FIN
        fr.alpha_composite(Image.new("RGBA", (W, H), (*GRAPHITE, int(215 * ease(u / 0.5)))))
        k = ease((u - 0.2) / 0.5)
        comp(fr, self.logo, W / 2 - self.logo.width / 2, 620 + (1 - k) * 30, k)
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        k2 = ease((u - 0.45) / 0.5)
        y = 920 + (1 - k2) * 20
        for ln in bwrap(self.T["end"], F("body", 46), 900):
            d.text((540, y), ln, font=F("body", 46), fill=(*WHITE, int(255 * k2)), anchor="ma")
            y += 62
        k3 = ease((u - 0.75) / 0.5)
        d.line([540 - 60 * k3, y + 22, 540 + 60 * k3, y + 22], fill=(*RUBY, int(255 * k3)), width=3)
        tracked(d, "BELYAKOVCONSULT.COM", F("body-semi", 34), 540, y + 40, (*SILVER, int(255 * k3)), 6)
        k4 = ease((u - 1.0) / 0.5)
        tracked(d, pa.TAGLINE[self.lang], F("body-semi", 26), 540, y + 104, (*pa.CHAMPAGNE, int(235 * k4)), 5)
        fr.alpha_composite(lay)

    def frame(self, t):
        ox, oy = int(150 - (t * 7) % 150), int(150 - (t * 4) % 150)
        fr = self.bg.crop((ox, oy, ox + W, oy + H))
        frame_marks(fr)
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        level = None
        if t < T0:                                        # хук: видно з кадру 0
            a = 1 - seg(t, T0 - 0.3, 0.3)
            tracked(d, self.T["hook"][0], F("body-semi", 30), 540, 300, (*RUBY, int(255 * a)), 8)
            fh = fit("head", 210, self.T["hook"][1], 940, 120)
            d.text((540, 350), self.T["hook"][1], font=fh, fill=(*WHITE, int(255 * a)), anchor="ma")
            for q, ln in enumerate(self.T["hook"][2].split(". ", 1)):
                ln = ln if ln.endswith(("?", ".")) else ln + "."
                d.text((540, 610 + q * 60), ln, font=F("body", 46), fill=(*SILVER, int(255 * a)), anchor="ma")
            # шість рівнів списком, видно з кадру 0; світла хвиля пробігає згори вниз
            for j, kind in enumerate(("app", "db", "db", "file", "cube", "cube")):
                y = 820 + j * 104
                hot = clamp(1 - abs(t * 3.2 - j) / 1.2)
                d.rounded_rectangle([170, y, 910, y + 84], 16, fill=(255, 255, 255, int((12 + 26 * hot) * a)),
                                    outline=(*(CHAMPAGNE if hot > 0.3 else SILVER), int((110 + 120 * hot) * a)), width=2)
                d.text((222, y + 42), str(j + 1), font=F("head", 40), fill=(*CHAMPAGNE, int(255 * a)), anchor="mm")
                icon(d, kind, 300, y + 42, 17, CHAMPAGNE if hot > 0.3 else SILVER, a)
                d.text((345, y + 42), self.T["short"][j], font=F("body-semi", 40), fill=(*WHITE, int(255 * a)), anchor="lm")
            self.ladder(d, None, a, t)
        elif t < T_CMP:
            i = int((t - T0) // SCENE)
            u = t - T0 - i * SCENE
            sc = self.T["scenes"][i]
            out = seg(u, SCENE - 0.35, 0.35) if i < 5 else seg(u, SCENE - 0.35, 0.35)
            k_in = seg(u, 0, 0.35)
            sub = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            sd = ImageDraw.Draw(sub)
            self.header(sd, f"{self.T['level']} {i + 1} / 6", sc["t"], sc["s"], k_in, (1 - k_in) * 24)
            scene(sd, i, sc["n"], u, t)
            self.proscons(sd, sc, u)
            if out > 0:
                sub = sub.transform(sub.size, Image.AFFINE, (1, 0, 0, 0, 1, out * 60), resample=Image.BILINEAR)
                alpha = sub.getchannel("A").point(lambda v: int(v * (1 - out)))
                sub.putalpha(alpha)
            lay.alpha_composite(sub)
            level = i
            self.ladder(d, level, 1.0, t)
        else:
            self.ladder(d, 5, 1.0, t)
        if t < 0.8:                                       # якір болю, під текстом
            pa.pain_rings(fr, 540, 470, t / 0.8, 1.0)
        fr.alpha_composite(lay)
        if T_CMP <= t < T_FIN + 0.4:
            cl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            self.compare(fr, ImageDraw.Draw(cl), t)
            fr.alpha_composite(cl)
        if t >= T_FIN:
            self.end(fr, t)
        else:
            fr.alpha_composite(self.lock, (72, 116))
        a = np.asarray(fr.convert("RGB"), np.float32) * self.vig
        a += self.grain
        return np.clip(a, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- звук
def music(path: Path):
    tmp = path.with_name(path.stem + "-base.wav")
    nd.soundtrack(tmp, None, 0, TRACK)
    with wave.open(str(tmp)) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, ch).astype(np.float32) / 32767
    tmp.unlink()

    def cut(a, b):
        return x[int(a * sr):int(b * sr)]
    parts = [cut(0, 19.2), cut(4.8, 19.2), cut(19.2, 24.0 + 1.0)]   # 19.2 + 14.4 + 4.8 (+хвіст)
    xf = int(0.03 * sr)
    out = parts[0]
    for p in parts[1:]:
        fade = np.linspace(0, 1, xf)[:, None]
        out = np.concatenate([out[:-xf], out[-xf:] * (1 - fade) + p[:xf] * fade, p[xf:]])
    sfx = nd.Bus(TOTAL + 1.5)

    def put(sig, at, g, pan=0.0):
        sfx.put(sig, at, g, pan)
    put(pa.pain(), 0.0, 0.5)
    for i in range(6):
        put(nd.scan_sfx(), T0 + i * SCENE - 0.3, 0.12, 0.2)
        put(nd.tick_sfx(1800), T0 + i * SCENE + 2.0, 0.07)
        put(nd.tick_sfx(1200), T0 + i * SCENE + 2.7, 0.07)
    put(pa.relief(), T_CMP, 0.3, 0.1)
    put(pa.logo(), T_FIN + 0.4, 0.42)
    s = np.stack([sfx.L, sfx.R], 1)[: len(out)]
    if nd.SR != sr:
        idx = np.linspace(0, len(s) - 1, int(len(s) * sr / nd.SR))
        s = np.stack([np.interp(idx, np.arange(len(s)), s[:, c]) for c in range(2)], 1)
    n = min(len(out), len(s))
    mix = out[:n] * 0.85 + s[:n] * 0.6
    mix = mix[: int((TOTAL + 0.2) * sr)]
    fo = int(1.0 * sr)
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())


_F = None


def _init(lang):
    global _F
    _F = Film(lang)


def _frame(k):
    return _F.frame(k / FPS).tobytes()


def render(lang, out: Path):
    out.parent.mkdir(parents=True, exist_ok=True)
    wav = out.with_suffix(".wav")
    music(wav)
    Image.fromarray(Film(lang).frame(12.0)).save(out.with_name(out.stem + "-cover.jpg"), "JPEG", quality=92)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
           "-tune", "animation", "-maxrate", "3500k", "-bufsize", "7M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.0:LRA=9", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{TOTAL}",
           "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        with Pool(2, initializer=_init, initargs=(lang,)) as pool:
            for buf in pool.imap(_frame, range(int(TOTAL * FPS)), chunksize=8):
                proc.stdin.write(buf)
    finally:
        proc.stdin.close()
        proc.wait()
    wav.unlink(missing_ok=True)
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")
    return out


if __name__ == "__main__":
    print(render(sys.argv[1], Path(sys.argv[2])))
