"""Піксель-арт фан-ролик «Jan 2 or Feb 1?» (22 с, англійською, 9:16).

Тема з якості даних: та сама дата 01/02/2026 з різних джерел потрапляє у звіт різними місяцями, бо джерела
пишуть дату по-різному (день/місяць чи місяць/день). Усі дати й джерела умовні.
Власні персонажі: капібара-аналітик із мандаринкою, два коти з лупами, робот Dupe Muncher.
Сюжет: питання «JAN 2? FEB 1?» → конвеєр несе дати з трьох умовних джерел у звіт → у січні раптовий сплеск
→ капібара штампує всі дати в один формат 2026-02-01, коти перевіряють, сплеск зникає → висновок
«ONE FORMAT AT THE POINT OF ENTRY» → питання до аудиторії «WHICH DATE FORMAT BROKE YOUR REPORT?».

Запуск: python scripts/make_dates.py <папка>
"""
from __future__ import annotations

import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
from make_fun import SR, Mix, crash, groove, kick, melody, midi, sq  # noqa: E402
from make_pixel import (BG, BG2, CAT1, CAT1_D, CAT2, CAT2_D, DARK, GREY_D, LH, LW, RUBY, RUBY_D, RUBY_L,  # noqa: E402
                        SILVER, STEEL, WHITE, big, blip, capybara, cat, clamp, ease, muncher, pop, ptext, ptext_c,
                        text_w)
from make_shooter import bang  # noqa: E402

W, H = 1080, 1920
FPS = 30
TOTAL = 22.0
BEAT = 60 / 128
S = [0.0, 3.0, 8.6, 12.4, 16.4, 19.2]   # питання, конвеєр, сплеск, штамп, висновок, фінал
ORANGE = (255, 150, 30)

# (запис дати, умовне джерело, у який місяць потрапляє у звіті до виправлення)
BLOCKS = [("2026-02-01", "API", "FEB"), ("02/01/26", "US", "FEB"), ("01/02/2026", "EU", "JAN"),
          ("2026-02-01", "API", "FEB"), ("01/02/2026", "EU", "JAN"), ("02/01/26", "US", "FEB")]
SRC_COL = {"API": SILVER, "US": WHITE, "EU": ORANGE}
BELT_Y = 150
BOX_X = 150
SPEED = 95.0
ARRIVE = [S[1] + 1.4 + k * 0.72 for k in range(len(BLOCKS))]
STAMP = [S[3] + 0.5 + k * 0.42 for k in range(len(BLOCKS))]
BASE, UNIT = 288, 13
BAR_X = {"JAN": 56, "FEB": 124}


def block(img, x, y, text, src, hot=False, fixed=False):
    """Цеглинка з датою: x: лівий край, y: верх; кольорова мітка джерела зліва."""
    d = ImageDraw.Draw(img)
    w = text_w(text) + 12
    x, y = int(x), int(y)
    fill = RUBY if fixed else (RUBY_D if hot else BG2)
    d.rectangle([x, y + 2, x + w, y + 14], fill=DARK)
    d.rectangle([x, y, x + w, y + 12], fill=fill, outline=WHITE if fixed else STEEL)
    d.rectangle([x + 2, y + 3, x + 4, y + 9], fill=WHITE if fixed else SRC_COL[src])
    ptext(img, text, x + 8, y + 3, WHITE, 1, shadow=False)
    return w


def belt(img, t, moving=True):
    d = ImageDraw.Draw(img)
    d.rectangle([0, BELT_Y + 14, BOX_X + 4, BELT_Y + 20], fill=STEEL)
    off = int(t * SPEED) % 8 if moving else 0
    for k in range(-8, BOX_X + 8, 8):
        d.rectangle([k + off, BELT_Y + 15, k + off + 3, BELT_Y + 16], fill=SILVER)
    for k in range(6, BOX_X, 24):
        d.ellipse([k - 3, BELT_Y + 18, k + 3, BELT_Y + 24], fill=GREY_D, outline=STEEL)


def report_box(img, t, shake=0):
    d = ImageDraw.Draw(img)
    x0 = BOX_X + int(math.sin(t * 60) * shake)
    d.rectangle([x0, BELT_Y - 22, LW - 4, BELT_Y + 24], fill=GREY_D, outline=SILVER)
    d.rectangle([x0 - 2, BELT_Y - 2, x0 + 2, BELT_Y + 14], fill=DARK)
    ptext(img, "BI", x0 + 6, BELT_Y - 16, WHITE, 2, shadow=False)


def chart(img, jan, feb, t, alarm=False):
    """Стовпчики «записів за місяць»: jan, feb: висота в цеглинках (можна дробову під час анімації)."""
    d = ImageDraw.Draw(img)
    d.line([20, BASE, LW - 20, BASE], fill=SILVER)
    for name, v in (("JAN", jan), ("FEB", feb)):
        x = BAR_X[name]
        h = int(round(v * UNIT))
        col = RUBY_L if (name == "JAN" and alarm and int(t * 6) % 2) else (RUBY if name == "FEB" else WHITE)
        if h > 0:
            d.rectangle([x - 14, BASE - h, x + 14, BASE - 1], fill=col)
            d.rectangle([x - 14, BASE - h, x + 14, BASE - h + 1], fill=WHITE)
        ptext_c(img, name, BASE + 5, SILVER, 1, cx=x)
        n = int(round(v))
        ptext_c(img, str(n), BASE - h - 10, WHITE, 1, cx=x)
    ptext(img, "ILLUSTRATIVE", LW - 4 - text_w("ILLUSTRATIVE"), BASE + 16, GREY_D, 1, shadow=False)


def counts(t):
    jan = feb = 0.0
    for k, (_, _, m) in enumerate(BLOCKS):
        g = ease((t - ARRIVE[k]) / 0.25)
        if m == "JAN":
            jan += g
        else:
            feb += g
    return jan, feb


class Dates:
    def __init__(self):
        self.lock = brand.lockup(46)
        self.logo = brand.logo(150)
        self.flash_t = S[1:] + STAMP

    def frame(self, t) -> Image.Image:
        i = max(k for k, s0 in enumerate(S) if t >= s0)
        u = t - S[i]
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        for k in range(0, LH, 24):
            d.line([0, k, LW, k], fill=BG2)
        for k in range(0, LW, 24):
            d.line([k, 0, k, LH], fill=BG2)

        if i == 0:                                              # гачок: яка це дата?
            s = pop(u / 0.4)
            ptext_c(img, "01/02", 34 + int((1 - s) * 10), WHITE, 4 if s > 0.6 else 3)
            ptext_c(img, "2026", 66 + int((1 - s) * 10), SILVER, 2)
            if u > 0.8:
                flip = int(u * 3) % 2
                ptext_c(img, "JAN 2?", 94, WHITE if flip else GREY_D, 2, cx=48)
                ptext_c(img, "FEB 1?", 94, RUBY_L if not flip else GREY_D, 2, cx=134)
            if u > 1.6:
                ptext_c(img, "SAME FILE. WHICH DAY?", 122, SILVER, 1)
            big(img, capybara, 90, 290, t, walk=False, face=1, glass=False)
            if int(u * 2.5) % 2:
                ptext(img, "?", 112, 168, RUBY_L, 3)
            cat(img, 22, 296, t, CAT1, CAT1_D, walk=False, face=1, glass=False)
            cat(img, 160, 296, t, CAT2, CAT2_D, walk=False, face=-1, glass=False)

        elif i in (1, 2):                                       # конвеєр і сплеск
            ptext_c(img, "3 SOURCES, 1 REPORT" if i == 1 else "SAME DAY.", 34, WHITE, 1 if i == 1 else 2)
            if i == 1:
                ptext(img, "API", 10, 52, SILVER, 1)
                ptext(img, "US", 46, 52, WHITE, 1)
                ptext(img, "EU", 76, 52, ORANGE, 1)
                ptext(img, "RECORDS PER MONTH", 10, 176, SILVER, 1)
            else:
                ptext_c(img, "TWO MONTHS.", 54, RUBY_L, 2)
            belt(img, t, moving=i == 1)
            for k, (txt, src, _) in enumerate(BLOCKS):
                x = BOX_X - text_w(txt) - 12 - (ARRIVE[k] - t) * SPEED
                if t < ARRIVE[k] and x > -80:
                    block(img, x, BELT_Y, txt, src)
            jan, feb = counts(t)
            report_box(img, t, shake=2 if any(0 <= t - a < 0.12 for a in ARRIVE) else 0)
            chart(img, jan, feb, t, alarm=i == 2)
            if i == 2:
                ptext(img, "!", BAR_X["JAN"] - 3, BASE - 2 * UNIT - 28, RUBY_L, 2)
                capybara(img, 40, 128, t, walk=False, face=1, sign="JAN OR FEB?", glass=False)
                muncher(img, 118, 128, t, mouth=0.2, face=1, sweat=True)

        elif i == 3:                                            # штамп: один формат
            ptext_c(img, "ONE FORMAT:", 34, WHITE, 2)
            ptext_c(img, "YYYY-MM-DD", 54, RUBY_L, 2)
            for k, (txt, src, _) in enumerate(BLOCKS):
                col, row = k % 2, k // 2
                x, y = 12 + col * 86, 84 + row * 22
                done = t >= STAMP[k]
                block(img, x, y, "2026-02-01" if done else txt, src, fixed=done)
                if done and t - STAMP[k] < 0.15:
                    d.rectangle([x - 2, y - 2, x + 76, y + 14], outline=WHITE)
            n_done = sum(1 for s0 in STAMP if t >= s0)
            k_now = min(n_done, len(BLOCKS) - 1)
            sx = 12 + (k_now % 2) * 86 + 34
            sy = 84 + (k_now // 2) * 22
            press = 1 - clamp(abs(t - STAMP[k_now]) / 0.15) if n_done < len(BLOCKS) else 0
            d.rectangle([sx - 6, sy - 16 + int(press * 10), sx + 6, sy - 10 + int(press * 10)], fill=RUBY)
            d.rectangle([sx - 2, sy - 24 + int(press * 10), sx + 2, sy - 16 + int(press * 10)], fill=ORANGE)
            g = ease((t - STAMP[-1] - 0.2) / 0.6)
            jan0, feb0 = counts(S[3])
            chart(img, jan0 * (1 - g), feb0 + jan0 * g, t)
            capybara(img, 34, 170, t, walk=False, face=1, glass=False)
            cat(img, 108, 170, t, CAT1, CAT1_D, walk=False, face=-1)
            cat(img, 150, 170, t + 0.3, CAT2, CAT2_D, walk=False, face=-1)
            if g > 0.5:
                ptext(img, "@", 102, 140, (110, 220, 130), 2)

        elif i == 4:                                            # висновок
            lines = [("SAME DATE,", WHITE, 2), ("DIFFERENT", RUBY_L, 2), ("MONTH.", RUBY_L, 2), ("", WHITE, 1),
                     ("AGREE ON ONE FORMAT", WHITE, 1), ("AT THE POINT OF ENTRY.", WHITE, 1),
                     ("LABEL EVERY SOURCE.", SILVER, 1)]
            y = 40
            for k, (s, c, kk) in enumerate(lines):
                if s and u > k * 0.3:
                    ptext_c(img, s, y, c, kk)
                y += 20 if kk == 2 else 12
            par = 84 + u * 22
            capybara(img, par, 270, t, face=1, glass=False)
            cat(img, par - 34, 270, t, CAT1, CAT1_D, face=1, glass=False)
            cat(img, par - 58, 270, t + 0.2, CAT2, CAT2_D, face=1, glass=False)
            muncher(img, par - 92, 270, t, mouth=abs(math.sin(t * 8)), face=1)
            block(img, 52, 196, "2026-02-01", "API", fixed=True)

        else:                                                   # фінал: питання до аудиторії
            ptext_c(img, "WHICH DATE FORMAT", 112, WHITE, 1)
            ptext_c(img, "BROKE YOUR", 126, WHITE, 2)
            ptext_c(img, "REPORT?", 146, RUBY_L, 2)
            ptext_c(img, "DD/MM OR MM/DD", 172, SILVER, 1)
            big(img, capybara, 90, 300, t, walk=False, face=1, glass=False)

        full = img.resize((W, H), Image.NEAREST)
        if i < 5:
            full.paste(self.lock, (56, 92), self.lock)
        else:
            k = ease(u / 0.5)
            full.paste(self.logo, (W // 2 - self.logo.width // 2, int(400 - (1 - k) * 40)), self.logo)
            if u > 0.8:
                url = Image.new("RGBA", (LW, 12), (0, 0, 0, 0))
                ptext(url, "BELYAKOVCONSULT.COM", int(LW / 2 - text_w("BELYAKOVCONSULT.COM") / 2), 2, SILVER)
                up = url.resize((W, 72), Image.NEAREST)
                full.paste(up, (0, 1260), up)
        if any(0 <= t - ft < 0.06 for ft in self.flash_t):
            full = Image.blend(full, Image.new("RGB", full.size, WHITE), 0.2)
        return full

    def poster(self):
        img = self.frame(S[2] + 1.0).resize((LW, LH), Image.NEAREST)
        d = ImageDraw.Draw(img)
        d.rectangle([0, 28, LW, 76], fill=BG)
        ptext_c(img, "JAN 2 OR", 32, WHITE, 2)
        ptext_c(img, "FEB 1?", 52, RUBY_L, 3)
        full = img.resize((W, H), Image.NEAREST)
        full.paste(self.lock, (56, 92), self.lock)
        return full


# ---------------------------------------------------------------- звук
def soundtrack(path: Path):
    m = Mix(TOTAL)
    hook = [(72, 1), (74, 1), (76, 2), (72, 1), (79, 1), (77, 2), (76, 1), (74, 1), (72, 2), (74, 4)]
    groove(m, S[1], S[2], ["Am", "F", "C", "G"], BEAT, arp=True, seed=4)
    melody(m, S[1], S[2], BEAT, hook * 2, gain=0.1)
    for k in range(int((S[3] - S[2]) / BEAT)):                 # сплеск: тривожний бас
        tt = S[2] + k * BEAT
        m.put(kick(), tt, 0.7)
        m.put(sq(midi(45 if k % 2 else 44), BEAT * 0.8, decay=5), tt, 0.14)
    groove(m, S[3], TOTAL - 0.4, ["C", "G", "Am", "F"], BEAT, arp=True, seed=7)
    melody(m, S[3], TOTAL - 0.6, BEAT, hook * 2, gain=0.1)
    m.put(crash(1), S[2], 0.35)
    m.put(crash(2), S[4], 0.3)
    music = m.x / max(1e-9, np.abs(m.x).max()) * 0.6
    fx = Mix(TOTAL)
    fx.put(blip(300, 1200, 0.25), 0.05, 0.7)
    for k in range(3):
        fx.put(blip(700, 500, 0.12), 0.9 + k * 0.33, 0.35)
    for a in ARRIVE:
        fx.put(blip(400, 900, 0.07), a, 0.5)
    fx.put(blip(900, 160, 0.5), S[2] + 0.05, 0.6)
    for k, s0 in enumerate(STAMP):
        fx.put(bang(k, 0.25), s0, 0.55)
    for k, note in enumerate([72, 76, 79, 84]):
        fx.put(sq(midi(note), 0.07, decay=6), STAMP[-1] + 0.4 + k * 0.06, 0.4)
    sfx = fx.x / max(1e-9, np.abs(fx.x).max()) * 0.8
    n = int(TOTAL * SR)
    mix = (music * 0.85 + sfx * 0.45)[:n]
    mix[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))
    mix /= max(1.0, np.abs(mix).max() / 0.95)
    st = np.stack([mix, mix], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


def render(out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    v = Dates()
    wav = out_dir / "dates.wav"
    soundtrack(wav)
    v.poster().save(out_dir / "dates-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "dates-9x16.mp4"
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
    print(render(Path(sys.argv[1])))
