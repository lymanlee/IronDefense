/**
 * GameOverScreen.ts - 结算界面
 * 负责填充结算文案与按钮状态，视觉样式尽量在编辑器中配置
 */

import { _decorator, Button, Color, Component, Label, Node, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('GameOverScreen')
export class GameOverScreen extends Component {
  private _onRestart: (() => void) | null = null;
  private _onMenu: (() => void) | null = null;
  private _onDoubleReward: (() => void) | null = null;
  private _doubleRewardEnabled: boolean = true;
  private _rewardPrefix: string = '结算奖励';
  private _displayedRewardCoins: number = 0;
  private _displayedRewardParts: number = 0;

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
    this._rewardPrefix = '基础奖励';
    this._setRewardText(coins, parts);
    if (this.restartButton) {
      this.restartButton.node.active = !!this._onRestart;
    }
    if (this.bannerAdSlot) {
      this.bannerAdSlot.active = false;
    }
    this.setDoubleRewardAvailable(true);
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
    this._rewardPrefix = '结算奖励';
    this._setRewardText(coins, parts);
    if (this.restartButton) {
      this.restartButton.node.active = false;
    }
    if (this.bannerAdSlot) {
      this.bannerAdSlot.active = false;
    }
    this.setDoubleRewardAvailable(true);
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

  setDoubleRewardAvailable(available: boolean): void {
    this._ensureRefs();
    this._doubleRewardEnabled = available;
    if (this.doubleRewardButton) {
      this.doubleRewardButton.interactable = available;
      this.doubleRewardButton.node.active = available && !!this._onDoubleReward;
    }
  }

  showDoubleRewardClaimed(coins: number, parts: number): void {
    const fromCoins = this._displayedRewardCoins;
    const fromParts = this._displayedRewardParts;
    this._setRewardText(fromCoins, fromParts, '双倍奖励');
    this.setDoubleRewardAvailable(false);
    this._playRewardCountUp(fromCoins, fromParts, coins, parts);
    this._playDoubleRewardAnimation();
    this._playRewardDeltaBadges(coins - fromCoins, parts - fromParts);
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

  private _setRewardText(coins: number, parts: number, prefix: string = this._rewardPrefix): void {
    this._displayedRewardCoins = Math.max(0, Math.round(coins));
    this._displayedRewardParts = Math.max(0, Math.round(parts));
    if (this.rewardLabel) {
      this.rewardLabel.string = `${prefix}  金币 +${this._displayedRewardCoins}   零件 +${this._displayedRewardParts}`;
    }
  }

  private _playRewardCountUp(fromCoins: number, fromParts: number, toCoins: number, toParts: number): void {
    if (!this.rewardLabel) return;

    const counter = {
      coins: Math.max(0, fromCoins),
      parts: Math.max(0, fromParts),
    };

    Tween.stopAllByTarget(counter);
    tween(counter)
      .to(0.82, {
        coins: Math.max(0, toCoins),
        parts: Math.max(0, toParts),
      }, {
        easing: 'quadOut',
        onUpdate: (value) => {
          this._setRewardText(Math.round(value.coins), Math.round(value.parts), '双倍奖励');
        },
      })
      .call(() => {
        this._setRewardText(toCoins, toParts, '双倍奖励');
      })
      .start();
  }

  private _playRewardDeltaBadges(deltaCoins: number, deltaParts: number): void {
    if (!this.rewardLabel?.node) return;

    if (deltaCoins > 0) {
      this._spawnRewardDeltaBadge(
        `金币 +${Math.round(deltaCoins)}`,
        new Color(255, 214, 92, 255),
        new Vec3(-120, 30, 0)
      );
    }

    if (deltaParts > 0) {
      this._spawnRewardDeltaBadge(
        `零件 +${Math.round(deltaParts)}`,
        new Color(130, 220, 255, 255),
        new Vec3(120, 30, 0)
      );
    }
  }

  private _spawnRewardDeltaBadge(text: string, color: Color, position: Vec3): void {
    if (!this.rewardLabel?.node) return;

    const host = this.rewardLabel.node;
    const badge = new Node('RewardDeltaBadge');
    const transform = badge.addComponent(UITransform);
    transform.setContentSize(180, 40);
    const label = badge.addComponent(Label);
    label.string = text;
    label.fontSize = 22;
    label.lineHeight = 26;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = color;
    const opacity = badge.addComponent(UIOpacity);
    opacity.opacity = 0;
    badge.setPosition(position);
    badge.setScale(0.86, 0.86, 1);
    host.addChild(badge);

    tween(opacity)
      .to(0.16, { opacity: 255 })
      .delay(0.26)
      .to(0.36, { opacity: 0 })
      .start();

    tween(badge)
      .to(0.18, { scale: new Vec3(1.05, 1.05, 1) })
      .to(0.58, { position: position.clone().add3f(0, 42, 0), scale: new Vec3(1, 1, 1) })
      .call(() => {
        if (badge.isValid) badge.destroy();
      })
      .start();
  }

  private _playDoubleRewardAnimation(): void {
    if (!this.rewardLabel?.node) return;

    const labelNode = this.rewardLabel.node;
    Tween.stopAllByTarget(labelNode);
    labelNode.setScale(1, 1, 1);

    const baseColor = this.rewardLabel.color.clone();
    const highlightColor = new Color(255, 226, 130, 255);
    const flashProxy = { t: 0 };
    const popNode = new Node('DoubleRewardFx');
    const popTransform = popNode.addComponent(UITransform);
    popTransform.setContentSize(200, 56);
    const popLabel = popNode.addComponent(Label);
    popLabel.string = 'x2';
    popLabel.fontSize = 38;
    popLabel.lineHeight = 42;
    popLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    popLabel.verticalAlign = Label.VerticalAlign.CENTER;
    popLabel.color = highlightColor.clone();
    const popOpacity = popNode.addComponent(UIOpacity);
    popOpacity.opacity = 0;
    popNode.setPosition(0, 42, 0);
    labelNode.addChild(popNode);

    tween(labelNode)
      .to(0.18, { scale: new Vec3(1.12, 1.12, 1) })
      .to(0.24, { scale: new Vec3(0.96, 0.96, 1) })
      .to(0.22, { scale: new Vec3(1, 1, 1) })
      .start();

    tween(flashProxy)
      .to(0.24, { t: 1 }, {
        onUpdate: () => {
          if (!this.rewardLabel) return;
          this.rewardLabel.color = Color.lerp(new Color(), baseColor, highlightColor, flashProxy.t);
        },
      })
      .to(0.36, { t: 0 }, {
        onUpdate: () => {
          if (!this.rewardLabel) return;
          this.rewardLabel.color = Color.lerp(new Color(), baseColor, highlightColor, flashProxy.t);
        },
      })
      .call(() => {
        if (this.rewardLabel) {
          this.rewardLabel.color = baseColor;
        }
      })
      .start();

    tween(popOpacity)
      .to(0.16, { opacity: 255 })
      .delay(0.18)
      .to(0.42, { opacity: 0 })
      .start();

    tween(popNode)
      .to(0.76, { position: new Vec3(0, 88, 0) })
      .call(() => {
        if (popNode.isValid) popNode.destroy();
      })
      .start();
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
    if (!this.bannerAdSlot) {
      this.bannerAdSlot = bg?.getChildByName('BannerAdSlot') || this.node.getChildByName('BannerAdSlot') || null;
    }
  }
}
