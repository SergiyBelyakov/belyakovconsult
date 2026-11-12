"""Мем-ролик дня TEEN «NPC vs Main Character: Monday report» (16 с, англійською, 9:16, піксель-арт).

Формат «NPC vs main character»: екран поділено навпіл. Угорі NPC (рудий кіт) збирає понеділковий звіт руками:
відкриває файл за файлом, CTRL+C / CTRL+V, годинник летить з 09:00 до 16:58. Унизу головний герой (капібара з
мандаринкою) тисне REFRESH один раз, дашборд готовий о 09:01, далі «Z Z Z». Поворот: Data Boss питає «ADD LAST
WEEK TOO?». У NPC таблиця розсипається в #REF! (vine boom, драматичний зум на кота), капібара міняє фільтр на
LAST 2 WEEKS, вдягає піксельні окуляри (vine boom, зум). Фінал: питання до глядача й логотип.
Цифри в таблицях декоративні (випадкові клітинки), годинник жартівливий. Персонажі лише власні. Звук синтезовано в коді.

Запуск: python scripts/make_teen_npc.py <папка>
"""
from __future__ import annotations

import math
import random
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_pixel  # noqa: E402
from make_67 import capy_face  # noqa: E402
from make_boss import boss  # noqa: E402
from make_fun import SR, Mix, groove, hat, kick, midi, sfx_pop, sq, tri  # noqa: E402
from make_pixel import (BG, BG2, CAT2, CAT2_D, DARK, LH, LW, RUBY_L, SILVER, STEEL, WHITE,  # noqa: E402
                        big, blip, capybara, cat, clamp, ease, pop, ptext, ptext_c, text_w)
from make_teen_aura import bubble, shades, vine_boom, zoom  # noqa: E402

make_pixel.FONT["#"] = ["01010", "11111", "01010", "01010", "01010", "11111", "01010"]
make_pixel.FONT["_"] = ["00000", "00000", "00000", "00000", "00000", "00000", "11111"]
W, H = 1080, 1920
FPS = 30
TOTAL = 16.0
BEAT = 60 / 124
S = [0.0, 1.8, 9.2, 12.8]                         # гачок, понеділок, поворот, фінал
T_REFRESH = 2.6                                    # капібара тисне REFRESH
T_ASK = S[2]                                       # Data Boss питає
T_REF = S[2] + 0.9                                 # у NPC #REF!
T_MC = S[2] + 2.1                                  # капібара: LAST 2 WEEKS
FILES = ["EU.XLSX", "US.XLSX", "ASIA.XLSX", "OLD.XLSX", "FINAL2.XLSX"]
PASTE = 0.5                                        # крок CTRL+C / CTRL+V
GREEN = (110, 220, 130)
GRASS = (70, 150, 80)
SPLIT = 170                                        # межа між панелями на полотні 180×320
CAT_XY = (40, 162)
CAPY_XY = (40, 304)
SHEET = (74, 50, 174, 160)
DASH = (74, 192, 174, 300)


def clock(t0_min, t1_min, u):
    m = int(t0_min + (t1_min - t0_min) * clamp(u))
    return f"{m // 60:02d}:{m % 60:02d}"


def npc_clock(t):
    if t < S[1]:
        return "09:00"
    return clock(9 * 60, 16 * 60 + 58, (t - S[1]) / (S[2] - S[1] - 0.3))


def mc_clock(t):
    if t < T_REFRESH + 0.6:
        return "09:00"
    if t < T_MC:
        return "09:01"
    return "17:00"


def capy_cool(img, x, y, t, cool=False, walk=False):
    """Капібара збоку (дивиться праворуч); cool: піксельні окуляри на оці."""
    capybara(img, x, y, t, walk=walk, face=1, glass=False)
    if cool:
        d = ImageDraw.Draw(img)
        hx = x + 13
        d.rectangle([hx + 1, y - 21, hx + 7, y - 18], fill=DARK)
        d.point((hx + 2, y - 20), fill=STEEL)
        d.line([hx - 2, y - 20, hx + 1, y - 20], fill=DARK)


def window(img, box, title, col=STEEL):
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(img)
    d.rectangle([x0, y0, x1, y1], fill=(17, 22, 31), outline=col)
    d.rectangle([x0, y0, x1, y0 + 9], fill=col)
    ptext(img, title, x0 + 3, y0 + 2, WHITE, 1, shadow=False)


class Npc:
    def __init__(self):
        self.lock = brand.lockup(46)
        self.logo = brand.logo(150)
        rnd = random.Random(67)
        self.cells = [[f"{rnd.randint(10, 999)}" for _ in range(3)] for _ in range(8)]

    # ------------------------------------------------ верхня панель: NPC
    def npc_panel(self, img, t, wrecked=0.0):
        d = ImageDraw.Draw(img)
        ptext(img, "NPC", 6, 32, SILVER, 2)
        ptext(img, npc_clock(t), LW - 6 - text_w("00:00", 2), 32, RUBY_L if t > S[1] + 4 else WHITE, 2)
        u = max(0.0, t - S[1])
        k = int(u / PASTE) if t >= S[1] else 0
        f = min(len(FILES) - 1, k // 3)
        window(img, SHEET, FILES[f])
        rows = min(8, k // 2) if t < S[2] else 8
        x0, y0 = SHEET[0] + 4, SHEET[1] + 14
        for r in range(rows):
            for c in range(3):
                txt = self.cells[r][c]
                col = WHITE
                if wrecked > 0 and (r * 3 + c) / 27 < wrecked:
                    txt, col = "#REF!", RUBY_L
                ptext(img, txt, x0 + c * 33, y0 + r * 10, col, 1, shadow=False)
            d.line([SHEET[0] + 1, y0 + r * 10 + 8, SHEET[2] - 1, y0 + r * 10 + 8], fill=BG2)
        if S[1] <= t < S[2]:
            n = k + 1
            ptext(img, f"COPY-PASTE X{n}", SHEET[0] + 4, SHEET[3] - 9, SILVER, 1, shadow=False)
        # кіт
        sweat = t > S[1] + 3
        big(img, cat, CAT_XY[0], CAT_XY[1], t, CAT2, CAT2_D, walk=False, face=1, glass=False)
        if sweat and int(t * 3) % 2:
            d.rectangle([CAT_XY[0] - 8, CAT_XY[1] - 44, CAT_XY[0] - 7, CAT_XY[1] - 41], fill=(150, 200, 230))
        if S[1] <= t < S[2]:
            bubble(img, "CTRL+C" if k % 2 == 0 else "CTRL+V", CAT_XY[0] + 4, CAT_XY[1] - 46)

    # ------------------------------------------------ нижня панель: MAIN CHARACTER
    def mc_panel(self, img, t, cool=False):
        d = ImageDraw.Draw(img)
        ptext(img, "MAIN", 6, SPLIT + 6, GREEN, 2)
        ptext(img, "CHARACTER", 6, SPLIT + 22, GREEN, 1)
        ptext(img, mc_clock(t), LW - 6 - text_w("00:00", 2), SPLIT + 6, GREEN, 2)
        window(img, DASH, "DASHBOARD", (40, 110, 70))
        x0, y0, x1, y1 = DASH
        two = t >= T_MC + 0.2
        label = "LAST 2 WEEKS" if two else "THIS WEEK"
        pressed = (T_REFRESH <= t < T_REFRESH + 0.25) or (T_MC <= t < T_MC + 0.25)
        bw = text_w(label) + 8
        d.rectangle([x0 + 5, y0 + 14, x0 + 5 + bw, y0 + 26], fill=(30, 60, 40), outline=GREEN)
        ptext(img, label, x0 + 9, y0 + 17, WHITE, 1, shadow=False)
        rd = "REFRESH"
        rx = x0 + 5
        d.rectangle([rx, y0 + 30, rx + text_w(rd) + 8, y0 + 42], fill=GREEN if pressed else (30, 60, 40), outline=GREEN)
        ptext(img, rd, rx + 4, y0 + 33, DARK if pressed else WHITE, 1, shadow=False)
        # стовпчики
        g = ease((t - T_REFRESH - 0.2) / 0.8)
        if two:
            g = ease((t - T_MC - 0.2) / 0.6)
        heights = [0.5, 0.75, 0.6, 0.9, 0.7] if not two else [0.55, 0.65, 0.8, 0.7, 0.95]
        base = y1 - 8
        for j, hh in enumerate(heights):
            bx = x0 + 10 + j * 18
            top = base - int(44 * hh * g)
            if g > 0:
                d.rectangle([bx, top, bx + 11, base], fill=GREEN if j != 3 else (160, 240, 170))
        d.line([x0 + 6, base + 1, x1 - 6, base + 1], fill=STEEL)
        if t > T_REFRESH + 1.0 and not (T_MC <= t < T_MC + 0.8):
            ptext(img, "DONE", x0 + 60, y0 + 33, GREEN, 1)
        # трава і капібара
        d.rectangle([0, CAPY_XY[1], 64, CAPY_XY[1] + 3], fill=GRASS)
        for gx in range(2, 64, 5):
            d.line([gx, CAPY_XY[1], gx + 1, CAPY_XY[1] - 3], fill=GRASS)
        big(img, capy_cool, CAPY_XY[0], CAPY_XY[1], t, cool=cool)
        if T_REFRESH + 1.4 < t < S[2] or t > T_MC + 1.4:
            for j in range(3):                               # «Z Z Z»
                ph = (t * 0.8 + j / 3) % 1
                ptext(img, "Z", CAPY_XY[0] - 2 + int(ph * 18), CAPY_XY[1] - 64 - int(ph * 22), SILVER, 1)

    def frame(self, t) -> Image.Image:
        i = max(k for k, s0 in enumerate(S) if t >= s0)
        u = t - S[i]
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        for k in range(0, LH, 14):
            d.line([0, k, LW, k], fill=BG2)
        z, zc, cap = 1.0, None, None
        if i < 3:
            wrecked = clamp((t - T_REF) / 0.35) if t >= T_REF else 0.0
            self.npc_panel(img, t, wrecked)
            d.rectangle([0, SPLIT - 1, LW, SPLIT + 1], fill=STEEL)
            self.mc_panel(img, t, cool=t >= T_MC + 0.3)
        if i == 0:                                           # гачок поверх обох панелей
            p = pop(u / 0.35)
            d.rectangle([0, SPLIT - 16, LW, SPLIT + 16], fill=DARK)
            ptext_c(img, "NPC VS", SPLIT - 13, WHITE, 2)
            ptext_c(img, "MAIN CHARACTER", SPLIT + 3, GREEN if p >= 1 else WHITE, 2)
            if u > 0.6:
                d.rectangle([0, 84, LW, 106], fill=DARK)
                ptext_c(img, "MONDAY REPORT", 89, RUBY_L, 2)
        elif i == 2:
            # Data Boss вистрибує на межі панелей
            bu = t - T_ASK
            by = SPLIT - 2 + int((1 - min(1.0, pop(bu / 0.35))) * 60)
            bx = 152 + int(ease((t - T_MC - 0.5) / 0.4) * 60)
            boss(img, bx, by, t, talk=abs(math.sin(t * 14)) if bu < 1.2 else 0.0, sus=0.7)
            if 0.25 < bu < 2.0:
                bubble(img, "ADD LAST WEEK TOO?", 122, by - 60)
            if T_REF <= t < T_REF + 0.45:
                z = 1.0 + 0.7 * math.sin(clamp((t - T_REF) / 0.45) * math.pi)
                zc = (CAT_XY[0] + 10, CAT_XY[1] - 20)
            if t >= T_REF + 0.15 and t < T_MC:
                cap = ("NPC MOVE", RUBY_L, 96)
            if T_MC + 0.3 <= t < T_MC + 0.75:
                z = 1.0 + 0.7 * math.sin(clamp((t - T_MC - 0.3) / 0.45) * math.pi)
                zc = (CAPY_XY[0] + 20, CAPY_XY[1] - 30)
            if t >= T_MC + 0.45:
                cap = ("MC MOVE", GREEN, SPLIT + 6)
        elif i == 3:
            capy_face(img, LW // 2, 240, t, blink=(t % 2.9) < 0.1, mouth=0.4)
            shades(img, LW // 2, 240)
            ptext_c(img, "NPC OR", 96, WHITE, 2)
            ptext_c(img, "MAIN CHARACTER?", 114, GREEN, 2)
            ptext_c(img, "WHO ARE YOU ON MONDAYS?", 138, SILVER, 1)
            ptext_c(img, "COMMENT NPC OR MC", 296, RUBY_L, 1)
        if zc:
            img = zoom(img, z, zc[0], zc[1])
        if cap:
            ImageDraw.Draw(img).rectangle([0, cap[2] - 4, LW, cap[2] + (14 if len(cap[0]) < 15 else 7) + 4], fill=DARK)
            ptext_c(img, cap[0], cap[2], cap[1], 2 if len(cap[0]) < 15 else 1)
        full = img.resize((W, H), Image.NEAREST)
        if i < 3:
            full.paste(self.lock, (56, 92), self.lock)
        else:
            k = ease(u / 0.5)
            full.paste(self.logo, (W // 2 - self.logo.width // 2, int(330 - (1 - k) * 40)), self.logo)
            url = Image.new("RGBA", (LW, 12), (0, 0, 0, 0))
            ptext(url, "BELYAKOVCONSULT.COM", int(LW / 2 - text_w("BELYAKOVCONSULT.COM") / 2), 2, SILVER)
            up_ = url.resize((W, 72), Image.NEAREST)
            full.paste(up_, (0, 1020), up_)
        if any(0 <= t - s0 < 0.05 for s0 in S[1:]) or any(0 <= t - x < 0.06 for x in (T_REF, T_MC + 0.3)):
            full = Image.blend(full, Image.new("RGB", full.size, WHITE), 0.2)
        return full

    def poster(self):
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        for k in range(0, LH, 14):
            d.line([0, k, LW, k], fill=BG2)
        self.npc_panel(img, 8.0)
        d.rectangle([0, SPLIT - 1, LW, SPLIT + 1], fill=STEEL)
        self.mc_panel(img, 8.0, cool=True)
        d.rectangle([0, SPLIT - 16, LW, SPLIT + 16], fill=DARK)
        ptext_c(img, "NPC VS", SPLIT - 13, WHITE, 2)
        ptext_c(img, "MAIN CHARACTER", SPLIT + 3, GREEN, 2)
        full = img.resize((W, H), Image.NEAREST)
        full.paste(self.lock, (56, 92), self.lock)
        return full


# ---------------------------------------------------------------- звук
def key_click(seed=0):
    n = int(SR * 0.04)
    t = np.arange(n) / SR
    rng = np.random.default_rng(seed)
    return rng.standard_normal(n) * np.exp(-t * 160) * 0.5


def soundtrack(path: Path):
    m = Mix(TOTAL)
    m.put(vine_boom(), 0.05, 1.2)                          # гачок
    for k in range(int(S[1] / BEAT) + 1):
        m.put(tri(midi(45), 0.15), k * BEAT, 0.3)
    groove(m, S[1], S[2] - 0.1, ["Am", "F", "C", "G"], BEAT, arp=False, seed=7)
    k = 0
    while S[1] + k * PASTE < S[2]:                         # CTRL+C / CTRL+V
        at = S[1] + k * PASTE
        m.put(key_click(k), at, 0.6)
        m.put(key_click(k + 50), at + 0.06, 0.5)
        m.put(blip(1200 if k % 2 else 900, 1100 if k % 2 else 800, 0.04, 0.4), at + 0.1, 0.18)
        k += 1
    m.put(blip(700, 1400, 0.12, 0.6), T_REFRESH, 0.4)       # REFRESH
    for j in range(8):
        m.put(blip(600 + j * 90, 700 + j * 90, 0.05, 0.5), T_REFRESH + 0.2 + j * 0.08, 0.2)
    m.put(sfx_pop(seed=3), T_ASK + 0.1, 0.6)               # Data Boss
    m.put(vine_boom(), T_REF, 1.6)
    for j in range(6):
        m.put(blip(900 - j * 110, 700 - j * 110, 0.06, 0.5), T_REF + 0.2 + j * 0.07, 0.22)
    m.put(blip(700, 1400, 0.12, 0.6), T_MC, 0.4)
    m.put(vine_boom(), T_MC + 0.3, 1.4)
    groove(m, T_MC + 0.6, TOTAL - 0.3, ["C", "G", "Am", "F"], BEAT, arp=True, seed=5)
    for j in range(int((TOTAL - S[3]) / BEAT)):
        m.put(hat(j), S[3] + j * BEAT + BEAT / 2, 0.1)
    for j, note in enumerate([72, 76, 79, 84]):
        m.put(sq(midi(note), 0.14, decay=4), S[3] + 0.1 + j * 0.12, 0.13)
    m.put(kick(), S[3], 0.8)
    music = m.x / max(1e-9, np.abs(m.x).max()) * 0.85
    n = int(TOTAL * SR)
    mix = music[:n]
    mix[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))
    st = np.stack([mix, mix], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


def render(out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    v = Npc()
    wav = out_dir / "npc.wav"
    soundtrack(wav)
    v.poster().save(out_dir / "npc-vs-main-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "npc-vs-main-9x16.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", str(mp4)]
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
    return mp4


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[2] == "--frames":
        out = Path(sys.argv[1])
        out.mkdir(parents=True, exist_ok=True)
        v = Npc()
        for tt in [float(x) for x in sys.argv[3:]]:
            v.frame(tt).resize((W // 3, H // 3)).save(out / f"f{tt:05.2f}.png")
    else:
        print(render(Path(sys.argv[1])))
