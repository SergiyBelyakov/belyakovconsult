"""Фан-тригер «Six Seven» (16 с, англійською, 9:16): піксельна капібара анфас, у камеру.

Мем 6-7: капібара з мандаринкою на голові «зважує» долонями вгору-вниз і каже SIX… SEVEN… Поворот у дані:
на лапах CRM: 6 і ERP: 7, коти на фоні скандують «6 7!», робот Dupe Muncher крутиться. Капібара дивиться
крізь лупу: «IT'S 6. ONE IS A DUPLICATE.» Фінал: питання до аудиторії. Без чужої музики й персонажів.

Запуск: python scripts/make_67.py <папка>
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
from make_pixel import (BG, BG2, CAP, CAP_D, CAP_L, CAT1, CAT1_D, CAT2, CAT2_D, DARK, GLASS, LH, LW, RUBY, RUBY_D,  # noqa: E402
                        RUBY_L, SILVER, STEEL, WHITE, big, blip, cat, clamp, ease, muncher, pop, ptext, ptext_c, text_w)

make_pixel.FONT["="] = ["00000", "00000", "11111", "00000", "11111", "00000", "00000"]
make_fun.CH.setdefault("Em", (40, [59, 64, 67, 71]))
make_fun.CH.setdefault("D", (38, [62, 66, 69, 74]))
W, H = 1080, 1920
FPS = 30
TOTAL = 16.0
BEAT = 60 / 128
S = [0.0, 2.2, 5.6, 8.6, 11.2, 13.4]      # гачок, «six seven», CRM/ERP, хор котів, розв'язка, фінал
ORANGE, ORANGE_D, LEAF = (255, 150, 30), (220, 110, 20), (88, 170, 84)
NOSE = (70, 46, 34)


def capy_face(img, cx, cy, t, blink=False, squint=0.0, mouth=0.0, tilt=0):
    """Капібара анфас крупно: широка голова, велика прямокутна морда, маленькі очі й вуха, мандаринка."""
    d = ImageDraw.Draw(img)
    cx, cy = int(cx), int(cy)
    # вуха
    for s in (-1, 1):
        d.ellipse([cx + s * 30 - 6, cy - 44, cx + s * 30 + 6, cy - 32], fill=CAP_D)
        d.ellipse([cx + s * 30 - 3, cy - 41, cx + s * 30 + 3, cy - 35], fill=(150, 104, 70))
    # голова
    d.rounded_rectangle([cx - 36, cy - 40, cx + 36, cy + 30], 18, fill=CAP)
    d.rounded_rectangle([cx - 32, cy - 38, cx + 20, cy - 30], 6, fill=CAP_L)          # світло зверху
    # морда
    d.rounded_rectangle([cx - 28, cy - 6, cx + 28, cy + 38], 14, fill=CAP_D)
    d.rounded_rectangle([cx - 24, cy - 4, cx + 24, cy + 6], 6, fill=(150, 106, 72))
    for s in (-1, 1):                                                                  # ніздрі
        d.rectangle([cx + s * 9 - 3, cy + 4, cx + s * 9 + 3, cy + 7], fill=NOSE)
    m = int(round(mouth * 5))
    d.line([cx, cy + 10, cx, cy + 16], fill=NOSE)
    d.rectangle([cx - 8, cy + 16, cx + 8, cy + 17 + m], fill=NOSE if m else CAP_D)
    if m > 2:
        d.rectangle([cx - 3, cy + 17, cx + 3, cy + 19], fill=WHITE)                    # зуби
    # очі
    for s in (-1, 1):
        ex, ey = cx + s * 20, cy - 18
        if blink:
            d.rectangle([ex - 4, ey, ex + 4, ey + 1], fill=DARK)
        else:
            h = max(1, int(round(4 * (1 - squint))))
            d.rectangle([ex - 4, ey - h // 2, ex + 4, ey + h - h // 2], fill=DARK)
            d.point((ex - 2, ey - h // 2), fill=WHITE)
        if squint > 0.3:                                                               # повіки «з підозрою»
            d.line([ex - 6, ey - 4 + s, ex + 6, ey - 4 - s], fill=CAP_D, width=2)
    # мандаринка
    bob = int(round(math.sin(t * 8) * 1.5))
    d.ellipse([cx - 9 + tilt, cy - 58 + bob, cx + 9 + tilt, cy - 41 + bob], fill=ORANGE)
    d.ellipse([cx - 6 + tilt, cy - 56 + bob, cx - 1 + tilt, cy - 52 + bob], fill=(255, 200, 120))
    d.rectangle([cx + tilt, cy - 61 + bob, cx + 1 + tilt, cy - 58 + bob], fill=(90, 70, 40))
    d.polygon([(cx + 1 + tilt, cy - 60 + bob), (cx + 8 + tilt, cy - 63 + bob), (cx + 4 + tilt, cy - 57 + bob)], fill=LEAF)


def paw(img, x, y, label=None, label_col=WHITE):
    """Лапа долонею вгору, на ній табличка з числом."""
    d = ImageDraw.Draw(img)
    x, y = int(x), int(y)
    d.rectangle([x - 6, y, x + 6, y + 40], fill=CAP)                                   # передпліччя
    d.rectangle([x - 6, y, x - 5, y + 40], fill=CAP_L)
    d.rounded_rectangle([x - 12, y - 6, x + 12, y + 6], 5, fill=CAP)                   # долоня
    d.rounded_rectangle([x - 8, y - 4, x + 8, y + 3], 3, fill=(150, 104, 70))
    for k in (-8, -3, 3, 8):
        d.ellipse([x + k - 2, y - 9, x + k + 2, y - 5], fill=CAP_D)


def paw_label(img, x, y, label, col=WHITE):
    """Табличка з числом над лапою (координати кадру)."""
    d = ImageDraw.Draw(img)
    w = text_w(label, 2) + 8
    x = int(clamp(x, w / 2 + 2, LW - w / 2 - 2))
    d.rectangle([x - w // 2, y - 24, x + w // 2, y - 2], fill=DARK, outline=RUBY_L)
    ptext(img, label, x - w // 2 + 4, y - 20, col, 2, shadow=False)


def magnifier_big(img, x, y, r=16):
    d = ImageDraw.Draw(img)
    d.line([x + r - 3, y + r - 3, x + r + 12, y + r + 12], fill=CAP_D, width=5)
    d.ellipse([x - r, y - r, x + r, y + r], fill=None, outline=SILVER, width=3)
    d.ellipse([x - r + 3, y - r + 3, x + r - 3, y + r - 3], fill=(150, 200, 230))
    d.point((x - 6, y - 7), fill=WHITE)


class SixSeven:
    def __init__(self):
        self.lock = brand.lockup(46)
        self.logo = brand.logo(150)
        self.beats = [S[1] + k * BEAT for k in range(int((S[4] - S[1]) / BEAT))]

    def word(self, t):
        """Яке слово зараз «на лапі»: 0 = SIX (ліва вгорі), 1 = SEVEN (права вгорі)."""
        k = int((t - S[1]) / BEAT)
        return k % 2

    def frame(self, t) -> Image.Image:
        i = max(k for k, s0 in enumerate(S) if t >= s0)
        u = t - S[i]
        ph = ((t - S[1]) % BEAT) / BEAT if t >= S[1] else 0
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        # тло: «вебкамера» — сітка й мітка REC
        for k in range(0, LH, 14):
            d.line([0, k, LW, k], fill=BG2)
        if i < 5:
            if int(t * 2) % 2:
                d.ellipse([8, 36, 13, 41], fill=RUBY_L)
            ptext(img, "REC", 16, 36, WHITE)
            ptext(img, f"00:{int(t):02d}", LW - text_w("00:00") - 8, 36, SILVER)
        blink = (t % 2.7) < 0.1
        # «селфі-камера»: капібара й лапи в подвійному масштабі (піксель 12×12)
        lay = Image.new("RGBA", (LW // 2, LH // 2), (0, 0, 0, 0))
        fy = 106
        if i == 3:                                           # хор котів і робот на фоні
            jump = abs(math.sin(t * math.pi / BEAT)) * 5
            big(img, cat, 22, 112 - jump, t, CAT1, CAT1_D, walk=False, face=1, glass=False)
            big(img, cat, 158, 112 - jump * 0.8, t + 0.3, CAT2, CAT2_D, walk=False, face=-1, glass=False)
            ptext(img, "6 7!", 4, 58 + int(jump), WHITE)
            ptext(img, "6 7!", LW - 28, 58 + int(jump), RUBY_L)
        labels = None
        if i == 0:
            zoom_in = ease(u / 1.2)
            capy_face(lay, LW // 4, fy + int((1 - zoom_in) * 12), t, blink=blink)
            ptext_c(img, "POV: YOU ASK THE", 52, WHITE, 1)
            ptext_c(img, "ANALYST HOW MANY", 62, WHITE, 1)
            ptext_c(img, "CLIENTS WE HAVE", 72, RUBY_L, 1)
        elif i in (1, 2, 3):
            up = self.word(t)
            swing = math.sin(ph * math.pi)                     # плавний підйом і спуск у межах долі
            ly = 122 - (12 * swing if up == 0 else -3 * swing)
            ry = 122 - (12 * swing if up == 1 else -3 * swing)
            capy_face(lay, LW // 4, fy, t, blink=blink, mouth=1 - ph if ph < 0.5 else 0.0, tilt=int(swing * 2) * (1 if up else -1))
            paw(lay, 9, ly)
            paw(lay, LW // 2 - 9, ry)
            labels = ((("6", "7") if i != 2 else ("CRM:6", "ERP:7")), ly * 2, ry * 2, up)
            w = ["SIX", "SEVEN"][up]
            k = 3 if ph < 0.25 else 2
            ptext_c(img, w, 52 if k == 3 else 56, WHITE if up == 0 else RUBY_L, k)
            if i == 2:
                ptext_c(img, "HOW MANY CLIENTS?", 76, SILVER, 1)
        elif i == 4:
            capy_face(lay, LW // 4, fy, t, squint=clamp(u / 0.4) * 0.7)
            magnifier_big(lay, LW // 4 + 10 + int(math.sin(t * 3) * 2), fy - 18, 9)
            if u > 0.6:
                ptext_c(img, "IT'S 6.", 50, WHITE, 3)
            if u > 1.2:
                ptext_c(img, "ONE IS A DUPLICATE.", 76, RUBY_L, 1)
        else:
            capy_face(img, LW // 2, 250, t, blink=blink, mouth=0.4)
            ptext_c(img, "WHICH TWO SYSTEMS", 128, WHITE, 1)
            ptext_c(img, "IN YOUR COMPANY", 138, WHITE, 1)
            ptext_c(img, "SAY 6 AND 7?", 150, RUBY_L, 2)
        if i < 5:
            up2 = lay.resize((LW, LH), Image.NEAREST)
            img.paste(up2, (0, 0), up2)
        if i == 3:
            big(img, muncher, LW // 2 + math.sin(t * 5) * 50, 268, t, abs(math.sin(t * 18)), 1 if int(t * 2) % 2 else -1)
        if labels:
            (l6, l7), ly2, ry2, up = labels
            paw_label(img, 18, int(ly2) - 18, l6, WHITE if up == 0 else SILVER)
            paw_label(img, LW - 18, int(ry2) - 18, l7, RUBY_L if up == 1 else SILVER)
        # зум-удар на кожне слово
        zoom = 1.0
        if i in (1, 2, 3) and ph < 0.12:
            zoom = 1.07
        if i == 4 and 0.6 <= u < 0.75:
            zoom = 1.12
        if zoom > 1:
            w_, h_ = LW / zoom, LH / zoom
            x0, y0 = int((LW - w_) / 2), int((LH - h_) / 2 + 10)
            img = img.crop((x0, y0, x0 + int(w_), y0 + int(h_))).resize((LW, LH), Image.NEAREST)
        if i == 3 and ph < 0.12:
            ox = int(math.sin(t * 80) * 2)
            img = img.transform(img.size, Image.AFFINE, (1, 0, ox, 0, 1, 0), fillcolor=BG)
        full = img.resize((W, H), Image.NEAREST)
        if i < 5:
            full.paste(self.lock, (56, 92), self.lock)
        else:
            k = ease(u / 0.5)
            full.paste(self.logo, (W // 2 - self.logo.width // 2, int(380 - (1 - k) * 40)), self.logo)
            url = Image.new("RGBA", (LW, 12), (0, 0, 0, 0))
            ptext(url, "BELYAKOVCONSULT.COM", int(LW / 2 - text_w("BELYAKOVCONSULT.COM") / 2), 2, SILVER)
            up_ = url.resize((W, 72), Image.NEAREST)
            full.paste(up_, (0, 1070), up_)
        if any(0 <= t - s0 < 0.05 for s0 in S[1:]):
            full = Image.blend(full, Image.new("RGB", full.size, WHITE), 0.15)
        return full

    def poster(self):
        img = Image.new("RGB", (LW, LH), BG)
        d = ImageDraw.Draw(img)
        for k in range(0, LH, 14):
            d.line([0, k, LW, k], fill=BG2)
        lay = Image.new("RGBA", (LW // 2, LH // 2), (0, 0, 0, 0))
        capy_face(lay, LW // 4, 106, 0.0, mouth=0.6)
        paw(lay, 9, 110)
        paw(lay, LW // 2 - 9, 122)
        up2 = lay.resize((LW, LH), Image.NEAREST)
        img.paste(up2, (0, 0), up2)
        paw_label(img, 18, 202, "6")
        paw_label(img, LW - 18, 226, "7", RUBY_L)
        ptext_c(img, "SIX SEVEN", 48, WHITE, 3)
        ptext_c(img, "CRM:6  ERP:7", 74, RUBY_L, 1)
        full = img.resize((W, H), Image.NEAREST)
        full.paste(self.lock, (56, 92), self.lock)
        return full


def soundtrack(path: Path, v: SixSeven):
    m = Mix(TOTAL)
    for k in range(int(S[1] / BEAT)):                       # інтро: лише легкий пульс
        m.put(tri(midi(40), 0.12), k * BEAT, 0.4)
    for k, tb in enumerate(v.beats):
        m.put(kick(), tb, 1.0)
        m.put(sq(midi(43 if k % 2 == 0 else 45), BEAT * 0.8, decay=5), tb, 0.18)     # «six» нижче, «seven» вище
        m.put(sq(midi(79 if k % 2 == 0 else 81), 0.12, decay=8), tb, 0.12)
        if S[3] <= tb < S[4]:
            m.put(sq(midi(91), 0.06, decay=10), tb + BEAT / 2, 0.08)
    m.put(crash(1), S[3], 0.35)
    # розв'язка: пауза, «дзинь», фінальний джингл
    m.put(blip(1600, 1600, 0.25, 0.6), S[4] + 0.6, 0.5)
    groove(m, S[5], TOTAL - 0.3, ["C", "G", "Am", "F"], BEAT, arp=True, seed=4)
    for k, note in enumerate([72, 76, 79, 84]):
        m.put(sq(midi(note), 0.14, decay=4), S[5] + 0.1 + k * 0.12, 0.13)
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
    v = SixSeven()
    wav = out_dir / "67.wav"
    soundtrack(wav, v)
    v.poster().save(out_dir / "six-seven-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "six-seven-9x16.mp4"
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
