/**
 * AudioManager.ts - 音频管理器（精简版）
 *
 * 设计说明：
 * - iOS Safari 上 Cocos Creator 3.8.8 的 AudioSource 已能正常工作
 * - 只需确保首次 play() 在用户手势内调用即可
 * - 无需手动操作 AudioContext，引擎内部会处理
 *
 * iOS 静音模式注意：
 * iPhone 物理静音开关会让 Safari 完全静音（包括 Web Audio 和 <audio>），
 * 这是系统级行为，代码无法绕过，只能提示用户检查静音开关。
 */

import { _decorator, Component, AudioSource, AudioClip, resources, error } from 'cc';

const { ccclass, property } = _decorator;

/** SFX 音效名称 → resources/audio/ 下的文件名 */
const SFX_NAMES = ['shoot', 'explode', 'hit', 'levelup', 'alarm'];

@ccclass('AudioManager')
export class AudioManager extends Component {

  // --- AudioSource 引用（需在编辑器中绑定） ---

  @property({ type: AudioSource, tooltip: 'BGM 音源，在编辑器中绑定，设置 Loop=true' })
  bgmSource: AudioSource = null!;

  @property({ type: AudioSource, tooltip: 'SFX 音源，在编辑器中绑定，PlayOnAwake=false' })
  sfxSource: AudioSource = null!;

  // --- 内部状态 ---

  private _clips: Map<string, AudioClip> = new Map();
  private _muted: boolean = false;
  private _bgmStarted: boolean = false;

  // ==================== 生命周期 ====================

  onLoad(): void {
    // 不需要复杂的 AudioContext 解锁逻辑
    // Cocos 3.8.8 引擎内部已经处理了 iOS Safari 的 AudioContext 恢复
  }

  start(): void {
    this._loadAllClips();
  }

  // ==================== 公开接口 ====================

  /**
   * 在用户点击"开始游戏"按钮时调用
   * 确保在用户手势内触发，iOS Safari 要求首次音频播放必须有用户交互
   */
  startBGM(): void {
    if (this._bgmStarted) return;
    if (!this.bgmSource) {
      console.warn('[AudioManager] bgmSource is null!');
      return;
    }
    if (!this.bgmSource.clip) {
      console.warn('[AudioManager] bgmSource.clip is null! 请在编辑器中绑定 BGM AudioClip。');
      return;
    }
    this.bgmSource.loop = true;
    this.bgmSource.volume = this._muted ? 0 : 0.5;
    this.bgmSource.play();
    this._bgmStarted = true;
    console.log(`[AudioManager] BGM started: ${this.bgmSource.clip.name}`);
  }

  stopBGM(): void {
    if (!this.bgmSource) return;
    this.bgmSource.stop();
    this._bgmStarted = false;
  }

  // --- SFX ---

  shoot(): void { this._playSFX('shoot'); }
  explode(): void { this._playSFX('explode'); }
  enemyHit(): void { this._playSFX('hit'); }
  levelUp(): void { this._playSFX('levelup'); }
  alarm(): void { this._playSFX('alarm'); }

  // --- 控制 ---

  toggleMute(): void {
    this._muted = !this._muted;
    if (this.bgmSource) {
      this.bgmSource.volume = this._muted ? 0 : 0.5;
    }
  }

  get muted(): boolean { return this._muted; }

  // ==================== 内部方法 ====================

  private _loadAllClips(): void {
    for (const name of SFX_NAMES) {
      resources.load(`audio/${name}`, AudioClip, (err, clip) => {
        if (err) {
          error(`[AudioManager] 加载 audio/${name} 失败:`, err.message);
          return;
        }
        this._clips.set(name, clip);
        console.log(`[AudioManager] SFX loaded: ${name}`);
      });
    }
  }

  private _playSFX(name: string): void {
    if (this._muted) return;
    const clip = this._clips.get(name);
    if (!clip || !this.sfxSource) return;
    this.sfxSource.playOneShot(clip, 1.0);
  }
}
