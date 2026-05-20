/**
 * GarageScreen.ts - 车库升级界面
 * 展示长期资源、永久升级项，并提供升级与返回入口
 */

import { _decorator, Button, Color, Component, Label, Node, Sprite } from 'cc';
import { PermanentUpgradeConfig, PermanentUpgradeId } from '../data/GameConfig';
import { ProgressManager } from '../managers/ProgressManager';

const { ccclass, property } = _decorator;

type UpgradeRowRefs = {
  id: PermanentUpgradeId;
  levelLabel: Label | null;
  descLabel: Label | null;
  valueLabel: Label | null;
  costLabel: Label | null;
  buttonNode: Node | null;
  buttonLabel: Label | null;
};

@ccclass('GarageScreen')
export class GarageScreen extends Component {
  @property(Label)
  coinsLabel: Label | null = null;

  @property(Label)
  partsLabel: Label | null = null;

  @property(Label)
  summaryLabel: Label | null = null;

  private _onBack: (() => void) | null = null;
  private _onUpgrade: ((id: PermanentUpgradeId) => boolean) | null = null;
  private _rows: UpgradeRowRefs[] = [];

  start(): void {
    this._cacheRows();
    this.refresh();
  }

  setOnBack(callback: () => void): void {
    this._onBack = callback;
  }

  setOnUpgrade(callback: (id: PermanentUpgradeId) => boolean): void {
    this._onUpgrade = callback;
  }

  refresh(): void {
    const progress = ProgressManager.instance;
    const panel = this.node.getChildByName('Panel');
    this.coinsLabel = this.coinsLabel || panel?.getChildByName('TopBar')?.getChildByName('CoinsLabel')?.getComponent(Label) || null;
    this.partsLabel = this.partsLabel || panel?.getChildByName('TopBar')?.getChildByName('PartsLabel')?.getComponent(Label) || null;
    this.summaryLabel = this.summaryLabel || panel?.getChildByName('SummaryLabel')?.getComponent(Label) || null;
    if (this.coinsLabel) {
      this.coinsLabel.string = `金币 ${progress.coins}`;
    }
    if (this.partsLabel) {
      this.partsLabel.string = `零件 ${progress.parts}`;
    }

    const bonus = progress.getPermanentBonuses();
    if (this.summaryLabel) {
      this.summaryLabel.string = [
        `武器档位 ${bonus.baseWeaponTier}`,
        `耐久 +${bonus.carHpFlat}`,
        `伤害 +${Math.round((bonus.carDamageMultiplier - 1) * 100)}%`,
        `开局金币 +${bonus.startingCoins}`,
        `复活增益 +${Math.round(bonus.reviveHpBonusRatio * 100)}%`,
      ].join('  |  ');
    }

    const rows = this._rows.length > 0 ? this._rows : this._cacheRows();
    const allStates = progress.getAllUpgradeStates();
    rows.forEach((row) => {
      const state = allStates.find(item => item.id === row.id);
      if (!state) return;

      if (row.levelLabel) {
        row.levelLabel.string = `${state.title}  Lv${state.level}/${state.maxLevel}`;
      }
      if (row.descLabel) {
        row.descLabel.string = state.desc;
      }
      if (row.valueLabel) {
        row.valueLabel.string = this._formatUpgradeValue(state);
      }
      if (row.costLabel) {
        row.costLabel.string = state.isMaxLevel
          ? '已满级'
          : `升级消耗: ${state.nextCost} ${state.currency === 'coins' ? '金币' : '零件'}`;
      }

      const enabled = !state.isMaxLevel && progress.canUpgrade(state.id);
      if (row.buttonNode) {
        const button = row.buttonNode.getComponent(Button);
        if (button) button.interactable = !state.isMaxLevel;
        const sprite = row.buttonNode.getComponent(Sprite);
        if (sprite) {
          sprite.color = state.isMaxLevel
            ? new Color(110, 110, 120, 255)
            : enabled
              ? new Color(255, 179, 0, 255)
              : new Color(96, 125, 139, 255);
        }
      }
      if (row.buttonLabel) {
        row.buttonLabel.string = state.isMaxLevel ? '满级' : enabled ? '升级' : '资源不足';
      }
    });
  }

  onBackClicked(): void {
    if (this._onBack) {
      this._onBack();
    }
  }

  onUpgradeCarHp(): void { this._handleUpgrade('car_hp'); }
  onUpgradeCarAttack(): void { this._handleUpgrade('car_attack'); }
  onUpgradeWeaponTier(): void { this._handleUpgrade('weapon_tier'); }
  onUpgradeStartingCoins(): void { this._handleUpgrade('starting_coins'); }
  onUpgradeReviveBonus(): void { this._handleUpgrade('revive_bonus'); }
  onUpgradeSupplyQuality(): void { this._handleUpgrade('supply_quality'); }
  onUpgradePartsBonus(): void { this._handleUpgrade('parts_bonus'); }

  private _handleUpgrade(id: PermanentUpgradeId): void {
    if (!this._onUpgrade) return;
    const changed = this._onUpgrade(id);
    if (changed) {
      this.refresh();
    }
  }

  private _cacheRows(): UpgradeRowRefs[] {
    this._rows = [
      this._makeRow('car_hp', 'UpgradeCarHpRow'),
      this._makeRow('car_attack', 'UpgradeCarAttackRow'),
      this._makeRow('weapon_tier', 'UpgradeWeaponTierRow'),
      this._makeRow('starting_coins', 'UpgradeStartingCoinsRow'),
      this._makeRow('revive_bonus', 'UpgradeReviveBonusRow'),
      this._makeRow('supply_quality', 'UpgradeSupplyQualityRow'),
      this._makeRow('parts_bonus', 'UpgradePartsBonusRow'),
    ];
    return this._rows;
  }

  private _makeRow(id: PermanentUpgradeId, nodeName: string): UpgradeRowRefs {
    const root = this.node.getChildByName('Panel')?.getChildByName(nodeName);
    return {
      id,
      levelLabel: root?.getChildByName('TitleLabel')?.getComponent(Label) || null,
      descLabel: root?.getChildByName('DescLabel')?.getComponent(Label) || null,
      valueLabel: root?.getChildByName('ValueLabel')?.getComponent(Label) || null,
      costLabel: root?.getChildByName('CostLabel')?.getComponent(Label) || null,
      buttonNode: root?.getChildByName('UpgradeBtn') || null,
      buttonLabel: root?.getChildByName('UpgradeBtn')?.getChildByName('Label')?.getComponent(Label) || null,
    };
  }

  private _formatUpgradeValue(config: PermanentUpgradeConfig & { value: number; extraValue: number }): string {
    switch (config.id) {
      case 'car_attack':
        return `当前加成: +${Math.round(config.value * 100)}${config.valueSuffix}`;
      case 'weapon_tier':
        return `当前加成: 开局档位 ${Math.round(config.value)}`;
      case 'revive_bonus':
        return `当前加成: +${Math.round(config.value * 100)}${config.valueSuffix} / +${config.extraValue.toFixed(1)}秒护盾`;
      case 'supply_quality':
        return `当前加成: 品质等级 +${Math.round(config.value)}`;
      default:
        return `当前加成: +${Math.round(config.value)}${config.valueSuffix}`;
    }
  }
}
