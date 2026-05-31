/**
 * StartScreen.ts - 开始界面
 * 显示标题、开始按钮、调试模式入口
 */

import { _decorator, Component, Node, Label, Button, tween, Tween, UIOpacity, Vec3, Graphics, UITransform, Mask, Color } from 'cc';

const { ccclass, property } = _decorator;

export interface DebugSettings {
  wave: number;
  level: number;
}

export interface StartStageDisplayData {
  eyebrow: string;
  code: string;
  name: string;
  waveText: string;
  rewardText: string;
  partsText: string;
  hintText: string;
  canPrev: boolean;
  canNext: boolean;
}

@ccclass('StartScreen')
export class StartScreen extends Component {
  private static readonly SHOW_DURATION = 0.4;
  private static readonly HIDE_DURATION = 0.18;

  // 回调
  private _onStart: (() => void) | null = null;
  private _onDebug: (() => void) | null = null;
  private _onGarage: (() => void) | null = null;
  private _onPrevStage: (() => void) | null = null;
  private _onNextStage: (() => void) | null = null;

  @property(Label)
  stageTitleLabel: Label | null = null;

  @property(Label)
  stageValueLabel: Label | null = null;

  @property(Label)
  stageMetaLabel: Label | null = null;

  @property(Label)
  stageCodeLabel: Label | null = null;

  @property(Label)
  stageNameLabel: Label | null = null;

  @property(Label)
  stageHintLabel: Label | null = null;

  @property(Label)
  stageWaveLabel: Label | null = null;

  @property(Label)
  stageRewardLabel: Label | null = null;

  @property(Label)
  stagePartsLabel: Label | null = null;

  @property(Button)
  prevStageButton: Button | null = null;

  @property(Button)
  nextStageButton: Button | null = null;

  @property(Node)
  garageNotifyNode: Node | null = null;

  private _bgNode: Node | null = null;
  private _heroBlockNode: Node | null = null;
  private _stageBlockNode: Node | null = null;
  private _actionBlockNode: Node | null = null;
  private _utilityBarNode: Node | null = null;

  /**
   * 设置开始回调
   */
  setOnStart(callback: () => void): void {
    this._onStart = callback;
  }

  /**
   * 设置调试模式回调
   */
  setOnDebug(callback: () => void): void {
    this._onDebug = callback;
  }

  setOnGarage(callback: () => void): void {
    this._onGarage = callback;
  }

  setOnPrevStage(callback: () => void): void {
    this._onPrevStage = callback;
  }

  setOnNextStage(callback: () => void): void {
    this._onNextStage = callback;
  }

  updateStageInfo(data: StartStageDisplayData): void {
    this._ensureStageRefs();
    if (this.stageTitleLabel) this.stageTitleLabel.string = data.eyebrow;
    if (this.stageCodeLabel) {
      this.stageCodeLabel.string = data.code;
      this.stageCodeLabel.node.active = data.code.trim().length > 0;
    }
    if (this.stageNameLabel) this.stageNameLabel.string = data.name;
    if (this.stageWaveLabel) {
      this.stageWaveLabel.string = data.waveText;
    }
    if (this.stageRewardLabel) {
      this.stageRewardLabel.string = data.rewardText;
    }
    if (this.stagePartsLabel) {
      this.stagePartsLabel.string = data.partsText;
    }
    if (this.stageHintLabel) {
      this.stageHintLabel.string = data.hintText;
      this.stageHintLabel.node.active = data.hintText.trim().length > 0;
    }

    // Fallback for older scene layouts before the richer stage card nodes exist.
    if (this.stageValueLabel && !this.stageCodeLabel && !this.stageNameLabel) {
      this.stageValueLabel.string = `${data.code} ${data.name}`;
    }
    if (this.stageMetaLabel && !this.stageWaveLabel && !this.stageRewardLabel && !this.stagePartsLabel && !this.stageHintLabel) {
      const parts = data.partsText ? ` · ${data.partsText}` : '';
      this.stageMetaLabel.string = `${data.waveText} · ${data.rewardText}${parts}`;
    }

    if (this.prevStageButton) this.prevStageButton.interactable = data.canPrev;
    if (this.nextStageButton) this.nextStageButton.interactable = data.canNext;
  }

  setGarageNotifyVisible(visible: boolean): void {
    this._ensureGarageRefs();
    if (this.garageNotifyNode) {
      this.garageNotifyNode.active = visible;
    }
    if (visible) {
      this._startGarageNotifyPulse();
    } else {
      this._stopGarageNotifyPulse();
    }
  }

  show(animated: boolean = true): void {
    this._ensureLayoutRefs();
    if (!animated) {
      this.node.active = true;
      this._restoreShownState();
      this._refreshGarageNotifyPulse();
      return;
    }

    this.node.active = true;
    this._resetBg();
    const groups = this._getAnimatedGroups();
    groups.forEach((group, index) => this._resetGroup(group, index));

    const bgOpacity = this._bgNode ? this._ensureOpacity(this._bgNode) : null;
    if (bgOpacity) {
      Tween.stopAllByTarget(bgOpacity);
      tween(bgOpacity)
        .to(StartScreen.SHOW_DURATION * 0.65, { opacity: 235 }, { easing: 'quadOut' })
        .start();
    }

    groups.forEach((group, index) => {
      const opacity = this._ensureOpacity(group);
      const targetPosition = this._getBasePosition(group);
      const delay = 0.05 + index * 0.05;
      Tween.stopAllByTarget(opacity);
      Tween.stopAllByTarget(group);
      tween(opacity)
        .delay(delay)
        .to(0.22, { opacity: 255 }, { easing: 'quadOut' })
        .start();
      tween(group)
        .delay(delay)
        .to(0.24, {
          position: targetPosition,
          scale: new Vec3(1.04, 1.04, 1),
        }, { easing: 'backOut' })
        .to(0.16, {
          scale: new Vec3(1, 1, 1),
        }, { easing: 'quadOut' })
        .start();
    });
  }

  hide(animated: boolean = false, onDone?: () => void): void {
    this._ensureLayoutRefs();
    if (!animated) {
      this._stopGarageNotifyPulse();
      this._restoreShownState();
      this.node.active = false;
      onDone?.();
      return;
    }

    const groups = this._getAnimatedGroups();
    const bgOpacity = this._bgNode ? this._ensureOpacity(this._bgNode) : null;
    if (bgOpacity) {
      Tween.stopAllByTarget(bgOpacity);
      tween(bgOpacity)
        .to(StartScreen.HIDE_DURATION, { opacity: 0 }, { easing: 'quadIn' })
        .start();
    }

    groups.forEach((group) => {
      const opacity = this._ensureOpacity(group);
      Tween.stopAllByTarget(opacity);
      Tween.stopAllByTarget(group);
      tween(opacity)
        .to(StartScreen.HIDE_DURATION * 0.85, { opacity: 0 }, { easing: 'quadIn' })
        .start();
      tween(group)
        .to(StartScreen.HIDE_DURATION, {
          position: this._getBasePosition(group).clone().add3f(0, -18, 0),
          scale: new Vec3(0.96, 0.96, 1),
        }, { easing: 'quadIn' })
        .start();
    });

    this.scheduleOnce(() => {
      this.node.active = false;
      this._restoreShownState();
      this._stopGarageNotifyPulse();
      onDone?.();
    }, StartScreen.HIDE_DURATION);
  }

  private _ensureStageRefs(): void {
    const stageCard = this.node.getChildByName('StageCard');
    if (!this.stageTitleLabel) {
      this.stageTitleLabel = stageCard?.getChildByName('StageTitleLabel')?.getComponent(Label) || null;
    }
    if (!this.stageValueLabel) {
      this.stageValueLabel = stageCard?.getChildByName('StageValueLabel')?.getComponent(Label) || null;
    }
    if (!this.stageMetaLabel) {
      this.stageMetaLabel = stageCard?.getChildByName('StageMetaLabel')?.getComponent(Label) || null;
    }
    if (!this.stageCodeLabel) {
      this.stageCodeLabel = stageCard?.getChildByName('StageCodeLabel')?.getComponent(Label) || null;
    }
    if (!this.stageNameLabel) {
      this.stageNameLabel = stageCard?.getChildByName('StageNameLabel')?.getComponent(Label) || null;
    }
    if (!this.stageHintLabel) {
      this.stageHintLabel = stageCard?.getChildByName('StageHintLabel')?.getComponent(Label) || null;
    }
    if (!this.stageWaveLabel) {
      this.stageWaveLabel = stageCard?.getChildByName('WaveBadgeLabel')?.getComponent(Label) || null;
    }
    if (!this.stageRewardLabel) {
      this.stageRewardLabel = stageCard?.getChildByName('RewardBadgeLabel')?.getComponent(Label) || null;
    }
    if (!this.stagePartsLabel) {
      this.stagePartsLabel = stageCard?.getChildByName('PartsBadgeLabel')?.getComponent(Label) || null;
    }
    if (!this.prevStageButton) {
      this.prevStageButton = stageCard?.getChildByName('PrevStageButton')?.getComponent(Button) || null;
    }
    if (!this.nextStageButton) {
      this.nextStageButton = stageCard?.getChildByName('NextStageButton')?.getComponent(Button) || null;
    }
  }

  private _ensureGarageRefs(): void {
    if (!this.garageNotifyNode) {
      this.garageNotifyNode = this.node
        .getChildByName('ActionBlock')
        ?.getChildByName('GarageButton')
        ?.getChildByName('UpgradeDot') || null;
    }
  }

  private _ensureLayoutRefs(): void {
    this._bgNode = this._bgNode || this.node.getChildByName('Bg') || null;
    this._heroBlockNode = this._heroBlockNode || this.node.getChildByName('HeroBlock') || null;
    this._stageBlockNode = this._stageBlockNode || this.node.getChildByName('StageBlock') || null;
    this._actionBlockNode = this._actionBlockNode || this.node.getChildByName('ActionBlock') || null;
    this._utilityBarNode = this._utilityBarNode || this.node.getChildByName('UtilityBar') || null;
  }

  private _getAnimatedGroups(): Node[] {
    return [
      this._heroBlockNode,
      this._stageBlockNode,
      this._actionBlockNode,
      this._utilityBarNode,
    ].filter((node): node is Node => Boolean(node && node.isValid));
  }

  private _resetBg(): void {
    if (!this._bgNode) return;
    const opacity = this._ensureOpacity(this._bgNode);
    Tween.stopAllByTarget(opacity);
    opacity.opacity = 0;
  }

  private _resetGroup(node: Node, index: number): void {
    const opacity = this._ensureOpacity(node);
    const basePosition = this._getBasePosition(node);
    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(opacity);
    node.setPosition(basePosition.clone().add3f(0, 26 + index * 10, 0));
    node.setScale(0.94, 0.94, 1);
    opacity.opacity = 0;
  }

  private _restoreShownState(): void {
    if (this._bgNode?.isValid) {
      this._ensureOpacity(this._bgNode).opacity = 235;
    }
    this._getAnimatedGroups().forEach((group) => {
      group.setPosition(this._getBasePosition(group));
      group.setScale(1, 1, 1);
      this._ensureOpacity(group).opacity = 255;
    });
    this._refreshGarageNotifyPulse();
  }

  private _refreshGarageNotifyPulse(): void {
    this._ensureGarageRefs();
    if (this.garageNotifyNode?.active) {
      this._startGarageNotifyPulse();
    } else {
      this._stopGarageNotifyPulse();
    }
  }

  private _startGarageNotifyPulse(): void {
    this._ensureGarageRefs();
    if (!this.garageNotifyNode?.isValid || !this.garageNotifyNode.active) return;

    const dotNode = this.garageNotifyNode as Node & {
      __notifyPulseActive?: boolean;
      __notifyShineNode?: Node | null;
      __notifyShineMaskNode?: Node | null;
      __notifyShineDriver?: { t: number } | null;
    };
    dotNode.__notifyPulseActive = true;

    const shineNode = this._ensureGarageNotifyShineNode(dotNode);
    const shineOpacity = shineNode ? this._ensureOpacity(shineNode) : null;
    dotNode.__notifyShineDriver = dotNode.__notifyShineDriver || { t: 0 };
    const driver = dotNode.__notifyShineDriver;

    if (!shineNode || !shineOpacity || !driver) return;

    Tween.stopAllByTarget(driver);
    Tween.stopAllByTarget(shineNode);
    Tween.stopAllByTarget(shineOpacity);
    driver.t = 0;
    this._applyGarageNotifyShineFrame(dotNode, driver.t);

    tween(driver)
      .delay(0.18)
      .to(0.34, { t: 1 }, {
        easing: 'quadOut',
        onUpdate: () => {
          this._applyGarageNotifyShineFrame(dotNode, driver.t);
        },
      })
      .delay(1.05)
      .call(() => {
        driver.t = 0;
        this._applyGarageNotifyShineFrame(dotNode, driver.t);
      })
      .union()
      .repeatForever()
      .start();
  }

  private _stopGarageNotifyPulse(): void {
    this._ensureGarageRefs();
    if (!this.garageNotifyNode?.isValid) return;

    const dotNode = this.garageNotifyNode as Node & {
      __notifyPulseActive?: boolean;
      __notifyShineNode?: Node | null;
      __notifyShineDriver?: { t: number } | null;
    };
    dotNode.__notifyPulseActive = false;
    const driver = dotNode.__notifyShineDriver;
    if (driver) {
      Tween.stopAllByTarget(driver);
      driver.t = 0;
    }
    this._applyGarageNotifyShineFrame(dotNode, 0);
  }

  private _applyGarageNotifyShineFrame(
    dotNode: Node & { __notifyShineNode?: Node | null },
    t: number,
  ): void {
    const shineNode = dotNode.__notifyShineNode;
    if (!shineNode?.isValid) return;

    const shineOpacity = this._ensureOpacity(shineNode);
    const x = -16 + 32 * t;
    const y = 8 - 16 * t;
    shineNode.setPosition(x, y, 0);

    // Bell-shaped alpha: stronger in the middle, fully transparent at both ends.
    const alpha = Math.max(0, Math.sin(t * Math.PI));
    shineOpacity.opacity = Math.round(alpha * 210);
  }

  private _ensureGarageNotifyShineNode(dotNode: Node & { __notifyShineNode?: Node | null; __notifyShineMaskNode?: Node | null }): Node | null {
    if (dotNode.__notifyShineNode?.isValid) {
      return dotNode.__notifyShineNode;
    }

    const maskNode = new Node('NotifyShineMask');
    const maskTransform = maskNode.addComponent(UITransform);
    maskTransform.setContentSize(20, 20);
    const mask = maskNode.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_ELLIPSE;
    maskNode.setPosition(0, 0, 0);
    dotNode.addChild(maskNode);

    const shineNode = new Node('NotifyShine');
    const transform = shineNode.addComponent(UITransform);
    transform.setContentSize(18, 28);
    const graphics = shineNode.addComponent(Graphics);
    const opacity = shineNode.addComponent(UIOpacity);
    opacity.opacity = 0;

    // Draw a slanted white gradient band: bright center with softer transparent edges.
    graphics.fillColor = new Color(255, 255, 255, 36);
    graphics.rect(-7, -14, 4, 28);
    graphics.fill();
    graphics.fillColor = new Color(255, 255, 255, 108);
    graphics.rect(-3, -14, 4, 28);
    graphics.fill();
    graphics.fillColor = new Color(255, 255, 255, 198);
    graphics.rect(1, -14, 3, 28);
    graphics.fill();
    graphics.fillColor = new Color(255, 255, 255, 72);
    graphics.rect(4, -14, 3, 28);
    graphics.fill();

    shineNode.angle = -28;
    shineNode.setPosition(-16, 8, 0);
    maskNode.addChild(shineNode);
    dotNode.__notifyShineMaskNode = maskNode;
    dotNode.__notifyShineNode = shineNode;
    return shineNode;
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

  /**
   * 点击开始（由编辑器 clickEvents 触发）
   */
  onStartClicked(): void {
    console.log('[StartScreen] onStartClicked called');
    console.log('[StartScreen] _onStart:', this._onStart);
    if (this._onStart) {
      this._onStart();
    }
  }

  /**
   * 点击调试模式（由编辑器 clickEvents 触发）
   */
  onDebugClicked(): void {
    console.log('[StartScreen] onDebugClicked called');
    console.log('[StartScreen] _onDebug:', this._onDebug);
    if (this._onDebug) {
      this._onDebug();
    }
  }

  onGarageClicked(): void {
    console.log('[StartScreen] onGarageClicked called');
    console.log('[StartScreen] _onGarage:', this._onGarage);
    if (this._onGarage) {
      this._onGarage();
    }
  }

  onPrevStageClicked(): void {
    if (this._onPrevStage) {
      this._onPrevStage();
    }
  }

  onNextStageClicked(): void {
    if (this._onNextStage) {
      this._onNextStage();
    }
  }
}
