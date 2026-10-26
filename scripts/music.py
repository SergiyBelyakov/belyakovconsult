"""Фонова музика для моушн-відео: власна синтезована доріжка, без ліцензійних обмежень.

Характер: спокійний «аналітичний» ембієнт, 96 BPM, ля мінор. М'які пади, глибокий бас,
легке арпеджіо й тихий ритм, щоб текст читався, а не боровся з музикою.
Переходи між слайдами підкреслено м'яким «свистом» повітря; наприкінці акорд затихає.

Тональність і рисунок арпеджіо залежать від назви статті (seed), тож у різних роликів
трохи різна музика, але один стиль. Результат детермінований: та сама стаття дає ту саму доріжку.
"""
from __future__ import annotations

import hashlib
import wave
from pathlib import Path

import numpy as np

SR = 44100
BPM = 96
BEAT = 60 / BPM

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


def generate(duration: float, cuts: list[float], key: str, out: Path) -> Path:
    seed = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    prog = PROGRESSIONS[seed % len(PROGRESSIONS)]
    tonic = TONICS[(seed // 7) % len(TONICS)]
    total = int((duration + 0.2) * SR)
    pad = np.zeros(total)
    bass = np.zeros(total)
    arp = np.zeros(total)
    perc = np.zeros(total)
    fx = np.zeros(total)

    chord_len = 8 * BEAT              # два такти на акорд
    n_chords = int(np.ceil(duration / chord_len)) + 1
    for c in range(n_chords):
        start = c * chord_len
        s0 = int(start * SR)
        if s0 >= total:
            break
        chord = prog[c % len(prog)]
        n = min(int((chord_len + 1.2) * SR), total - s0)
        e = env_adsr(n, 0.9, 1.4)
        for k, iv in enumerate(chord + (chord[0] + 12,)):
            f = midi_hz(tonic + iv)
            pad[s0:s0 + n] += (tone(f, n, 5, 0.0015) + tone(f, n, 5, -0.0015)) * e * 0.06
        # бас: тоніка акорду на дві октави нижче, м'які удари на 1 і 3 долю
        root = midi_hz(tonic + chord[0] - 24)
        for b in range(0, 8, 2):
            bs = int((start + b * BEAT) * SR)
            if bs >= total:
                break
            bn = min(int(BEAT * 1.9 * SR), total - bs)
            t = np.arange(bn) / SR
            bass[bs:bs + bn] += np.sin(2 * np.pi * root * t) * np.exp(-t * 2.2) * env_adsr(bn, 0.01, 0.2) * 0.32
        # арпеджіо восьмими, після вступу
        if start >= 3.0:
            pattern = rng.permutation([0, 1, 2, 3, 2, 1, 3, 0])
            tones = list(chord) + [chord[0] + 12]
            for i8 in range(16):
                ts = start + i8 * BEAT / 2
                if ts >= duration - 2.5:
                    break
                s = int(ts * SR)
                pn = min(int(0.5 * SR), total - s)
                t = np.arange(pn) / SR
                f = midi_hz(tonic + 12 + tones[pattern[i8 % 8]])
                vel = 0.05 if i8 % 2 == 0 else 0.032
                arp[s:s + pn] += (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 7) * vel

    # тихий ритм: м'який «удар» на сильні долі й шелест на слабкі, після обкладинки
    beat_n = int(duration / BEAT)
    noise = rng.standard_normal(int(0.08 * SR))
    hat = one_pole_fft(np.diff(noise, prepend=0), 7000) * np.exp(-np.linspace(0, 9, len(noise)))
    for b in range(beat_n):
        ts = b * BEAT
        if ts < 4.0 or ts > duration - 2.0:
            continue
        s = int(ts * SR)
        if b % 2 == 0:
            kn = min(int(0.25 * SR), total - s)
            t = np.arange(kn) / SR
            freq = 90 * np.exp(-t * 18) + 45
            perc[s:s + kn] += np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 14) * 0.22
        hs = int((ts + BEAT / 2) * SR)
        if hs + len(hat) < total:
            perc[hs:hs + len(hat)] += hat * 0.022

    # переходи: «повітря», що наростає до межі слайда
    for cut in cuts:
        a, b = int((cut - 0.6) * SR), int((cut + 0.15) * SR)
        if a < 0 or b > total:
            continue
        nz = rng.standard_normal(b - a)
        nz = one_pole_fft(nz, 2400) - one_pole_fft(nz, 300)
        sw = np.linspace(0, 1, b - a) ** 2.2
        sw[-int(0.15 * SR):] *= np.linspace(1, 0, int(0.15 * SR))
        fx[a:b] += nz * sw * 0.10

    dry = pad + bass + arp + perc + fx
    wet = reverb(pad + arp + fx, seed=seed)
    mix = 0.55 * dry + 0.45 * (wet + bass + perc)
    # загасання на початку й наприкінці
    mix *= env_adsr(total, 1.2, 2.6)
    # стерео: невелика затримка правого каналу для ширини
    d = int(0.012 * SR)
    left = mix
    right = np.concatenate([np.zeros(d), mix[:-d]]) * 0.96 + 0.04 * mix
    st = np.stack([left, right], axis=1)
    # гучність: RMS близько -20 dBFS, піки не вище -1 dBFS (музика під текст, не на передньому плані)
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
    print(generate(dur, [4.2, 8.8, 13.4], sys.argv[2] if len(sys.argv) > 2 else "demo", Path("music-demo.wav")))
