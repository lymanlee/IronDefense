/**
 * AudioManager.ts - 音效管理器
 * 使用 Web Audio API 程序生成音效
 */

export class AudioManager {
  private _ctx: AudioContext | null = null;
  private _muted: boolean = false;
  private _bgmTimer: number | null = null;
  private _bgmIndex: number = 0;

  constructor() {
    try {
      this._ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not available:', e);
      this._ctx = null;
    }
  }

  private _play(fn: (ctx: AudioContext) => void): void {
    if (!this._ctx || this._muted) return;
    if (this._ctx.state === 'suspended') this._ctx.resume();
    fn(this._ctx);
  }

  /**
   * 射击音效
   */
  shoot(): void {
    this._play(ctx => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.05);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      o.start();
      o.stop(ctx.currentTime + 0.08);
    });
  }

  /**
   * 爆炸音效
   */
  explode(): void {
    this._play(ctx => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
    });
  }

  /**
   * 升级音效
   */
  levelUp(): void {
    this._play(ctx => {
      [523, 659, 784, 1047].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = f;
        o.type = 'square';
        const t = ctx.currentTime + i * 0.12;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.25, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.start(t);
        o.stop(t + 0.2);
      });
    });
  }

  /**
   * 敌人受击音效
   */
  enemyHit(): void {
    this._play(ctx => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.setValueAtTime(200, ctx.currentTime);
      o.type = 'sawtooth';
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      o.start();
      o.stop(ctx.currentTime + 0.12);
    });
  }

  /**
   * 警报音效
   */
  alarm(): void {
    this._play(ctx => {
      [440, 550, 440, 550].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = f;
        const t = ctx.currentTime + i * 0.1;
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.start(t);
        o.stop(t + 0.1);
      });
    });
  }

  /**
   * 开始背景音乐
   */
  startBGM(): void {
    if (!this._ctx || this._bgmTimer) return;

    // 简单循环节拍
    const notes = [130, 0, 164, 0, 146, 0, 130, 0, 164, 0, 196, 0, 174, 130, 0, 0];
    const bpm = 120;
    const step = 60 / bpm;
    this._bgmIndex = 0;

    const play = () => {
      if (this._muted) {
        this._bgmTimer = window.setTimeout(play, step * 1000);
        return;
      }
      if (this._ctx!.state === 'suspended') this._ctx!.resume();

      const freq = notes[this._bgmIndex % notes.length];
      if (freq > 0) {
        const o = this._ctx!.createOscillator();
        const g = this._ctx!.createGain();
        o.connect(g);
        g.connect(this._ctx!.destination);
        o.frequency.value = freq;
        o.type = 'square';
        g.gain.setValueAtTime(0.08, this._ctx!.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this._ctx!.currentTime + step * 0.8);
        o.start();
        o.stop(this._ctx!.currentTime + step * 0.8);
      }
      this._bgmIndex++;
      this._bgmTimer = window.setTimeout(play, step * 1000);
    };

    play();
  }

  /**
   * 停止背景音乐
   */
  stopBGM(): void {
    if (this._bgmTimer !== null) {
      window.clearTimeout(this._bgmTimer);
      this._bgmTimer = null;
    }
  }

  /**
   * 静音切换
   */
  toggleMute(): void {
    this._muted = !this._muted;
  }

  get muted(): boolean {
    return this._muted;
  }
}
