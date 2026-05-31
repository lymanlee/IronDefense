/**
 * GarageScreen.ts - 车库升级界面
 * 展示长期资源、永久升级项，并提供升级与返回入口
 */

import { _decorator, Button, Color, Component, Label, Node, Sprite, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { PermanentUpgradeConfig, PermanentUpgradeId } from '../data/GameConfig';
import { ProgressManager } from '../managers/ProgressManager';

const { ccclass, property } = _decorator;

const UPGRADE_BUTTON_ENABLED_COLOR = new Color(245, 245, 245, 255);
const UPGRADE_BUTTON_DISABLED_COLOR = new Color(92, 104, 115, 190);
const UPGRADE_BUTTON_LABEL_ENABLED_COLOR = new Color(255, 255, 255, 255);
const UPGRADE_BUTTON_LABEL_DISABLED_COLOR = new Color(165, 176, 186, 255);
const UPGRADE_COST_DISABLED_COLOR = new Color(133, 150, 166, 255);

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
  private static readonly SHOW_DURATION = 0.42;
  private static readonly HIDE_DURATION = 0.2;

  @property(Label)
  coinsLabel: Label | null = null;

  @property(Label)
  partsLabel: Label | null = null;

  @property(Label)
  summaryLabel: Label | null = null;

  private _onBack: (() => void) | null = null;
  private _onUpgrade: ((id: PermanentUpgradeId) => boolean) | null = null;
  private _rows: UpgradeRowRefs[] = [];
  private _bgNode: Node | null = null;
  private _panelNode: Node | null = null;

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

  show(animated: boolean = true): void {
    this._ensureLayoutRefs();
    if (!animated || !this._panelNode) {
      this.node.active = true;
      this._restoreShownState();
      return;
    }

    this.node.active = true;
    this._resetBg();
    this._resetPanel();
    const contentNodes = this._getAnimatedNodes();
    contentNodes.forEach((node, index) => this._resetContent(node, index));

    if (this._bgNode) {
      const bgOpacity = this._ensureOpacity(this._bgNode);
      Tween.stopAllByTarget(bgOpacity);
      tween(bgOpacity)
        .to(GarageScreen.SHOW_DURATION * 0.62, { opacity: 255 }, { easing: 'quadOut' })
        .start();
    }

    const panelOpacity = this._ensureOpacity(this._panelNode);
    Tween.stopAllByTarget(panelOpacity);
    tween(panelOpacity)
      .to(GarageScreen.SHOW_DURATION * 0.72, { opacity: 255 }, { easing: 'quadOut' })
      .start();

    const panelTarget = this._getBasePosition(this._panelNode);
    Tween.stopAllByTarget(this._panelNode);
    tween(this._panelNode)
      .to(GarageScreen.SHOW_DURATION * 0.56, {
        position: panelTarget,
        scale: new Vec3(1.03, 1.03, 1),
      }, { easing: 'backOut' })
      .to(GarageScreen.SHOW_DURATION * 0.2, {
        scale: new Vec3(1, 1, 1),
      }, { easing: 'quadOut' })
      .start();

    contentNodes.forEach((node, index) => {
      const opacity = this._ensureOpacity(node);
      const targetPosition = this._getBasePosition(node);
      const delay = 0.05 + index * 0.024;
      Tween.stopAllByTarget(opacity);
      Tween.stopAllByTarget(node);
      tween(opacity)
        .delay(delay)
        .to(0.18, { opacity: 255 }, { easing: 'quadOut' })
        .start();
      tween(node)
        .delay(delay)
        .to(0.2, { position: targetPosition }, { easing: 'backOut' })
        .start();
    });
  }

  hide(animated: boolean = false, onDone?: () => void): void {
    this._ensureLayoutRefs();
    if (!animated || !this._panelNode) {
      this.node.active = false;
      onDone?.();
      return;
    }

    if (this._bgNode) {
      const bgOpacity = this._ensureOpacity(this._bgNode);
      Tween.stopAllByTarget(bgOpacity);
      tween(bgOpacity)
        .to(GarageScreen.HIDE_DURATION, { opacity: 0 }, { easing: 'quadIn' })
        .start();
    }

    const panelOpacity = this._ensureOpacity(this._panelNode);
    Tween.stopAllByTarget(panelOpacity);
    tween(panelOpacity)
      .to(GarageScreen.HIDE_DURATION * 0.9, { opacity: 0 }, { easing: 'quadIn' })
      .start();

    Tween.stopAllByTarget(this._panelNode);
    tween(this._panelNode)
      .to(GarageScreen.HIDE_DURATION, {
        position: this._getBasePosition(this._panelNode).clone().add3f(0, -24, 0),
        scale: new Vec3(0.97, 0.97, 1),
      }, { easing: 'quadIn' })
      .start();

    this.scheduleOnce(() => {
      this.node.active = false;
      this._restoreShownState();
      onDone?.();
    }, GarageScreen.HIDE_DURATION);
  }

  refresh(): void {
    const progress = ProgressManager.instance;
    const panel = this.node.getChildByName('Panel');
    const rows = this._rows.length > 0 ? this._rows : this._cacheRows();
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
        `耐久 +${bonus.carHpFlat}  |  伤害 +${Math.round((bonus.carDamageMultiplier - 1) * 100)}%  |  开局档位 ${bonus.baseWeaponTier}`,
        `开局金币 +${bonus.startingCoins}  |  复活增益 +${Math.round(bonus.reviveHpBonusRatio * 100)}%`,
      ].join('\n');
    }

    const allStates = progress.getAllUpgradeStates();
    rows.forEach((row) => {
      const state = allStates.find(item => item.id === row.id);
      if (!state) return;

      if (row.levelLabel) {
        row.levelLabel.string = `${state.title} · Lv ${state.level}/${state.maxLevel}`;
      }
      if (row.descLabel) {
        row.descLabel.string = state.desc;
      }
      if (row.valueLabel) {
        row.valueLabel.string = this._formatUpgradeValue(state);
      }
      const enabled = !state.isMaxLevel && progress.canUpgrade(state.id);
      if (row.costLabel) {
        row.costLabel.string = state.isMaxLevel
          ? '已满级'
          : `${state.currency === 'coins' ? '金币' : '零件'} ${state.nextCost}`;
        row.costLabel.color = !enabled
          ? UPGRADE_COST_DISABLED_COLOR
          : this._getCurrencyColor(state.currency);
      }

      if (row.buttonLabel) {
        row.buttonLabel.string = state.isMaxLevel ? '满级' : enabled ? '升级' : '不足';
      }
      this._applyUpgradeButtonState(row, enabled);
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

  private _applyUpgradeButtonState(row: UpgradeRowRefs, enabled: boolean): void {
    if (row.buttonNode) {
      const button = row.buttonNode.getComponent(Button);
      if (button) {
        button.normalColor = UPGRADE_BUTTON_ENABLED_COLOR;
        button.disabledColor = UPGRADE_BUTTON_DISABLED_COLOR;
        button.interactable = enabled;
      }

      const sprite = row.buttonNode.getComponent(Sprite);
      if (sprite) {
        sprite.color = enabled ? UPGRADE_BUTTON_ENABLED_COLOR : UPGRADE_BUTTON_DISABLED_COLOR;
      }
    }

    if (row.buttonLabel) {
      row.buttonLabel.color = enabled
        ? UPGRADE_BUTTON_LABEL_ENABLED_COLOR
        : UPGRADE_BUTTON_LABEL_DISABLED_COLOR;
    }
  }

  private _formatUpgradeValue(config: PermanentUpgradeConfig & { value: number; extraValue: number }): string {
    switch (config.id) {
      case 'car_attack':
        return `当前: +${Math.round(config.value * 100)}${config.valueSuffix}`;
      case 'weapon_tier':
        return `当前: 开局档位 ${Math.round(config.value)}`;
      case 'revive_bonus':
        return `当前: +${Math.round(config.value * 100)}${config.valueSuffix} / +${config.extraValue.toFixed(1)}秒护盾`;
      case 'supply_quality':
        return `当前: 品质等级 +${Math.round(config.value)}`;
      default:
        return `当前: +${Math.round(config.value)}${config.valueSuffix}`;
    }
  }

  private _getCurrencyColor(currency: 'coins' | 'parts'): Color {
    return currency === 'coins'
      ? new Color(255, 220, 138, 255)
      : new Color(154, 224, 255, 255);
  }

  private _ensureLayoutRefs(): void {
    this._bgNode = this._bgNode || this.node.getChildByName('Bg') || null;
    this._panelNode = this._panelNode || this.node.getChildByName('Panel') || null;
  }

  private _getAnimatedNodes(): Node[] {
    const nodes: Node[] = [];
    if (this._panelNode) {
      const title = this._panelNode.getChildByName('TitleLabel');
      const topBar = this._panelNode.getChildByName('TopBar');
      const summary = this._panelNode.getChildByName('SummaryLabel');
      const hint = this._panelNode.getChildByName('HintLabel');
      const backBtn = this._panelNode.getChildByName('BackBtn');
      [title, topBar, summary, hint].forEach(node => {
        if (node?.isValid) nodes.push(node);
      });
      this._rows.forEach(row => {
        if (row.buttonNode?.parent?.isValid && nodes.indexOf(row.buttonNode.parent) < 0) {
          nodes.push(row.buttonNode.parent);
        }
      });
      if (backBtn?.isValid) nodes.push(backBtn);
    }
    return nodes;
  }

  private _resetBg(): void {
    if (!this._bgNode) return;
    const opacity = this._ensureOpacity(this._bgNode);
    Tween.stopAllByTarget(opacity);
    opacity.opacity = 0;
  }

  private _resetPanel(): void {
    if (!this._panelNode) return;
    const opacity = this._ensureOpacity(this._panelNode);
    const basePosition = this._getBasePosition(this._panelNode);
    Tween.stopAllByTarget(this._panelNode);
    Tween.stopAllByTarget(opacity);
    this._panelNode.setPosition(basePosition.clone().add3f(0, 36, 0));
    this._panelNode.setScale(0.96, 0.96, 1);
    opacity.opacity = 0;
  }

  private _resetContent(node: Node, index: number): void {
    const opacity = this._ensureOpacity(node);
    const basePosition = this._getBasePosition(node);
    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(opacity);
    node.setPosition(basePosition.clone().add3f(0, 14 + Math.min(index, 8) * 3, 0));
    opacity.opacity = 0;
  }

  private _restoreShownState(): void {
    if (this._bgNode?.isValid) {
      this._ensureOpacity(this._bgNode).opacity = 255;
    }
    if (this._panelNode?.isValid) {
      this._panelNode.setPosition(this._getBasePosition(this._panelNode));
      this._panelNode.setScale(1, 1, 1);
      this._ensureOpacity(this._panelNode).opacity = 255;
    }
    this._getAnimatedNodes().forEach((node) => {
      node.setPosition(this._getBasePosition(node));
      this._ensureOpacity(node).opacity = 255;
    });
  }

  private _getBasePosition(node: Node): Vec3 {
    const carrier = node as Node & { __popupBasePosition?: Vec3 };
    if (!carrier.__popupBasePosition) {
      carrier.__popupBasePosition = node.getPosition().clone();
    }
    return carrier.__popupBasePosition.clone();
  }

  private _ensureOpacity(node: Node): UIOpacity {
    return node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
  }
}
