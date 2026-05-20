/**
 * Bullet.ts - 子弹组件
 * 使用 Sprite + SpriteFrame 渲染（替代 Graphics），支持合批降低 DrawCall
 */

import { _decorator, Component, Color, Sprite } from 'cc';
import { GameConfig, WeaponBehavior, WeaponEvolutionData } from '../data/GameConfig';

const { ccclass, property } = _decorator;

@ccclass('Bullet')
export class Bullet extends Component {
  // 子弹数据
  private _x: number = 0;
  private _y: number = 0;
  private _speed: number = 400;
  private _damage: number = 15;
  private _tierIndex: number = 0;
  private _dead: boolean = false;
  private _angle: number = 90;   // 发射角度（度），90°=垂直向上
  private _vx: number = 0;       // X轴速度分量
  private _vy: number = 0;       // Y轴速度分量
  private _speedMult: number = 1.0; // 速度倍率（用于连发子弹差异化）
  private _lastColorKey: string = ''; // 缓存上次颜色键，避免对象池复用时混色
  private _sprite: Sprite | null = null;
  private _behavior: WeaponBehavior = 'normal';
  private _explodeRadius: number = 0;
  private _splashMultiplier: number = 0;
  private _remainingPierce: number = 0;
  private _chainCount: number = 0;
  private _chainRange: number = 0;
  private _chainMultiplier: number = 0;
  private _evolutionTint: string | null = null;

  /**
   * 初始化子弹
   * @param x 起始X坐标
   * @param y 起始Y坐标
   * @param tierIndex 基础武器档位索引
   * @param angle 发射角度（度），90°=垂直向上，0°=水平向右
   * @param speedMult 速度倍率（用于连发子弹差异化）
   * @param damageMultiplier 临时伤害倍率（补给效果）
   */
  init(
    x: number,
    y: number,
    tierIndex: number,
    angle: number = 90,
    speedMult: number = 1.0,
    damageMultiplier: number = 1.0,
    evolution: WeaponEvolutionData | null = null
  ): void {
    this._x = x;
    this._y = y;
    this._tierIndex = tierIndex;
    this._angle = angle;
    this._speedMult = speedMult;
    this._dead = false;
    this._behavior = evolution?.behavior || 'normal';
    this._explodeRadius = evolution?.explodeRadius || 0;
    this._splashMultiplier = evolution?.splashMultiplier || 0;
    this._remainingPierce = evolution?.pierceCount || 0;
    this._chainCount = evolution?.chainCount || 0;
    this._chainRange = evolution?.chainRange || 0;
    this._chainMultiplier = evolution?.chainMultiplier || 0;
    this._evolutionTint = evolution?.tint || null;

    const idx = Math.min(tierIndex, GameConfig.weaponBase.speed.length - 1);
    const baseSpeed = GameConfig.weaponBase.speed[idx];
    this._speed = baseSpeed * speedMult;
    this._damage = Math.max(
      1,
      Math.round(GameConfig.weaponBase.damage[idx] * damageMultiplier * (evolution?.damageMultiplier || 1))
    );

    // 计算速度分量（角度转弧度）
    const rad = (angle * Math.PI) / 180;
    this._vx = this._speed * Math.cos(rad);
    this._vy = this._speed * Math.sin(rad);

    this.node.setPosition(x, y, 0);
    this._applyColor();
  }

  /**
   * 设置子弹颜色（通过 Sprite.color tint 白色精灵图）
   * 同时缓存等级与分支色，避免对象池复用时沿用旧色
   */
  private _applyColor(): void {
    // 懒获取 Sprite 组件
    if (!this._sprite) {
      this._sprite = this.node.getComponent(Sprite);
    }
    if (!this._sprite) return;

    const colorHex = this.color;
    const colorKey = `${this._tierIndex}:${colorHex}`;
    if (colorKey === this._lastColorKey) return;
    this._lastColorKey = colorKey;

    const c = new Color().fromHEX(colorHex);
    this._sprite.color = c;
  }

  /**
   * 更新子弹位置（按角度飞行）
   * 注意：使用 tickMove 而非 update，避免 Cocos 引擎自动调用 lifecycle update
   * 与 GameManager._bullets.forEach(b => b.tickMove(dt)) 配合，确保每帧只更新一次
   */
  tickMove(dt: number): void {
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
   * 获取子弹基础武器档位索引
   */
  get level(): number {
    return this._tierIndex;
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
   * 获取子弹颜色（HEX 字符串）
   */
  get color(): string {
    if (this._evolutionTint) return this._evolutionTint;
    const idx = Math.min(this._tierIndex, GameConfig.bulletColors.length - 1);
    return GameConfig.bulletColors[idx];
  }

  /**
   * 获取碰撞半径
   */
  get radius(): number {
    return GameConfig.bullet.radius;
  }

  get behavior(): WeaponBehavior {
    return this._behavior;
  }

  get explodeRadius(): number {
    return this._explodeRadius;
  }

  get splashMultiplier(): number {
    return this._splashMultiplier;
  }

  get remainingPierce(): number {
    return this._remainingPierce;
  }

  get chainCount(): number {
    return this._chainCount;
  }

  get chainRange(): number {
    return this._chainRange;
  }

  get chainMultiplier(): number {
    return this._chainMultiplier;
  }

  consumePierce(): boolean {
    if (this._remainingPierce <= 0) return false;
    this._remainingPierce--;
    return this._remainingPierce > 0;
  }

  /**
   * 重置位置到对象池外
   */
  reset(): void {
    this._dead = true;
    this._tierIndex = 0;
    this._vx = 0;
    this._vy = 0;
    this._angle = 90;
    this._speedMult = 1.0;
    this._lastColorKey = '';
    this._behavior = 'normal';
    this._explodeRadius = 0;
    this._splashMultiplier = 0;
    this._remainingPierce = 0;
    this._chainCount = 0;
    this._chainRange = 0;
    this._chainMultiplier = 0;
    this._evolutionTint = null;
    this.node.setPosition(0, -2000, 0);
  }
}
