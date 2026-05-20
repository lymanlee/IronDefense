/**
 * StartScreen.ts - 开始界面
 * 显示标题、开始按钮、调试模式入口
 */

import { _decorator, Component, Node, Label, Button } from 'cc';

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
    if (this.stageCodeLabel) this.stageCodeLabel.string = data.code;
    if (this.stageNameLabel) this.stageNameLabel.string = data.name;
    if (this.stageWaveLabel) this.stageWaveLabel.string = data.waveText;
    if (this.stageRewardLabel) this.stageRewardLabel.string = data.rewardText;
    if (this.stagePartsLabel) this.stagePartsLabel.string = data.partsText;
    if (this.stageHintLabel) this.stageHintLabel.string = data.hintText;

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
