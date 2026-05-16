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

  updateStageInfo(title: string, value: string, meta: string, canPrev: boolean, canNext: boolean): void {
    this._ensureStageRefs();
    if (this.stageTitleLabel) this.stageTitleLabel.string = title;
    if (this.stageValueLabel) this.stageValueLabel.string = value;
    if (this.stageMetaLabel) this.stageMetaLabel.string = meta;
    if (this.prevStageButton) this.prevStageButton.interactable = canPrev;
    if (this.nextStageButton) this.nextStageButton.interactable = canNext;
  }

  private _ensureStageRefs(): void {
    if (!this.stageTitleLabel) {
      this.stageTitleLabel = this.node.getChildByName('StageTitleLabel')?.getComponent(Label) || null;
    }
    if (!this.stageValueLabel) {
      this.stageValueLabel = this.node.getChildByName('StageValueLabel')?.getComponent(Label) || null;
    }
    if (!this.stageMetaLabel) {
      this.stageMetaLabel = this.node.getChildByName('StageMetaLabel')?.getComponent(Label) || null;
    }
    if (!this.prevStageButton) {
      this.prevStageButton = this.node.getChildByName('PrevStageButton')?.getComponent(Button) || null;
    }
    if (!this.nextStageButton) {
      this.nextStageButton = this.node.getChildByName('NextStageButton')?.getComponent(Button) || null;
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
