/**
 * DebugScreen.ts - 调试模式界面
 * 支持调整起始波次和武器等级
 */

import { _decorator, Component, Node, Label, Button } from 'cc';
import { GameConfig } from '../data/GameConfig';

const { ccclass, property } = _decorator;

@ccclass('DebugScreen')
export class DebugScreen extends Component {
  // UI 元素
  @property(Label)
  waveValueLabel: Label | null = null;

  @property(Label)
  levelValueLabel: Label | null = null;

  @property(Label)
  previewLabel: Label | null = null;

  @property(Label)
  weaponPreviewLabel: Label | null = null;

  // 当前值
  private _wave: number = 1;
  private _level: number = 1;

  // 回调
  private _onConfirm: ((wave: number, level: number) => void) | null = null;
  private _onBack: (() => void) | null = null;

  start(): void {
    this._updateDisplay();
  }

  /**
   * 设置确认回调
   */
  setOnConfirm(callback: (wave: number, level: number) => void): void {
    this._onConfirm = callback;
  }

  /**
   * 设置返回回调
   */
  setOnBack(callback: () => void): void {
    this._onBack = callback;
  }

  // ==================== 波次调整 ====================

  onWaveMinus(): void {
    this._wave = Math.max(1, this._wave - 1);
    this._updateDisplay();
  }

  onWavePlus(): void {
    this._wave = Math.min(99, this._wave + 1);
    this._updateDisplay();
  }

  // ==================== 等级调整 ====================

  onLevelMinus(): void {
    this._level = Math.max(1, this._level - 1);
    this._updateDisplay();
  }

  onLevelPlus(): void {
    this._level = Math.min(6, this._level + 1);
    this._updateDisplay();
  }

  // ==================== 确认/返回 ====================

  onConfirm(): void {
    if (this._onConfirm) {
      this._onConfirm(this._wave, this._level);
    }
  }

  onBack(): void {
    if (this._onBack) {
      this._onBack();
    }
  }

  // ==================== 显示更新 ====================

  private _updateDisplay(): void {
    if (this.waveValueLabel) {
      this.waveValueLabel.string = `${this._wave}`;
    }

    if (this.levelValueLabel) {
      this.levelValueLabel.string = `Lv${this._level}`;
    }

    // 更新波次预览
    if (this.previewLabel) {
      const waveData = this._getWaveData(this._wave);
      this.previewLabel.string = `敌人: ${waveData.count}  HP: ${waveData.hp}\n速度: ${waveData.speed}  攻击: ${waveData.atk}\n经验: ${waveData.exp}`;
    }

    // 更新武器预览
    if (this.weaponPreviewLabel) {
      const idx = Math.min(this._level - 1, GameConfig.bullet.damage.length - 1);
      this.weaponPreviewLabel.string = `炮: ${GameConfig.weaponNames[idx]}  伤害: ${GameConfig.bullet.damage[idx]}`;
    }
  }

  private _getWaveData(index: number): { count: number; hp: number; speed: number; atk: number; exp: number } {
    if (index <= GameConfig.waves.length) {
      return { ...GameConfig.waves[index - 1] };
    }

    const base = GameConfig.waves[GameConfig.waves.length - 1];
    const s = GameConfig.waveScaling;
    const extra = index - GameConfig.waves.length + 1;

    return {
      count: base.count + s.countAdd * extra,
      hp: Math.round(base.hp * Math.pow(s.hpMult, extra)),
      speed: base.speed + s.speedAdd * extra,
      atk: Math.round(base.atk * Math.pow(s.atkMult, extra)),
      exp: base.exp + s.expAdd * extra,
    };
  }
}
