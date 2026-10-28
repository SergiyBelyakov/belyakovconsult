"""Фонова музика для моушн-відео: власна синтезована доріжка, без ліцензійних обмежень.

Шість стилів (PRESETS), щоб ролики не звучали однаково: різний темп, лад, тембри й ритм.
Стиль кожному відео призначає make_motion (state/video-styles.json): сусідні відео звучать по-різному.
Музика лишається фоновою: RMS близько -20 dBFS, переходи між слайдами підкреслено «повітрям».
Результат детермінований: те саме відео дає ту саму доріжку.
"""
from __future__ import annotations

import hashlib
import wave
from pathlib import Path

import numpy as np

SR = 44100
BPM = 96
BEAT = 60 / BPM          # темп за замовчуванням (стиль analytic)

# Прогресії в мінорі (ступені від тоніки, напівтони): i–VI–III–VII і варіанти
PROGRESSIONS = [
    [(0, 3, 7), (-4, 0, 3), (3, 7, 10), (-2, 2, 5)],     # Am F C G
    [(0, 3, 7), (-2, 2, 5), (-4, 0, 3), (-5, -1, 2)],    # Am G F E-ish
    [(0, 3, 7), (5, 8, 12), (-4, 0, 3), (-2, 2, 5)],     # Am Dm F G
]
TONICS = [57, 55, 52, 50]   # MIDI: A3, G3, E3, D3


def midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n: int, a: float, r: float) -> np.ndarray:
    e = np.ones(n)
    na, nr = min(int(a * SR), n // 2), min(int(r * SR), n // 2)
    if na:
        e[:na] = np.linspace(0, 1, na) ** 1.5
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def tone(freq: float, n: int, harmonics: int = 6, detune: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    out = np.zeros(n)
    for h in range(1, harmonics + 1):
        out += np.sin(2 * np.pi * freq * h * (1 + detune) * t) / (h ** 1.6)
    return out


def one_pole_fft(x: np.ndarray, cutoff: float) -> np.ndarray:
    """Швидкий м'який низькочастотний фільтр у частотній області."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / cutoff) ** 4), n=len(x))


def reverb(x: np.ndarray, seconds: float = 1.8, mix: float = 0.28, seed: int = 1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    ir = one_pole_fft(ir, 3500)
    ir /= np.sqrt((ir ** 2).sum())
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    return (1 - mix) * x + mix * wet


# Прогресії в мажорі/дорійському для світліших стилів
PROG_BRIGHT = [
    [(0, 4, 7), (7, 11, 14), (9, 12, 16), (5, 9, 12)],    # I V vi IV
    [(0, 4, 7), (5, 9, 12), (-3, 0, 4), (7, 11, 14)],     # I IV vi V
]
PROG_DORIAN = [[(0, 3, 7), (5, 9, 12), (0, 3, 7), (-2, 2, 5)]]   # i IV i VII

PRESETS = {
    # name: темп, прогресії, тембр паду, арпеджіо (ділення долі, тембр), ударні, бас
    "analytic":  dict(bpm=96,  progs=PROGRESSIONS, pad="warm",  arp=(2, "pluck"), drums="soft",  bass="half",  tonics=[57, 55, 52, 50]),
    "pulse":     dict(bpm=118, progs=PROGRESSIONS, pad="saw",   arp=(4, "pluck"), drums="four",  bass="eighth", tonics=[50, 52, 53]),
    "ambient":   dict(bpm=76,  progs=PROG_DORIAN,  pad="glass", arp=(1, "bell"),  drums="none",  bass="long",  tonics=[50, 52, 55]),
    "lofi":      dict(bpm=84,  progs=PROG_BRIGHT,  pad="warm",  arp=(2, "keys"),  drums="swing", bass="half",  tonics=[53, 55, 48]),
    "cinematic": dict(bpm=88,  progs=PROGRESSIONS, pad="strings", arp=(0, None),  drums="taiko", bass="long",  tonics=[50, 48, 52]),
    "bright":    dict(bpm=104, progs=PROG_BRIGHT,  pad="glass", arp=(2, "bell"),  drums="soft",  bass="eighth", tonics=[55, 57, 53]),
}
STYLE_NAMES = list(PRESETS)


def beat_of(style: str | None) -> float:
    return 60 / PRESETS.get(style or "analytic", PRESETS["analytic"])["bpm"]


def _pad_voice(kind: str, f: float, n: int) -> np.ndarray:
    if kind == "saw":
        return tone(f, n, 9, 0.003) + tone(f, n, 9, -0.003)
    if kind == "glass":
        t = np.arange(n) / SR
        return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.01 * t) + 0.12 * np.sin(2 * np.pi * f * 3 * t)) * 0.9
    if kind == "strings":
        t = np.arange(n) / SR
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t)
        ph = 2 * np.pi * f * np.cumsum(vib) / SR
        return sum(np.sin(ph * h) / h ** 1.2 for h in range(1, 8)) * 0.8
    return tone(f, n, 5, 0.0015) + tone(f, n, 5, -0.0015)        # warm


def _arp_voice(kind: str, f: float, n: int) -> np.ndarray:
    t = np.arange(n) / SR
    if kind == "bell":
        return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)) * np.exp(-t * 3.2)
    if kind == "keys":       # електропіаніно: м'яка атака, кілька гармонік
        return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)) * np.exp(-t * 4.5)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 7)   # pluck


def generate(duration: float, cuts: list[float], key: str, out: Path, style: str | None = None) -> Path:
    seed = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    P = PRESETS.get(style or "analytic", PRESETS["analytic"])
    beat = 60 / P["bpm"]
    prog = P["progs"][seed % len(P["progs"])]
    tonic = P["tonics"][(seed // 7) % len(P["tonics"])]
    total = int((duration + 0.2) * SR)
    pad, bass, arp, perc, fx = (np.zeros(total) for _ in range(5))

    chord_len = 8 * beat
    n_chords = int(np.ceil(duration / chord_len)) + 1
    for c in range(n_chords):
        start = c * chord_len
        s0 = int(start * SR)
        if s0 >= total:
            break
        chord = prog[c % len(prog)]
        n = min(int((chord_len + 1.2) * SR), total - s0)
        e = env_adsr(n, 1.6 if P["pad"] in ("strings", "glass") else 0.9, 1.4)
        for iv in chord + (chord[0] + 12,):
            pad[s0:s0 + n] += _pad_voice(P["pad"], midi_hz(tonic + iv), n) * e * (0.045 if P["pad"] == "saw" else 0.06)
        root = midi_hz(tonic + chord[0] - 24)
        hits = {"half": range(0, 8, 2), "eighth": [x / 2 for x in range(16)], "long": [0]}[P["bass"]]
        for b in hits:
            bs = int((start + b * beat) * SR)
            if bs >= total:
                break
            ln = chord_len if P["bass"] == "long" else beat * (0.45 if P["bass"] == "eighth" else 1.9)
            bn = min(int(ln * SR), total - bs)
            t = np.arange(bn) / SR
            dec = 0.4 if P["bass"] == "long" else (6 if P["bass"] == "eighth" else 2.2)
            bass[bs:bs + bn] += np.sin(2 * np.pi * root * t) * np.exp(-t * dec) * env_adsr(bn, 0.01, 0.2) * (0.26 if P["bass"] == "eighth" else 0.32)
        div, timbre = P["arp"]
        if div and start >= 3.0:
            steps = 4 * div * 2
            pattern = rng.permutation([0, 1, 2, 3, 2, 1, 3, 0])
            tones = list(chord) + [chord[0] + 12]
            for i8 in range(steps):
                ts = start + i8 * beat / div
                if ts >= duration - 2.5:
                    break
                if div == 1 and i8 % 2:          # амбієнт: рідкі дзвіночки
                    continue
                s = int(ts * SR)
                pn = min(int((1.4 if timbre == "bell" else 0.5) * SR), total - s)
                f = midi_hz(tonic + 12 + tones[pattern[i8 % 8]])
                vel = (0.05 if i8 % 2 == 0 else 0.032) * (0.8 if div == 4 else 1)
                arp[s:s + pn] += _arp_voice(timbre, f, pn) * vel
        if P["pad"] == "strings" and start >= 2.0:     # кінематографічна мелодія: повільні ноти
            for j, iv in enumerate((chord[2] + 12, chord[1] + 12)):
                ts = start + j * 4 * beat
                s = int(ts * SR)
                if ts >= duration - 3:
                    break
                pn = min(int(4 * beat * SR), total - s)
                arp[s:s + pn] += _pad_voice("strings", midi_hz(tonic + 12 + iv), pn) * env_adsr(pn, 0.6, 1.0) * 0.03

    beat_n = int(duration / beat)
    noise = rng.standard_normal(int(0.08 * SR))
    hat = one_pole_fft(np.diff(noise, prepend=0), 7000) * np.exp(-np.linspace(0, 9, len(noise)))
    def kick(s, amp, f0=90, f1=45, dec=14):
        kn = min(int(0.3 * SR), total - s)
        t = np.arange(kn) / SR
        freq = f0 * np.exp(-t * 18) + f1
        perc[s:s + kn] += np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * dec) * amp
    drums = P["drums"]
    for b in range(beat_n):
        ts = b * beat
        if drums == "none" or ts < 4.0 or ts > duration - 2.0:
            continue
        s = int(ts * SR)
        if drums == "four":
            kick(s, 0.24)
        elif drums == "soft" and b % 2 == 0:
            kick(s, 0.22)
        elif drums == "swing" and b % 4 in (0, 2):
            kick(s, 0.2, 80, 42, 12)
        elif drums == "taiko" and b % 8 == 0:
            kick(s, 0.36, 70, 38, 6)
        if drums in ("four", "soft"):
            hs = int((ts + beat / 2) * SR)
            if hs + len(hat) < total:
                perc[hs:hs + len(hat)] += hat * (0.03 if drums == "four" else 0.022)
        if drums == "swing":
            for off in (0.0, 0.66):           # шафл
                hs = int((ts + off * beat) * SR)
                if hs + len(hat) < total:
                    perc[hs:hs + len(hat)] += hat * (0.018 if off else 0.012)
    if style == "lofi":                        # легкий шум платівки
        perc += one_pole_fft(rng.standard_normal(total), 5000) * 0.004

    for cut in cuts:
        a, b = int((cut - 0.6) * SR), int((cut + 0.15) * SR)
        if a < 0 or b > total:
            continue
        nz = rng.standard_normal(b - a)
        nz = one_pole_fft(nz, 2400) - one_pole_fft(nz, 300)
        sw = np.linspace(0, 1, b - a) ** 2.2
        sw[-int(0.15 * SR):] *= np.linspace(1, 0, int(0.15 * SR))
        fx[a:b] += nz * sw * 0.10
        if drums == "taiko":
            kick(int(cut * SR), 0.3, 60, 34, 5)

    dry = pad + bass + arp + perc + fx
    wet = reverb(pad + arp + fx, seconds=2.8 if style in ("ambient", "cinematic") else 1.8, seed=seed)
    mix = 0.55 * dry + 0.45 * (wet + bass + perc)
    mix *= env_adsr(total, 1.2, 2.6)
    d = int(0.012 * SR)
    left = mix
    right = np.concatenate([np.zeros(d), mix[:-d]]) * 0.96 + 0.04 * mix
    st = np.stack([left, right], axis=1)
    rms = np.sqrt((st ** 2).mean()) or 1
    st *= 10 ** (-20 / 20) / rms
    peak = np.abs(st).max() or 1
    if peak > 10 ** (-1 / 20):
        st *= 10 ** (-1 / 20) / peak
    pcm = (np.clip(st, -1, 1) * 32767).astype("<i2")
    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return out


if __name__ == "__main__":
    import sys
    dur = float(sys.argv[1]) if len(sys.argv) > 1 else 30
    st = sys.argv[2] if len(sys.argv) > 2 else "analytic"
    print(generate(dur, [4.2, 8.8, 13.4], "demo", Path(f"music-{st}.wav"), st))
