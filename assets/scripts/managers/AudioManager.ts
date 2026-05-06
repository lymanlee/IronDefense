/**
 * AudioManager.ts - 音效管理器
 * 使用 Web Audio API 程序生成音效
 *
 * iOS 兼容要点：
 * - AudioContext 必须在用户手势的同步调用栈内 new + resume()
 * - resume() 不需要 await，只需在同步栈内触发即可激活
 * - 音效播放前检查 state，如果 running 则直接播
 */

export class AudioManager {
  private _ctx: AudioContext | null = null;
  private _muted: boolean = false;
  private _bgmTimer: number | null = null;
  private _bgmIndex: number = 0;

  constructor() {
    // 不在此处创建 AudioContext（iOS 要求在用户手势中创建）
  }

  /**
   * 获取或创建 AudioContext（懒加载，仅内部使用）
   */
  private _getContext(): AudioContext | null {
    if (!this._ctx) {
      try {
        this._ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('[AudioManager] AudioContext created, state:', this._ctx.state);
      } catch (e) {
        console.warn('[AudioManager] AudioContext not available:', e);
        return null;
      }
    }
    return this._ctx;
  }

  /**
   * 在用户手势的同步调用栈内调用此方法，激活 AudioContext（iOS 关键）
   *
   * 注意：这里不使用 await，而是同步触发 resume()。
   * iOS Safari 只要求 resume() 的调用发起在用户手势栈内即可，
   * 不需要等它 resolve。一旦 resume 启动，后续播放就能正常工作。
   */
  resumeContext(): void {
    const ctx = this._getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      // 同步调用 resume()，不 await —— 保持调用栈在用户手势内
      const p = ctx.resume();
      console.log('[AudioManager] resume() triggered in user gesture, state:', ctx.state);
      // resume resolve 后确认状态
      p.then(() => {
        console.log('[AudioManager] AudioContext resumed, state:', ctx.state);
      }).catch((e) => {
        console.warn('[AudioManager] resume() failed:', e);
      });
    }
  }

  /**
   * 内部播放：确保 AudioContext 处于 running 状态再执行
   */
  private _play(fn: (ctx: AudioContext) => void): void {
    if (this._muted) return;
    const ctx = this._getContext();
    if (!ctx) return;

    // 如果 suspended，尝试 resume；无论是否成功都尝试播放（iOS 首次后会是 running）
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    fn(ctx);
  }

  /**
   * 射击音效 — 高频下滑 + 低频冲击
   */
  shoot(): void {
    this._play(ctx => {
      const now = ctx.currentTime;

      // 高频子弹啸叫
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);
      oscGain.gain.setValueAtTime(0.15, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);

      // 低频冲击感
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(150, now);
      sub.frequency.exponentialRampToValueAtTime(50, now + 0.05);
      subGain.gain.setValueAtTime(0.25, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      sub.start(now);
      sub.stop(now + 0.05);
    });
  }

  /**
   * 爆炸音效 — 白噪声 + 低频 rumble
   */
  explode(): void {
    this._play(ctx => {
      const now = ctx.currentTime;

      // 白噪声爆裂
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length;
        const envelope = t < 0.02 ? t / 0.02 : Math.exp(-8 * (t - 0.02));
        data[i] = (Math.random() * 2 - 1) * envelope;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      src.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      src.start(now);

      // 低频冲击波
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(80, now);
      sub.frequency.exponentialRampToValueAtTime(20, now + 0.25);
      subGain.gain.setValueAtTime(0.4, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      sub.start(now);
      sub.stop(now + 0.25);
    });
  }

  /**
   * 升级音效 — 上行琶音，三角波更悦耳
   */
  levelUp(): void {
    this._play(ctx => {
      const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = freq;
        o.type = 'triangle';
        const t = ctx.currentTime + i * 0.1;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.3, t + 0.03);
        g.gain.setValueAtTime(0.3, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.start(t);
        o.stop(t + 0.25);
      });
    });
  }

  /**
   * 敌人受击音效 — 短促金属撞击
   */
  enemyHit(): void {
    this._play(ctx => {
      const now = ctx.currentTime;

      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(300, now);
      o.frequency.exponentialRampToValueAtTime(100, now + 0.08);
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      o.start(now);
      o.stop(now + 0.08);
    });
  }

  /**
   * 警报音效 — 双音交替
   */
  alarm(): void {
    this._play(ctx => {
      [440, 550, 440, 550].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = freq;
        o.type = 'square';
        const t = ctx.currentTime + i * 0.1;
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.start(t);
        o.stop(t + 0.1);
      });
    });
  }

  /**
   * 开始背景音乐 — 方波低音循环节拍
   * BGM 通过 audio 事件驱动，每步触发一次
   */
  startBGM(): void {
    const ctx = this._getContext();
    if (!ctx || this._bgmTimer) return;

    const notes = [130, 0, 164, 0, 146, 0, 130, 0, 164, 0, 196, 0, 174, 130, 0, 0];
    const bpm = 120;
    const stepMs = (60 / bpm) * 1000;
    this._bgmIndex = 0;

    const play = () => {
      if (!this._ctx || this._bgmTimer === null) return;
      if (this._muted) {
        this._bgmTimer = window.setTimeout(play, stepMs);
        return;
      }
      // 检查 AudioContext 状态
      if (this._ctx.state !== 'running') {
        this._ctx.resume();
        this._bgmTimer = window.setTimeout(play, stepMs);
        return;
      }

      const freq = notes[this._bgmIndex % notes.length];
      if (freq > 0) {
        const o = this._ctx.createOscillator();
        const g = this._ctx.createGain();
        o.connect(g);
        g.connect(this._ctx.destination);
        o.frequency.value = freq;
        o.type = 'square';
        const step = stepMs / 1000;
        g.gain.setValueAtTime(0.08, this._ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + step * 0.8);
        o.start();
        o.stop(this._ctx.currentTime + step * 0.8);
      }
      this._bgmIndex++;
      this._bgmTimer = window.setTimeout(play, stepMs);
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
