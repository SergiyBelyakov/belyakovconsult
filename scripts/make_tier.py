"""Мем-ролик «Tier list: why your team trusts a wrong number» (EN, 9:16, ~18 с, піксель-арт).

Сім принципів впливу (за Р. Чалдіні, «Психологія впливу»: авторитет, соціальний доказ, послідовність,
симпатія, єдність, дефіцит, взаємність) як причини, чому команда вірить неправильному числу у звіті.
Капібара з мандаринкою розкладає картки по рядах S, A, B, C з ефектом «бум»; висновок: «Check the data, not
the vibe.» Питання наприкінці: «Which one got you?»

Запуск: python scripts/make_tier.py <папка>
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
import make_fun  # noqa: E402
import make_pixel  # noqa: E402
from make_fun import SR, Mix, crash, groove, kick, melody, midi, sq, tri  # noqa: E402
from make_pixel import (BG, BG2, CAP, CAP_D, DARK, GREY, GREY_D, LH, LW, RUBY, RUBY_D, RUBY_L, SILVER, STEEL, WHITE,  # noqa: E402
                        big, blip, capybara, clamp, ease, pop, ptext, ptext_c, text_w)

make_pixel.FONT["_"] = ["00000", "00000", "00000", "00000", "00000", "00000", "11111"]
make_fun.CH.setdefault("Em", (40, [59, 64, 67, 71]))
W, H = 1080, 1920
FPS = 30
BEAT = 60 / 128
TIERS = [("S", RUBY), ("A", (220, 110, 70)), ("B", (200, 170, 80)), ("C", (110, 150, 120))]
CARDS = [  # (принцип, приклад, ряд)
    ("AUTHORITY", "THE BOSS SAID IT'S UP", "S"),
    ("SOCIAL PROOF", "EVERYONE USES FINAL_V7.XLSX", "S"),
    ("CONSISTENCY", "WE REPORTED IT LAST MONTH", "A"),
    ("LIKING", "THE DASHBOARD IS SO PRETTY", "A"),
    ("UNITY", "IT'S OUR TEAM'S NUMBER", "B"),
    ("SCARCITY", "ONLY COPY. DON'T TOUCH.", "B"),
    ("RECIPROCITY", "IT FIXED MY REPORT, SO...", "C"),
]
T0 = 2.4                 # перша картка
STEP = 1.55              # на картку
T_END = T0 + STEP * len(CARDS)          # висновок
TOTAL = T_END + 6.2
ROW_Y = {t: 84 + k * 34 for k, (t, _) in enumerate(TIERS)}
ROW_H = 30


def card_slot(i):
    """Позиція картки в її ряду (x, y) після приземлення."""
    tier = CARDS[i][2]
    k = sum(1 for j in range(i) if CARDS[j][2] == tier)
    return 30 + k * 74, ROW_Y[tier] + 3


def draw_card(img, x, y, i, scale=1, hot=False):
    d = ImageDraw.Draw(img)
    name = CARDS[i][0]
    w, h = 70, 24
    d.rectangle([x, y, x + w, y + h], fill=WHITE if hot else (34, 38, 50), outline=RUBY_L if hot else SILVER)
    ptext(img, name, x + (w - text_w(name)) // 2, y + 4, RUBY if hot else WHITE, 1, shadow=False)
    # маленька піктограма принципу
    ic = [(240, 190, 80), (120, 200, 230), (200, 200, 200), (255, 140, 160), (120, 200, 150), (255, 150, 30), (190, 150, 255)][i]
    for k in range(3):
        d.rectangle([x + 22 + k * 10, y + 15, x + 27 + k * 10, y + 19], fill=ic)


class Tier:
    def __init__(self):
        self.lock = brand.lockup(46)
        self.logo = brand.logo(150)

    def frame(self, t):
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        for k in range(0, LH, 14):
            d.line([0, k, LW, k], fill=BG2)
        if t < TOTAL - 4.2:
            # заголовок
            ptext_c(img, "TIER LIST:", 34, RUBY_L, 2)
            ptext_c(img, "WHY YOUR TEAM TRUSTS", 54, WHITE, 1)
            ptext_c(img, "A WRONG NUMBER", 66, WHITE, 1)
            # ряди
            for tier, col in TIERS:
                y = ROW_Y[tier]
                d.rectangle([4, y, 24, y + ROW_H], fill=col)
                ptext(img, tier, 9, y + 9, DARK, 2, shadow=False)
                d.rectangle([26, y, LW - 4, y + ROW_H], fill=(22, 25, 33), outline=GREY_D)
            cur = int((t - T0) // STEP) if t >= T0 else -1
            for i in range(len(CARDS)):
                ts = T0 + i * STEP
                if t < ts:
                    continue
                u = t - ts
                sx, sy = card_slot(i)
                if u < 0.9 and i == cur:                 # картка в руках у капібари, потім летить у ряд
                    hx, hy = 56, 236
                    k = ease((u - 0.55) / 0.3) if u > 0.55 else 0.0
                    x = hx + (sx - hx) * k
                    y = hy + (sy - hy) * k - math.sin(k * math.pi) * 20
                    draw_card(img, int(x), int(y), i, hot=True)
                else:
                    draw_card(img, sx, sy, i, hot=(i == cur and u < 1.2))
            # капібара коментує
            big(img, capybara, 128, 290, t, walk=False, face=-1, glass=t > T_END)
            if 0 <= cur < len(CARDS) and t < T_END:
                u = t - (T0 + cur * STEP)
                line = CARDS[cur][1]
                w = text_w(line) + 10
                x0 = max(3, LW - w - 6)
                d.rectangle([x0, 214, x0 + w, 230], fill=WHITE, outline=DARK)
                d.polygon([(x0 + w - 30, 230), (x0 + w - 22, 230), (x0 + w - 28, 237)], fill=WHITE)
                ptext(img, line, x0 + 5, 219, DARK, 1, shadow=False)
            if t < T0:
                ptext_c(img, "7 WEAPONS OF INFLUENCE", 226, SILVER, 1)
            if T_END <= t:
                u = t - T_END
                d.rectangle([0, 200, LW, 236], fill=DARK)
                if u > 0.1:
                    ptext_c(img, "CHECK THE DATA,", 204, WHITE, 2)
                if u > 0.6:
                    ptext_c(img, "NOT THE VIBE.", 220, RUBY_L, 2)
        else:
            u = t - (TOTAL - 4.2)
            ptext_c(img, "WHICH ONE", 122, WHITE, 3)
            ptext_c(img, "GOT YOU?", 146, RUBY_L, 3)
            ptext_c(img, "COMMENT S, A, B OR C", 174, SILVER, 1)
            big(img, capybara, 90, 280, t, walk=False, face=1)
        # «бум»: зум-удар у момент приземлення картки
        zoom = 1.0
        for i in range(len(CARDS)):
            land = T0 + i * STEP + 0.85
            if 0 <= t - land < 0.12:
                zoom = 1.05
        if 0 <= t - T_END < 0.15:
            zoom = 1.08
        if zoom > 1:
            w_, h_ = LW / zoom, LH / zoom
            x0, y0 = int((LW - w_) / 2), int((LH - h_) / 2)
            img = img.crop((x0, y0, x0 + int(w_), y0 + int(h_))).resize((LW, LH), Image.NEAREST)
        full = img.resize((W, H), Image.NEAREST)
        if t < TOTAL - 4.2:
            full.paste(self.lock, (56, 92), self.lock)
        else:
            k = ease(u / 0.5)
            full.paste(self.logo, (W // 2 - self.logo.width // 2, int(380 - (1 - k) * 40)), self.logo)
            url = Image.new("RGBA", (LW, 12), (0, 0, 0, 0))
            ptext(url, "BELYAKOVCONSULT.COM", int(LW / 2 - text_w("BELYAKOVCONSULT.COM") / 2), 2, SILVER)
            up = url.resize((W, 72), Image.NEAREST)
            full.paste(up, (0, 1150), up)
        return full

    def poster(self):
        f = self.frame(T0 + STEP * 5 + 1.0)
        return f


def boom(dur=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t * 3) + 40
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    x += 0.3 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * np.exp(-t * 8)
    return x


def soundtrack(path: Path):
    m = Mix(TOTAL)
    hook = [(76, 1), (79, 1), (81, 1), (79, 1), (76, 2), (74, 2), (72, 1), (74, 1), (76, 2), (79, 4)]
    groove(m, 0.0, T_END, ["Am", "F", "C", "G"], BEAT, arp=True, seed=11)
    melody(m, 0.2, T_END, BEAT, hook * 3, gain=0.1)
    for i in range(len(CARDS)):
        m.put(boom(), T0 + i * STEP + 0.85, 0.8)
        m.put(blip(400, 1400, 0.12), T0 + i * STEP + 0.55, 0.3)
    m.put(boom(0.9), T_END, 1.0)
    m.put(crash(2), T_END, 0.3)
    groove(m, T_END + 0.6, TOTAL - 0.3, ["C", "G", "Am", "F"], BEAT, arp=True, seed=4)
    for k, note in enumerate([72, 76, 79, 84]):
        m.put(sq(midi(note), 0.16, decay=4), TOTAL - 4.0 + k * 0.12, 0.13)
    x = m.x / max(1e-9, np.abs(m.x).max()) * 0.85
    n = int(TOTAL * SR)
    x = x[:n]
    x[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))
    st = np.stack([x, x], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


def render(out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    v = Tier()
    wav = out_dir / "tier.wav"
    soundtrack(wav)
    v.poster().save(out_dir / "tier-list-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "tier-list-9x16.mp4"
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
