#!/usr/bin/env python3
"""
generate_bgm.py - 为 IronDefense 坦克防守游戏生成 BGM
风格：电子/芯片音乐，BPM 140，C小调，约 60 秒，无缝循环
"""

import math
import wave
import numpy as np

# ---- 音频参数 ----
SR = 44100
BPM = 140
BEAT = 60.0 / BPM
BAR = BEAT * 4
TOTAL_BARS = 8
TOTAL_SAMPLES = int(BAR * TOTAL_BARS * SR)

def s2s(sec: float) -> int:
    return int(sec * SR)

# ---- 基础波形 ----
def sine(freq: float, length_samples: int, vol: float = 1.0) -> np.ndarray:
    t = np.arange(length_samples) / SR
    return vol * np.sin(2 * np.pi * freq * t)

def square(freq: float, length_samples: int, vol: float = 1.0) -> np.ndarray:
    t = np.arange(length_samples) / SR
    return vol * np.sign(np.sin(2 * np.pi * freq * t))

def saw(freq: float, length_samples: int, vol: float = 1.0) -> np.ndarray:
    t = np.arange(length_samples) / SR
    return vol * (2 * ((t * freq) % 1.0) - 1)

def white_noise(length_samples: int, vol: float = 1.0) -> np.ndarray:
    return vol * (2.0 * np.random.random(length_samples) - 1.0)

# ---- 鼓合成 ----
def add_kick(mix: np.ndarray, start: int):
    """底鼓：150Hz→40Hz 滑降 + 指数衰减"""
    n = min(s2s(0.12), len(mix) - start)
    if n <= 0: return
    t = np.arange(n) / SR
    freq = 150.0 * np.exp(-t * 12.0) + 40.0 * (1.0 - np.exp(-t * 12.0))
    phase = 2.0 * np.pi * np.cumsum(freq) / SR
    sig = 0.9 * np.sin(phase) * np.exp(-t * 25.0)
    mix[start:start+n] += sig

def add_snare(mix: np.ndarray, start: int):
    """军鼓：噪声 + 200Hz 正弦体音"""
    n = min(s2s(0.1), len(mix) - start)
    if n <= 0: return
    t = np.arange(n) / SR
    noise_part = white_noise(n, 0.6) * np.exp(-t * 20.0)
    tone_part = 0.4 * np.sin(2 * np.pi * 200 * t) * np.exp(-t * 18.0)
    mix[start:start+n] += (noise_part + tone_part)

def add_hihat(mix: np.ndarray, start: int, open_hh: bool = False):
    """踩镲：高通噪声 + 快速衰减"""
    dur = 0.04 if not open_hh else 0.12
    n = min(s2s(dur), len(mix) - start)
    if n <= 0: return
    t = np.arange(n) / SR
    sig = white_noise(n, 0.3)
    # 简易高通：差分
    sig[1:] = sig[1:] - 0.7 * sig[:-1]
    sig[0] = 0
    sig *= np.exp(-t * (40.0 if not open_hh else 10.0))
    mix[start:start+n] += sig

# ---- 音符频率 ----
NOTE = {
    'C2': 65.41, 'D2': 73.42, 'Eb2': 77.78, 'F2': 87.31, 'G2': 98.00,
    'C3': 130.81, 'D3': 146.83, 'Eb3': 155.56, 'F3': 174.61, 'G3': 196.00,
    'C4': 261.63, 'D4': 293.66, 'Eb4': 311.13, 'F4': 349.23, 'G4': 392.00,
    'C5': 523.25, 'D5': 587.33, 'Eb5': 622.25, 'F5': 698.46, 'G5': 783.99,
}

# ---- 低音线（每小节 1 个根音）----
BASS_NOTES = ['C2', 'G2', 'F2', 'Eb2', 'C2', 'G2', 'F2', 'D2']

# ---- 旋律（每拍一个和弦音，分 8 小节）----
MELODY = [
    [('C4',0.5), ('Eb4',0.5), ('G4',0.5), ('C5',0.3)],
    [('G3',0.5), ('C4',0.5), ('Eb4',0.5), ('G4',0.3)],
    [('F3',0.5), ('G3',0.5), ('C4',0.5), ('F4',0.3)],
    [('C3',0.5), ('F3',0.5), ('G3',0.5), ('C4',0.3)],
    [('Eb4',0.4), ('G4',0.5), ('Bb4',0.3), ('G4',0.4)],
    [('C4',0.5), ('D4',0.3), ('Eb4',0.5), ('G4',0.3)],
    [('G4',0.5), ('C5',0.5), ('G4',0.5), ('Eb4',0.3)],
    [('C5',0.4), ('Eb5',0.4), ('G5',0.4), ('C6',0.2)],
]

# ============ 主合成 ============

def generate():
    mix = np.zeros(TOTAL_SAMPLES, dtype=np.float32)

    # --- 1. 鼓组 ---
    for bar in range(TOTAL_BARS):
        bar_s = int(bar * BAR * SR)
        for beat in range(4):
            b_s = bar_s + int(beat * BEAT * SR)
            # 底鼓：1、3 拍
            if beat in (0, 2):
                add_kick(mix, b_s)
            # 军鼓：2、4 拍
            if beat in (1, 3):
                add_snare(mix, b_s)
            # 踩镲：每八分音符
            for eh in range(2):
                hh_s = b_s + int(eh * BEAT * SR / 2)
                is_open = (bar == TOTAL_BARS - 1 and beat == 3 and eh == 1)
                add_hihat(mix, hh_s, open_hh=is_open)

    # --- 2. 低音线 ---
    for bar in range(TOTAL_BARS):
        bar_s = int(bar * BAR * SR)
        freq = NOTE[BASS_NOTES[bar]]
        n = min(int(BAR * SR * 0.75), TOTAL_SAMPLES - bar_s)
        if n <= 0: continue
        t = np.arange(n) / SR
        # 方波 + 轻微饱和
        sig = 0.65 * np.sign(np.sin(2 * np.pi * freq * t))
        # 简易低通：移动平均
        kernel = np.ones(12) / 12.0
        sig = np.convolve(sig, kernel, mode='same')
        sig *= np.exp(-t * 2.5)
        mix[bar_s:bar_s+n] += sig

    # --- 3. 旋律/琶音 ---
    for bar in range(TOTAL_BARS):
        bar_s = int(bar * BAR * SR)
        notes = MELODY[bar]
        # 每拍分 4 个十六分音符
        notes_in_bar = len(notes)
        for i, (nn, vol) in enumerate(notes):
            freq = NOTE.get(nn, 262.0)
            note_start = bar_s + int(i * (BAR / notes_in_bar) * SR)
            note_dur_samples = int((BAR / notes_in_bar) * 0.8 * SR)
            n = min(note_dur_samples, TOTAL_SAMPLES - note_start)
            if n <= 0: continue
            t = np.arange(n) / SR
            # 主音 + 失谐（略厚）
            sig = vol * 0.2 * (
                0.65 * np.sin(2 * np.pi * freq * t) +
                0.35 * np.sin(2 * np.pi * freq * 1.005 * t)
            )
            # 短 ADSR
            a_n = min(s2s(0.01), n)
            r_n = min(s2s(0.04), n)
            env = np.ones(n)
            if a_n > 0:
                env[:a_n] = np.linspace(0.0, 1.0, a_n)
            if r_n > 0 and n > r_n:
                env[-r_n:] = np.linspace(1.0, 0.0, r_n)
            sig *= env
            mix[note_start:note_start+n] += sig

    # --- 4. 侧链模拟（底鼓下凹）---
    sc = np.ones(TOTAL_SAMPLES)
    for bar in range(TOTAL_BARS):
        bar_s = int(bar * BAR * SR)
        for beat in (0, 2):
            ks = int(bar_s + beat * BEAT * SR)
            ks_n = min(s2s(0.06), TOTAL_SAMPLES - ks)
            if ks_n <= 0: continue
            t_sc = np.arange(ks_n) / SR
            sc[ks:ks+ks_n] *= (1.0 - 0.25 * np.exp(-t_sc * 80.0))
    mix *= sc

    # --- 5. 无缝循环处理（交叉淡化尾部→头部）---
    cf_sec = 0.15
    cf = int(cf_sec * SR)
    if cf > 0 and cf < len(mix):
        end_part = mix[-cf:].copy()
        start_part = mix[:cf].copy()
        t = np.linspace(0.0, 1.0, cf)
        # 交叉淡化：尾音淡出 + 头音淡入混合
        cross = end_part * (1.0 - t) + start_part * t
        # 写入尾部和头部，使循环点无缝
        mix[-cf:] = cross
        mix[:cf] = cross

    # --- 6. 母带限制 & 归一化 ---
    mix = np.clip(mix, -0.95, 0.95)
    peak = np.max(np.abs(mix))
    if peak > 0:
        mix /= peak
        mix *= 0.85

    return mix

def save_wav(path: str, data: np.ndarray):
    data_int16 = (data * 32767).astype(np.int16)
    with wave.open(path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data_int16.tobytes())
    dur = len(data_int16) / SR
    print(f"[✓] 已保存 {path}  ({dur:.1f}s, {TOTAL_SAMPLES} samples)")

if __name__ == '__main__':
    out = "/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/resources/audio/bgm.wav"
    print(f"BPM={BPM}  TOTAL_BARS={TOTAL_BARS}  TOTAL_SAMPLES={TOTAL_SAMPLES}")
    print("生成中...")
    bgm = generate()
    save_wav(out, bgm)
    print("完成！")
