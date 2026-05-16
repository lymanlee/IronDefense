/**
 * PlayerCar.ts - 武装车组件
 * 控制武装车的移动、射击和武器等级
 */

import { _decorator, Component, Node, Sprite, SpriteFrame, resources, UITransform } from 'cc';
import { GameConfig } from '../data/GameConfig';
import { ExpSystem } from './ExpSystem';
import { Enemy } from './Enemy';

const { ccclass, property } = _decorator;

export interface AttackTarget {
  x: number;
  y: number;
  dead: boolean;
}

@ccclass('PlayerCar')
export class PlayerCar extends Component {
  // 位置
  private _x: number = 0;
  private _y: number = 0;

  // 状态
  private _hp: number = 200;
  private _maxHp: number = 200;
  private _baseMaxHp: number = 200;
  private _dead: boolean = false;
  private _invulnerableTimer: number = 0;

  // 经验系统引用
  private _expSystem: ExpSystem | null = null;

  // 射击
  private _fireTimer: number = 0;
  private _fireRateMultiplier: number = 1;
  private _damageMultiplier: number = 1;

  // 控制
  private static readonly TOUCH_SENSITIVITY: number = 0.6; // 手指速度 → 坦克速度的倍率
  private static readonly TOUCH_STOP_THRESHOLD: number = 0.08; // 手指停止判定阈值（秒），80ms 无新触摸事件即认为停止
  private _dragging: boolean = false;
  private _lastTouchX: number = 0;
  private _lastTouchMoveTime: number = 0; // Date.now() 毫秒时间戳
  private _touchSpeed: number = 0;        // 手指实时速度（世界坐标/秒），由 onTouchMove 计算，update 消费
  private _keyLeft: boolean = false;
  private _keyRight: boolean = false;

  // 射击回调（新增 angle 和 speedMult 参数）
  private _onFire: ((x: number, y: number, level: number, angle: number, speedMult: number) => void) | null = null;
  private _onShoot: (() => void) | null = null;

  // 序列帧动画
  private _frames: SpriteFrame[] = [];
  private _frameIndex: number = 0;
  private _frameTimer: number = 0;
  private _isFireAnim: boolean = false;  // 是否正在播放开火动画
  private static readonly FIRE_ANIM_FPS: number = 24;  // 开火动画帧率
  private static readonly IDLE_ANIM_FPS: number = 6;   // 待机循环帧率

  onLoad(): void {
    console.log('[PlayerCar] onLoad called');
    const cfg = GameConfig;
    this._x = 0;
    this._y = cfg.bridge.carY;
    this._baseMaxHp = cfg.car.hp;
    this._maxHp = cfg.car.hp;
    this._hp = cfg.car.hp;
    this.node.setPosition(this._x, this._y, 0);
    // CarGraphics 的 Sprite/UITransform 配置全部由编辑器控制，代码不再覆盖
    // 确保 PlayerCar 节点 contentSize 不为 0
    const playerUT = this.node.getComponent(UITransform);
    if (playerUT) {
      playerUT.setContentSize(cfg.car.width, cfg.car.height);
    }
  }

  start(): void {
    console.log('[PlayerCar] start called');
    this._loadFrames();
  }

  /**
   * 加载序列帧图片（resources/car_frames/car_0~7.png）
   */
  private _loadFrames(): void {
    resources.loadDir('car_frames', SpriteFrame, (err, assets) => {
      if (err) {
        console.error('[PlayerCar] 加载 car_frames 失败:', err);
        return;
      }
      // 过滤 car_ 开头并按数字排序
      this._frames = (assets as SpriteFrame[])
        .filter(f => f.name && f.name.startsWith('car_'))
        .sort((a, b) => {
          const numA = parseInt(a.name.replace('car_', ''));
          const numB = parseInt(b.name.replace('car_', ''));
          return numA - numB;
        });
      console.log('[PlayerCar] 加载了', this._frames.length, '帧动画');

      // 设置第一帧
      if (this._frames.length > 0) {
        const carGraphics = this.node.getChildByName('CarGraphics');
        if (carGraphics) {
          const sprite = carGraphics.getComponent(Sprite);
          if (sprite) {
            sprite.spriteFrame = this._frames[0];
          }
        }
      }
    });
  }

  /**
   * 设置经验系统引用
   */
  setExpSystem(expSystem: ExpSystem): void {
    this._expSystem = expSystem;
  }

  /**
   * 设置射击回调
   */
  setOnFire(callback: (x: number, y: number, level: number, angle: number, speedMult: number) => void): void {
    this._onFire = callback;
  }

  /**
   * 设置射击音效回调
   */
  setOnShoot(callback: () => void): void {
    this._onShoot = callback;
  }

  /**
   * 更新武装车
   */
  update(dt: number): void {
    if (this._dead) return;

    if (this._invulnerableTimer > 0) {
      this._invulnerableTimer = Math.max(0, this._invulnerableTimer - dt);
    }

    const { width } = GameConfig.canvas;
    const { left, right } = GameConfig.bridge;
    const halfW = GameConfig.car.width / 2;

    // 键盘移动
    if (this._keyLeft) this._x -= GameConfig.car.speed * dt;
    if (this._keyRight) this._x += GameConfig.car.speed * dt;

    // 触屏移动：按手指实时速度驱动，手指停止后立即停
    if (this._dragging) {
      const timeSinceLastMove = (Date.now() - this._lastTouchMoveTime) / 1000;
      if (timeSinceLastMove < PlayerCar.TOUCH_STOP_THRESHOLD) {
        this._x += this._touchSpeed * dt;
      } else {
        this._touchSpeed = 0;
      }
    }

    // 限制范围
    this._x = Math.max(left + halfW, Math.min(right - halfW, this._x));

    // 更新位置
    this.node.setPosition(this._x, this._y, 0);

    // 更新序列帧动画
    this._updateFrameAnimation(dt);
  }

  /**
   * 更新序列帧动画
   * 开火状态：快速播放全部帧（24fps）
   * 待机状态：循环 car_0（6fps，保持呼吸感）
   */
  private _updateFrameAnimation(dt: number): void {
    if (this._frames.length === 0) return;

    const fps = this._isFireAnim ? PlayerCar.FIRE_ANIM_FPS : PlayerCar.IDLE_ANIM_FPS;
    const interval = 1 / fps;

    this._frameTimer += dt;
    if (this._frameTimer < interval) return;
    this._frameTimer -= interval;

    if (this._isFireAnim) {
      // 开火动画：逐帧推进
      this._frameIndex++;
      if (this._frameIndex >= this._frames.length) {
        // 开火动画结束，回到待机
        this._isFireAnim = false;
        this._frameIndex = 0;
      }
    } else {
      // 待机：始终显示 car_0
      this._frameIndex = 0;
    }

    const carGraphics = this.node.getChildByName('CarGraphics');
    if (carGraphics) {
      const sprite = carGraphics.getComponent(Sprite);
      if (sprite && this._frames[this._frameIndex]) {
        sprite.spriteFrame = this._frames[this._frameIndex];
      }
    }
  }

  /**
   * 触发开火动画（每次发射子弹时调用）
   */
  private _playFireAnim(): void {
    this._isFireAnim = true;
    this._frameIndex = 0;
    this._frameTimer = 0;
  }

  /**
   * 尝试射击（按角度扇形发射）
   */
  tryFire(targets: AttackTarget[], dt: number): void {
    if (this._dead || !this._expSystem) return;

    // 没有可用目标时不累加计时器
    const target = this._findTarget(targets);
    if (!target) {
      this._fireTimer = 0;
      return;
    }

    this._fireTimer += dt;
    const rate = this._expSystem.fireRate * this._fireRateMultiplier;

    if (this._fireTimer < 1 / rate) return;

    // 重置计时器：保留超出部分
    this._fireTimer -= 1 / rate;
    if (this._fireTimer < 0) this._fireTimer = 0;

    // 获取发射模式配置
    const pattern = this._expSystem.firePattern;
    const baseAngle = 90; // 基准角度：垂直向上
    const count = pattern.count;
    const spread = pattern.spread;
    const multiShot = pattern.multiShot;
    const speedMults = pattern.speedMults;

    // 计算角度列表（以90°为中心对称分布）
    const totalSpread = (count - 1) * spread;
    const startAngle = baseAngle - totalSpread / 2;

    const angles: number[] = [];
    for (let i = 0; i < count; i++) {
      angles.push(startAngle + i * spread);
    }

    // 发射子弹
    if (this._onFire) {
      for (const angle of angles) {
        // 每个方向连发 multiShot 次，速度差异化
        for (let m = 0; m < multiShot; m++) {
          const speedMult = speedMults[m] ?? 1.0;
          this._onFire(this._x, this._y + GameConfig.car.height / 2, this._expSystem!.levelIndex, angle, speedMult);
        }
      }
    }

    if (this._onShoot) {
      this._onShoot();
    }

    // 触发开火动画
    this._playFireAnim();
  }

  /**
   * 找最近敌人
   */
  private _findTarget(targets: AttackTarget[]): AttackTarget | null {
    let closest: AttackTarget | null = null;
    let minDist = Infinity;

    for (const target of targets) {
      if (target.dead) continue;
      const d = Math.abs(target.x - this._x) + Math.abs(this._y - target.y);
      if (d < minDist) {
        minDist = d;
        closest = target;
      }
    }

    return closest;
  }

  /**
   * 受到伤害
   */
  takeDamage(dmg: number): void {
    if (this._dead) return;
    if (this._invulnerableTimer > 0) return;
    this._hp -= dmg;
    if (this._hp <= 0) {
      this._hp = 0;
      this._dead = true;
    }
  }

  /**
   * 恢复血量
   */
  heal(amount: number): void {
    if (amount <= 0) return;
    this._hp = Math.min(this._maxHp, this._hp + amount);
  }

  /**
   * 提升最大生命，并可选择同步回复
   */
  increaseMaxHp(amount: number, healAmount: number = 0): void {
    if (amount <= 0) return;
    this._maxHp += amount;
    this._hp = Math.min(this._maxHp, this._hp + Math.max(0, healAmount));
  }

  /**
   * 广告复活
   */
  reviveWithHpRatio(ratio: number, invulnerableSeconds: number = 0): void {
    this._dead = false;
    this._hp = Math.max(1, Math.ceil(this._maxHp * Math.max(0, Math.min(1, ratio))));
    this._invulnerableTimer = Math.max(this._invulnerableTimer, invulnerableSeconds);
    this._fireTimer = 0;
  }

  /**
   * 设置临时无敌
   */
  setInvulnerable(seconds: number): void {
    this._invulnerableTimer = Math.max(this._invulnerableTimer, seconds);
  }

  /**
   * 设置射速倍率
   */
  setFireRateMultiplier(multiplier: number): void {
    this._fireRateMultiplier = Math.max(0.2, multiplier);
  }

  setPermanentStats(maxHp: number, damageMultiplier: number): void {
    this._baseMaxHp = Math.max(1, Math.round(maxHp));
    this._maxHp = this._baseMaxHp;
    this._hp = Math.min(this._hp, this._maxHp);
    this._damageMultiplier = Math.max(0.5, damageMultiplier);
  }

  /**
   * 重置射击计时器
   */
  resetFireTimer(): void {
    this._fireTimer = 0;
  }

  // 触控输入：速度模式，手指滑动速度决定坦克速度，手指停则立即停
  onTouchStart(x: number): void {
    this._dragging = true;
    this._lastTouchX = x;
    this._lastTouchMoveTime = Date.now();
    this._touchSpeed = 0;
  }

  onTouchMove(x: number): void {
    if (!this._dragging) return;
    const now = Date.now();
    const dt = (now - this._lastTouchMoveTime) / 1000; // 转秒
    const moveDelta = x - this._lastTouchX;

    if (dt > 0.001) {
      // 根据手指实时速度计算坦克速度（所有移动都参与计算，停止判定由时间阈值统一处理）
      const fingerSpeed = moveDelta / dt; // 世界坐标/秒
      this._touchSpeed = fingerSpeed * PlayerCar.TOUCH_SENSITIVITY;
    }

    this._lastTouchX = x;
    this._lastTouchMoveTime = now;
  }

  onTouchEnd(): void {
    this._dragging = false;
    this._touchSpeed = 0;
    this._lastTouchX = 0;
    this._lastTouchMoveTime = 0;
  }

  // 键盘输入
  setKeyLeft(value: boolean): void {
    this._keyLeft = value;
  }

  setKeyRight(value: boolean): void {
    this._keyRight = value;
  }

  // Getters
  get hp(): number { return this._hp; }
  get maxHp(): number { return this._maxHp; }
  get dead(): boolean { return this._dead; }
  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get invulnerable(): boolean { return this._invulnerableTimer > 0; }
  get damageMultiplier(): number { return this._damageMultiplier; }
  get fireRateMultiplier(): number { return this._fireRateMultiplier; }

  /**
   * 重置
   */
  reset(): void {
    const cfg = GameConfig;
    this._x = 0;
    this._y = cfg.bridge.carY;
    this._baseMaxHp = Math.max(this._baseMaxHp, cfg.car.hp);
    this._maxHp = this._baseMaxHp;
    this._hp = this._baseMaxHp;
    this._dead = false;
    this._invulnerableTimer = 0;
    this._fireTimer = 0;
    this._fireRateMultiplier = 1;
    this._dragging = false;
    this._lastTouchX = 0;
    this._lastTouchMoveTime = 0;
    this._touchSpeed = 0;
    this._keyLeft = false;
    this._keyRight = false;
    this._isFireAnim = false;
    this._frameIndex = 0;
    this._frameTimer = 0;
    this.node.setPosition(this._x, this._y, 0);
    // 重置到第一帧
    if (this._frames.length > 0) {
      const carGraphics = this.node.getChildByName('CarGraphics');
      if (carGraphics) {
        const sprite = carGraphics.getComponent(Sprite);
        if (sprite) {
          sprite.spriteFrame = this._frames[0];
        }
      }
    }
  }
}
