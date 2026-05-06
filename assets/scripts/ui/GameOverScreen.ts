/**
 * GameOverScreen.ts - 结算界面
 * 显示 Game Over 或 Victory，以及统计数据
 */

import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('GameOverScreen')
export class GameOverScreen extends Component {
  // 回调
  private _onRestart: (() => void) | null = null;
  private _onMenu: (() => void) | null = null;

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
   * 显示 Game Over
   */
  showGameOver(kills: number, wave: number, exp: number, level: number): void {
    if (this.titleLabel) {
      this.titleLabel.string = 'GAME OVER';
      // 红色
      if (this.titleLabel.color) {
        this.titleLabel.color.set(255, 68, 68);
      }
    }
    if (this.statsLabel) {
      this.statsLabel.string = `击杀: ${kills}  波次: ${wave}\n经验: ${exp}  等级: Lv${level}`;
    }
    this.node.active = true;
  }

  /**
   * 显示胜利
   */
  showVictory(kills: number, wave: number, exp: number, level: number): void {
    if (this.titleLabel) {
      this.titleLabel.string = '胜利!';
      // 金色
      if (this.titleLabel.color) {
        this.titleLabel.color.set(255, 233, 77);
      }
    }
    if (this.statsLabel) {
      this.statsLabel.string = `击杀: ${kills}  波次: ${wave}\n经验: ${exp}  等级: Lv${level}`;
    }
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
   * 隐藏界面
   */
  hide(): void {
    this.node.active = false;
  }
}
