"""Клікбейтна обкладинка й 0,6-секундне інтро для реклами «Директор і GTA VI» (20.11.2026).

Комікс-колаж із кадрів нашого ж ролика (директор у кабінеті, контролер, купе на червоному, телефон із дашбордом,
директор у машині), стилізованих під мальовану ілюстрацію, на тлі заходу сонця з силуетами пальмового листя.
Палітра як у моді на обкладинки ігор цього сезону, але без чужих логотипів, шрифтів, персонажів і арту.

Запуск: python scripts/make_gta_cover.py <кліп.mp4> <uk|en> <video.mp4>
  створює <video>-cover.jpg поруч і переписує <video> з інтро-обкладинкою на початку (0,6 с)
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
import make_gta_ad as ad  # noqa: E402
import make_nightdrive as nd  # noqa: E402

W, H = 1080, 1920
INK = (26, 12, 46)
TOP = (34, 20, 72)
MID = (150, 60, 140)
LOW = (236, 120, 110)
PEACH = (255, 196, 150)
HOT = (255, 64, 132)
SUN = (255, 196, 64)

TEXT = {
    "uk": dict(top="ПІСЛЯ ВИХОДУ GTA VI", h1="ДИРЕКТОР ЗНИК", h2="ЗНАЙШЛИ НА СВІТЛОФОРІ", sticker="ЩО ТАМ\nУ П’ЯТНИЦЮ?!"),
    "en": dict(top="AFTER GTA VI DROPPED", h1="THE DIRECTOR VANISHED", h2="FOUND AT A RED LIGHT", sticker="WHAT HAPPENED\nON FRIDAY?!"),
}


def comic(rgb: np.ndarray) -> np.ndarray:
    """Кадр у мальовану ілюстрацію: згладжені площини, обмежена палітра, контурні лінії, тепліший колір."""
    img = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    for _ in range(4):
        img = cv2.bilateralFilter(img, 9, 40, 9)
    z = img.reshape(-1, 3).astype(np.float32)
    _, lab, cen = cv2.kmeans(z, 14, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 12, 1.0), 2,
                             cv2.KMEANS_PP_CENTERS)
    q = cen[lab.flatten()].reshape(img.shape).astype(np.uint8)
    gray = cv2.medianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 5)
    edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 11, 6)
    edges = cv2.erode(edges, np.ones((2, 2), np.uint8))
    out = cv2.bitwise_and(q, q, mask=edges)
    hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.35, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * 1.12 + 6, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32)
    out = out * np.array([1.04, 0.98, 1.02]) + np.array([6, 0, 10])  # теплий рожевий відтінок
    return np.clip(out, 0, 255).astype(np.uint8)


def frames_from(src: Path):
    cap = cv2.VideoCapture(str(src))
    fr = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        fr.append(f)
    return fr


def panel_img(rgb, box, size):
    x0, y0, x1, y1 = box
    im = Image.fromarray(rgb[y0:y1, x0:x1]).resize(size, Image.LANCZOS)
    return Image.fromarray(comic(np.asarray(im)))


def frond(d, x, y, ang, L, col, w=46):
    spine = []
    for j in range(18):
        u = j / 17
        spine.append((x + L * u * math.cos(ang), y + L * u * math.sin(ang) + 0.35 * L * u * u))
    left, right = [], []
    for j in range(1, 18):
        u = j / 17
        ww = w * math.sin(math.pi * u) ** 0.7
        dx, dy = spine[j][0] - spine[j - 1][0], spine[j][1] - spine[j - 1][1]
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        for k, side in ((1, left), (-1, right)):
            jag = 1 + 0.35 * math.sin(j * 2.7)
            side.append((spine[j][0] + k * nx * ww * jag, spine[j][1] + k * ny * ww * jag))
    d.polygon([spine[0]] + left + right[::-1], fill=col)


def background():
    g = np.linspace(0, 1, H)[:, None]
    stops = [(0.0, TOP), (0.45, MID), (1.0, LOW)]
    col = np.zeros((H, 3))
    for c in range(3):
        col[:, c] = np.interp(g[:, 0], [s[0] for s in stops], [s[1][c] for s in stops])
    img = Image.fromarray(np.broadcast_to(col[:, None, :], (H, W, 3)).astype(np.uint8)).convert("RGBA")
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    rng = np.random.default_rng(3)
    for cx, cy, base in ((-60, 120, 0.2), (W + 60, 160, math.pi - 0.2), (-80, H - 260, -0.4), (W + 80, H - 220, math.pi + 0.4)):
        for k in range(7):
            frond(d, cx, cy, base + (k - 3) * 0.32 + rng.uniform(-0.08, 0.08), rng.uniform(380, 560), (40, 14, 60, 120))
    img.alpha_composite(lay.filter(ImageFilter.GaussianBlur(2)))
    return img


def outlined(d, xy, text, font, fill, stroke=12, shadow=(0, 0, 0, 120), anchor="mm"):
    x, y = xy
    d.text((x + 8, y + 10), text, font=font, fill=shadow, anchor=anchor, stroke_width=stroke, stroke_fill=shadow)
    d.text((x, y), text, font=font, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=INK)


def fit(text, size, maxw, kind="head"):
    while size > 30:
        f = brand.font(kind, size)
        if f.getlength(text) <= maxw:
            return f
        size -= 4
    return brand.font(kind, size)


def cover(src: Path, lang: str) -> Image.Image:
    T = TEXT[lang]
    fr = frames_from(src)
    rgb = lambda k: cv2.cvtColor(fr[k], cv2.COLOR_BGR2RGB)  # noqa: E731
    pos = ad.track(fr)
    car = cv2.cvtColor(ad.clean_badges(fr[104], pos[104]), cv2.COLOR_BGR2RGB)
    phone = np.asarray(ad.Ad(lang).insert(cv2.cvtColor(ad.upscale(fr[130]), cv2.COLOR_BGR2RGB), 1.0))

    img = background()
    d = ImageDraw.Draw(img)
    f_top = brand.font("body-semi", 34)
    nd.tracked(d, T["top"], f_top, W / 2, 118, (*PEACH, 255), 12)

    G = 14                                                   # міжпанельний проміжок
    X0, X1, Y0, Y1 = 70, 1010, 190, 1720
    frame_box = [X0 - 16, Y0 - 16, X1 + 16, Y1 + 16]
    d.rectangle(frame_box, fill=INK)
    d.rectangle(frame_box, outline=(*HOT, 255), width=4)
    xm = (X0 + X1) // 2
    ya, yb = Y0 + 640, Y0 + 640 + G + 400
    panels = [
        ((X0, Y0, X1, ya), rgb(8), (0, 330, 720, 330 + int(720 * (ya - Y0) / (X1 - X0)))),     # директор у кабінеті
        ((X0, ya + G, xm - G // 2, yb), rgb(86), (60, 360, 660, 360 + int(600 * 400 / (xm - G // 2 - X0)))),  # контролер
        ((xm + G // 2, ya + G, X1, yb), car, (40, 470, 680, 470 + int(640 * 400 / (X1 - xm - G // 2)))),  # купе на червоному
        ((X0, yb + G, xm - G // 2, Y1), phone, (180, 640, 900, 640 + int(720 * (Y1 - yb - G) / (xm - G // 2 - X0)))),  # телефон
        ((xm + G // 2, yb + G, X1, Y1), rgb(180), (20, 80, 620, 80 + int(600 * (Y1 - yb - G) / (X1 - xm - G // 2)))),  # палець угору
    ]
    for (bx0, by0, bx1, by1), src_img, crop in panels:
        size = (bx1 - bx0, by1 - by0)
        p = panel_img(src_img, crop, size) if src_img is not phone else Image.fromarray(src_img[crop[1]:crop[3], crop[0]:crop[2]]).resize(size, Image.LANCZOS)
        img.paste(p, (bx0, by0))
        d.rectangle([bx0, by0, bx1 - 1, by1 - 1], outline=(255, 244, 236, 255), width=5)

    # заголовок-бейдж по центру колажу
    cy = ya + 8
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    f1 = fit(T["h1"], 118, 900)
    f2 = fit(T["h2"], 74, 860)
    bw = max(f1.getlength(T["h1"]), f2.getlength(T["h2"])) + 90
    ld.rounded_rectangle([W / 2 - bw / 2, cy - 120, W / 2 + bw / 2, cy + 128], 26, fill=(*HOT, 255), outline=INK, width=10)
    ld.rounded_rectangle([W / 2 - bw / 2 + 16, cy - 104, W / 2 + bw / 2 - 16, cy + 112], 18, outline=(255, 236, 220, 160), width=3)
    outlined(ld, (W / 2, cy - 38), T["h1"], f1, (255, 255, 255, 255), 10)
    outlined(ld, (W / 2, cy + 66), T["h2"], f2, (*SUN, 255), 8)
    lay = lay.rotate(-4, resample=Image.BICUBIC, center=(W / 2, cy))
    img.alpha_composite(lay)

    # наліпка біля телефона
    st = Image.new("RGBA", (420, 420), (0, 0, 0, 0))
    sd = ImageDraw.Draw(st)
    pts = [(210 + (190 if k % 2 == 0 else 160) * math.cos(k * math.pi / 12), 210 + (190 if k % 2 == 0 else 160) * math.sin(k * math.pi / 12))
           for k in range(24)]
    sd.polygon(pts, fill=(*SUN, 255), outline=INK, width=8)
    lines = T["sticker"].split("\n")
    fs = brand.font("head", 44)
    for size in range(44, 20, -2):
        fs = brand.font("head", size)
        if max(fs.getlength(ln) for ln in lines) <= 300:
            break
    y = 210 - 30
    for ln in lines:
        sd.text((210, y), ln, font=fs, fill=INK, anchor="mm")
        y += 60
    st = st.rotate(12, resample=Image.BICUBIC)
    img.alpha_composite(st.resize((300, 300), Image.LANCZOS), (xm - 140, yb - 220))

    logo = brand.lockup(46)
    img.alpha_composite(logo, (int(W / 2 - logo.width / 2), 1790))
    return img.convert("RGB")


def intro(cover_img: Image.Image, video: Path, sec=0.6):
    """Ставить обкладинку на початок ролика: 0,6 с з ледь помітним наїздом і ударом, далі ролик як був."""
    tmp = video.with_name(video.stem + "-intro-src.mp4")
    video.rename(tmp)
    cimg = video.with_name(video.stem + "-intro.png")
    cover_img.save(cimg)
    n = int(sec * 24)
    boom = nd.boom_sfx(3)
    wav = video.with_name(video.stem + "-intro.wav")
    import wave
    a = np.zeros(int(sec * 48000))
    b = np.interp(np.linspace(0, len(boom) - 1, int(len(boom) * 48000 / nd.SR)), np.arange(len(boom)), boom)[:len(a)]
    a[:len(b)] += 0.5 * b / (np.abs(b).max() + 1e-9)
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(48000)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())
    fc = (f"[0:v]scale=1080:1920,zoompan=z='1.06-0.06*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s=1080x1920:fps=24,"
          f"format=yuv420p,setsar=1[v0];[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a0];"
          f"[2:v]setsar=1[v1];[2:a]aformat=sample_rates=48000:channel_layouts=stereo[a1];"
          f"[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(cimg), "-i", str(wav), "-i", str(tmp),
           "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
           "-tune", "film", "-maxrate", "6000k", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(video)]
    subprocess.run(cmd, check=True)
    for p in (tmp, cimg, wav):
        p.unlink(missing_ok=True)


if __name__ == "__main__":
    src, lang, video = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
    img = cover(src, lang)
    img.save(video.with_name(video.stem + "-cover.jpg"), "JPEG", quality=93)
    if "--no-intro" not in sys.argv:
        intro(img, video)
    print(video)
