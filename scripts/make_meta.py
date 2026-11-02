"""Метагумор: «This video has a duplicate» (22 с, англійською, 9:16).

Ролик підписує власні сцени, як чернетку монтажу ([HOOK], [SCENE 2: THE CAPYBARA LOOKS SERIOUS],
[SCENE 3: A CHART, FOR CREDIBILITY]), потім дослівно повторює сцену 2, застигає і знаходить у собі дублікат:
«DUPLICATE SCENE DETECTED. SCENES: 4 · UNIQUE: 3». Дві сцени зливаються в одну («MERGED»), висновок:
«If a 22-second video can have duplicates, so can your register.» Фінал: «CHECK FOR DUPLICATES. EVEN HERE.»

Запуск: python scripts/make_meta.py <папка>
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
from make_fun import (  # noqa: E402
    BAR, BAR_BG, FPS, GRAPHITE, INK, PANEL, PANEL_LINE, RUBY, SILVER, SR, WHITE, Mix, back, clamp, crash, ease,
    fit_size, groove, kick, melody, put, sfx_ding, sfx_pop, sfx_scratch, sfx_whoosh, stamp, text_block, xform)
from make_grwm import draw_capy  # noqa: E402

W, H = 1080, 1920
BEAT = 0.5
TOTAL = 22.0
S = [0.0, 2.6, 5.2, 7.8, 10.2, 13.2, 16.2, 19.0]   # початки сцен: hook, capy, chart, capy (дубль), detect, merge, takeaway, end
TAGS = ["[HOOK]", "[SCENE 2: THE CAPYBARA LOOKS SERIOUS]", "[SCENE 3: A CHART, FOR CREDIBILITY]",
        "[SCENE 2: THE CAPYBARA LOOKS SERIOUS]", "[QUALITY CHECK]", "[SCENE 4: DEDUPLICATION]", "[SCENE 5: THE TAKEAWAY]",
        "[END CARD: THE PART WHERE WE ASK FOR A COMMENT]"]


def scene_of(t):
    return max(i for i, s0 in enumerate(S) if t >= s0)


class Meta:
    def __init__(self):
        bg = Image.new("RGB", (W, H), GRAPHITE)
        d = ImageDraw.Draw(bg)
        for x in range(0, W, 60):
            d.line([x, 0, x, H], fill=(13, 16, 22))
        for y in range(0, H, 60):
            d.line([0, y, W, y], fill=(13, 16, 22))
        glow = Image.new("L", (W, H), 0)
        gd = ImageDraw.Draw(glow)
        for i in range(30, 0, -1):
            r = int(W * 0.8 * i / 30)
            gd.ellipse([W // 2 - r, int(H * 0.55) - r, W // 2 + r, int(H * 0.55) + r], fill=int(60 * (1 - i / 30) ** 2))
        self.bg = Image.composite(Image.new("RGB", (W, H), RUBY), bg, glow)
        self.capy = xform(draw_capy(8), 0.82)
        self.lock = brand.lockup(50)
        self.logo = brand.logo(170)
        self._c = {}
        self.thumb = None

    def cache(self, key, fn):
        if key not in self._c:
            self._c[key] = fn()
        return self._c[key]

    def tag(self, f, i, u):
        def mk():
            fn = brand.font("body-semi", fit_size([TAGS[i]], W - 200, 34, "body-semi"))
            probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
            w = int(probe.textlength(TAGS[i], font=fn)) + 44
            im = Image.new("RGBA", (w, int(fn.size * 1.25) + 24), (0, 0, 0, 0))
            d = ImageDraw.Draw(im)
            d.rounded_rectangle([0, 0, w - 1, im.height - 1], 14, fill=(17, 22, 31, 235), outline=PANEL_LINE, width=2)
            d.text((22, 11), TAGS[i], font=fn, fill=SILVER)
            return im
        im = self.cache(("tag", i), mk)
        n = int(len(TAGS[i]) * clamp(u / 0.4))                 # «друкується», як титр монтажу
        if n < len(TAGS[i]):
            im = im.crop((0, 0, max(30, int(im.width * n / len(TAGS[i]))), im.height))
        put(f, im, 60 + im.width / 2, 250 + im.height / 2)

    def caption(self, f, key, lines, cols, u, y=380, size=110):
        im = self.cache(("cap", key), lambda: text_block(lines, fit_size(lines, W - 130, size), cols))
        put(f, xform(im, 0.6 + 0.4 * back(u / 0.32)), W / 2, y + im.height / 2, clamp(u * 6))

    def scene_capy(self, f, u):
        """Сцена 2 (і її дубль): капібара серйозно дивиться, відблиск окулярів."""
        self.caption(f, "capy", ["The capybara", "looks serious."], [WHITE, SILVER], u)
        rise = ease(u / 0.5)
        cy = H + 240 - self.capy.height / 2 + (1 - rise) * 500
        put(f, self.capy, W / 2, cy)
        g = (u - 1.2) / 0.35
        if 0 <= g <= 1:
            d = ImageDraw.Draw(f, "RGBA")
            for ex in (380 - 118, 380 + 118):
                gx = W / 2 + (ex - 380) * 0.82
                gy = cy + ((210 + 110) - 590) * 0.82
                r = 50
                off = (g * 2 - 1) * r * 0.8
                d.line([gx - r * 0.5 + off, gy + r * 0.5, gx + r * 0.5 + off, gy - r * 0.5], fill=(255, 255, 255, 230), width=10)

    def frame(self, t, freeze=None):
        f = self.bg.copy()
        i = scene_of(t)
        u = t - S[i]
        if i not in (4,):
            put(f, self.lock, 60 + self.lock.width / 2, 150 + self.lock.height / 2, 0.9)
            self.tag(f, i, u)
        if i == 0:
            self.caption(f, "hook", ["THIS VIDEO IS", "ABOUT DATA", "QUALITY."], [WHITE, WHITE, RUBY], u, y=520, size=130)
            if u > 1.2:
                im = self.cache("sup", lambda: text_block(["(supposedly)"], 64, [SILVER], 6))
                put(f, xform(im, 0.6 + 0.4 * back((u - 1.2) / 0.3), -4), W / 2, 1040, clamp((u - 1.2) * 6))
        elif i in (1, 3):
            self.scene_capy(f, u)
        elif i == 2:
            self.caption(f, "chart", ["A chart.", "For credibility."], [WHITE, RUBY], u)
            d = ImageDraw.Draw(f, "RGBA")
            x0, y0, x1, y1 = 120, 760, W - 120, 1380
            d.rounded_rectangle([x0, y0, x1, y1], 24, fill=(*PANEL, 245), outline=PANEL_LINE, width=3)
            vals = [0.35, 0.5, 0.42, 0.68, 0.86]
            for k, v in enumerate(vals):
                g = ease((u - 0.3 - k * 0.12) / 0.5)
                bx = x0 + 70 + k * 168
                hh = (y1 - y0 - 200) * v * g
                d.rounded_rectangle([bx, y1 - 110 - hh, bx + 110, y1 - 110], 10, fill=RUBY if k == 4 else BAR)
            d.line([x0 + 50, y1 - 108, x1 - 50, y1 - 108], fill=PANEL_LINE, width=3)
            if u > 1.3:
                im = self.cache("foot", lambda: text_block(["Illustrative data. Labeled as such."], 40, [SILVER], 5))
                put(f, im, W / 2, y1 + 70, clamp((u - 1.3) * 4))
        elif i == 4:
            f = freeze.copy() if freeze is not None else f
            if u < 0.5:                                            # глюк: зсув каналів
                r, g_, b = f.split()
                sh = int(14 * (1 - u / 0.5))
                f = Image.merge("RGB", (r.transform(r.size, Image.AFFINE, (1, 0, sh, 0, 1, 0)), g_, b.transform(b.size, Image.AFFINE, (1, 0, -sh, 0, 1, 0))))
            f = Image.blend(f, Image.new("RGB", f.size, GRAPHITE), 0.45)
            st = self.cache("dup", lambda: stamp("DUPLICATE SCENE DETECTED", 52))
            put(f, xform(st, 0.6 + 0.4 * back(u / 0.25), -6), W / 2, 640)
            if u > 0.6:
                im = self.cache("cnt", lambda: text_block(["SCENES: 4", "UNIQUE: 3"], 96, [WHITE, RUBY], 8))
                put(f, xform(im, 0.7 + 0.3 * back((u - 0.6) / 0.3)), W / 2, 900, clamp((u - 0.6) * 5))
            if u > 1.5:
                bub = self.cache("bub", lambda: self.bubble(["Wait. We already", "had this one."]))
                put(f, xform(bub, 0.7 + 0.3 * back((u - 1.5) / 0.3)), W * 0.62, 1180, clamp((u - 1.5) * 5))
        elif i == 5:
            self.caption(f, "merge", ["Merged.", "One scene. One owner."], [WHITE, RUBY], u, size=100)
            th = self.thumb
            sep = (1 - ease((u - 0.6) / 0.7)) * 280
            for k, sx in enumerate((-1, 1)):
                if u > 1.3 and k == 1:
                    continue
                x = W / 2 + sx * sep
                put(f, th, x, 1050)
                lab = self.cache(("lab", k), lambda k=k: text_block(["SCENE 2" if k == 0 else "SCENE 2 (AGAIN)"], 34, [SILVER], 5))
                if u < 1.3:
                    put(f, lab, x, 1050 + th.height / 2 + 40)
            if u > 1.3:
                st = self.cache("merged", lambda: stamp("MERGED", 60))
                put(f, xform(st, 0.6 + 0.4 * back((u - 1.3) / 0.25), 6), W / 2, 1050)
        elif i == 6:
            self.caption(f, "take", ["IF A 22-SECOND", "VIDEO CAN HAVE", "DUPLICATES,", "SO CAN YOUR", "REGISTER."],
                         [WHITE, WHITE, WHITE, WHITE, RUBY], u, y=480, size=100)
        else:
            self.caption(f, "end", ["CHECK FOR", "DUPLICATES.", "EVEN HERE."], [WHITE, WHITE, RUBY], u, y=380, size=120)
            if u > 0.5:
                put(f, xform(self.logo, 0.7 + 0.3 * back((u - 0.5) / 0.4)), W / 2, 980, clamp((u - 0.5) * 4))
            if u > 0.9:
                c = self.cache("cta", lambda: text_block(["Spotted it before the capybara?", "Comment “meta”."], 52, [WHITE, RUBY], 6))
                put(f, c, W / 2, 1180 + c.height / 2, clamp((u - 0.9) * 3))
                c3 = self.cache("url", lambda: text_block(["belyakovconsult.com"], 40, [SILVER], 5))
                put(f, c3, W / 2, 1400, clamp((u - 1.1) * 3))
        if any(0 <= t - s0 < 0.05 for s0 in S[1:]):
            f = Image.blend(f, Image.new("RGB", f.size, WHITE), 0.1)
        return f

    def make_thumb(self):
        im = xform(self.frame(S[1] + 1.0), 0.34).convert("RGBA")
        ImageDraw.Draw(im).rounded_rectangle([0, 0, im.width - 1, im.height - 1], 18, outline=(*PANEL_LINE, 255), width=4)
        return im

    def bubble(self, lines):
        fb = brand.font("head", 48)
        probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        bw = int(max(probe.textlength(l, font=fb) for l in lines)) + 64
        lh = int(48 * 1.25)
        bh = lh * len(lines) + 46
        im = Image.new("RGBA", (bw, bh + 56), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, bw - 1, bh], 26, fill=WHITE)
        d.polygon([60, bh - 4, 120, bh - 4, 36, bh + 52], fill=WHITE)
        for k, l in enumerate(lines):
            d.text((32, 22 + k * lh), l, font=fb, fill=INK)
        return im

    def poster(self):
        f = self.bg.copy()
        im = text_block(["THIS VIDEO", "HAS A", "DUPLICATE."], 150, [WHITE, WHITE, RUBY], 10)
        put(f, im, W / 2, 330 + im.height / 2)
        q = text_block(["Can you spot it?"], 70, [SILVER], 6)
        put(f, q, W / 2, 330 + im.height + 50 + q.height / 2)
        put(f, xform(self.capy, 0.9), W / 2, H + 200 - self.capy.height * 0.9 / 2)
        put(f, self.lock, 60 + self.lock.width / 2, 150 + self.lock.height / 2, 0.9)
        return f


def soundtrack(path: Path):
    m = Mix(TOTAL)
    hook = [(72, 1), (74, 1), (76, 2), (79, 2), (76, 1), (74, 1), (72, 2), (67, 2), (69, 1), (72, 1), (74, 2), (72, 4)]
    groove(m, 0.0, S[4], ["C", "Am", "F", "G"], BEAT, arp=True, seed=3)
    melody(m, S[1], S[4], BEAT, hook * 2, gain=0.11)
    m.put(crash(6), S[5], 0.25)
    m.put(kick(), S[5], 0.9)
    groove(m, S[5], TOTAL - 0.6, ["F", "G", "C", "C"], BEAT, arp=True, seed=7)
    melody(m, S[6], TOTAL - 0.6, BEAT, hook, gain=0.1)
    music = m.x / max(1e-9, np.abs(m.x).max()) * 0.62
    fx = Mix(TOTAL)
    for s0 in S[1:4] + S[5:]:
        fx.put(sfx_whoosh(0.35, int(s0 * 10)), s0 - 0.12, 0.3)
    fx.put(sfx_scratch(), S[4] - 0.02, 0.8)
    fx.put(sfx_ding(880, 1.0), S[4] + 0.05, 0.5)
    fx.put(sfx_ding(1568, 0.6), S[4] + 0.6, 0.3)
    fx.put(sfx_pop(0.24, 5), S[5] + 1.3, 0.6)
    fx.put(sfx_ding(1320, 1.0), S[7] + 0.5, 0.4)
    sfx = fx.x / max(1e-9, np.abs(fx.x).max()) * 0.8
    n = int(TOTAL * SR)
    mix = (music * 0.85 + sfx * 0.6)[:n]
    mix[-int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))
    mix /= max(1.0, np.abs(mix).max() / 0.95)
    st = np.stack([mix, mix], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())


def render(out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    wav = out_dir / "meta.wav"
    soundtrack(wav)
    v = Meta()
    v.thumb = v.make_thumb()
    v.poster().save(out_dir / "meta-9x16-cover.jpg", "JPEG", quality=92)
    mp4 = out_dir / "meta-9x16.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(wav), "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", str(mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    freeze = None
    try:
        for k in range(int(TOTAL * FPS)):
            t = k / FPS
            if scene_of(t) == 3:
                freeze = None
            img = v.frame(t, freeze)
            if scene_of(t) == 3:
                freeze_src = img
            if freeze is None and scene_of(t) == 4:
                freeze = freeze_src
                img = v.frame(t, freeze)
            proc.stdin.write(img.tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    wav.unlink(missing_ok=True)
    if proc.returncode:
        raise RuntimeError(f"ffmpeg завершився з кодом {proc.returncode}")
    return mp4


if __name__ == "__main__":
    print(render(Path(sys.argv[1])))
