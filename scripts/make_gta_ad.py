"""Монтаж реклами «Директор і GTA VI» з кліпу відеогенератора (20.11.2026), 9:16, UA і EN (англійські субтитри).

Джерело: кліп 720×1280, 24 к/с, 10 с (офіс 0–3.375, контролер 3.375–3.79, авто 3.79–5.0, салон 5.0–8.79,
згенерована заставка 8.79–10). Що робимо:
  * апскейл до 1080×1920 (lanczos + різкість), легке зерно;
  * прибираємо чужі торгові марки: емблему й шильдик моделі на багажнику (трекінг по кадрах, inpaint);
  * перекриваємо вшитий генератором підпис власною плашкою з фірмовими шрифтами (хук видно з кадру 0);
  * субтитри до реплік (генератор не гарантує чистої української озвучки, а більшість дивиться без звуку);
  * вставка крупного плану телефона з дашбордом: виручка за 7 днів і просадка в п'ятницю (опора для панчлайну);
  * власна фінальна заставка замість згенерованої: справжній логотип, рядок, сайт; сигнал авто з кліпу і звуковий логотип.

Запуск: python scripts/make_gta_ad.py <кліп.mp4> <out.mp4> [uk|en]
"""
from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_nightdrive as nd  # noqa: E402
import premium_anchors as pa  # noqa: E402
from make_nightdrive import CHAMPAGNE, RUBY, SILVER, WHITE, clamp, ease, tracked  # noqa: E402

FPS = 24
SW, SH = 720, 1280
W, H = 1080, 1920
K_END = 211                 # 8.79 с: тут починається згенерована заставка, її замінюємо
END_LEN = 3.0
T_TOTAL = K_END / FPS + END_LEN
INSERT = (126, 145)         # 5.25–6.04 с: крупний план телефона
BG_END = (5, 7, 10)
CORAL = (255, 128, 104)
TEAL = (52, 214, 206)
TEXT = {
    "uk": dict(caption="Поки директор не пропав\nпісля виходу GTA VI…",
               subs=[(1.15, 2.75, "«І звіт мені на телефон»"), (7.35, 8.79, "«Секунду. Що там у п’ятницю?»")],
               end="Ваша аналітика.\nНа кожному світлофорі.", label="ВИРУЧКА · 7 ДНІВ", value="1 245 000 ₴",
               days=["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]),
    "en": dict(caption="Before the director vanished\ninto GTA VI…",
               subs=[(1.15, 2.75, "“And send the report to my phone.”"), (7.35, 8.79, "“One sec. What happened on Friday?”")],
               end="Your analytics.\nAt every red light.", label="REVENUE · 7 DAYS", value="₴1,245,000",
               days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
}


def track(frames):
    """Позиції емблеми (коло) і шильдика моделі на багажнику для кадрів 91..119."""
    ref = frames[92]
    tpl = ref[857 - 24:857 + 24, 362 - 24:362 + 24]
    tb = ref[873 - 14:873 + 14, 450 - 36:450 + 36]
    out = {}
    for k in range(91, 120):
        g = frames[k]
        r = cv2.matchTemplate(g[700:1000, 250:480], tpl, cv2.TM_CCOEFF_NORMED)
        _, _, _, ml = cv2.minMaxLoc(r)
        rb = cv2.matchTemplate(g[700:1000, 330:600], tb, cv2.TM_CCOEFF_NORMED)
        _, _, _, lb = cv2.minMaxLoc(rb)
        out[k] = ((ml[0] + 250 + 24, ml[1] + 700 + 24), (lb[0] + 330 + 36, lb[1] + 700 + 14))
    return out


def clean_badges(f, pos):
    (cx, cy), (bx, by) = pos
    m = np.zeros(f.shape[:2], np.uint8)
    cv2.circle(m, (cx, cy), 23, 255, -1)
    cv2.rectangle(m, (bx - 42, by - 15), (bx + 42, by + 15), 255, -1)
    out = cv2.inpaint(f, m, 9, cv2.INPAINT_TELEA)
    soft = cv2.GaussianBlur(out, (0, 0), 3)               # згладити латку, щоб не було видно межі
    mm = cv2.GaussianBlur(m, (0, 0), 4)[..., None].astype(np.float32) / 255
    return (out * (1 - mm) + soft * mm).astype(np.uint8)


def upscale(f):
    up = cv2.resize(f, (W, H), interpolation=cv2.INTER_LANCZOS4)
    blur = cv2.GaussianBlur(up, (0, 0), 1.6)
    return cv2.addWeighted(up, 1.35, blur, -0.35, 0)


class Ad:
    def __init__(self, lang="uk"):
        self.lang = lang
        self.T = TEXT[lang]
        self.f_cap = brand.font("body-semi", 54)
        self.f_sub = brand.font("body-semi", 46)
        self.f_lab = brand.font("body-semi", 26)
        self.f_big = brand.font("head", 92)
        self.f_day = brand.font("body-semi", 26)
        self.f_end = brand.font("body-semi", 54)
        self.f_url = brand.font("body-semi", 32)
        self.logo = brand.logo(230)
        self.small_logo = brand.logo(56)
        rng = np.random.default_rng(6)
        self.grain = [rng.normal(0, 3.2, (H // 2, W // 2, 1)).astype(np.float32) for _ in range(5)]

    # ---- плашка підпису поверх вшитого генератором
    def caption(self, fr, t):
        box = (54, 128, 1026, 372)
        reg = fr.crop(box).filter(ImageFilter.GaussianBlur(28))
        reg = Image.blend(reg, Image.new("RGB", reg.size, (14, 16, 22)), 0.82)
        m = Image.new("L", reg.size, 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, reg.width - 1, reg.height - 1], 30, fill=255)
        fr.paste(reg, box[:2], m)
        d = ImageDraw.Draw(fr, "RGBA")
        d.rounded_rectangle(box, 30, outline=(255, 255, 255, 40), width=2)
        d.line([box[0] + 40, box[1] + 26, box[0] + 110, box[1] + 26], fill=RUBY, width=4)
        y = box[1] + 52
        for ln in self.T["caption"].split("\n"):
            d.text((540, y), ln, font=self.f_cap, fill=WHITE, anchor="ma")
            y += 74

    def subtitle(self, fr, t):
        for t0, t1, s in self.T["subs"]:
            if t0 <= t < t1:
                a = min(clamp((t - t0) / 0.15), clamp((t1 - t) / 0.15))
                lay = Image.new("RGBA", fr.size, (0, 0, 0, 0))
                d = ImageDraw.Draw(lay)
                w = self.f_sub.getlength(s)
                d.rounded_rectangle([540 - w / 2 - 30, 1560, 540 + w / 2 + 30, 1652], 22, fill=(8, 10, 14, int(190 * a)))
                d.text((540, 1606), s, font=self.f_sub, fill=(*WHITE, int(255 * a)), anchor="mm")
                fr.paste(Image.alpha_composite(fr.convert("RGBA"), lay).convert("RGB"))

    # ---- вставка: телефон з дашбордом
    def insert(self, src_rgb, u):
        bg = Image.fromarray(src_rgb).resize((W // 4, H // 4)).filter(ImageFilter.GaussianBlur(8)).resize((W, H))
        bg = Image.blend(bg, Image.new("RGB", (W, H), (6, 8, 12)), 0.55).convert("RGBA")
        z = 1.0 + 0.05 * u
        pw, ph = int(700 * z), int(1360 * z)
        px, py = (W - pw) // 2, (H - ph) // 2 + 40
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([px - 10, py + 30, px + pw + 10, py + ph + 50], 90, fill=(0, 0, 0, 170))
        bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(30)))
        ph_img = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        d = ImageDraw.Draw(ph_img)
        d.rounded_rectangle([0, 0, pw - 1, ph - 1], int(86 * z), fill=(22, 24, 30, 255))
        sx0, sy0, sx1, sy1 = int(18 * z), int(18 * z), pw - int(18 * z), ph - int(18 * z)
        scr = Image.new("RGBA", (sx1 - sx0, sy1 - sy0), (9, 11, 16, 255))
        g = np.linspace(0, 1, scr.height)[:, None]
        arr = np.asarray(scr).astype(np.float32)
        arr[..., :3] += (g * np.array([10, 6, 14]))[:, :, None].transpose(0, 2, 1)
        scr = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
        s = ImageDraw.Draw(scr)
        sw, shh = scr.size
        s.rounded_rectangle([sw / 2 - 90 * z, 22 * z, sw / 2 + 90 * z, 58 * z], 18 * z, fill=(0, 0, 0, 255))
        scr.alpha_composite(self.small_logo, (int(46 * z), int(110 * z)))
        s.text((int(46 * z) + self.small_logo.width + 18, int(110 * z) + self.small_logo.height // 2), "Belyakov Consult", font=self.f_lab, fill=(*SILVER, 255), anchor="lm")
        tracked(s, self.T["label"], self.f_lab, sw / 2, 300 * z, (*SILVER, 255), 4)
        s.text((sw / 2, 340 * z), self.T["value"], font=self.f_big, fill=(*WHITE, 255), anchor="ma")
        vals = [0.62, 0.68, 0.66, 0.74, 0.30, 0.71, 0.78]
        days = self.T["days"]
        cx0, cx1, cy0, cy1 = 60 * z, sw - 60 * z, 620 * z, 1000 * z
        pts = [(cx0 + (cx1 - cx0) * i / 6, cy1 - (cy1 - cy0) * v) for i, v in enumerate(vals)]
        for gy in range(4):
            y = cy0 + (cy1 - cy0) * gy / 3
            s.line([cx0, y, cx1, y], fill=(255, 255, 255, 22), width=1)
        draw_k = ease(u / 0.55) * 6
        n = int(draw_k)
        path = pts[:n + 1]
        if n < 6:
            fr_ = draw_k - n
            path.append((pts[n][0] + (pts[n + 1][0] - pts[n][0]) * fr_, pts[n][1] + (pts[n + 1][1] - pts[n][1]) * fr_))
        if len(path) > 1:
            poly = path + [(path[-1][0], cy1), (path[0][0], cy1)]
            s.polygon(poly, fill=(*TEAL, 34))
            s.line(path, fill=(*TEAL, 255), width=int(6 * z), joint="curve")
        for i, (x, y) in enumerate(pts):
            col = RUBY if i == 4 else SILVER
            s.text((x, cy1 + 30 * z), days[i], font=self.f_day, fill=(*col, 255), anchor="ma")
            if i <= draw_k:
                r = (12 if i == 4 else 7) * z
                s.ellipse([x - r, y - r, x + r, y + r], fill=(*(RUBY if i == 4 else TEAL), 255))
        if draw_k >= 4:                                     # п'ятниця підсвічена
            x, y = pts[4]
            a = int(255 * clamp((draw_k - 4) / 0.6))
            s.rounded_rectangle([x - 70 * z, y + 26 * z, x + 70 * z, y + 74 * z], 14 * z, fill=(*RUBY, int(a * 0.25)))
            s.text((x, y + 50 * z), "−58%", font=self.f_lab, fill=(*RUBY, a), anchor="mm")
        lay = Image.new("RGBA", scr.size, (0, 0, 0, 0))     # неоновий відблиск вулиці на склі
        ld = ImageDraw.Draw(lay)
        bx = -sw * 0.6 + u * sw * 1.6
        ld.polygon([(bx, 0), (bx + 160, 0), (bx - 340, shh), (bx - 500, shh)], fill=(*CORAL, 26))
        ld.polygon([(bx + 260, 0), (bx + 300, 0), (bx - 200, shh), (bx - 240, shh)], fill=(*TEAL, 22))
        scr.alpha_composite(lay)
        m = Image.new("L", scr.size, 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, sw - 1, shh - 1], int(70 * z), fill=255)
        ph_img.paste(scr, (sx0, sy0), m)
        bg.alpha_composite(ph_img, (px, py))
        return bg.convert("RGB")

    # ---- фінальна заставка
    def end(self, u):
        fr = Image.new("RGBA", (W, H), (*BG_END, 255))
        k = ease(u / 0.6)
        lg = self.logo
        nd.comp(fr, lg, W / 2 - lg.width / 2, 700 - lg.height / 2 + (1 - k) * 24, k)
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        k2 = ease((u - 0.35) / 0.6)
        y = 920
        for ln in self.T["end"].split("\n"):
            d.text((540, y + (1 - k2) * 16), ln, font=self.f_end, fill=(*WHITE, int(255 * k2)), anchor="ma")
            y += 72
        k3 = ease((u - 0.75) / 0.6)
        d.line([540 - 60 * k3, 1110, 540 + 60 * k3, 1110], fill=(*RUBY, int(255 * k3)), width=3)
        tracked(d, "BELYAKOVCONSULT.COM", self.f_url, 540, 1150, (*SILVER, int(255 * k3)), 6)
        k4 = ease((u - 1.1) / 0.6)
        tracked(d, pa.TAGLINE[self.lang], self.f_lab, 540, 1232, (*pa.CHAMPAGNE, int(230 * k4)), 5)
        fr.alpha_composite(lay)
        return fr.convert("RGB")

    def finish(self, img, k):
        a = np.asarray(img, np.float32) + np.repeat(np.repeat(self.grain[k % 5], 2, 0), 2, 1)
        return np.clip(a, 0, 255).astype(np.uint8)


def audio(src: Path, wav: Path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-ac", "2", "-ar", "48000", "-f", "f32le", "-"],
                         capture_output=True).stdout
    a = np.frombuffer(raw, np.float32).reshape(-1, 2)
    sr = 48000
    out = np.zeros((int(T_TOTAL * sr) + sr, 2), np.float32)
    out[:len(a)] += a                                       # репліки, вулиця і сигнал авто з кліпу
    def put(x, t, g):
        i = int(t * sr)
        x = np.repeat(x[:, None], 2, 1) if x.ndim == 1 else x
        x = np.asarray(x, np.float32)
        if nd.SR != sr:
            idx = np.linspace(0, len(x) - 1, int(len(x) * sr / nd.SR))
            x = np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], 1)
        n = min(len(x), len(out) - i)
        out[i:i + n] += g * x[:n]
    put(nd.tick_sfx(2200), INSERT[0] / FPS, 0.08)
    put(pa.logo(), K_END / FPS + 1.25, 0.32)                # звуковий логотип після сигналу
    out = out[:int(T_TOTAL * sr)]
    fade = int(0.5 * sr)
    out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    import wave
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())


def render(src: Path, out: Path, lang="uk"):
    out.parent.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(src))
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(f)
    pos = track(frames)
    wav = out.with_suffix(".wav")
    audio(src, wav)
    ad = Ad(lang)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
           "-tune", "film", "-x264-params", "aq-mode=3", "-maxrate", "6000k", "-bufsize", "12M", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-af", "loudnorm=I=-14:TP=-1.0:LRA=9", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
           "-t", f"{T_TOTAL:.3f}", "-movflags", "+faststart", str(out)]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    cover = None
    try:
        for k in range(int(round(T_TOTAL * FPS))):
            t = k / FPS
            if k < K_END:
                f = frames[k]
                if k in pos:
                    f = clean_badges(f, pos[k])
                rgb = cv2.cvtColor(upscale(f), cv2.COLOR_BGR2RGB)
                if INSERT[0] <= k <= INSERT[1]:
                    img = ad.insert(rgb, (k - INSERT[0]) / (INSERT[1] - INSERT[0]))
                else:
                    img = Image.fromarray(rgb)
                    if t < 3.375:
                        ad.caption(img, t)
                    ad.subtitle(img, t)
            else:
                img = ad.end((k - K_END) / FPS)
            a = ad.finish(img, k)
            if k == 0:
                cover = Image.fromarray(a)
            enc.stdin.write(a.tobytes())
    finally:
        enc.stdin.close()
        enc.wait()
    wav.unlink(missing_ok=True)
    cover.save(out.with_name(out.stem + "-cover.jpg"), "JPEG", quality=92)
    if enc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {enc.returncode}")
    return out


if __name__ == "__main__":
    print(render(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else "uk"))
