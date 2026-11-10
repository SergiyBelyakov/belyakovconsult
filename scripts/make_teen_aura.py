"""Мем-ролик дня TEEN «Aura check: whose file is final?» (16 с, англійською, 9:16, піксель-арт).

Формат «лічильник аури»: капібара з мандаринкою стартує з +1000 аури. Кожен персонаж надсилає у спільну папку ще
один «фінальний» файл (FINAL, FINAL_V2, FINAL_FINAL, FINAL_USE_THIS), кожен раз «vine boom», драматичний зум на
капібару і мінус аура. Розв'язка: робот Dupe Muncher з'їдає зайві копії, лишається один файл за одним посиланням,
капібара в піксельних окулярах, аура +9999 (жартівливе число, не дані). Фінал: питання до глядача й логотип.
Персонажі лише власні: капібара, коти, Data Boss, Laser Kitty, Dupe Muncher. Звук синтезовано в коді.

Запуск: python scripts/make_teen_aura.py <папка>
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
import make_pixel  # noqa: E402
from make_67 import capy_face  # noqa: E402
from make_boss import boss  # noqa: E402
from make_fun import SR, Mix, groove, hat, kick, midi, noise, sfx_crack, sfx_pop, sq, tri  # noqa: E402
from make_pixel import (BG, BG2, CAT1, CAT1_D, CAT2, CAT2_D, DARK, LH, LW, RUBY, RUBY_D, RUBY_L, SILVER, STEEL,  # noqa: E402
                        WHITE, big, blip, cat, clamp, ease, muncher, pop, ptext, ptext_c, text_w)
from make_shooter import kitty  # noqa: E402

make_pixel.FONT["_"] = ["00000", "00000", "00000", "00000", "00000", "00000", "11111"]
W, H = 1080, 1920
FPS = 30
TOTAL = 16.0
BEAT = 60 / 120
S = [0.0, 1.8, 9.6, 13.0]                       # гачок, «фінальні» файли, розв'язка, фінал
DROPS = [2.0, 3.9, 5.8, 7.7]                    # моменти, коли падає новий файл
FILES = ["REPORT_FINAL.XLSX", "REPORT_FINAL_V2.XLSX", "REPORT_FINAL_FINAL.XLSX", "FINAL_USE_THIS.XLSX"]
HITS = [-100, -250, -500, -1000]
START_AURA = 1000
WIN_AURA = 9999
GREEN = (110, 220, 130)
FACE = (48, 262)                                # капібара (низ-ліворуч), полотно 180×320
SENDER = (132, 300)                             # де з'являється відправник
FOLDER = (8, 60, 172, 122)                      # панель «спільна папка»


def aura_at(t):
    """Аура на момент t: стартова мінус удари; у розв'язці плавно росте до +9999."""
    a = START_AURA + sum(h for d, h in zip(DROPS, HITS) if t >= d + 0.15)
    if t >= S[2] + 1.6:
        k = ease((t - S[2] - 1.6) / 1.0)
        a = int(a + (WIN_AURA - a) * k)
    return a


def shades(img, cx, cy):
    """Піксельні окуляри «головного героя» на capy_face (ті самі координати очей)."""
    d = ImageDraw.Draw(img)
    for s in (-1, 1):
        ex, ey = cx + s * 20, cy - 18
        d.rectangle([ex - 8, ey - 4, ex + 8, ey + 3], fill=DARK)
        d.rectangle([ex - 6, ey - 3, ex - 3, ey - 2], fill=STEEL)
    d.rectangle([cx - 12, cy - 21, cx + 12, cy - 19], fill=DARK)


def file_row(img, x, y, name, col=WHITE, strike=0.0):
    d = ImageDraw.Draw(img)
    d.rectangle([x, y, x + 6, y + 8], fill=(40, 150, 90))           # іконка таблиці
    d.rectangle([x + 1, y + 2, x + 5, y + 2], fill=WHITE)
    d.rectangle([x + 1, y + 5, x + 5, y + 5], fill=WHITE)
    ptext(img, name, x + 10, y + 1, col, 1)
    if strike > 0:
        w = int((text_w(name) + 10) * clamp(strike))
        d.rectangle([x, y + 4, x + w, y + 4], fill=RUBY_L)


def bubble(img, text, x, y):
    d = ImageDraw.Draw(img)
    w = text_w(text) + 8
    x = int(clamp(x, w / 2 + 2, LW - w / 2 - 2))
    d.rectangle([x - w // 2, y - 14, x + w // 2, y], fill=WHITE, outline=RUBY)
    d.polygon([(x + 4, y), (x + 10, y), (x + 8, y + 5)], fill=WHITE)
    ptext(img, text, x - w // 2 + 4, y - 11, RUBY, 1, shadow=False)


def sender(img, k, x, y, t):
    if k == 0:
        big(img, cat, x, y, t, CAT1, CAT1_D, walk=False, face=-1, glass=False)
    elif k == 1:
        big(img, cat, x, y, t, CAT2, CAT2_D, walk=False, face=-1, glass=False)
    elif k == 2:
        boss(img, x, y - 4, t, talk=abs(math.sin(t * 14)), sus=0.6)
    else:
        big(img, kitty, x, y - 8, t, eyes_on=int(t * 6) % 2 == 0)


def zoom(img, z, cx, cy):
    if z <= 1.0:
        return img
    w_, h_ = LW / z, LH / z
    x0 = int(clamp(cx - w_ / 2, 0, LW - w_))
    y0 = int(clamp(cy - h_ / 2, 0, LH - h_))
    return img.crop((x0, y0, x0 + int(w_), y0 + int(h_))).resize((LW, LH), Image.NEAREST)


class Aura:
    def __init__(self):
        self.lock = brand.lockup(46)
        self.logo = brand.logo(150)

    def meter(self, img, t, shake=0):
        a = aura_at(t)
        txt = f"AURA: {a:+d}"
        col = GREEN if a > 0 else RUBY_L
        ptext_c(img, txt, 34 + shake, col, 2, cx=LW // 2 + shake)
        # шкала
        d = ImageDraw.Draw(img)
        d.rectangle([20, 52, LW - 20, 55], fill=BG2, outline=STEEL)
        frac = clamp((a + 1000) / 3000)
        d.rectangle([21, 53, 21 + int((LW - 42) * frac), 54], fill=col)

    def folder(self, img, t, eaten=None):
        x0, y0, x1, y1 = FOLDER
        d = ImageDraw.Draw(img)
        d.rectangle([x0, y0, x1, y1], fill=(17, 22, 31), outline=STEEL)
        d.rectangle([x0, y0, x0 + 40, y0 + 8], fill=STEEL)
        ptext(img, "SHARED", x0 + 3, y0 + 1, WHITE, 1, shadow=False)
        rows = [k for k, dt in enumerate(DROPS) if t >= dt]
        for k in rows:
            ry = y0 + 12 + k * 12
            slide = ease((t - DROPS[k]) / 0.25)
            x = int(x0 + 4 + (1 - slide) * 140)
            if eaten is not None and k in eaten:
                e = eaten[k]
                if e >= 1:
                    continue
                file_row(img, x, ry, FILES[k], SILVER, strike=e * 2)
            else:
                file_row(img, x, ry, FILES[k], WHITE if k < len(rows) - 1 else RUBY_L)

    def frame(self, t) -> Image.Image:
        i = max(k for k, s0 in enumerate(S) if t >= s0)
        u = t - S[i]
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        for k in range(0, LH, 14):
            d.line([0, k, LW, k], fill=BG2)
        blink = (t % 2.9) < 0.1
        z, zc, shake, hit = 1.0, FACE, 0, None
        if i == 0:
            self.meter(img, t)
            ptext_c(img, "AURA", 66, WHITE, 3)
            ptext_c(img, "CHECK", 90, WHITE, 3)
            ptext_c(img, "WHOSE FILE IS", 122, SILVER, 2)
            ptext_c(img, "FINAL?", 140, RUBY_L, 2)
            capy_face(img, LW // 2, 244, t, blink=blink, mouth=0.2)
            ptext_c(img, "+1000 MAIN CHARACTER", 290, GREEN, 1)
        elif i == 1:
            k = max([n for n, dt in enumerate(DROPS) if t >= dt], default=-1)
            du = t - DROPS[k] if k >= 0 else 9
            shake = int(math.sin(t * 90) * 2) if 0 <= du < 0.25 else 0
            self.meter(img, t, shake)
            self.folder(img, t)
            sq_ = 0.25 * (k + 1)
            capy_face(img, *FACE, t, blink=blink and k < 0, squint=sq_, mouth=0.0)
            if k >= 0:
                # відправник вистрибує і кричить
                p = pop(du / 0.3)
                sender(img, k, SENDER[0] + int((1 - min(1, p)) * 50), SENDER[1], t)
                if du > 0.2:
                    bubble(img, "IT'S FINAL!!" if k < 3 else "NO, THIS ONE!", SENDER[0], 214 if k == 2 else 226)
                # мінус аура вилітає
                if 0.15 < du < 1.4:
                    hit = (f"{HITS[k]} AURA", 134 - int((du - 0.15) * 6))
                if 0.15 <= du < 0.55:                 # драматичний зум на обличчя
                    z = 1.0 + 0.6 * math.sin(clamp((du - 0.15) / 0.4) * math.pi)
            else:
                ptext_c(img, "SEND THE REPORT", 140, SILVER, 1)
        elif i == 2:
            self.meter(img, t)
            eaten = {k: clamp((u - 0.2 - j * 0.35) / 0.3) for j, k in enumerate([3, 2, 0])}
            self.folder(img, t, eaten)
            mx = 190 - u * 150
            if u < 1.5:
                muncher(img, mx, 128, t, mouth=abs(math.sin(t * 20)), face=-1)
            left = u > 1.4
            if left:                                       # лишається один файл: тег «одне посилання»
                ptext(img, "ONE FILE. ONE LINK.", 22, 100, GREEN, 1)
                ptext(img, "VERSION HISTORY ON.", 22, 110, SILVER, 1)
            capy_face(img, *FACE, t, blink=blink, mouth=0.3 if u > 1.6 else 0.0)
            if u > 1.5:
                drop = int((1 - ease((u - 1.5) / 0.4)) * 30)
                shades(img, FACE[0], FACE[1] - drop)
                ptext(img, "MAIN", 104, 228, GREEN, 2)
                ptext(img, "CHARACTER", 104, 246, GREEN, 1)
                ptext(img, "MOVE", 104, 258, GREEN, 2)
            if 1.5 <= u < 1.9:
                z = 1.0 + 0.6 * math.sin(clamp((u - 1.5) / 0.4) * math.pi)
        else:
            capy_face(img, LW // 2, 254, t, blink=blink, mouth=0.4)
            shades(img, LW // 2, 254)
            ptext_c(img, "HOW MANY", 112, WHITE, 2)
            ptext_c(img, "\"FINAL\" FILES", 130, RUBY_L, 2)
            ptext_c(img, "ARE IN YOUR FOLDER?", 152, WHITE, 1)
            ptext_c(img, "DROP THE NUMBER", 302, SILVER, 1)
        img = zoom(img, z, zc[0], zc[1] - 40)
        if hit:                                            # мінус аура поверх зуму, щоб не обрізалася
            ptext_c(img, hit[0], hit[1], RUBY_L, 2)
        full = img.resize((W, H), Image.NEAREST)
        if i < 3:
            full.paste(self.lock, (56, 92), self.lock)
        else:
            k = ease(u / 0.5)
            full.paste(self.logo, (W // 2 - self.logo.width // 2, int(380 - (1 - k) * 40)), self.logo)
            url = Image.new("RGBA", (LW, 12), (0, 0, 0, 0))
            ptext(url, "BELYAKOVCONSULT.COM", int(LW / 2 - text_w("BELYAKOVCONSULT.COM") / 2), 2, SILVER)
            up_ = url.resize((W, 72), Image.NEAREST)
            full.paste(up_, (0, 990), up_)
        if any(0 <= t - s0 < 0.05 for s0 in S[1:]) or any(0.15 <= t - dt < 0.2 for dt in DROPS):
            full = Image.blend(full, Image.new("RGB", full.size, WHITE), 0.18)
        return full

    def poster(self):
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        for k in range(0, LH, 14):
            d.line([0, k, LW, k], fill=BG2)
        ptext_c(img, "AURA: -850", 34, RUBY_L, 2)
        self.folder(img, 9.0)
        capy_face(img, *FACE, 0.0, squint=1.0)
        boss(img, SENDER[0], SENDER[1] - 4, 0.3, talk=1.0, sus=0.6)
        bubble(img, "IT'S FINAL!!", SENDER[0], 214)
        ptext_c(img, "AURA CHECK", 140, WHITE, 2)
        full = img.resize((W, H), Image.NEAREST)
        full.paste(self.lock, (56, 92), self.lock)
        return full


# ---------------------------------------------------------------- звук
def vine_boom(dur=1.1):
    """Власний синтез «бум»: низький синус із падінням висоти, перевантаження і хвіст."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = 38 + 70 * np.exp(-t * 9)
    ph = np.cumsum(f) / SR
    x = np.sin(2 * np.pi * ph) * np.exp(-t * 3.2)
    x += 0.35 * np.sin(4 * np.pi * ph) * np.exp(-t * 6)
    click = noise(n, 7) * np.exp(-t * 120) * 0.6
    y = np.tanh((x + click) * 2.6)
    tail = np.convolve(y, np.exp(-np.arange(int(SR * 0.08)) / (SR * 0.02)), mode="full")[:n] * 0.04
    return (y + tail) * np.minimum(1, np.arange(n) / 40)


def soundtrack(path: Path):
    m = Mix(TOTAL)
    for k in range(int(S[1] / BEAT) + 1):                 # гачок: легкий пульс
        m.put(tri(midi(45), 0.15), k * BEAT, 0.35)
        m.put(hat(k), k * BEAT + BEAT / 2, 0.12)
    groove(m, S[1], S[2] - 0.2, ["Am", "F", "C", "G"], BEAT, arp=False, seed=3)
    for k, dt in enumerate(DROPS):
        m.put(sfx_pop(seed=k), dt, 0.5)
        m.put(vine_boom(), dt + 0.15, 1.6)
        for j in range(5):                               # «падіння» лічильника
            m.put(blip(900 - j * 120, 700 - j * 120, 0.05, 0.5), dt + 0.25 + j * 0.06, 0.25)
    # розв'язка: хрум-хрум робота, «дзинь», лічильник угору, фінальний джингл
    for j in range(3):
        m.put(sfx_crack(seed=j + 2), S[2] + 0.35 + j * 0.35, 0.8)
        m.put(sfx_crack(seed=j + 9), S[2] + 0.45 + j * 0.35, 0.6)
    m.put(vine_boom(), S[2] + 1.5, 1.3)
    for j in range(14):
        m.put(blip(600 + j * 80, 800 + j * 80, 0.05, 0.5), S[2] + 1.6 + j * 0.07, 0.22)
    groove(m, S[2] + 1.8, TOTAL - 0.3, ["C", "G", "Am", "F"], BEAT, arp=True, seed=5)
    for k, note in enumerate([72, 76, 79, 84]):
        m.put(sq(midi(note), 0.14, decay=4), S[3] + 0.1 + k * 0.12, 0.13)
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
    v = Aura()
    wav = out_dir / "aura.wav"
    soundtrack(wav)
    v.poster().save(out_dir / "aura-check-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "aura-check-9x16.mp4"
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
