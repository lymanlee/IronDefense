/**
 * HUDController.ts - HUD 控制器
 * 更新波次、血条、关卡击杀进度、武器模式显示
 */

import { _decorator, Component, Label, Sprite, ProgressBar, Node, Color } from 'cc';
import { GameConfig } from '../data/GameConfig';

const { ccclass, property } = _decorator;

@ccclass('HUDController')
export class HUDController extends Component {
  // UI 元素引用（需要在编辑器中绑定）
  @property(Label)
  waveLabel: Label | null = null;

  @property(Label)
  hpLabel: Label | null = null;

  @property(Label)
  lvLabel: Label | null = null;

  @property(ProgressBar)
  hpBar: ProgressBar | null = null;

  @property(ProgressBar)
  expBar: ProgressBar | null = null;

  @property(Label)
  weaponLabel: Label | null = null;

  @property(Label)
  nextWaveLabel: Label | null = null;

  @property(Node)
  nextWaveNode: Node | null = null;

  @property(Label)
  stageLabel: Label | null = null;

  @property(Label)
  enemyHintLabel: Label | null = null;

  @property(Label)
  buffSummaryLabel: Label | null = null;

  start(): void {
    // 默认隐藏波次间提示
    if (this.nextWaveNode) {
      this.nextWaveNode.active = false;
    }
    // 位置在编辑器中配置
  }

  /**
   * 更新 HUD 显示
   */
  updateHUD(
    stageLabel: string,
    waveNum: number,
    hp: number,
    maxHp: number,
    killProgress: number,
    killProgressText: string,
    weaponName: string,
    enemyHintText: string,
    buffSummary: string,
    inPause: boolean = false,
    pauseTime: number = 0
  ): void {
    this._ensureHUDRefs();
    if (this.stageLabel) {
      this.stageLabel.string = stageLabel;
    }
    if (this.enemyHintLabel) {
      this.enemyHintLabel.string = enemyHintText;
    }
    if (this.buffSummaryLabel) {
      this.buffSummaryLabel.string = buffSummary;
    }

    // 波次
    if (this.waveLabel) {
      this.waveLabel.string = `第${waveNum}波`;
    }

    // 血量数值：仅显示当前值，与参考设计一致
    if (this.hpLabel) {
      this.hpLabel.string = `${Math.ceil(hp)}`;
    }

    // 关卡击杀进度
    if (this.lvLabel) {
      this.lvLabel.string = killProgressText;
    }

    // 血条
    if (this.hpBar) {
      this.hpBar.progress = hp / maxHp;
      // 颜色变化
      const hpRatio = hp / maxHp;
      if (this.hpBar['_barSprite']) {
        if (hpRatio > 0.5) {
          this.hpBar['_barSprite'].color = new Color(0, 255, 0);
        } else if (hpRatio > 0.25) {
          this.hpBar['_barSprite'].color = new Color(255, 255, 0);
        } else {
          this.hpBar['_barSprite'].color = new Color(255, 0, 0);
        }
      }
    }

    // 进度条：始终展示当前关卡击杀进度
    if (this.expBar) {
      this.expBar.progress = killProgress;
    }

    // 武器模式：琥珀金色，与游戏主题一致
    if (this.weaponLabel) {
      this.weaponLabel.string = `⚡ ${weaponName}`;
    }

    // 波次间隔提示
    if (this.nextWaveNode) {
      this.nextWaveNode.active = inPause;
      if (this.nextWaveLabel && inPause) {
        this.nextWaveLabel.string = `下一波: ${Math.ceil(pauseTime)}s`;
      }
    }
  }

  /**
   * 显示波次宣告
   */
  showWaveAnnounce(waveNum: number): void {
    // 波次宣告由单独的 UI 节点处理
    // 这里只更新波次数字
    if (this.waveLabel) {
      this.waveLabel.string = `第${waveNum}波`;
    }
  }

  private _ensureHUDRefs(): void {
    if (!this.stageLabel) {
      this.stageLabel = this.node.getChildByName('StageLabel')?.getComponent(Label) || null;
    }
    if (!this.enemyHintLabel) {
      this.enemyHintLabel = this.node.getChildByName('EnemyHintLabel')?.getComponent(Label) || null;
    }
    if (!this.buffSummaryLabel) {
      this.buffSummaryLabel = this.node.getChildByName('BuffSummaryLabel')?.getComponent(Label) || null;
    }
  }
}
