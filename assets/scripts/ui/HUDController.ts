/**
 * HUDController.ts - HUD 控制器
 * 更新波次、生命值与关卡完成进度等 HUD 信息
 */

import { _decorator, Component, Label, ProgressBar, Node, Color, UITransform } from 'cc';

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
    this._ensureHUDRefs();
    // 默认隐藏波次间提示
    if (this.nextWaveNode) {
      this.nextWaveNode.active = false;
    }
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
      this.stageLabel.node.active = false;
    }

    // 波次
    if (this.waveLabel) {
      this.waveLabel.string = `第${waveNum}波`;
    }

    // 血量数值：展示当前/上限，方便快速判断容错
    if (this.hpLabel) {
      this.hpLabel.string = `生命值 ${Math.ceil(hp)}/${Math.ceil(maxHp)}`;
    }

    // 关卡完成进度
    if (this.lvLabel) {
      this.lvLabel.string = this._formatCompletionProgress(killProgress, killProgressText);
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
      this.weaponLabel.string = `火力 ${weaponName}`;
      this.weaponLabel.node.active = false;
    }

    if (this.enemyHintLabel) {
      this.enemyHintLabel.string = this._compactEnemyHint(enemyHintText);
    }

    if (this.buffSummaryLabel) {
      this.buffSummaryLabel.string = this._compactBuffSummary(buffSummary);
    }

    // 波次间隔提示
    if (this.nextWaveNode) {
      this.nextWaveNode.active = inPause;
      if (this.nextWaveLabel && inPause) {
        this.nextWaveLabel.string = `整备 ${Math.ceil(pauseTime)}s`;
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

  private _formatCompletionProgress(progress: number, fallbackText: string): string {
    if (Number.isFinite(progress)) {
      const pct = Math.max(0, Math.min(100, Math.floor(progress * 100)));
      return `完成进度 ${pct}%`;
    }

    return this._compactKillProgress(fallbackText);
  }

  private _compactKillProgress(text: string): string {
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) {
      return `完成进度 ${text.replace(/^本关击杀:\s*/, '').trim()}`;
    }
    return `完成进度 ${match[1]}/${match[2]}`;
  }

  private _compactEnemyHint(text: string): string {
    const compact = text.replace(/^敌情提示:\s*/, '').trim();
    return `敌情 ${compact}`;
  }

  private _compactBuffSummary(text: string): string {
    const compact = text.replace(/^本关增益:\s*/, '').trim();
    if (!compact || compact === '无') {
      return '增益 暂无';
    }

    const fullText = `增益 ${compact.split('·').map(part => part.trim()).filter(Boolean).join(' · ')}`;
    return this._ellipsizeBuffSummary(fullText);
  }

  private _ellipsizeBuffSummary(text: string): string {
    const label = this.buffSummaryLabel;
    if (!label) return text;

    const transform = label.node.getComponent(UITransform);
    const maxWidth = transform?.contentSize.width || 0;
    if (maxWidth <= 0) return text;

    const measure = (value: string): number => {
      label.string = value;
      label.updateRenderData(true);
      return label.node.getComponent(UITransform)?.contentSize.width || 0;
    };

    if (measure(text) <= maxWidth) {
      return text;
    }

    const ellipsis = '...';
    let left = 0;
    let right = text.length;
    let best = ellipsis;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const candidate = `${text.slice(0, mid).replace(/\s+$/, '')}${ellipsis}`;
      if (measure(candidate) <= maxWidth) {
        best = candidate;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return best;
  }
}
