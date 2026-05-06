/**
 * BackgroundRenderer.ts - 背景渲染器
 * 使用 Graphics 程序绘制游戏背景（天空/草地/河流/桥面/护栏）
 *
 * 坐标系说明：
 * BgGraphics 节点锚点为 (0.5, 0.5)，contentSize 为 720x1280，
 * 本地坐标系原点在节点中心。GameConfig 坐标也是相对于 Canvas 中心的，
 * 因此直接使用 GameConfig 坐标即可在 BgGraphics 上正确绘制。
 */

import { _decorator, Component, Graphics, Color, UITransform } from 'cc';
import { GameConfig } from '../data/GameConfig';

const { ccclass } = _decorator;

@ccclass('BackgroundRenderer')
export class BackgroundRenderer extends Component {
  private _graphics: Graphics | null = null;

  // 预生成的草地噪点（使用以节点中心为原点的本地坐标）
  private _grassDots: Array<{ x: number; y: number; w: number; c: string }> = [];

  onLoad(): void {
    // 从子节点 BgGraphics 获取 Graphics 组件
    const bgGraphics = this.node.getChildByName('BgGraphics');
    if (bgGraphics) {
      this._graphics = bgGraphics.getComponent(Graphics);
    }
    if (!this._graphics) {
      console.warn('BackgroundRenderer: Graphics component not found');
      return;
    }

    // 预生成草地纹理
    this._generateGrassDots();
  }

  start(): void {
    console.log('[BackgroundRenderer] start called');
    this.draw();
    console.log('[BackgroundRenderer] draw finished');
  }

  private _generateGrassDots(): void {
    const W = GameConfig.canvas.width;
    const H = GameConfig.canvas.height;
    for (let i = 0; i < 120; i++) {
      this._grassDots.push({
        x: -W / 2 + Math.random() * W,
        y: -H / 2 + H * 0.12 + Math.random() * H * 0.88,
        w: 2 + Math.random() * 3,
        c: Math.random() > 0.5 ? '#5d9e40' : '#4a8230',
      });
    }
  }

  /**
   * 绘制完整背景
   */
  draw(): void {
    if (!this._graphics) {
      console.warn('[BackgroundRenderer] Graphics not found, cannot draw');
      return;
    }

    try {
      const g = this._graphics;
      // 使用 Canvas 实际尺寸，确保背景覆盖整个屏幕（适配不同分辨率）
      const canvasUT = this.node.parent?.getComponent(UITransform);
      const W = canvasUT ? canvasUT.contentSize.width : GameConfig.canvas.width;
      const H = canvasUT ? canvasUT.contentSize.height : GameConfig.canvas.height;
      const HW = W / 2;
      const HH = H / 2;
      const cfg = GameConfig;

      // 清空
      g.clear();

      // ============ 天空渐变 ============
    this._drawSky(g, W, H);

    // ============ 草地背景 ============
    // 草地只在桥面两侧绘制
    g.fillColor = new Color().fromHEX('#6abf57');
    // 左侧草地：x 从屏幕左边缘到桥左边界
    const leftGrassW = cfg.bridge.left - (-HW);
    g.fillRect(-HW, -HH, leftGrassW, H);
    // 右侧草地：x 从桥右边界到屏幕右边缘
    const rightGrassW = HW - cfg.bridge.right;
    g.fillRect(cfg.bridge.right, -HH, rightGrassW, H);

    // 草地纹理点
    this._grassDots.forEach(d => {
      if (d.x < cfg.bridge.left - 4 || d.x > cfg.bridge.right + 4) {
        g.fillColor = new Color().fromHEX(d.c);
        g.fillRect(d.x, d.y, d.w, d.w);
      }
    });

    // ============ 河流 ============
    g.fillColor = new Color().fromHEX('#3a8fbf');
    // 左侧河流
    g.fillRect(-HW, -HH + H * 0.08, leftGrassW - 4, H * 0.76);
    // 右侧河流
    g.fillRect(cfg.bridge.right + 4, -HH + H * 0.08, rightGrassW - 4, H * 0.76);

    // 水面反光
    g.fillColor = new Color(255, 255, 255, 46); // rgba(255,255,255,0.18)
    for (let i = 0; i < 6; i++) {
      g.fillRect(-HW + 4, -HH + H * 0.12 + i * 60, leftGrassW - 10, 3);
      g.fillRect(
        cfg.bridge.right + 8,
        -HH + H * 0.12 + i * 60 + 20,
        rightGrassW - 12,
        3
      );
    }

    // ============ 桥面 ============
    this._drawBridge(g, cfg);

    // ============ 护栏 ============
    this._drawRail(g, cfg);

    // ============ 底部地面 ============
    const railH = 14;
    const groundTop = cfg.bridge.railY - railH;
    const groundHeight = groundTop - (-HH); // 从屏幕底部到护栏底部下方
    g.fillColor = new Color().fromHEX('#7a6a5a');
    g.fillRect(cfg.bridge.left, -HH, cfg.bridge.right - cfg.bridge.left, groundHeight);

    // 地面砖纹
    for (let gx = cfg.bridge.left; gx < cfg.bridge.right; gx += 20) {
      g.fillColor = new Color(0, 0, 0, 25); // rgba(0,0,0,0.1)
      g.fillRect(gx, -HH, 1, groundHeight);
    }
    } catch (e) {
      console.error('[BackgroundRenderer] Draw error:', e);
    }
  }

  private _drawSky(g: Graphics, W: number, H: number): void {
    const HW = W / 2;
    const HH = H / 2;
    const skyTop = new Color().fromHEX('#4a90d9');
    const skyBottom = new Color().fromHEX('#a8d0e6');
    const steps = 16;
    const skyH = H * 0.14;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(skyTop.r + (skyBottom.r - skyTop.r) * t);
      const gr = Math.round(skyTop.g + (skyBottom.g - skyTop.g) * t);
      const b = Math.round(skyTop.b + (skyBottom.b - skyTop.b) * t);
      g.fillColor = new Color(r, gr, b, 255);
      g.fillRect(-HW, HH - skyH + i * (skyH / steps), W, skyH / steps + 1);
    }

    // 云朵
    this._drawCloud(g, -HW + W * 0.15, HH - skyH * 0.4, 45, new Color(255, 255, 255, 120));
    this._drawCloud(g, HW - W * 0.25, HH - skyH * 0.7, 55, new Color(255, 255, 255, 90));
    this._drawCloud(g, 0, HH - skyH * 0.25, 35, new Color(255, 255, 255, 70));
  }

  private _drawCloud(g: Graphics, cx: number, cy: number, size: number, color: Color): void {
    g.fillColor = color;
    g.ellipse(cx, cy, size, size * 0.5);
    g.fill();
    g.ellipse(cx - size * 0.4, cy + size * 0.05, size * 0.7, size * 0.4);
    g.fill();
    g.ellipse(cx + size * 0.4, cy + size * 0.05, size * 0.7, size * 0.4);
    g.fill();
  }

  private _drawBridge(g: Graphics, cfg: typeof GameConfig): void {
    const bLeft = cfg.bridge.left;
    const bRight = cfg.bridge.right;
    const bTop = cfg.bridge.top;
    const bBot = cfg.bridge.railY - 20;
    const bW = bRight - bLeft;

    // 桥面基础
    g.fillColor = new Color().fromHEX('#a89880');
    g.fillRect(bLeft, bBot, bW, bTop - bBot);

    // 石砖纹理
    const brickH = 16;
    const brickW = 28;
    g.strokeColor = new Color().fromHEX('#7a6a5a');
    g.lineWidth = 1;

    for (let row = 0; row * brickH < bTop - bBot; row++) {
      const offset = (row % 2) * (brickW / 2);
      for (let col = -1; col * brickW < bW + brickW; col++) {
        const bx = bLeft + col * brickW + offset;
        const by = bBot + row * brickH;
        if (bx + brickW > bLeft && bx < bRight) {
          g.rect(bx + 0.5, by + 0.5, brickW - 1, brickH - 1);
          g.stroke();
        }
      }
    }

    // 桥面磨损/污渍
    g.fillColor = new Color(0, 0, 0, 20);
    for (let i = 0; i < 8; i++) {
      const sx = bLeft + 20 + Math.random() * (bW - 40);
      const sy = bBot + 20 + Math.random() * (bTop - bBot - 40);
      g.ellipse(sx, sy, 8 + Math.random() * 12, 3 + Math.random() * 5);
      g.fill();
    }

    // 桥面阴影边缘
    g.fillColor = new Color(0, 0, 0, 50);
    g.fillRect(bLeft, bBot, 5, bTop - bBot);
    g.fillColor = new Color(0, 0, 0, 35);
    g.fillRect(bRight - 5, bBot, 5, bTop - bBot);

    // 车道分割虚线
    const laneCount = cfg.bridge.laneCount;
    const laneW = bW / laneCount;
    g.fillColor = new Color(255, 255, 255, 55);

    for (let i = 1; i < laneCount; i++) {
      const lx = bLeft + i * laneW;
      for (let seg = 0; seg < 40; seg++) {
        if (seg % 2 === 0) {
          g.fillRect(lx - 1, bBot + seg * 18, 2, 10);
        }
      }
    }

    // 桥两侧边缘线
    g.strokeColor = new Color().fromHEX('#5a4a3a');
    g.lineWidth = 2;
    g.moveTo(bLeft + 0.5, bBot);
    g.lineTo(bLeft + 0.5, bTop);
    g.stroke();
    g.moveTo(bRight - 0.5, bBot);
    g.lineTo(bRight - 0.5, bTop);
    g.stroke();
  }

  private _drawRail(g: Graphics, cfg: typeof GameConfig): void {
    const bLeft = cfg.bridge.left;
    const bRight = cfg.bridge.right;
    const railY = cfg.bridge.railY;
    const railH = 14;
    const bW = bRight - bLeft;

    // 护栏阴影
    g.fillColor = new Color(0, 0, 0, 40);
    g.fillRect(bLeft + 3, railY - railH - 3, bW, railH + 3);

    // 护栏主体
    g.fillColor = new Color().fromHEX('#7a6a5a');
    g.fillRect(bLeft, railY - railH, bW, railH);

    // 护栏砖石纹理
    g.strokeColor = new Color().fromHEX('#5a4a3a');
    g.lineWidth = 1;
    const brickW = 18;
    for (let bx = bLeft; bx < bRight; bx += brickW) {
      g.moveTo(bx + 0.5, railY - railH);
      g.lineTo(bx + 0.5, railY);
      g.stroke();
    }

    // 城垛
    const merlonW = 12;
    const merlonH = 10;
    const merlonGap = 8;
    let mx = bLeft + 4;

    g.fillColor = new Color().fromHEX('#8c7c6c');
    g.strokeColor = new Color().fromHEX('#5a4a3a');
    g.lineWidth = 1;

    while (mx + merlonW < bRight) {
      g.fillRect(mx, railY - railH - merlonH, merlonW, merlonH);
      g.rect(mx + 0.5, railY - railH - merlonH + 0.5, merlonW - 1, merlonH - 1);
      g.stroke();
      mx += merlonW + merlonGap;
    }

    // 护栏顶面高光（金属光泽感）
    g.fillColor = new Color().fromHEX('#a09080');
    g.fillRect(bLeft, railY - railH, bW, 3);
    g.fillColor = new Color().fromHEX('#c0b0a0');
    g.fillRect(bLeft, railY - railH, bW, 1);

    // 护栏描边
    g.strokeColor = new Color().fromHEX('#4a3a2a');
    g.lineWidth = 1.5;
    g.rect(bLeft + 0.5, railY - railH + 0.5, bW - 1, railH - 1);
    g.stroke();

    // 护栏底部阴影线
    g.fillColor = new Color(0, 0, 0, 60);
    g.fillRect(bLeft, railY - 1, bW, 2);
  }
}
