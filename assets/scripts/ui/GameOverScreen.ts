/**
 * GameOverScreen.ts - 结算界面
 * 显示 Game Over 或 Victory，以及统计数据
 */

import { _decorator, Component, Label, Node, UITransform, Button, Graphics, Color } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('GameOverScreen')
export class GameOverScreen extends Component {
  // 回调
  private _onRestart: (() => void) | null = null;
  private _onMenu: (() => void) | null = null;
  private _onDoubleReward: (() => void) | null = null;
  private _doubleRewardButton: Node | null = null;
  private _doubleRewardLabel: Label | null = null;
  private _doubleRewardEnabled: boolean = true;

  @property(Label)
  titleLabel: Label | null = null;

  @property(Label)
  statsLabel: Label | null = null;

  /**
   * 设置重新开始回调
   */
  setOnRestart(callback: () => void): void {
    this._onRestart = callback;
  }

  /**
   * 设置返回菜单回调
   */
  setOnMenu(callback: () => void): void {
    this._onMenu = callback;
  }

  /**
   * 设置结算双倍广告回调
   */
  setOnDoubleReward(callback: () => void): void {
    this._onDoubleReward = callback;
    this._ensureDoubleRewardButton();
  }

  /**
   * 显示 Game Over
   */
  showGameOver(stageLabel: string, kills: number, wave: number, progressText: string, coins: number = 0, parts: number = 0): void {
    if (this.titleLabel) {
      this.titleLabel.string = 'GAME OVER';
      // 红色
      if (this.titleLabel.color) {
        this.titleLabel.color.set(255, 68, 68);
      }
    }
    if (this.statsLabel) {
      this.statsLabel.string = `关卡: ${stageLabel}  波次: ${wave}\n击杀: ${kills}\n${progressText}\n金币: ${coins}  零件: ${parts}`;
    }
    this.setDoubleRewardAvailable(true, '看广告双倍奖励');
    this.node.active = true;
  }

  /**
   * 显示胜利
   */
  showVictory(stageLabel: string, kills: number, wave: number, progressText: string, coins: number = 0, parts: number = 0): void {
    if (this.titleLabel) {
      this.titleLabel.string = '胜利!';
      // 金色
      if (this.titleLabel.color) {
        this.titleLabel.color.set(255, 233, 77);
      }
    }
    if (this.statsLabel) {
      this.statsLabel.string = `关卡: ${stageLabel}  波次: ${wave}\n击杀: ${kills}\n${progressText}\n金币: ${coins}  零件: ${parts}`;
    }
    this.setDoubleRewardAvailable(true, '看广告双倍奖励');
    this.node.active = true;
  }

  /**
   * 点击重新开始
   */
  onRestartClicked(): void {
    if (this._onRestart) {
      this._onRestart();
    }
  }

  /**
   * 点击返回菜单
   */
  onMenuClicked(): void {
    if (this._onMenu) {
      this._onMenu();
    }
  }

  /**
   * 点击结算双倍奖励
   */
  onDoubleRewardClicked(): void {
    if (!this._doubleRewardEnabled) return;
    if (this._onDoubleReward) {
      this._onDoubleReward();
    }
  }

  setDoubleRewardAvailable(available: boolean, text: string): void {
    this._ensureDoubleRewardButton();
    this._doubleRewardEnabled = available;
    if (this._doubleRewardLabel) {
      this._doubleRewardLabel.string = text;
      this._doubleRewardLabel.color = available ? new Color(80, 40, 0) : new Color(160, 160, 160);
    }
  }

  /**
   * 隐藏界面
   */
  hide(): void {
    this.node.active = false;
  }

  private _ensureDoubleRewardButton(): void {
    if (this._doubleRewardButton?.isValid) return;

    const parent = this.node.getChildByName('Bg') || this.node;
    const buttonNode = new Node('DoubleRewardBtn');
    const transform = buttonNode.addComponent(UITransform);
    transform.setContentSize(300, 70);
    buttonNode.setPosition(0, -95, 0);

    const graphics = buttonNode.addComponent(Graphics);
    graphics.fillColor = new Color(255, 210, 92, 255);
    graphics.roundRect(-150, -35, 300, 70, 12);
    graphics.fill();

    buttonNode.addComponent(Button);
    buttonNode.on(Node.EventType.TOUCH_END, this.onDoubleRewardClicked, this);

    const labelNode = new Node('Label');
    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(260, 44);
    this._doubleRewardLabel = labelNode.addComponent(Label);
    this._doubleRewardLabel.string = '看广告双倍奖励';
    this._doubleRewardLabel.fontSize = 26;
    this._doubleRewardLabel.lineHeight = 34;
    this._doubleRewardLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this._doubleRewardLabel.verticalAlign = Label.VerticalAlign.CENTER;
    this._doubleRewardLabel.color = new Color(80, 40, 0);
    buttonNode.addChild(labelNode);

    parent.addChild(buttonNode);
    this._doubleRewardButton = buttonNode;
  }
}
