/**
 * AudioManager.ts - 音效管理器
 * 使用 Web Audio API 程序生成音效
 *
 * iOS 兼容策略：
 * 1. 首次用户触摸时，播放一段极短的静音音频（HTMLAudioElement）来"解锁"音频硬件
 * 2. 然后在同一个手势栈内创建 AudioContext 并 resume
 * 3. visibility change 时处理 iOS Safari 切后台再回来的 bug
 * 4. 所有代码保持同步，不使用 async/await（iOS 手势栈要求）
 */

export class AudioManager {
  private _ctx: AudioContext | null = null;
  private _muted: boolean = false;
  private _bgmTimer: number | null = null;
  private _bgmIndex: number = 0;
  private _unlocked: boolean = false;

  constructor() {
    // 注册全局首次触摸解锁（capture 阶段，在 Cocos canvas 消费事件之前）
    this._registerUnlock();
    // 注册 visibility change 监听（修复 iOS 切后台回来无声）
    this._registerVisibilityHandler();
  }

  /**
   * iOS 音频解锁：在首次用户触摸/点击的 capture 阶段，
   * 通过播放一段静音 HTMLAudioElement 来解锁音频硬件，
   * 然后在同一手势栈内创建并 resume AudioContext。
   *
   * 必须用 capture: true，因为 Cocos Canvas 会消费 touchstart 事件阻止冒泡。
   */
  private _registerUnlock(): void {
    const unlock = () => {
      if (this._unlocked) return;
      this._unlocked = true;

      console.log('[AudioManager] Attempting audio unlock via silent HTMLAudioElement');

      // 方法1：通过 HTMLAudioElement 播放静音音频解锁 iOS 音频硬件
      try {
        const silentAudio = new Audio();
        // 极短的静音 WAV（~1ms 纯静音）
        silentAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        silentAudio.volume = 0.01;
        const playPromise = silentAudio.play();
        if (playPromise) {
          playPromise.then(() => {
            console.log('[AudioManager] Silent audio played, hardware unlocked');
            silentAudio.pause();
            silentAudio.src = '';
          }).catch(() => {
            // 静音播放被拒绝没关系，继续尝试 Web Audio
          });
        }
      } catch (e) {
        console.warn('[AudioManager] Silent audio unlock failed:', e);
      }

      // 方法2：在同一个手势栈内创建 AudioContext 并 resume
      try {
        if (!this._ctx) {
          this._ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this._ctx.state === 'suspended') {
          this._ctx.resume();
          console.log('[AudioManager] AudioContext resume() called in gesture stack');
        }
      } catch (e) {
        console.warn('[AudioManager] AudioContext creation failed:', e);
      }

      // 移除监听（只需解锁一次）
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('touchend', unlock, true);
      document.removeEventListener('click', unlock, true);
    };

    // capture: true 确保在 Cocos Canvas 消费事件之前执行
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('touchend', unlock, true);
    document.addEventListener('click', unlock, true);
  }

  /**
   * iOS Safari 在切后台再回来时，AudioContext 可能卡在 "interrupted" 状态
   * state 显示 running 但实际不出声。
   * workaround：visibility 恢复时 suspend → 短延迟 → resume
   */
  private _registerVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (!this._ctx) return;
      if (document.visibilityState === 'visible') {
        console.log('[AudioManager] Page visible, fixing AudioContext state');
        // suspend → 短延迟 → resume，强制 iOS 重新激活音频会话
        this._ctx.suspend().then(() => {
          setTimeout(() => {
            if (this._ctx && this._ctx.state === 'suspended') {
              this._ctx.resume();
            }
          }, 250);
        });
      }
    });
  }

  /**
   * 获取或创建 AudioContext
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
   * 手动 resume（在按钮回调的同步栈内调用，作为补充解锁）
   */
  resumeContext(): void {
    const ctx = this._getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  /**
   * 内部播放：检查状态后执行音效回调
   */
  private _play(fn: (ctx: AudioContext) => void): void {
    if (this._muted) return;
    const ctx = this._getContext();
    if (!ctx) return;
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
   * 升级音效 — 上行琶音，三角波
   */
  levelUp(): void {
    this._play(ctx => {
      const notes = [523, 659, 784, 1047];
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
   * 敌人受击音效
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
   * 警报音效
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
   * 开始背景音乐
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
