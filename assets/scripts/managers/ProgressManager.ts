/**
 * ProgressManager.ts - 长期奖励与局外成长存档
 */

import { sys } from 'cc';
import { GameConfig, PermanentUpgradeConfig, PermanentUpgradeId, UpgradeCurrency } from '../data/GameConfig';

export interface RunReward {
  coins: number;
  parts: number;
}

export interface PermanentUpgradeState {
  level: number;
  value: number;
  extraValue: number;
  nextCost: number | null;
  isMaxLevel: boolean;
}

export interface PermanentBonusSummary {
  carHpFlat: number;
  carDamageMultiplier: number;
  baseWeaponTier: number;
  startingCoins: number;
  reviveHpBonusRatio: number;
  reviveShieldSeconds: number;
  supplyQualityTier: number;
  partsFlatBonus: number;
}

interface ProgressData {
  coins: number;
  parts: number;
  upgrades: Partial<Record<PermanentUpgradeId, number>>;
  currentStageIndex?: number;
  unlockedStageIndex?: number;
}

export class ProgressManager {
  private static readonly STORAGE_KEY = 'bridge_guard_progress_v1';
  private static _instance: ProgressManager | null = null;
  private static readonly _upgradeDefs: PermanentUpgradeConfig[] = GameConfig.progression.upgrades as PermanentUpgradeConfig[];

  static get instance(): ProgressManager {
    if (!this._instance) {
      this._instance = new ProgressManager();
    }
    return this._instance;
  }

  private _data: ProgressData = { coins: 0, parts: 0, upgrades: {} };

  private constructor() {
    this._load();
  }

  addReward(reward: RunReward): void {
    this._data.coins += Math.max(0, Math.floor(reward.coins));
    this._data.parts += Math.max(0, Math.floor(reward.parts));
    this._save();
  }

  get coins(): number {
    return this._data.coins;
  }

  get parts(): number {
    return this._data.parts;
  }

  get currentStageIndex(): number {
    return Math.max(0, Math.floor(this._data.currentStageIndex || 0));
  }

  get unlockedStageIndex(): number {
    return Math.max(0, Math.floor(this._data.unlockedStageIndex || 0));
  }

  setCurrentStageIndex(index: number): void {
    this._data.currentStageIndex = Math.max(0, Math.floor(index));
    this._save();
  }

  unlockStage(index: number): void {
    const next = Math.max(this.unlockedStageIndex, Math.floor(index));
    if (next === this.unlockedStageIndex) return;
    this._data.unlockedStageIndex = next;
    this._save();
  }

  spend(currency: UpgradeCurrency, amount: number): boolean {
    const normalized = Math.max(0, Math.floor(amount));
    if (normalized <= 0) return true;
    if (currency === 'coins') {
      if (this._data.coins < normalized) return false;
      this._data.coins -= normalized;
    } else {
      if (this._data.parts < normalized) return false;
      this._data.parts -= normalized;
    }
    this._save();
    return true;
  }

  getUpgradeLevel(id: PermanentUpgradeId): number {
    return Math.max(0, Math.floor(this._data.upgrades[id] || 0));
  }

  getUpgradeConfig(id: PermanentUpgradeId): PermanentUpgradeConfig | null {
    return ProgressManager._upgradeDefs.find(def => def.id === id) || null;
  }

  getUpgradeState(id: PermanentUpgradeId): PermanentUpgradeState {
    const config = this.getUpgradeConfig(id);
    if (!config) {
      return {
        level: 0,
        value: 0,
        extraValue: 0,
        nextCost: null,
        isMaxLevel: true,
      };
    }

    const level = Math.min(config.maxLevel, this.getUpgradeLevel(id));
    const isMaxLevel = level >= config.maxLevel;
    return {
      level,
      value: config.valueBase + config.valueStep * level,
      extraValue: (config.extraValueBase || 0) + (config.extraValueStep || 0) * level,
      nextCost: isMaxLevel ? null : this.getUpgradeCost(id, level),
      isMaxLevel,
    };
  }

  getUpgradeCost(id: PermanentUpgradeId, currentLevel?: number): number {
    const config = this.getUpgradeConfig(id);
    if (!config) return 0;
    const level = Math.max(0, currentLevel ?? this.getUpgradeLevel(id));
    return Math.max(0, Math.round(config.costBase + config.costStep * level));
  }

  canUpgrade(id: PermanentUpgradeId): boolean {
    const config = this.getUpgradeConfig(id);
    if (!config) return false;
    const state = this.getUpgradeState(id);
    if (state.isMaxLevel || state.nextCost == null) return false;
    return config.currency === 'coins'
      ? this._data.coins >= state.nextCost
      : this._data.parts >= state.nextCost;
  }

  upgrade(id: PermanentUpgradeId): boolean {
    const config = this.getUpgradeConfig(id);
    if (!config) return false;

    const state = this.getUpgradeState(id);
    if (state.isMaxLevel || state.nextCost == null) return false;
    if (!this.spend(config.currency, state.nextCost)) return false;

    this._data.upgrades[id] = state.level + 1;
    this._save();
    return true;
  }

  resetAll(): void {
    this._data = {
      coins: 0,
      parts: 0,
      upgrades: {},
      currentStageIndex: 0,
      unlockedStageIndex: 0,
    };
    this._save();
  }

  getAllUpgradeStates(): Array<PermanentUpgradeConfig & PermanentUpgradeState> {
    return ProgressManager._upgradeDefs.map(def => ({
      ...def,
      ...this.getUpgradeState(def.id),
    }));
  }

  getPermanentBonuses(): PermanentBonusSummary {
    const hp = this.getUpgradeState('car_hp');
    const atk = this.getUpgradeState('car_attack');
    const weaponTier = this.getUpgradeState('weapon_tier');
    const startCoins = this.getUpgradeState('starting_coins');
    const revive = this.getUpgradeState('revive_bonus');
    const supply = this.getUpgradeState('supply_quality');
    const parts = this.getUpgradeState('parts_bonus');

    return {
      carHpFlat: Math.round(hp.value),
      carDamageMultiplier: 1 + atk.value,
      baseWeaponTier: Math.max(1, Math.round(weaponTier.value)),
      startingCoins: Math.round(startCoins.value),
      reviveHpBonusRatio: revive.value,
      reviveShieldSeconds: revive.extraValue,
      supplyQualityTier: Math.round(supply.value),
      partsFlatBonus: Math.round(parts.value),
    };
  }

  private _load(): void {
    try {
      const raw = sys.localStorage.getItem(ProgressManager.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ProgressData;
      this._data = {
        coins: Number(parsed.coins) || 0,
        parts: Number(parsed.parts) || 0,
        upgrades: parsed.upgrades || {},
        currentStageIndex: Math.max(0, Number(parsed.currentStageIndex) || 0),
        unlockedStageIndex: Math.max(0, Number(parsed.unlockedStageIndex) || 0),
      };
    } catch (err) {
      console.warn('[ProgressManager] load failed:', err);
      this._data = { coins: 0, parts: 0, upgrades: {}, currentStageIndex: 0, unlockedStageIndex: 0 };
    }
  }

  private _save(): void {
    try {
      sys.localStorage.setItem(ProgressManager.STORAGE_KEY, JSON.stringify(this._data));
    } catch (err) {
      console.warn('[ProgressManager] save failed:', err);
    }
  }
}
