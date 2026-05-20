/**
 * WeaponTierSystem.ts - 基础武器档位系统
 * 管理基础武器档位、开火参数与分支解锁门槛
 */

import { GameConfig } from '../data/GameConfig';

export class WeaponTierSystem {
  private _tier: number = 0;  // 0-indexed，0=档位1, 5=档位6
  private readonly _maxTier: number;

  constructor() {
    this._maxTier = Math.max(0, GameConfig.weaponBase.profileNames.length - 1);
  }

  get tier(): number {
    return this._tier + 1;
  }

  get tierIndex(): number {
    return this._tier;
  }

  get isMaxTier(): boolean {
    return this._tier >= this._maxTier;
  }

  get damage(): number {
    const idx = Math.min(this._tier, GameConfig.weaponBase.damage.length - 1);
    return GameConfig.weaponBase.damage[idx];
  }

  get fireRate(): number {
    const idx = Math.min(this._tier, GameConfig.weaponBase.fireRate.length - 1);
    return GameConfig.weaponBase.fireRate[idx];
  }

  get bulletSpeed(): number {
    const idx = Math.min(this._tier, GameConfig.weaponBase.speed.length - 1);
    return GameConfig.weaponBase.speed[idx];
  }

  get weaponName(): string {
    const idx = Math.min(this._tier, GameConfig.weaponBase.profileNames.length - 1);
    return GameConfig.weaponBase.profileNames[idx];
  }

  get canOfferEvolution(): boolean {
    return this._tier + 1 >= GameConfig.gameplay.weaponEvolution.unlockLevel;
  }

  get firePattern(): { count: number; spread: number; multiShot: number; speedMults: number[] } {
    const base = GameConfig.weaponBase;
    const idx = Math.min(this._tier, base.baseSpreadCount.length - 1);

    return {
      count: base.baseSpreadCount[idx] || 1,
      spread: base.spreadAngle[idx] || 0,
      multiShot: base.baseBurstCount[idx] || 1,
      speedMults: base.burstSpeedScales[idx] || [1.0],
    };
  }

  reset(): void {
    this._tier = 0;
  }

  setTier(tier: number): void {
    const nextTier = Math.max(1, Math.floor(tier || 1));
    this._tier = Math.min(this._maxTier, nextTier - 1);
  }
}
