/**
 * DebugScreen.ts - 调试模式界面
 * 支持调整起始波次和基础武器档位
 */

import { _decorator, Component, Node, Label, Button } from 'cc';
import { EnemyTypeId, GameConfig, WaveDefinitionData, WeaponEvolutionId } from '../data/GameConfig';

const { ccclass, property } = _decorator;

type PreviewEnemyType = EnemyTypeId | 'mixed';

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

  @property(Label)
  evolutionValueLabel: Label | null = null;

  @property(Label)
  enemyTypeValueLabel: Label | null = null;

  // 当前值
  private _wave: number = 1;
  private _tier: number = 1;
  private _evolution: WeaponEvolutionId | 'none' = 'none';
  private _enemyType: PreviewEnemyType = 'mixed';

  // 回调
  private _onConfirm: ((wave: number, tier: number, evolution: WeaponEvolutionId | 'none', enemyType: PreviewEnemyType) => void) | null = null;
  private _onBack: (() => void) | null = null;
  private _onResetProgress: (() => void) | null = null;

  start(): void {
    this._updateDisplay();
  }

  /**
   * 设置确认回调
   */
  setOnConfirm(callback: (wave: number, tier: number, evolution: WeaponEvolutionId | 'none', enemyType: PreviewEnemyType) => void): void {
    this._onConfirm = callback;
  }

  /**
   * 设置返回回调
   */
  setOnBack(callback: () => void): void {
    this._onBack = callback;
  }

  setOnResetProgress(callback: () => void): void {
    this._onResetProgress = callback;
  }

  // ==================== 波次调整 ====================

  onWaveMinus(): void {
    this._wave = Math.max(0, this._wave - 1);
    this._updateDisplay();
  }

  onWavePlus(): void {
    this._wave = Math.min(99, this._wave + 1);
    this._updateDisplay();
  }

  // ==================== 档位调整 ====================

  onTierMinus(): void {
    if (this._tier > 1) {
      this._tier = Math.max(1, this._tier - 1);
    } else {
      this._cycleEvolution(-1);
    }
    this._updateDisplay();
  }

  onTierPlus(): void {
    if (this._tier < 6) {
      this._tier = Math.min(6, this._tier + 1);
    } else {
      this._cycleEvolution(1);
    }
    this._updateDisplay();
  }

  // ==================== 确认/返回 ====================

  onConfirm(): void {
    if (this._onConfirm) {
      this._onConfirm(this._wave, this._tier, this._evolution, this._enemyType);
    }
  }

  onBack(): void {
    if (this._onBack) {
      this._onBack();
    }
  }

  onResetProgress(): void {
    if (this._onResetProgress) {
      this._onResetProgress();
    }
  }

  onEvolutionPrev(): void {
    this._cycleEvolution(-1);
    this._updateDisplay();
  }

  onEvolutionNext(): void {
    this._cycleEvolution(1);
    this._updateDisplay();
  }

  onEnemyTypePrev(): void {
    this._cycleEnemyType(-1);
    this._updateDisplay();
  }

  onEnemyTypeNext(): void {
    this._cycleEnemyType(1);
    this._updateDisplay();
  }

  // ==================== 显示更新 ====================

  private _updateDisplay(): void {
    if (this.waveValueLabel) {
      this.waveValueLabel.string = this._wave === 0 ? '预览' : `${this._wave}`;
    }

    if (this.levelValueLabel) {
      this.levelValueLabel.string = `档位${this._tier}`;
    }

    if (this.evolutionValueLabel) {
      this.evolutionValueLabel.string = this._getEvolutionLabel();
    }

    if (this.enemyTypeValueLabel) {
      this.enemyTypeValueLabel.string = this._getEnemyTypeLabel();
    }

    // 更新波次预览
    if (this.previewLabel) {
      if (this._wave === 0) {
        this.previewLabel.string = `特效预览模式\n敌军: ${this._getEnemyTypeLabel()}  分支: ${this._getEvolutionLabel()}\n用于稳定观察命中 proc 动画`;
      } else {
        const summary = this._getWavePreviewSummary(this._wave);
        this.previewLabel.string = summary;
      }
    }

    // 更新武器预览
    if (this.weaponPreviewLabel) {
      const idx = Math.min(this._tier - 1, GameConfig.weaponBase.damage.length - 1);
      const tip = this._tier >= GameConfig.gameplay.weaponEvolution.unlockLevel ? '\n档位到顶后继续 +/- 可切换分支' : '';
      this.weaponPreviewLabel.string = `炮: ${GameConfig.weaponBase.profileNames[idx]}  伤害: ${GameConfig.weaponBase.damage[idx]}\n分支: ${this._getEvolutionLabel()}${tip}`;
    }
  }

  private _cycleEvolution(direction: 1 | -1): void {
    const all: Array<WeaponEvolutionId | 'none'> = ['none', 'mg_explode', 'mg_pierce', 'mg_arc'];
    const index = all.indexOf(this._evolution);
    this._evolution = all[(index + direction + all.length) % all.length];
  }

  private _cycleEnemyType(direction: 1 | -1): void {
    const all: PreviewEnemyType[] = ['mixed', 'normal', 'shield', 'runner', 'healer', 'boss_bulldozer', 'boss_commander'];
    const index = all.indexOf(this._enemyType);
    this._enemyType = all[(index + direction + all.length) % all.length];
  }

  private _getEvolutionLabel(): string {
    switch (this._evolution) {
      case 'mg_explode':
        return '爆裂';
      case 'mg_pierce':
        return '穿透';
      case 'mg_arc':
        return '电弧';
      default:
        return '原版';
    }
  }

  private _getEnemyTypeLabel(): string {
    switch (this._enemyType) {
      case 'normal':
        return '普通';
      case 'shield':
        return '护盾';
      case 'runner':
        return '冲锋';
      case 'healer':
        return '治疗';
      case 'boss_bulldozer':
        return '推土机Boss';
      case 'boss_commander':
        return '指挥官Boss';
      case 'mixed':
      default:
        return '混合';
    }
  }

  private _getWavePreviewSummary(index: number): string {
    const waveDef = GameConfig.waveDefs[index - 1] as WaveDefinitionData | undefined;
    const waveData = this._getWaveBaseData(index);
    const isHandcrafted = !!waveDef;

    if (waveDef) {
      const composition = waveDef.entries
        .map((entry) => `${this._getEnemyTypeShortLabel(entry.type)}x${entry.count}`)
        .join(' / ');
      const totalCount = waveDef.entries.reduce((sum, entry) => sum + entry.count, 0);
      return `${waveDef.title}  ${waveDef.kind}\n构成: ${composition}\n总数: ${totalCount}  间隔: ${waveDef.spawnInterval ?? waveData.spawnInterval}s  底稿HP: ${waveData.hp}`;
    }

    return `扩展波次（fallback）\n兵力预算: ${waveData.count}  间隔: ${waveData.spawnInterval}s\n底稿HP: ${waveData.hp}  速度: ${waveData.speed}  攻击: ${waveData.atk}${isHandcrafted ? '' : '\n基于 waves + waveScaling 自动外推'}`;
  }

  private _getWaveBaseData(index: number): { count: number; hp: number; speed: number; atk: number; spawnInterval: number } {
    if (index <= GameConfig.waves.length) {
      const wave = GameConfig.waves[index - 1];
      return {
        count: wave.count,
        hp: wave.hp,
        speed: wave.speed,
        atk: wave.atk,
        spawnInterval: wave.spawnInterval,
      };
    }

    const base = GameConfig.waves[GameConfig.waves.length - 1];
    const s = GameConfig.waveScaling;
    const extra = index - GameConfig.waves.length + 1;

    return {
      count: base.count + s.countAdd * extra,
      hp: Math.round(base.hp * Math.pow(s.hpMult, extra)),
      speed: base.speed + s.speedAdd * extra,
      atk: Math.round(base.atk * Math.pow(s.atkMult, extra)),
      spawnInterval: Math.max(s.intervalMin, base.spawnInterval - 0.05 * extra),
    };
  }

  private _getEnemyTypeShortLabel(type: EnemyTypeId): string {
    switch (type) {
      case 'normal':
        return '普';
      case 'runner':
        return '冲';
      case 'shield':
        return '盾';
      case 'suicide':
        return '爆';
      case 'healer':
        return '医';
      case 'boss_bulldozer':
        return '推Boss';
      case 'boss_commander':
        return '指Boss';
      default:
        return type;
    }
  }
}
