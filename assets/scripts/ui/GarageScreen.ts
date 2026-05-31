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
  rootNode: Node | null;
  levelLabel: Label | null;
  descLabel: Label | null;
  valueLabel: Label | null;
  costLabel: Label | null;
  buttonNode: Node | null;
  buttonLabel: Label | null;
  enabled: boolean;
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
      this._refreshAvailableRowPulses();
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

    this._rows
      .filter(row => row.enabled && row.rootNode?.isValid)
      .forEach((row, index) => {
        this._playAvailableRowHighlight(row, 0.24 + index * 0.06);
        this._startAvailableRowPulse(row, 0.82 + index * 0.06);
      });
  }

  hide(animated: boolean = false, onDone?: () => void): void {
    this._ensureLayoutRefs();
    if (!animated || !this._panelNode) {
      this._rows.forEach(row => this._stopAvailableRowPulse(row));
      this._restoreShownState();
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

    this._rows.forEach(row => this._stopAvailableRowPulse(row));

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
      row.enabled = enabled;
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
      rootNode: root || null,
      levelLabel: root?.getChildByName('TitleLabel')?.getComponent(Label) || null,
      descLabel: root?.getChildByName('DescLabel')?.getComponent(Label) || null,
      valueLabel: root?.getChildByName('ValueLabel')?.getComponent(Label) || null,
      costLabel: root?.getChildByName('CostLabel')?.getComponent(Label) || null,
      buttonNode: root?.getChildByName('UpgradeBtn') || null,
      buttonLabel: root?.getChildByName('UpgradeBtn')?.getChildByName('Label')?.getComponent(Label) || null,
      enabled: false,
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

    if (!enabled) {
      this._stopAvailableRowPulse(row);
    } else if (this.node.active) {
      this._startAvailableRowPulse(row);
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
        if (row.rootNode?.isValid && nodes.indexOf(row.rootNode) < 0) {
          nodes.push(row.rootNode);
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
      node.setScale(1, 1, 1);
      this._ensureOpacity(node).opacity = 255;
    });
  }

  private _refreshAvailableRowPulses(): void {
    this._rows.forEach((row) => {
      if (row.enabled) {
        this._startAvailableRowPulse(row);
      } else {
        this._stopAvailableRowPulse(row);
      }
    });
  }

  private _playAvailableRowHighlight(row: UpgradeRowRefs, delay: number): void {
    if (!row.rootNode?.isValid || !row.buttonNode?.isValid) return;

    const rowNode = row.rootNode;
    const buttonNode = row.buttonNode;
    const rowSprite = rowNode.getComponent(Sprite);
    const rowBaseColor = rowSprite?.color.clone() || null;
    const rowBrightColor = rowBaseColor
      ? new Color(
          Math.min(255, rowBaseColor.r + 20),
          Math.min(255, rowBaseColor.g + 26),
          Math.min(255, rowBaseColor.b + 18),
          rowBaseColor.a
        )
      : null;
    const buttonBaseScale = buttonNode.getScale().clone();
    const buttonBaseColor = buttonNode.getComponent(Sprite)?.color.clone() || null;
    const buttonBrightColor = buttonBaseColor
      ? new Color(255, 248, 220, buttonBaseColor.a)
      : null;
    const glowProxy = { t: 0 };

    Tween.stopAllByTarget(glowProxy);
    tween(glowProxy)
      .delay(delay)
      .to(0.18, { t: 1 }, {
        easing: 'quadOut',
        onUpdate: () => {
          if (!rowSprite || !rowBaseColor || !rowBrightColor) return;
          rowSprite.color = Color.lerp(new Color(), rowBaseColor, rowBrightColor, glowProxy.t);
          const buttonSprite = buttonNode.getComponent(Sprite);
          if (buttonSprite && buttonBaseColor && buttonBrightColor) {
            buttonSprite.color = Color.lerp(new Color(), buttonBaseColor, buttonBrightColor, glowProxy.t);
          }
        },
      })
      .to(0.28, { t: 0 }, {
        easing: 'quadInOut',
        onUpdate: () => {
          if (!rowSprite || !rowBaseColor || !rowBrightColor) return;
          rowSprite.color = Color.lerp(new Color(), rowBaseColor, rowBrightColor, glowProxy.t);
          const buttonSprite = buttonNode.getComponent(Sprite);
          if (buttonSprite && buttonBaseColor && buttonBrightColor) {
            buttonSprite.color = Color.lerp(new Color(), buttonBaseColor, buttonBrightColor, glowProxy.t);
          }
        },
      })
      .call(() => {
        if (rowSprite && rowBaseColor) {
          rowSprite.color = rowBaseColor;
        }
        const buttonSprite = buttonNode.getComponent(Sprite);
        if (buttonSprite && buttonBaseColor) {
          buttonSprite.color = buttonBaseColor;
        }
      })
      .start();

    Tween.stopAllByTarget(buttonNode);
    tween(buttonNode)
      .delay(delay + 0.04)
      .to(0.16, { scale: new Vec3(buttonBaseScale.x * 1.08, buttonBaseScale.y * 1.08, 1) }, { easing: 'backOut' })
      .to(0.2, { scale: buttonBaseScale }, { easing: 'quadOut' })
      .start();
  }

  private _startAvailableRowPulse(row: UpgradeRowRefs, delay: number = 0): void {
    if (!row.enabled || !row.buttonNode?.isValid || !row.rootNode?.isValid) return;

    const buttonNode = row.buttonNode as Node & { __garagePulseActive?: boolean };
    if (buttonNode.__garagePulseActive) return;
    buttonNode.__garagePulseActive = true;
    buttonNode.setScale(1, 1, 1);

    const rowNode = row.rootNode;
    const rowSprite = rowNode.getComponent(Sprite);
    const rowBaseColor = this._getRowBaseColor(rowNode);
    const rowPulseColor = rowBaseColor
      ? new Color(
          Math.min(255, rowBaseColor.r + 18),
          Math.min(255, rowBaseColor.g + 24),
          Math.min(255, rowBaseColor.b + 18),
          rowBaseColor.a
        )
      : null;
    const rowCarrier = rowNode as Node & { __garageRowPulseProxy?: { t: number } };
    rowCarrier.__garageRowPulseProxy = rowCarrier.__garageRowPulseProxy || { t: 0 };
    rowCarrier.__garageRowPulseProxy.t = 0;

    const pulse = tween(buttonNode)
      .delay(delay)
      .to(0.58, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'sineInOut' })
      .to(0.58, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
      .delay(0.5)
      .union()
      .repeatForever();

    pulse.start();

    if (rowSprite && rowBaseColor && rowPulseColor) {
      Tween.stopAllByTarget(rowCarrier.__garageRowPulseProxy);
      tween(rowCarrier.__garageRowPulseProxy)
        .delay(delay)
        .to(0.58, { t: 1 }, {
          easing: 'sineInOut',
          onUpdate: () => {
            rowSprite.color = Color.lerp(new Color(), rowBaseColor, rowPulseColor, rowCarrier.__garageRowPulseProxy!.t);
          },
        })
        .to(0.58, { t: 0 }, {
          easing: 'sineInOut',
          onUpdate: () => {
            rowSprite.color = Color.lerp(new Color(), rowBaseColor, rowPulseColor, rowCarrier.__garageRowPulseProxy!.t);
          },
        })
        .delay(0.5)
        .union()
        .repeatForever()
        .start();
    }
  }

  private _stopAvailableRowPulse(row: UpgradeRowRefs): void {
    if (!row.buttonNode?.isValid) return;
    const buttonNode = row.buttonNode as Node & { __garagePulseActive?: boolean };
    buttonNode.__garagePulseActive = false;
    Tween.stopAllByTarget(buttonNode);
    buttonNode.setScale(1, 1, 1);

    if (row.rootNode?.isValid) {
      const rowSprite = row.rootNode.getComponent(Sprite);
      const rowCarrier = row.rootNode as Node & { __garageRowPulseProxy?: { t: number } };
      if (rowCarrier.__garageRowPulseProxy) {
        Tween.stopAllByTarget(rowCarrier.__garageRowPulseProxy);
        rowCarrier.__garageRowPulseProxy.t = 0;
      }
      if (rowSprite) {
        const baseColor = this._getRowBaseColor(row.rootNode);
        if (baseColor) {
          rowSprite.color = baseColor;
        }
      }
    }
  }

  private _getRowBaseColor(node: Node): Color | null {
    const carrier = node as Node & { __garageBaseColor?: Color };
    if (!carrier.__garageBaseColor) {
      const sprite = node.getComponent(Sprite);
      if (!sprite) return null;
      carrier.__garageBaseColor = sprite.color.clone();
    }
    return carrier.__garageBaseColor.clone();
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
