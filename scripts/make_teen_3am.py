"""Мем-ролик дня TEEN «nobody: / my CRM at 3am:» (16 с, англійською, 9:16, піксель-арт).

Формат «nobody: / me:» + «bro really…»: ніч, капібара з мандаринкою і кіт сплять, а таблиця клієнтів сама себе
клонує: JOHN SMITH, JOHN  SMITH, J. SMITH, JON SMITH… щоразу швидше. На дев'ятій копії «vine boom», капібара
прокидається, драматичний зум, напис «BRO REALLY MADE 9 OF HIMSELF». Розв'язка: робот Dupe Muncher з'їдає копії,
лишається один клієнт з одним ID, капібара в окулярах спить далі. Фінал: питання до глядача й логотип.
Ім'я в таблиці умовне, кількість копій лише в ролику (не дані). Персонажі власні. Звук синтезовано в коді.

Запуск: python scripts/make_teen_3am.py <папка>
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
from make_67 import capy_face  # noqa: E402
from make_fun import SR, Mix, groove, hat, kick, midi, sfx_crack, sfx_pop, sq, tri  # noqa: E402
from make_pixel import (BG, BG2, CAT2, CAT2_D, DARK, LH, LW, RUBY_L, SILVER, STEEL, WHITE,  # noqa: E402
                        big, blip, cat, clamp, ease, muncher, pop, ptext, ptext_c, text_w)
from make_teen_aura import shades, vine_boom, zoom  # noqa: E402

W, H = 1080, 1920
FPS = 30
TOTAL = 16.0
BEAT = 60 / 100
S = [0.0, 2.2, 9.0, 12.6]                      # гачок, клонування, розв'язка, фінал
NAMES = ["JOHN SMITH", "JOHN SMITH", "JOHN  SMITH", "J. SMITH", "JON SMITH",
         "JOHN SMITH 2", "SMITH JOHN", "JOHN SMITH!!", "JOHN SMITH."]
SPAWN = [2.4, 3.5, 4.4, 5.1, 5.7, 6.2, 6.6, 6.95, 7.25]
BOOM = 7.5                                      # капібара прокидається
SHADES = 11.0                                   # окуляри і назад спати
GREEN = (110, 220, 130)
NIGHT = (8, 10, 22)
MOON = (236, 230, 190)
FACE = (58, 270)                                # капібара, полотно 180×320
TABLE = (8, 74, 172, 182)
ROW0, ROWH = 88, 10
EAT_ORDER = [8, 7, 6, 5, 4, 3, 2, 1]            # робот їсть знизу вгору, лишається рядок 0


def night(img, t):
    d = ImageDraw.Draw(img)
    for k in range(0, LH, 14):
        d.line([0, k, LW, k], fill=BG2)
    for k, (x, y) in enumerate([(14, 24), (40, 64), (120, 30), (166, 70), (96, 196), (20, 214), (170, 206)]):
        if int(t * 3 + k) % 4:
            d.point((x, y), fill=SILVER)
    d.ellipse([150, 22, 170, 42], fill=MOON)                     # місяць-серпик
    d.ellipse([144, 18, 164, 38], fill=BG)


def zzz(img, x, y, t, on=True):
    if not on:
        return
    for k in range(3):
        u = (t * 0.7 + k / 3) % 1
        ptext(img, "Z", int(x + u * 14 + math.sin(u * 6) * 2), int(y - u * 26), SILVER if u < 0.7 else STEEL, 1 + (k == 1))


def row(img, y, name, col, strike=0.0):
    d = ImageDraw.Draw(img)
    x0 = TABLE[0] + 4
    d.rectangle([x0, y, x0 + 6, y + 7], fill=(40, 150, 90))
    d.rectangle([x0 + 1, y + 2, x0 + 5, y + 2], fill=WHITE)
    ptext(img, name, x0 + 10, y, col, 1)
    if strike > 0:
        w = int((text_w(name) + 10) * clamp(strike))
        d.rectangle([x0, y + 3, x0 + w, y + 3], fill=RUBY_L)


class Night3am:
    def __init__(self):
        self.lock = brand.lockup(46)
        self.logo = brand.logo(150)

    def table(self, img, t, eaten=None, clock=True):
        x0, y0, x1, y1 = TABLE
        d = ImageDraw.Draw(img)
        d.rectangle([x0, y0, x1, y1], fill=(17, 22, 31), outline=STEEL)
        d.rectangle([x0, y0, x1, y0 + 9], fill=STEEL)
        ptext(img, "CUSTOMERS", x0 + 3, y0 + 1, WHITE, 1, shadow=False)
        if clock:
            mins = min(9, max(0, int((t - S[1]) * 1.3)))
            c = f"3:0{mins} AM"
            ptext(img, c, x1 - 3 - text_w(c), y0 + 1, DARK, 1, shadow=False)
        live = [k for k, s in enumerate(SPAWN) if t >= s]
        for k in live:
            y = ROW0 + k * ROWH
            du = t - SPAWN[k]
            if eaten is not None and k in eaten:
                e = eaten[k]
                if e >= 1:
                    continue
                row(img, y, NAMES[k], SILVER, strike=e * 2)
                continue
            if eaten is not None and k == 0 and t >= S[2] + 2.9:
                row(img, y, NAMES[k], GREEN)
                ptext(img, "ID 1", x1 - 4 - text_w("ID 1"), y, GREEN, 1)
                continue
            slide = ease(du / 0.2)
            col = RUBY_L if (k > 0 and du < 0.5 and int(du * 12) % 2 == 0) else (WHITE if k == 0 else SILVER)
            yy = y - int((1 - slide) * 6)
            row(img, yy, NAMES[k], col)
            if k > 0 and eaten is None:
                ptext(img, "COPY", x1 - 4 - text_w("COPY"), yy, RUBY_L if du < 0.6 else STEEL, 1)

    def frame(self, t) -> Image.Image:
        i = max(k for k, s0 in enumerate(S) if t >= s0)
        u = t - S[i]
        img = Image.new("RGB", (LW, LH), BG)
        night(img, t)
        z, zc, over = 1.0, FACE, None
        if i in (0, 1):
            ptext(img, "NOBODY:", 12, 30, WHITE, 2)
            ptext(img, "MY CRM AT 3AM:", 6, 52, RUBY_L, 2)
            awake = t >= BOOM
            if i == 0:
                ptext_c(img, "SHH... EVERYONE IS ASLEEP", 120, SILVER, 1)
            else:
                self.table(img, t)
            capy_face(img, *FACE, t, blink=not awake, mouth=0.4 if awake else 0.0)
            zzz(img, FACE[0] + 30, FACE[1] - 46, t, on=not awake)
            big(img, cat, 136, 304, t, CAT2, CAT2_D, walk=False, face=-1, glass=False)
            zzz(img, 128, 240, t + 0.4, on=t < BOOM + 0.6)
            if awake:
                du = t - BOOM
                if du < 0.45:
                    z = 1.0 + 0.7 * math.sin(clamp(du / 0.45) * math.pi)
                if du >= 0.1:
                    over = [("BRO REALLY", 186, WHITE, 2), ("MADE 9 OF HIMSELF", 202, RUBY_L, 1)]
                if du > 0.6:                                  # «!» над капібарою
                    ptext(img, "!!", FACE[0] + 40, FACE[1] - 40 + int(math.sin(t * 20)), RUBY_L, 2)
        elif i == 2:
            ptext(img, "NOBODY:", 12, 30, WHITE, 2)
            ptext(img, "MY CRM AT 3AM:", 6, 52, RUBY_L, 2)
            eaten = {k: clamp((u - 0.4 - j * 0.28) / 0.25) for j, k in enumerate(EAT_ORDER)}
            self.table(img, t, eaten, clock=False)
            if u < 3.0:
                mx = 200 - u * 75
                muncher(img, mx, 196, t, mouth=abs(math.sin(t * 20)), face=-1)
                if 0.4 < u < 2.8:
                    ptext(img, "NOM", int(mx - 34), 172, GREEN, 1)
            if u >= 2.9:
                ptext_c(img, "1 CUSTOMER = 1 ID", 112, GREEN, 1)
                ptext_c(img, "MATCH RULES ON", 126, SILVER, 1)
            on = t >= SHADES
            capy_face(img, *FACE, t, blink=on, mouth=0.0 if on else 0.3)
            if on:
                drop = int((1 - ease((t - SHADES) / 0.35)) * 30)
                shades(img, FACE[0], FACE[1] - drop)
                zzz(img, FACE[0] + 30, FACE[1] - 46, t)
                ptext(img, "BACK TO", 108, 236, WHITE, 1)
                ptext(img, "SLEEP", 108, 248, GREEN, 2)
                if t - SHADES < 0.4:
                    z = 1.0 + 0.5 * math.sin(clamp((t - SHADES) / 0.4) * math.pi)
            big(img, cat, 136, 304, t, CAT2, CAT2_D, walk=False, face=-1, glass=False)
        else:
            capy_face(img, LW // 2, 254, t, blink=False, mouth=0.4)
            shades(img, LW // 2, 254)
            ptext_c(img, "WHAT DOES", 104, WHITE, 2)
            ptext_c(img, "YOUR DATA DO", 122, WHITE, 2)
            ptext_c(img, "AT 3AM?", 144, RUBY_L, 3)
            ptext_c(img, "TELL ME BELOW", 302, SILVER, 1)
        img = zoom(img, z, zc[0], zc[1] - 40)
        if over:
            for s, y, c, k in over:
                ptext_c(img, s, y, c, k)
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
        if any(0 <= t - s0 < 0.05 for s0 in (S[2], S[3], BOOM, SHADES)):
            full = Image.blend(full, Image.new("RGB", full.size, WHITE), 0.2)
        return full

    def poster(self):
        t = BOOM + 0.7
        img = Image.new("RGB", (LW, LH), BG)
        night(img, t)
        ptext(img, "NOBODY:", 12, 30, WHITE, 2)
        ptext(img, "MY CRM AT 3AM:", 6, 52, RUBY_L, 2)
        self.table(img, t)
        capy_face(img, *FACE, t, mouth=0.4)
        ptext(img, "!!", FACE[0] + 40, FACE[1] - 40, RUBY_L, 2)
        big(img, cat, 136, 304, t, CAT2, CAT2_D, walk=False, face=-1, glass=False)
        ptext_c(img, "BRO REALLY", 186, WHITE, 2)
        ptext_c(img, "MADE 9 OF HIMSELF", 202, RUBY_L, 1)
        full = img.resize((W, H), Image.NEAREST)
        full.paste(self.lock, (56, 92), self.lock)
        return full


# ---------------------------------------------------------------- звук
def soundtrack(path: Path):
    m = Mix(TOTAL)
    lull = [76, 79, 81, 79, 76, 72, 74, 76]                 # тиха «колискова» музична скринька
    for k in range(int(BOOM / (BEAT / 2))):
        m.put(tri(midi(lull[k % len(lull)]), 0.25, decay=6), k * BEAT / 2, 0.12)
        if k % 4 == 0:
            m.put(tri(midi(45), 0.4), k * BEAT / 2, 0.22)
    for k, s in enumerate(SPAWN):
        m.put(sfx_pop(seed=k), s, 0.45)
        m.put(blip(500 + k * 90, 900 + k * 120, 0.06, 0.5), s + 0.03, 0.25)
    m.put(vine_boom(), BOOM, 1.7)
    groove(m, S[2], SHADES - 0.1, ["Am", "F", "C", "G"], BEAT, arp=False, seed=3)
    for j in range(len(EAT_ORDER)):
        m.put(sfx_crack(seed=j + 2), S[2] + 0.45 + j * 0.28, 0.7)
    m.put(vine_boom(), SHADES, 1.3)
    for k in range(int((TOTAL - SHADES) / (BEAT / 2))):
        m.put(tri(midi(lull[k % len(lull)]), 0.25, decay=6), SHADES + 0.3 + k * BEAT / 2, 0.1)
        m.put(hat(k), SHADES + 0.3 + k * BEAT / 2, 0.06)
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
    v = Night3am()
    wav = out_dir / "3am.wav"
    soundtrack(wav)
    v.poster().save(out_dir / "crm-3am-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "crm-3am-9x16.mp4"
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
