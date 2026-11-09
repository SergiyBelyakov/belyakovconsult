"""Хук-промо гри «Scooter Cat: Ride the Chart» (EN, 9:16, ~26 с) на справжніх кадрах гри.

Кадри гри записує scripts/record_scooter_cat.js (сайт локально, ?scdebug, автопілот гри: trend, season,
waterfall, multiples, candles; котик, капібара, голова аналітика).
Тут: кадри гри в рамці посередині, піксельні підписи механік зверху й знизу, фінал із посиланням.

Запуск: python scripts/make_sc_trailer.py <папка з кадрами f00000.jpg…> <папка виводу>
"""
from __future__ import annotations

import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_fun  # noqa: E402
from make_fun import SR, Mix, crash, groove, kick, melody, midi, sq  # noqa: E402
from make_pixel import BG, BG2, LH, LW, RUBY, RUBY_L, SILVER, WHITE, blip, ease, ptext, ptext_c, text_w  # noqa: E402

import make_pixel  # noqa: E402

make_pixel.FONT[">"] = ["01000", "00100", "00010", "00001", "00010", "00100", "01000"]
make_pixel.FONT["="] = ["00000", "00000", "11111", "00000", "11111", "00000", "00000"]
make_fun.CH.setdefault("Em", (40, [59, 64, 67, 71]))
make_fun.CH.setdefault("D", (38, [62, 66, 69, 74]))
W, H = 1080, 1920
FPS = 30
BEAT = 60 / 150
URL_PLAIN = "https://www.belyakovconsult.com/en/cases/scooter-cat/"

# монтаж: (з кадру, по кадр, крок) у записі гри; підписи: (від, до, рядки, колір)
CUTS = [(0, 75, 1), (75, 150, 1), (165, 285, 1), (315, 435, 1), (460, 580, 1), (620, 760, 1)]
CAPS = [
    (0.0, 2.5, ["THIS IS A SALES CHART.", "NOW RIDE IT."], [WHITE, RUBY_L]),
    (2.5, 5.0, ["COLLECT DATA POINTS", "= COMPLETE DATA"], [WHITE, SILVER]),
    (5.0, 9.0, ["SEASONALITY:", "JANUARY IS NOT A FAILURE"], [RUBY_L, SILVER]),
    (9.0, 13.0, ["WATERFALL:", "MIND THE COST STEP"], [RUBY_L, SILVER]),
    (13.0, 17.0, ["12 CHART TYPES", "LASERS FOR DATA BUGS"], [WHITE, SILVER]),
    (17.0, 21.7, ["HELL MODE:", "ONE LIFE. GOOD LUCK."], [RUBY_L, WHITE]),
]
END = 21.7
TOTAL = END + 4.0


def timeline():
    seq = []
    for a, b, st in CUTS:
        seq += list(range(a, b, st))
    return seq


def render(frames_dir: Path, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    seq = timeline()
    files = sorted(frames_dir.glob("f*.jpg"))
    lock, logo = brand.lockup(46), brand.logo(150)
    # тло: графіт із тонкою піксельною сіткою
    bg = Image.new("RGB", (LW, LH), BG)
    d = ImageDraw.Draw(bg)
    for k in range(0, LH, 12):
        d.line([0, k, LW, k], fill=BG2)
    bg = bg.resize((W, H), Image.NEAREST)
    gx0, gy0, gw = 0, 400, W
    crop = (80, 120, 1340, 1228)                              # середина поля гри: картки читаються
    gh = int(gw * (crop[3] - crop[1]) / (crop[2] - crop[0]))

    def game_frame(t):
        idx = seq[min(len(seq) - 1, int(t * FPS))]
        im = Image.open(files[min(idx, len(files) - 1)]).crop(crop).resize((gw, gh), Image.LANCZOS)
        return im

    wav = out_dir / "sc.wav"
    soundtrack(wav)
    mp4 = out_dir / "scooter-cat-9x16.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "7M", "-bufsize", "14M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", str(mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    cover = None
    try:
        for k in range(int(TOTAL * FPS)):
            t = k / FPS
            f = bg.copy()
            if t < END:
                g = game_frame(t)
                # рамка: рубіновий кант і тінь
                fd = ImageDraw.Draw(f)
                fd.rectangle([gx0, gy0 - 12, gx0 + gw, gy0 + gh + 12], fill=(8, 10, 14))
                fd.rectangle([gx0, gy0 - 12, gx0 + gw, gy0 - 6], fill=RUBY)
                fd.rectangle([gx0, gy0 + gh + 6, gx0 + gw, gy0 + gh + 12], fill=RUBY)
                f.paste(g, (gx0, gy0))
                layer = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
                ptext_c(layer, "SCOOTER CAT", 28, RUBY_L, 2)
                ptext_c(layer, "RIDE THE CHART", 46, WHITE, 1)
                ptext_c(layer, "FREE GAME: LINK IN BIO", 56, WHITE if int(t * 2) % 2 else RUBY_L, 1)
                for a, b, lines, cols in CAPS:
                    if a <= t < b:
                        u = t - a
                        for j, (s, c) in enumerate(zip(lines, cols)):
                            if u > j * 0.25:
                                k_ = 2 if j == 0 and text_w(s, 2) <= LW - 8 else 1
                                ptext_c(layer, s, 234 + j * 18, c, k_)
                up = layer.resize((W, H), Image.NEAREST)
                f.paste(up, (0, 0), up)
                f.paste(lock, (56, 92), lock)
                if t > 10.0 and cover is None:
                    cover = f.copy()
            else:
                u = t - END
                kk = ease(u / 0.5)
                f.paste(logo, (W // 2 - logo.width // 2, int(360 - (1 - kk) * 40)), logo)
                layer = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
                ptext_c(layer, "PLAY FREE", 100, WHITE, 3)
                ptext_c(layer, "IN YOUR BROWSER", 124, RUBY_L, 2)
                if u > 0.6:
                    ptext_c(layer, "12 CHARTS + HELL MODE", 148, SILVER, 1)
                    ptext_c(layer, "BELYAKOVCONSULT.COM", 164, WHITE, 1)
                    ptext_c(layer, "/EN/CASES/SCOOTER-CAT", 174, WHITE, 1)
                if u > 1.2:
                    ptext_c(layer, "WHAT'S YOUR TIME", 196, WHITE, 1)
                    ptext_c(layer, "ON LEVEL 1?", 208, RUBY_L, 2)
                up = layer.resize((W, H), Image.NEAREST)
                f.paste(up, (0, 0), up)
            if any(0 <= t - a < 0.05 for a, *_ in CAPS[1:]) or 0 <= t - END < 0.06:
                f = Image.blend(f, Image.new("RGB", f.size, WHITE), 0.12)
            proc.stdin.write(f.tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    wav.unlink(missing_ok=True)
    (cover or f).save(out_dir / "scooter-cat-9x16-cover.jpg", "JPEG", quality=92)
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")
    return mp4


def soundtrack(path: Path):
    m = Mix(TOTAL)
    hook = [(76, 1), (79, 1), (83, 1), (88, 1), (86, 1), (83, 1), (79, 2), (81, 1), (84, 1), (88, 2), (86, 2), (83, 4)]
    groove(m, 0.0, 17.0, ["Em", "C", "G", "D"], BEAT, arp=True, seed=3)
    melody(m, 0.4, 17.0, BEAT, hook * 3, gain=0.12)
    groove(m, 17.0, 21.7, ["Am", "F", "Am", "G"], BEAT, arp=True, seed=9)
    groove(m, 21.7, TOTAL - 0.4, ["C", "G", "Am", "F"], BEAT, arp=True, seed=5)
    melody(m, 21.7, TOTAL - 0.6, BEAT, hook, gain=0.11)
    for a, *_ in CAPS[1:]:
        m.put(blip(180, 1800, 0.16), a - 0.08, 0.4)
    m.put(crash(2), 17.0, 0.35)
    for k, note in enumerate([72, 76, 79, 84, 88]):
        m.put(sq(midi(note), 0.16, decay=4), END + 0.2 + k * 0.12, 0.13)
    x = m.x / max(1e-9, np.abs(m.x).max()) * 0.8
    n = int(TOTAL * SR)
    x = x[:n]
    x[-int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))
    st = np.stack([x, x], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    print(render(Path(sys.argv[1]), Path(sys.argv[2])))
