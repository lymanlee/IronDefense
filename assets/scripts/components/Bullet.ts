/**
 * Bullet.ts - 子弹组件
 * 控制子弹移动和碰撞标记
 */

import { _decorator, Component, Graphics, Color, Sprite } from 'cc';
import { GameConfig } from '../data/GameConfig';

const { ccclass, property } = _decorator;

@ccclass('Bullet')
export class Bullet extends Component {
  // 子弹数据
  private _x: number = 0;
  private _y: number = 0;
  private _speed: number = 400;
  private _damage: number = 15;
  private _level: number = 0;
  private _dead: boolean = false;
  private _angle: number = 90;   // 发射角度（度），90°=垂直向上
  private _vx: number = 0;       // X轴速度分量
  private _vy: number = 0;       // Y轴速度分量
  private _speedMult: number = 1.0; // 速度倍率（用于连发子弹差异化）

  /**
   * 初始化子弹
   * @param x 起始X坐标
   * @param y 起始Y坐标
   * @param level 子弹等级
   * @param angle 发射角度（度），90°=垂直向上，0°=水平向右
   * @param speedMult 速度倍率（用于连发子弹差异化）
   */
  init(x: number, y: number, level: number, angle: number = 90, speedMult: number = 1.0): void {
    this._x = x;
    this._y = y;
    this._level = level;
    this._angle = angle;
    this._speedMult = speedMult;
    this._dead = false;

    const idx = Math.min(level, GameConfig.bullet.speed.length - 1);
    const baseSpeed = GameConfig.bullet.speed[idx];
    this._speed = baseSpeed * speedMult;
    this._damage = GameConfig.bullet.damage[idx];

    // 计算速度分量（角度转弧度）
    const rad = (angle * Math.PI) / 180;
    this._vx = this._speed * Math.cos(rad);
    this._vy = this._speed * Math.sin(rad);

    this.node.setPosition(x, y, 0);
    this._drawBullet();
  }

  /**
   * 绘制子弹（使用 Graphics，不依赖缺失的图片资源）
   */
  private _drawBullet(): void {
    // prefab 中已将 Sprite 替换为 Graphics，直接获取绘制
    let graphics = this.node.getComponent(Graphics);
    if (!graphics) {
      graphics = this.node.addComponent(Graphics);
    }
    const color = this.color;
    const r = GameConfig.bullet.radius;

    graphics.clear();
    graphics.fillColor = new Color().fromHEX(color);
    graphics.circle(0, 0, r);
    graphics.fill();
  }

  /**
   * 更新子弹位置（按角度飞行）
   */
  update(dt: number): void {
    this._x += this._vx * dt;
    this._y += this._vy * dt;
    this.node.setPosition(this._x, this._y, 0);

    // 出界判定：检测所有方向
    const canvasW = GameConfig.canvas.width;
    const canvasH = GameConfig.canvas.height;
    const margin = 50;
    if (
      this._y > canvasH / 2 + margin ||   // 上出界
      this._y < -canvasH / 2 - margin ||  // 下出界
      this._x > canvasW / 2 + margin ||    // 右出界
      this._x < -canvasW / 2 - margin      // 左出界
    ) {
      this._dead = true;
    }
  }

  /**
   * 是否已标记为死亡
   */
  get dead(): boolean {
    return this._dead;
  }

  /**
   * 标记死亡
   */
  set dead(value: boolean) {
    this._dead = value;
  }

  /**
   * 获取伤害值
   */
  get damage(): number {
    return this._damage;
  }

  /**
   * 获取子弹等级
   */
  get level(): number {
    return this._level;
  }

  /**
   * 获取子弹 x 坐标
   */
  get x(): number {
    return this._x;
  }

  /**
   * 获取子弹 y 坐标
   */
  get y(): number {
    return this._y;
  }

  /**
   * 获取子弹颜色
   */
  get color(): string {
    const idx = Math.min(this._level, GameConfig.bulletColors.length - 1);
    return GameConfig.bulletColors[idx];
  }

  /**
   * 获取碰撞半径
   */
  get radius(): number {
    return GameConfig.bullet.radius;
  }

  /**
   * 重置位置到对象池外
   */
  reset(): void {
    this._dead = true;
    this._vx = 0;
    this._vy = 0;
    this._angle = 90;
    this._speedMult = 1.0;
    this.node.setPosition(0, -2000, 0);
  }
}
