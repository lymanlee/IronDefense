/**
 * ExpSystem.ts - 经验/升级系统
 * 管理玩家经验获取和武器等级提升
 */

import { GameConfig } from '../data/GameConfig';

export class ExpSystem {
  private _exp: number = 0;
  private _level: number = 0;  // 0-indexed，0=Lv1, 5=Lv6
  private readonly _maxLevel: number;

  constructor() {
    this._maxLevel = GameConfig.expLevels.length - 1;
  }

  /**
   * 获取指定等级所需的总经验值
   * 配置范围内：直接读表
   * 超出配置范围：每级经验需求为前一级的两倍
   * 例：Lv6=6000, Lv7=12000, Lv8=24000, Lv9=48000 ...
   */
  private _getRequiredExp(targetLevel: number): number {
    if (targetLevel < GameConfig.expLevels.length) {
      return GameConfig.expLevels[targetLevel];
    }
    const lastIdx = GameConfig.expLevels.length - 1;
    let exp = GameConfig.expLevels[lastIdx];
    // 每多一级，需求翻倍
    for (let i = lastIdx + 1; i <= targetLevel; i++) {
      exp *= 2;
    }
    return exp;
  }

  /**
   * 添加经验值，返回是否升级
   * 满级后经验继续累加，等级继续上涨，武器属性以配置最高档为准
   */
  addExp(amount: number): boolean {
    this._exp += amount;
    let leveled = false;

    // 检查是否升级（支持超出配置范围的外推）
    while (this._exp >= this._getRequiredExp(this._level + 1)) {
      this._level++;
      leveled = true;
    }

    return leveled;
  }

  /**
   * 获取当前经验值
   */
  get exp(): number {
    return this._exp;
  }

  /**
   * 获取当前等级（1-based，用于显示）
   */
  get level(): number {
    return this._level + 1;
  }

  /**
   * 获取当前等级索引（0-based，内部使用）
   */
  get levelIndex(): number {
    return this._level;
  }

  /**
   * 是否已达满级
   */
  get isMaxLevel(): boolean {
    return this._level >= this._maxLevel;
  }

  /**
   * 当前等级武器伤害
   */
  get damage(): number {
    const idx = Math.min(this._level, GameConfig.bullet.damage.length - 1);
    return GameConfig.bullet.damage[idx];
  }

  /**
   * 当前等级射速
   */
  get fireRate(): number {
    const idx = Math.min(this._level, GameConfig.bullet.fireRate.length - 1);
    return GameConfig.bullet.fireRate[idx];
  }

  /**
   * 当前等级子弹速度
   */
  get bulletSpeed(): number {
    const idx = Math.min(this._level, GameConfig.bullet.speed.length - 1);
    return GameConfig.bullet.speed[idx];
  }

  /**
   * 当前武器名称
   */
  get weaponName(): string {
    const idx = Math.min(this._level, GameConfig.weaponNames.length - 1);
    return GameConfig.weaponNames[idx];
  }

  /**
   * 获取当前等级的发射模式配置
   */
  get firePattern(): { count: number; spread: number; multiShot: number; speedMults: number[] } {
    const idx = Math.min(this._level, GameConfig.car.firePatterns.length - 1);
    return GameConfig.car.firePatterns[idx];
  }

  /**
   * 经验进度百分比 [0, 1]
   * 超出配置范围后继续按外推值计算进度
   */
  get progressPct(): number {
    const currentLevelExp = this._getRequiredExp(this._level);
    const nextLevelExp = this._getRequiredExp(this._level + 1);
    return Math.min(1, (this._exp - currentLevelExp) / (nextLevelExp - currentLevelExp));
  }

  /**
   * 重置状态
   */
  reset(): void {
    this._exp = 0;
    this._level = 0;
  }

  /**
   * 设置特定等级（调试用）
   * 支持超出配置范围的等级，经验值按外推计算
   */
  setLevel(level: number): void {
    this._level = Math.max(0, level - 1);
    this._exp = this._getRequiredExp(this._level);
  }
}
