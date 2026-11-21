"""Преміум-промо з відео власника (18.11.2026): постпродакшн і брендовий фінал, 9:16, EN і UA.

Джерело: квадратне відео 720×720 у кадрі 1280×720 (16,5 с): людина за екранами з даними → голограми графіків →
мережа зв'язків → всесвіт даних. Кадр не обрізаємо: квадрат стоїть на всю ширину, зверху й знизу м'яке
продовження того самого кадру, розмите й затемнене.

Постпродакшн: шумозаглушення й апскейл 1080 (lanczos + різкість), грейд (графітові тіні, теплі світла кольору
шампань, м'який S-контраст), повільний наїзд, кутові рамки, зерно, віньєтка, перехід у ядро галактики зі спалахом.
Тексти: хук-біль на кадрі 0, три смислові кроки під сцени відео, фінал з логотипом, послугами, сайтом і фразою бренду.
Якорі з premium_anchors.py: біль на хуку, полегшення на «всю картину», звуковий логотип у фіналі.

Запуск: python scripts/make_video_promo.py <en|uk> <джерело.mov> <out.mp4> [мелодія]
"""
from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand  # noqa: E402
import make_nightdrive as nd  # noqa: E402
import premium_anchors as pa  # noqa: E402
from make_nightdrive import CHAMPAGNE, FPS, GRAPHITE, H, MIDNIGHT, RUBY, SILVER, W, WHITE, bwrap, clamp, ease, tracked  # noqa: E402

SRC_CROP = "720:720:280:0"
T_V = 16.5          # кінець відео-частини
T_ZOOM = 15.9       # початок переходу в ядро галактики
T_FLASH = 16.45
T_TOTAL = 22.0
VC = (540, 1120)    # центр квадрата відео
TEXT_Y = 300

TEXT = {
    "en": dict(label="BEFORE EVERY DECISION", hook="Can you trust this number?",
               say=[(4.4, 8.4, "We check the data before it reaches *your desk.*", 0.07, False),
                    (8.4, 11.0, "*Sources.* *Links.* *Logic.*", 0.6, True),
                    (11.0, 15.9, "So you see *the whole picture.*", 0.07, True)],
               services="BI · DATA ARCHITECTURE · DATA GOVERNANCE"),
    "uk": dict(label="ПЕРЕД КОЖНИМ РІШЕННЯМ", hook="Цьому числу можна вірити?",
               say=[(4.4, 8.4, "Ми перевіряємо дані, перш ніж вони ляжуть *вам на стіл.*", 0.07, False),
                    (8.4, 11.0, "*Джерела.* *Зв’язки.* *Логіка.*", 0.6, True),
                    (11.0, 15.9, "Щоб ви бачили *всю картину.*", 0.07, True)],
               services="BI · АРХІТЕКТУРА ДАНИХ · DATA GOVERNANCE"),
}


def seg(t, a, b):
    return ease((t - a) / max(1e-6, b - a))


# ---------------------------------------------------------------- грейд
def grade_luts():
    x = np.arange(256, dtype=np.float32) / 255
    s = np.clip(0.5 + (x - 0.5) * 1.06 + 0.07 * np.sin(np.pi * (x - 0.5)) * (1 - abs(2 * x - 1)), 0, 1)  # м'який S
    lift = (1 - x) ** 3                                    # тіні в графіт із синявою
    hi = np.clip((x - 0.55) / 0.45, 0, 1) ** 1.5            # світла в шампань
    r = s * 255 + 2 * lift + 10 * hi
    g = s * 255 + 5 * lift + 4 * hi
    b = s * 255 + 11 * lift - 6 * hi
    return [np.clip(c, 0, 255).astype(np.uint8) for c in (r, g, b)]


LUTS = grade_luts()


def grade(a):
    out = np.empty_like(a)
    for c in range(3):
        out[..., c] = LUTS[c][a[..., c]]
    f = out.astype(np.float32)
    luma = f @ np.array([0.299, 0.587, 0.114], np.float32)
    f = luma[..., None] + (f - luma[..., None]) * 1.08     # трохи насиченості
    return np.clip(f, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- ролик
class Promo:
    def __init__(self, lang):
        self.lang = lang
        self.S = TEXT[lang]
        self.lock = brand.lockup(52)
        self.logo = brand.logo(220)
        self.f_label = brand.font("body-semi", 28)
        self.f_hook = brand.font("head", 86)
        self.f_say = brand.font("body-semi", 56)
        self.f_big = brand.font("head", 74)
        self.f_name = brand.font("body-semi", 62)
        self.f_serv = brand.font("body-semi", 26)
        self.f_url = brand.font("body-semi", 34)
        self.f_tag = brand.font("body-semi", 26)
        self.f_foot = brand.font("body-semi", 22)
        m = Image.new("L", (1080, 1080), 0)
        ImageDraw.Draw(m).rectangle([70, 70, 1010, 1010], fill=255)
        self.mask = m.filter(ImageFilter.GaussianBlur(40))
        yy, xx = np.mgrid[0:H, 0:W]
        v = 1 - 0.5 * np.clip((np.hypot((xx - 540) / 760, (yy - 1000) / 1200) - 0.55) / 0.6, 0, 1) ** 1.6
        self.vig = v[..., None].astype(np.float32)
        rng = np.random.default_rng(4)
        self.grain = [rng.normal(0, 4.0, (H // 2, W // 2, 1)).astype(np.float32) for _ in range(6)]
        self.dust = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(5, 18), rng.uniform(1, 2.4)) for _ in range(40)]
        top, bot = np.array(MIDNIGHT, np.float32), np.array(GRAPHITE, np.float32)
        y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
        self.base = np.broadcast_to(top + (bot - top) * y, (H, W, 3)).astype(np.float32)
        self.last = None
        self.end_bg = None

    # ---- фон і відео
    def fill(self, src):
        small = Image.fromarray(src).resize((64, 64), Image.BILINEAR)
        w = int(64 * W / H)
        strip = small.crop(((64 - w) // 2, 0, (64 - w) // 2 + w, 64)).filter(ImageFilter.GaussianBlur(2))
        big = np.asarray(strip.resize((W, H), Image.BICUBIC), np.float32)
        return self.base * 0.55 + big * 0.33

    def video_layer(self, img, src, t):
        size = int(1010 + 70 * ease(t / T_V))
        sq = Image.fromarray(src).resize((size, size), Image.LANCZOS).convert("RGBA")
        sq.putalpha(self.mask.resize((size, size), Image.BILINEAR))
        x0, y0 = VC[0] - size // 2, VC[1] - size // 2
        img.alpha_composite(sq, (x0, y0))
        lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        a = int(150 * seg(t, 0.3, 1.2) * (1 - seg(t, T_ZOOM - 0.4, T_ZOOM)))
        if a > 0:                                          # кутові рамки видошукача
            m, L = 26, 54
            x1, y1 = x0 + size, y0 + size
            for cx, cy, sx, sy in ((x0 - m, y0 - m, 1, 1), (x1 + m, y0 - m, -1, 1), (x0 - m, y1 + m, 1, -1),
                                   (x1 + m, y1 + m, -1, -1)):
                d.line([(cx, cy + sy * L), (cx, cy), (cx + sx * L, cy)], fill=(*CHAMPAGNE, a), width=3)
        img.alpha_composite(lay)

    # ---- тексти
    def caption(self, d, text, t, t0, t1, stagger, big):
        if not (t0 <= t < t1 + 0.01):
            return
        f = self.f_big if big else self.f_say
        words = text.split()
        plain = " ".join(w.strip("*") for w in words)
        flags, state = [], False
        for w in words:
            st = w.startswith("*")
            flags.append(state or st)
            state = (state or st) and not w.endswith("*")
        out = 1 - seg(t, t1 - 0.25, t1)
        lines = bwrap(plain, f, 940)
        lh = int(f.size * 1.2)
        y = TEXT_Y + (220 - lh * len(lines)) / 2
        idx = 0
        for ln in lines:
            x = (W - f.getlength(ln)) / 2
            for wd in ln.split():
                k = ease((t - t0 - stagger * idx) / 0.32)
                col = CHAMPAGNE if flags[idx] else WHITE
                d.text((x, y + (1 - k) * 16), wd, font=f, fill=(*col, int(255 * k * out)))
                x += f.getlength(wd + " ")
                idx += 1
            y += lh

    def texts(self, fr, t):
        lay = Image.new("RGBA", fr.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        if t < 4.4:                                        # хук повністю видно з кадру 0
            a = 1 - seg(t, 4.15, 4.4)
            tracked(d, self.S["label"], self.f_label, 540, 262, (*RUBY, int(255 * a)), 7)
            y = 330
            for ln in bwrap(self.S["hook"], self.f_hook, 960):
                d.text((540, y), ln, font=self.f_hook, fill=(*WHITE, int(255 * a)), anchor="ma")
                y += 100
        for t0, t1, s, stg, big in self.S["say"]:
            self.caption(d, s, t, t0, t1, stg, big)
        a = seg(t, 0.6, 1.4) * (1 - seg(t, T_ZOOM - 0.3, T_ZOOM))
        if a > 0:
            tracked(d, self.S["services"], self.f_foot, 540, 1790, (*SILVER, int(200 * a)), 5)
        fr.alpha_composite(lay)

    def finale(self, fr, t):
        u = t - T_V
        lay = Image.new("RGBA", fr.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        k = seg(u, 0.15, 0.85)
        lg = self.logo.resize((int(self.logo.width * (0.9 + 0.1 * k)), int(self.logo.height * (0.9 + 0.1 * k))), Image.LANCZOS)
        nd.comp(fr, lg, W / 2 - lg.width / 2, 830 - lg.height / 2, k)
        sh = u - 1.0                                       # відблиск по логотипу
        if 0 <= sh < 0.8:
            band = Image.new("L", lg.size, 0)
            bd = ImageDraw.Draw(band)
            x = -lg.width * 0.4 + sh / 0.8 * lg.width * 1.8
            bd.polygon([(x, 0), (x + 60, 0), (x - 60 + 60, lg.height), (x - 120 + 60, lg.height)], fill=170)
            band = band.filter(ImageFilter.GaussianBlur(14))
            alpha = np.asarray(lg.getchannel("A"), np.float32) / 255 * np.asarray(band, np.float32)
            glow = Image.new("RGBA", lg.size, (255, 244, 225, 0))
            glow.putalpha(Image.fromarray(alpha.astype(np.uint8)))
            fr.alpha_composite(glow, (int(W / 2 - lg.width / 2), int(830 - lg.height / 2)))
        k2 = seg(u, 0.6, 1.2)
        d.text((540, 1035 + (1 - k2) * 16), "Belyakov Consult", font=self.f_name, fill=(*WHITE, int(255 * k2)), anchor="ma")
        k3 = seg(u, 0.9, 1.5)
        tracked(d, self.S["services"], self.f_serv, 540, 1140, (*SILVER, int(230 * k3)), 5)
        k4 = seg(u, 1.3, 1.9)
        d.line([540 - 70 * k4, 1208, 540 + 70 * k4, 1208], fill=(*RUBY, int(255 * k4)), width=3)
        tracked(d, "BELYAKOVCONSULT.COM", self.f_url, 540, 1250, (*SILVER, int(255 * k4)), 6)
        k5 = seg(u, 1.8, 2.4)                              # якір бренду
        tracked(d, pa.TAGLINE[self.lang], self.f_tag, 540, 1340, (*pa.CHAMPAGNE, int(240 * k5)), 5)
        fr.alpha_composite(lay)

    # ---- кадр
    def frame(self, t, src):
        if src is not None:
            self.last = src
        if t < T_V:
            img = Image.fromarray(np.clip(self.fill(src), 0, 255).astype(np.uint8)).convert("RGBA")
            self.video_layer(img, src, t)
        else:
            if self.end_bg is None:
                bgi = Image.fromarray(self.last).resize((W, W), Image.BILINEAR).filter(ImageFilter.GaussianBlur(26))
                pad = Image.new("RGB", (W, H), GRAPHITE)
                pad.paste(bgi, (0, VC[1] - W // 2))
                self.end_bg = np.asarray(pad.filter(ImageFilter.GaussianBlur(40)), np.float32)
            u = t - T_V
            z = 1.0 + 0.06 * u / (T_TOTAL - T_V)
            e = Image.fromarray(np.clip(self.end_bg * 0.3 + self.base * 0.7, 0, 255).astype(np.uint8))
            cw, ch = W / z, H / z
            e = e.resize((W, H), Image.BILINEAR, box=((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2))
            img = e.convert("RGBA")
        lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        for x, y, sp, r in self.dust:
            yy = (y - sp * t * 3) % H
            d.ellipse([x - r, yy - r, x + r, yy + r], fill=(*CHAMPAGNE, 34))
        img.alpha_composite(lay)
        if t < T_ZOOM:
            img.alpha_composite(self.lock, (72, 116))
            if t < 0.8:                                    # якір болю під хуком (під текстом)
                pa.pain_rings(img, 540, 420, t / 0.8, 1.5)
            self.texts(img, t)
            if 0 <= t - 11.0 < 0.9:                        # якір полегшення
                pa.relief_sweep(img, (90, 270, 990, 540), (t - 11.0) / 0.9)
        else:
            if t >= T_V:
                self.finale(img, t)
        out = np.asarray(img.convert("RGB"), np.float32)
        if T_ZOOM <= t < T_V:                              # наїзд у ядро галактики
            u = (t - T_ZOOM) / (T_V - T_ZOOM)
            z = 1 + 2.2 * u ** 2
            cw, ch = W / z, H / z
            cy = min(max(VC[1], ch / 2), H - ch / 2)       # центр наїзду, але рамка в межах кадру
            im = Image.fromarray(out.astype(np.uint8)).resize(
                (W, H), Image.BILINEAR, box=(VC[0] - cw / 2, cy - ch / 2, VC[0] + cw / 2, cy + ch / 2))
            out = np.asarray(im, np.float32)
            blur = np.asarray(im.reduce(4).filter(ImageFilter.GaussianBlur(6)).resize((W, H)), np.float32)
            out = out * (1 - 0.6 * u) + blur * 0.6 * u
        fl = max(0.0, 1 - abs(t - T_FLASH) / 0.32)         # спалах кольору шампань
        if fl > 0:
            out = out + np.array([255, 236, 205], np.float32) * (fl ** 1.5) * 0.85
        out *= self.vig
        out += np.repeat(np.repeat(self.grain[int(t * FPS) % 6], 2, 0), 2, 1)
        if t > T_TOTAL - 0.6:
            out *= (T_TOTAL - t) / 0.6
        return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- звук
def story_sfx(dry, send):
    dry.put(pa.pain(), 0.0, 0.45)
    dry.put(pa.relief(), 11.0, 0.3, pan=0.1)
    n = int(1.2 * nd.SR)
    riser = nd.sweep_bp(nd.noise(n, 7), 400, 7000) * np.linspace(0, 1, n) ** 2
    send.put(riser, T_FLASH - 1.2, 0.28)
    dry.put(nd.boom_sfx(5), T_FLASH, 0.6)
    send.put(pa.logo(), T_V + 0.45, 0.42)


def render(lang, src: Path, out: Path, track=4):
    out.parent.mkdir(parents=True, exist_ok=True)
    wav = out.with_suffix(".wav")
    nd.soundtrack(wav, story_sfx=story_sfx, track=track)
    pro = Promo(lang)
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(src), "-map", "0:v:0", "-vf",
                            f"crop={SRC_CROP},fps={FPS},hqdn3d=1.2:1.2:2.5:2.5,scale=1080:1080:flags=lanczos,"
                            "unsharp=5:5:0.55:5:5:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                           stdout=subprocess.PIPE)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-i", str(src),
           "-filter_complex", f"[2:a]volume=1.0,atrim=0:{T_V},apad[o];[1:a][o]amix=inputs=2:duration=first:normalize=0,"
           f"atrim=0:{T_TOTAL},afade=t=out:st={T_TOTAL - 1.2}:d=1.2,loudnorm=I=-14:TP=-1.0:LRA=9[a]",
           "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-tune", "film",
           "-x264-params", "aq-mode=3", "-maxrate", "6000k", "-bufsize", "12M", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-t", str(T_TOTAL),
           "-movflags", "+faststart", str(out)]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    fsize = 1080 * 1080 * 3
    cover = None
    try:
        for k in range(int(T_TOTAL * FPS)):
            t = k / FPS
            src_fr = None
            if t < T_V:
                buf = dec.stdout.read(fsize)
                if len(buf) == fsize:
                    src_fr = grade(np.frombuffer(buf, np.uint8).reshape(1080, 1080, 3))
                else:
                    src_fr = pro.last
            img = pro.frame(t, src_fr)
            if k == 0:
                cover = img
            enc.stdin.write(img.tobytes())
    finally:
        enc.stdin.close()
        enc.wait()
        dec.kill()
    wav.unlink(missing_ok=True)
    cover.save(out.with_name(out.stem + "-cover.jpg"), "JPEG", quality=92)
    if enc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {enc.returncode}")
    return out


if __name__ == "__main__":
    print(render(sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 4))
