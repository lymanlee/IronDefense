/**
 * StartScreen.ts - 开始界面
 * 显示标题、开始按钮、调试模式入口
 */

import { _decorator, Component, Node, Label, Button } from 'cc';
import { GameConfig } from '../data/GameConfig';

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
}
