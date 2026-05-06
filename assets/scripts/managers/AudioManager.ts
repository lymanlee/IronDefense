/**
 * AudioManager.ts - 音效管理器
 * 使用 Web Audio API 程序生成音效
 *
 * iOS 兼容要点：
 * - AudioContext 在用户手势触发时才创建并 resume
 * - resume() 是异步的，播放前必须 await
 * - BGM 的 setTimeout 递归也需检查 suspended 状态
 */

export class AudioManager {
  private _ctx: AudioContext | null = null;
  private _muted: boolean = false;
  private _bgmTimer: number | null = null;
  private _bgmIndex: number = 0;
  /** 标记是否曾成功 resume 过（首次需用户手势） */
  private _resumed: boolean = false;

  constructor() {
    // 不在此处创建 AudioContext，延迟到首次用户交互时创建（iOS 兼容）
  }

  /**
   * 获取或创建 AudioContext（懒加载）
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
   * 在用户手势的调用栈内调用此方法，激活 AudioContext（iOS 关键）
   * 必须在按钮点击、触摸等用户交互事件中调用
   */
  async resumeContext(): Promise<void> {
    const ctx = this._getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        this._resumed = true;
        console.log('[AudioManager] AudioContext resumed');
      } catch (e) {
        console.warn('[AudioManager] Failed to resume AudioContext:', e);
      }
    } else {
      this._resumed = true;
    }
  }

  /**
   * 内部播放：确保 AudioContext 已激活再执行音效回调
   */
  private async _play(fn: (ctx: AudioContext) => void): Promise<void> {
    if (this._muted) return;
    const ctx = this._getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        this._resumed = true;
      } catch (e) {
        return; // resume 失败则跳过
      }
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
        // 快速起爆 + 指数衰减
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
        o.type = 'triangle'; // 三角波比方波柔和
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

      // 金属撞击高频
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
   */
  startBGM(): void {
    const ctx = this._getContext();
    if (!ctx || this._bgmTimer) return;

    // 简单循环节拍
    const notes = [130, 0, 164, 0, 146, 0, 130, 0, 164, 0, 196, 0, 174, 130, 0, 0];
    const bpm = 120;
    const stepMs = (60 / bpm) * 1000;
    this._bgmIndex = 0;

    const play = () => {
      if (!this._ctx) return;
      if (this._muted || this._ctx.state === 'suspended') {
        // 静音或 suspended 时跳过音符但保持节拍
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
