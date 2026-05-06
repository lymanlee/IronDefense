/**
 * AudioManager.ts - 音效管理器
 * 使用 HTMLAudioElement 播放预编码的 WAV 音效（iOS 兼容方案）
 *
 * 为什么不用 Web Audio API：
 * iOS Safari/WebView 对 AudioContext 有严格限制，即使用户手势栈内创建+resume，
 * 在 Cocos Creator 游戏中仍可能无声。HTMLAudioElement.play() 在用户手势后
 * 是 iOS 上最可靠的音频播放方式。
 *
 * 策略：
 * - 音效预编码为 base64 WAV，通过 data URI 播放
 * - SFX（射击/爆炸等）用对象池复用 HTMLAudioElement
 * - BGM 用单个 HTMLAudioElement 循环播放
 */

import { AudioData } from '../data/AudioData';

export class AudioManager {
  private _muted: boolean = false;
  private _bgmAudio: HTMLAudioElement | null = null;
  private _bgmPlaying: boolean = false;

  // SFX 对象池 — 避免频繁创建/销毁 HTMLAudioElement
  private _sfxPool: Map<string, HTMLAudioElement[]> = new Map();

  constructor() {
    // iOS: 注册首次触摸解锁（capture 阶段）
    this._registerUnlock();
  }

  /**
   * iOS 音频解锁：首次触摸时播放一段静音音频
   */
  private _registerUnlock(): void {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      try {
        const a = new Audio();
        a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        a.volume = 0.01;
        const p = a.play();
        if (p) p.then(() => { a.pause(); a.src = ''; }).catch(() => {});
      } catch (e) {}
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('click', unlock, true);
    };
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('click', unlock, true);
  }

  /**
   * 从池中获取或创建 HTMLAudioElement
   */
  private _getSFX(key: string): HTMLAudioElement | null {
    // 查找空闲的
    const pool = this._sfxPool.get(key);
    if (pool) {
      for (const a of pool) {
        if (a.ended || a.paused) {
          a.currentTime = 0;
          return a;
        }
      }
    }
    // 创建新的
    try {
      const a = new Audio();
      a.src = AudioData.DATA_URI_PREFIX + (AudioData as any)[key];
      a.preload = 'auto';
      if (!pool) {
        this._sfxPool.set(key, [a]);
      } else {
        pool.push(a);
      }
      return a;
    } catch (e) {
      return null;
    }
  }

  /**
   * 播放 SFX
   */
  private _playSFX(key: string): void {
    if (this._muted) return;
    const a = this._getSFX(key);
    if (!a) return;
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch (e) {}
  }

  /**
   * 射击音效
   */
  shoot(): void {
    this._playSFX('shoot');
  }

  /**
   * 爆炸音效
   */
  explode(): void {
    this._playSFX('explode');
  }

  /**
   * 升级音效
   */
  levelUp(): void {
    this._playSFX('levelup');
  }

  /**
   * 敌人受击音效
   */
  enemyHit(): void {
    this._playSFX('hit');
  }

  /**
   * 警报音效
   */
  alarm(): void {
    this._playSFX('alarm');
  }

  /**
   * 开始背景音乐（循环播放）
   */
  startBGM(): void {
    if (this._bgmPlaying) return;
    try {
      this._bgmAudio = new Audio();
      this._bgmAudio.src = AudioData.DATA_URI_PREFIX + AudioData.bgm;
      this._bgmAudio.loop = true;
      this._bgmAudio.volume = 0.5;
      this._bgmAudio.play().catch(() => {});
      this._bgmPlaying = true;
    } catch (e) {}
  }

  /**
   * 停止背景音乐
   */
  stopBGM(): void {
    if (this._bgmAudio) {
      this._bgmAudio.pause();
      this._bgmAudio.currentTime = 0;
      this._bgmAudio.src = '';
      this._bgmAudio = null;
    }
    this._bgmPlaying = false;
  }

  /**
   * 静音切换
   */
  toggleMute(): void {
    this._muted = !this._muted;
    if (this._bgmAudio) {
      this._bgmAudio.muted = this._muted;
    }
  }

  /**
   * 保留此方法以兼容 GameManager 的调用（iOS AudioElement 方案不需要）
   */
  resumeContext(): void {
    // No-op with HTMLAudioElement approach
  }

  get muted(): boolean {
    return this._muted;
  }
}
