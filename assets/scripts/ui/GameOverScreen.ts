/**
 * GameOverScreen.ts - 结算界面
 * 负责填充结算文案与按钮状态，视觉样式尽量在编辑器中配置
 */

import { _decorator, Button, Color, Component, Label, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('GameOverScreen')
export class GameOverScreen extends Component {
  private _onRestart: (() => void) | null = null;
  private _onMenu: (() => void) | null = null;
  private _onDoubleReward: (() => void) | null = null;
  private _doubleRewardEnabled: boolean = true;

  @property(Label)
  titleLabel: Label | null = null;

  @property(Label)
  subtitleLabel: Label | null = null;

  @property(Label)
  statsLabel: Label | null = null;

  @property(Label)
  stageLineLabel: Label | null = null;

  @property(Label)
  combatLineLabel: Label | null = null;

  @property(Label)
  progressLineLabel: Label | null = null;

  @property(Label)
  rewardLabel: Label | null = null;

  @property(Button)
  doubleRewardButton: Button | null = null;

  @property(Button)
  restartButton: Button | null = null;

  @property(Label)
  doubleRewardLabel: Label | null = null;

  @property(Node)
  bannerAdSlot: Node | null = null;

  @property({ type: Color })
  gameOverTitleColor: Color = new Color(255, 102, 92, 255);

  @property({ type: Color })
  victoryTitleColor: Color = new Color(255, 226, 130, 255);

  setOnRestart(callback: () => void): void {
    this._onRestart = callback;
  }

  setOnMenu(callback: () => void): void {
    this._onMenu = callback;
  }

  setOnDoubleReward(callback: () => void): void {
    this._onDoubleReward = callback;
    this._ensureRefs();
    if (this.doubleRewardButton) {
      this.doubleRewardButton.node.active = !!callback;
    }
  }

  showGameOver(
    stageLabel: string,
    kills: number,
    wave: number,
    progressText: string,
    coins: number = 0,
    parts: number = 0,
  ): void {
    this._ensureRefs();
    if (this.titleLabel) {
      this.titleLabel.string = '很遗憾，继续加油！';
      this.titleLabel.color = this.gameOverTitleColor;
    }
    if (this.subtitleLabel) {
      this.subtitleLabel.node.active = false;
    }
    if (this.statsLabel) {
      this.statsLabel.node.active = !this.stageLineLabel && !this.combatLineLabel && !this.progressLineLabel;
    }
    this._setSummaryLines(stageLabel, kills, wave, progressText, '抵达波次');
    if (this.rewardLabel) {
      this.rewardLabel.string = `基础奖励  金币 +${coins}   零件 +${parts}`;
    }
    if (this.restartButton) {
      this.restartButton.node.active = !!this._onRestart;
    }
    if (this.bannerAdSlot) {
      this.bannerAdSlot.active = false;
    }
    this.setDoubleRewardAvailable(true, '看广告双倍奖励');
    this.node.active = true;
  }

  showVictory(
    stageLabel: string,
    kills: number,
    wave: number,
    progressText: string,
    coins: number = 0,
    parts: number = 0,
  ): void {
    this._ensureRefs();
    if (this.titleLabel) {
      this.titleLabel.string = '太棒了，已取得阶段胜利！';
      this.titleLabel.color = this.victoryTitleColor;
    }
    if (this.subtitleLabel) {
      this.subtitleLabel.node.active = false;
    }
    if (this.statsLabel) {
      this.statsLabel.node.active = !this.stageLineLabel && !this.combatLineLabel && !this.progressLineLabel;
    }
    this._setSummaryLines(stageLabel, kills, wave, progressText, '完成波次');
    if (this.rewardLabel) {
      this.rewardLabel.string = `结算奖励  金币 +${coins}   零件 +${parts}`;
    }
    if (this.restartButton) {
      this.restartButton.node.active = false;
    }
    if (this.bannerAdSlot) {
      this.bannerAdSlot.active = false;
    }
    this.setDoubleRewardAvailable(true, '看广告双倍奖励');
    this.node.active = true;
  }

  onRestartClicked(): void {
    if (this._onRestart) {
      this._onRestart();
    }
  }

  onMenuClicked(): void {
    if (this._onMenu) {
      this._onMenu();
    }
  }

  onDoubleRewardClicked(): void {
    if (!this._doubleRewardEnabled) return;
    if (this._onDoubleReward) {
      this._onDoubleReward();
    }
  }

  setDoubleRewardAvailable(available: boolean, text: string): void {
    this._ensureRefs();
    this._doubleRewardEnabled = available;
    if (this.doubleRewardButton) {
      this.doubleRewardButton.interactable = available;
      this.doubleRewardButton.node.active = !!this._onDoubleReward;
    }
    if (this.doubleRewardLabel) {
      this.doubleRewardLabel.string = text;
    }
  }

  hide(): void {
    this.node.active = false;
  }

  private _buildStatsText(stageLabel: string, kills: number, wave: number, progressText: string): string {
    return [
      `作战关卡  ${stageLabel}    抵达波次  ${wave}`,
      `击毁敌军  ${kills}    推进结果  ${progressText}`,
    ].join('\n');
  }

  private _setSummaryLines(
    stageLabel: string,
    kills: number,
    wave: number,
    progressText: string,
    wavePrefix: string,
  ): void {
    if (this.stageLineLabel || this.combatLineLabel || this.progressLineLabel) {
      if (this.stageLineLabel) {
        this.stageLineLabel.string = `作战关卡  ${stageLabel}`;
      }
      if (this.combatLineLabel) {
        this.combatLineLabel.string = `${wavePrefix}  ${wave}    击毁敌军  ${kills}`;
      }
      if (this.progressLineLabel) {
        this.progressLineLabel.string = progressText;
      }
      return;
    }

    if (this.statsLabel) {
      this.statsLabel.string = this._buildStatsText(stageLabel, kills, wave, progressText);
    }
  }

  private _ensureRefs(): void {
    const bg = this.node.getChildByName('Bg');
    const panel = bg?.getChildByName('Panel');
    const infoCard = panel?.getChildByName('InfoCard');
    const rewardCard = panel?.getChildByName('RewardCard');

    if (!this.titleLabel) {
      this.titleLabel = panel?.getChildByName('TitleLabel')?.getComponent(Label) || null;
    }
    if (!this.subtitleLabel) {
      this.subtitleLabel = panel?.getChildByName('SubtitleLabel')?.getComponent(Label) || null;
    }
    if (!this.statsLabel) {
      this.statsLabel = panel?.getChildByName('StatsLabel')?.getComponent(Label) || null;
    }
    if (!this.stageLineLabel) {
      this.stageLineLabel = infoCard?.getChildByName('StageLineLabel')?.getComponent(Label) || null;
    }
    if (!this.combatLineLabel) {
      this.combatLineLabel = infoCard?.getChildByName('CombatLineLabel')?.getComponent(Label) || null;
    }
    if (!this.progressLineLabel) {
      this.progressLineLabel = infoCard?.getChildByName('ProgressLineLabel')?.getComponent(Label) || null;
    }
    if (!this.rewardLabel) {
      this.rewardLabel = rewardCard?.getChildByName('RewardLabel')?.getComponent(Label) || null;
    }
    if (!this.restartButton) {
      this.restartButton = bg?.getChildByName('RestartBtn')?.getComponent(Button) || null;
    }
    if (!this.doubleRewardButton) {
      this.doubleRewardButton = bg?.getChildByName('DoubleRewardBtn')?.getComponent(Button) || null;
    }
    if (!this.doubleRewardLabel) {
      this.doubleRewardLabel = this.doubleRewardButton?.node.getChildByName('Label')?.getComponent(Label) || null;
    }
    if (!this.bannerAdSlot) {
      this.bannerAdSlot = bg?.getChildByName('BannerAdSlot') || this.node.getChildByName('BannerAdSlot') || null;
    }
  }
}
