/**
 * PlayerCar.ts - 武装车组件
 * 控制武装车的移动、射击和基础武器档位表现
 */

import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, tween, Vec3, UIOpacity } from 'cc';
import { GameConfig } from '../data/GameConfig';
import { WeaponTierSystem } from './WeaponTierSystem';
import { Enemy } from './Enemy';
import { BundleLoader } from '../managers/BundleLoader';

const { ccclass, property } = _decorator;

export interface AttackTarget {
  x: number;
  y: number;
  dead: boolean;
}

@ccclass('PlayerCar')
export class PlayerCar extends Component {
  private static readonly BURST_INTERVAL: number = 0.065;
  private static readonly MUZZLE_FLASH_DURATION: number = 0.08;
  private static readonly RECOIL_DISTANCE: number = 8;
  private static readonly RECOIL_COOLDOWN: number = 0.11;
  private static readonly THRUSTER_FIRE_SCALE: number = 1.12;
  private static readonly PARALLEL_SHOT_GAP: number = 14;

  // 位置
  private _x: number = 0;
  private _y: number = 0;

  // 状态
  private _hp: number = 200;
  private _maxHp: number = 200;
  private _baseMaxHp: number = 200;
  private _dead: boolean = false;
  private _invulnerableTimer: number = 0;

  // 基础武器档位系统引用
  private _weaponTierSystem: WeaponTierSystem | null = null;

  // 射击
  private _fireTimer: number = 0;
  private _fireRateMultiplier: number = 1;
  private _damageMultiplier: number = 1;
  private _bonusMultiShot: number = 0;
  private _bonusSpreadCount: number = 0;
  private _burstQueue: Array<Array<{ angle: number; speedMult: number; offsetX: number }>> = [];
  private _burstTimer: number = 0;

  // 控制
  private _dragging: boolean = false;
  private _lastTouchX: number = 0;
  private _keyLeft: boolean = false;
  private _keyRight: boolean = false;

  // 射击回调（新增 angle 和 speedMult 参数）
  private _onFire: ((x: number, y: number, tierIndex: number, angle: number, speedMult: number) => void) | null = null;
  private _onShoot: (() => void) | null = null;

  // 序列帧动画
  private _frames: SpriteFrame[] = [];
  private _frameIndex: number = 0;
  private _frameTimer: number = 0;
  private _isFireAnim: boolean = false;  // 是否正在播放开火动画
  private static readonly FIRE_ANIM_FPS: number = 24;  // 开火动画帧率
  private static readonly IDLE_ANIM_FPS: number = 6;   // 待机循环帧率
  private _idleTime: number = 0;
  private _muzzleFlashTimer: number = 0;
  private _recoilTweenActive: boolean = false;
  private _recoilCooldownTimer: number = 0;
  private _thrusterFrames: SpriteFrame[] = [];
  private _muzzleFrames: SpriteFrame[] = [];
  private _thrusterFrameIndex: number = 0;
  private _thrusterFrameTimer: number = 0;
  private _cachedCarBasePos: Vec3 = new Vec3();
  private _carGraphicsNode: Node | null = null;
  private _rearThrusterNodes: Node[] = [];
  private _muzzleFlashNode: Node | null = null;
  private _rearThrusterSprites: Sprite[] = [];
  private _cachedThrusterBasePos: Vec3[] = [];
  private _cachedThrusterBaseScale: Vec3[] = [];
  private _muzzleFlashSprite: Sprite | null = null;
  private _muzzleFlashOpacity: UIOpacity | null = null;
  private _muzzleFlashDefaultScale: Vec3 = new Vec3(1, 1, 1);
  private _burstVisualStage: number = 0;

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
    this._bindVisualNodes();
  }

  start(): void {
    console.log('[PlayerCar] start called');
    this._loadFrames();
    this._loadFxFrames();
  }

  /**
   * 加载序列帧图片（resources/car_frames_v3/car_0~1.png）
   */
  private _loadFrames(): void {
    BundleLoader.loadDir('battle', 'car_frames_v3', SpriteFrame, (err, assets) => {
      if (err) {
        console.error('[PlayerCar] 加载 car_frames_v3 失败:', err);
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
        if (this._carGraphicsNode) {
          const sprite = this._carGraphicsNode.getComponent(Sprite);
          if (sprite) {
            sprite.spriteFrame = this._frames[0];
          }
        }
      }
    });
  }

  private _loadFxFrames(): void {
    BundleLoader.loadDir('battle', 'car_fx/muzzle_v2', SpriteFrame, (err, assets) => {
      if (err) {
        console.error('[PlayerCar] 加载 muzzle_v2 frames 失败:', err);
        return;
      }
      this._muzzleFrames = (assets as SpriteFrame[])
        .filter(frame => frame.name && frame.name.startsWith('muzzle_flash_'))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (this._muzzleFlashSprite && this._muzzleFrames.length > 0) {
        this._muzzleFlashSprite.spriteFrame = this._muzzleFrames[0];
      }
    });

    BundleLoader.loadDir('battle', 'car_fx/thruster', SpriteFrame, (err, assets) => {
      if (err) {
        console.error('[PlayerCar] 加载 thruster frames 失败:', err);
        return;
      }
      this._thrusterFrames = (assets as SpriteFrame[])
        .filter(frame => frame.name && frame.name.startsWith('thruster_'))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (this._thrusterFrames.length > 0) {
        this._rearThrusterSprites.forEach(sprite => {
          sprite.spriteFrame = this._thrusterFrames[0];
        });
      }
    });

  }

  private _bindVisualNodes(): void {
    this._carGraphicsNode = this.node.getChildByName('CarGraphics');
    this._rearThrusterNodes = this.node.children.filter(child => child.name === 'RearThruster');
    this._muzzleFlashNode = this.node.getChildByName('MuzzleFlash');

    this._rearThrusterSprites = this._rearThrusterNodes
      .map(node => node.getComponent(Sprite))
      .filter((sprite): sprite is Sprite => !!sprite);
    this._muzzleFlashSprite = this._muzzleFlashNode?.getComponent(Sprite) || null;
    this._muzzleFlashOpacity = this._muzzleFlashNode?.getComponent(UIOpacity) || null;

    if (this._muzzleFlashNode && !this._muzzleFlashOpacity) {
      this._muzzleFlashOpacity = this._muzzleFlashNode.addComponent(UIOpacity);
    }

    if (this._muzzleFlashNode && this._muzzleFlashOpacity) {
      this._muzzleFlashOpacity.opacity = 0;
      this._muzzleFlashNode.active = false;
      this._muzzleFlashDefaultScale = this._muzzleFlashNode.scale.clone();
    }

    if (this._carGraphicsNode) {
      this._cachedCarBasePos = this._carGraphicsNode.position.clone();
    }
    this._cachedThrusterBasePos = this._rearThrusterNodes.map(node => node.position.clone());
    this._cachedThrusterBaseScale = this._rearThrusterNodes.map(node => node.scale.clone());
  }

  /**
   * 设置基础武器档位系统引用
   */
  setWeaponTierSystem(weaponTierSystem: WeaponTierSystem): void {
    this._weaponTierSystem = weaponTierSystem;
  }

  /**
   * 设置射击回调
   */
  setOnFire(callback: (x: number, y: number, tierIndex: number, angle: number, speedMult: number) => void): void {
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
  // Manual tick driven by GameManager. Avoid Cocos Component.update auto-running in parallel.
  tick(dt: number): void {
    if (this._dead) return;

    if (this._invulnerableTimer > 0) {
      this._invulnerableTimer = Math.max(0, this._invulnerableTimer - dt);
    }
    if (this._recoilCooldownTimer > 0) {
      this._recoilCooldownTimer = Math.max(0, this._recoilCooldownTimer - dt);
    }

    this._updateBurstQueue(dt);

    const { left, right } = GameConfig.bridge;
    const movePadding = Math.max(0, GameConfig.car.movePadding ?? GameConfig.car.width / 2);

    // 键盘移动
    if (this._keyLeft) this._x -= GameConfig.car.speed * dt;
    if (this._keyRight) this._x += GameConfig.car.speed * dt;

    // 限制范围
    this._x = Math.max(left + movePadding, Math.min(right - movePadding, this._x));

    // 更新位置
    this.node.setPosition(this._x, this._y, 0);

    // 更新序列帧动画
    this._updateFrameAnimation(dt);
    this._updateIdleVisuals(dt);
    this._updateFx(dt);
  }

  /**
   * 更新序列帧动画
   * 开火状态：快速切换两帧并交给火光/后坐力补足体感
   * 待机状态：两帧慢速交替，提供轻微机械呼吸感
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
      // 待机：慢速交替两帧
      if (this._frames.length > 1) {
        this._frameIndex = (this._frameIndex + 1) % Math.min(2, this._frames.length);
      } else {
        this._frameIndex = 0;
      }
    }

    if (this._carGraphicsNode) {
      const sprite = this._carGraphicsNode.getComponent(Sprite);
      if (sprite && this._frames[this._frameIndex]) {
        sprite.spriteFrame = this._frames[this._frameIndex];
      }
    }
  }

  /**
   * 触发开火动画（每次发射子弹时调用）
   */
  private _playFireAnim(burstStage: number = 0, burstTotal: number = 1): void {
    this._isFireAnim = true;
    this._frameIndex = 0;
    this._frameTimer = 0;
    this._playMuzzleFlash(burstStage, burstTotal);
    this._playRecoil(burstStage, burstTotal);
  }

  private _updateIdleVisuals(dt: number): void {
    this._idleTime += dt;

    if (this._carGraphicsNode && !this._recoilTweenActive) {
      this._carGraphicsNode.setPosition(this._cachedCarBasePos);
    }

    this._rearThrusterNodes.forEach((node, index) => {
      if (!this._recoilTweenActive) {
        node.setPosition(this._cachedThrusterBasePos[index] || node.position);
        node.setScale(this._cachedThrusterBaseScale[index] || node.scale);
      }
    });
  }

  private _updateFx(dt: number): void {
    if (this._thrusterFrames.length > 0 && this._rearThrusterSprites.length > 0) {
      this._thrusterFrameTimer += dt;
      if (this._thrusterFrameTimer >= 0.09) {
        this._thrusterFrameTimer = 0;
        this._thrusterFrameIndex = (this._thrusterFrameIndex + 1) % this._thrusterFrames.length;
        this._rearThrusterSprites.forEach(sprite => {
          sprite.spriteFrame = this._thrusterFrames[this._thrusterFrameIndex];
        });
      }
    }

    if (this._muzzleFlashTimer > 0) {
      this._muzzleFlashTimer = Math.max(0, this._muzzleFlashTimer - dt);
      if (this._muzzleFlashTimer <= 0 && this._muzzleFlashNode && this._muzzleFlashOpacity) {
        this._muzzleFlashOpacity.opacity = 0;
        this._muzzleFlashNode.active = false;
      }
    }
  }

  private _playMuzzleFlash(burstStage: number = 0, burstTotal: number = 1): void {
    if (!this._muzzleFlashNode || !this._muzzleFlashOpacity) return;
    if (this._muzzleFrames.length > 0 && this._muzzleFlashSprite) {
      const nextIndex = Math.floor(Math.random() * this._muzzleFrames.length);
      this._muzzleFlashSprite.spriteFrame = this._muzzleFrames[nextIndex];
    }
    const stageRatio = burstTotal > 1 ? burstStage / Math.max(1, burstTotal - 1) : 0;
    const flashBoost = burstTotal > 1 ? 1 + stageRatio * 0.22 : 1;
    this._muzzleFlashTimer = PlayerCar.MUZZLE_FLASH_DURATION;
    this._muzzleFlashNode.active = true;
    this._muzzleFlashOpacity.opacity = 255;
    this._muzzleFlashNode.setScale(
      this._muzzleFlashDefaultScale.x * (0.95 + Math.random() * 0.24) * flashBoost,
      this._muzzleFlashDefaultScale.y * (0.95 + Math.random() * 0.18) * flashBoost,
      this._muzzleFlashDefaultScale.z
    );
  }

  private _playRecoil(burstStage: number = 0, burstTotal: number = 1): void {
    if (!this._carGraphicsNode || this._recoilCooldownTimer > 0) return;
    const stageRatio = burstTotal > 1 ? burstStage / Math.max(1, burstTotal - 1) : 0;
    const recoilDistance = PlayerCar.RECOIL_DISTANCE + (burstTotal > 1 ? stageRatio * 2.4 : 0);
    const thrusterOffset = 6 + (burstTotal > 1 ? stageRatio * 1.8 : 0);
    const thrusterScale = PlayerCar.THRUSTER_FIRE_SCALE + (burstTotal > 1 ? stageRatio * 0.08 : 0);
    this._recoilCooldownTimer = Math.max(0.05, PlayerCar.RECOIL_COOLDOWN - (burstTotal > 1 ? 0.02 : 0));
    this._recoilTweenActive = true;
    tween(this._carGraphicsNode)
      .stop()
      .to(0.032, { position: new Vec3(this._cachedCarBasePos.x, this._cachedCarBasePos.y - recoilDistance, this._cachedCarBasePos.z) })
      .to(0.14, { position: this._cachedCarBasePos.clone() })
      .call(() => {
        this._recoilTweenActive = false;
      })
      .start();

    this._rearThrusterNodes.forEach((node, index) => {
      const basePos = this._cachedThrusterBasePos[index] || node.position.clone();
      const baseScale = this._cachedThrusterBaseScale[index] || node.scale.clone();
      tween(node)
        .stop()
        .to(0.032, {
          position: new Vec3(basePos.x, basePos.y - thrusterOffset, basePos.z),
          scale: new Vec3(
            baseScale.x * thrusterScale,
            baseScale.y * thrusterScale,
            baseScale.z
          ),
        })
        .to(0.14, {
          position: basePos.clone(),
          scale: baseScale.clone(),
        })
        .start();
    });

  }

  /**
   * 尝试射击（按角度扇形发射）
   */
  tryFire(targets: AttackTarget[], dt: number): void {
    if (this._dead || !this._weaponTierSystem) return;

    // 没有可用目标时不累加计时器
    const target = this._findTarget(targets);
    if (!target) {
      this._fireTimer = 0;
      return;
    }

    this._fireTimer += dt;
    const rate = this._weaponTierSystem.fireRate * this._fireRateMultiplier;

    if (this._fireTimer < 1 / rate) return;

    // 重置计时器：保留超出部分
    this._fireTimer -= 1 / rate;
    if (this._fireTimer < 0) this._fireTimer = 0;

    // 获取发射模式配置
    const pattern = this._weaponTierSystem.firePattern;
    const baseAngle = 90; // 基准角度：垂直向上
    const count = pattern.count;
    const parallelCount = Math.max(1, pattern.multiShot + this._bonusMultiShot);
    const speedMults = pattern.speedMults;
    const finalCount = count + this._bonusSpreadCount;
    const spread = this._resolveSpreadAngle(finalCount, pattern.spread);

    // 计算角度列表（以90°为中心对称分布）
    const totalSpread = (finalCount - 1) * spread;
    const startAngle = baseAngle - totalSpread / 2;

    const angles: number[] = [];
    for (let i = 0; i < finalCount; i++) {
      angles.push(startAngle + i * spread);
    }

    this._burstQueue = [];
    const burstPhases = parallelCount >= 4 ? 2 : 1;
    const phaseGroups: Array<Array<{ angle: number; speedMult: number; offsetX: number }>> = Array.from(
      { length: burstPhases },
      () => []
    );
    const offsets = this._buildParallelOffsets(parallelCount);
    for (let index = 0; index < offsets.length; index++) {
      const offsetX = offsets[index];
      const phaseIndex = burstPhases === 1 ? 0 : index % burstPhases;
      const phaseLayer = burstPhases === 1 ? 0 : Math.floor(index / burstPhases);
      for (const angle of angles) {
        const speedBase = speedMults[Math.min(index, speedMults.length - 1)] ?? 1.0;
        const speedMult = Math.max(0.86, speedBase - phaseLayer * 0.015);
        phaseGroups[phaseIndex].push({ angle, speedMult, offsetX });
      }
    }
    this._burstQueue = phaseGroups.filter(group => group.length > 0);
    this._burstVisualStage = 0;
    this._fireBurstShot();
    this._burstTimer = PlayerCar.BURST_INTERVAL;

    if (this._onShoot) {
      this._onShoot();
    }

    // 触发开火动画
    this._playFireAnim(this._burstVisualStage, Math.max(1, this._burstQueue.length));
  }

  /**
   * 根据最终并发数解析实际夹角。
   * 优先映射到 weaponBase 中已配置的并发档位，保证“并发+1”后的手感与配置表一致。
   */
  private _resolveSpreadAngle(finalCount: number, fallbackSpread: number): number {
    if (finalCount <= 1) return 0;

    const profileCounts = GameConfig.weaponBase.baseSpreadCount || [];
    const profileAngles = GameConfig.weaponBase.spreadAngle || [];

    const exactIdx = profileCounts.findIndex(count => count === finalCount);
    if (exactIdx >= 0) {
      return Math.max(0, profileAngles[exactIdx] || fallbackSpread || 0);
    }

    const nextIdx = profileCounts.findIndex(count => count > finalCount);
    if (nextIdx >= 0) {
      return Math.max(0, profileAngles[nextIdx] || fallbackSpread || 0);
    }

    const maxConfiguredCount = profileCounts[profileCounts.length - 1] || 1;
    const maxConfiguredAngle = profileAngles[profileAngles.length - 1] || fallbackSpread || 0;
    const overflowCount = Math.max(0, finalCount - maxConfiguredCount);
    return maxConfiguredAngle + overflowCount * 1.2;
  }

  private _updateBurstQueue(dt: number): void {
    if (this._burstQueue.length === 0) return;
    this._burstTimer -= dt;
    if (this._burstTimer > 0) return;
    const totalBurst = Math.max(1, this._burstQueue.length + 1);
    this._burstVisualStage = Math.min(totalBurst - 1, this._burstVisualStage + 1);
    this._fireBurstShot();
    if (this._burstQueue.length > 0) {
      this._burstTimer = PlayerCar.BURST_INTERVAL;
      this._playFireAnim(this._burstVisualStage, totalBurst);
    }
  }

  private _fireBurstShot(): void {
    if (!this._onFire || !this._weaponTierSystem) return;
    const volley = this._burstQueue.shift();
    if (!volley) return;
    for (const shot of volley) {
      this._onFire(
        this._x + shot.offsetX,
        this._y + GameConfig.car.height / 2,
        this._weaponTierSystem.tierIndex,
        shot.angle,
        shot.speedMult
      );
    }
  }

  private _buildParallelOffsets(count: number): number[] {
    if (count <= 1) return [0];
    const center = (count - 1) / 2;
    const gap = PlayerCar.PARALLEL_SHOT_GAP;
    const offsets: number[] = [];
    for (let i = 0; i < count; i++) {
      offsets.push((i - center) * gap);
    }
    return offsets;
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

  setRunFirePatternBonus(multiShotAdd: number, spreadCountAdd: number): void {
    this._bonusMultiShot = Math.max(0, Math.floor(multiShotAdd));
    this._bonusSpreadCount = Math.max(0, Math.floor(spreadCountAdd));
  }

  /**
   * 重置射击计时器
   */
  resetFireTimer(): void {
    this._fireTimer = 0;
  }

  // 触控输入：位移模式，touchSensitivity=1 时战车横向位移等于手指横向位移
  onTouchStart(x: number): void {
    this._dragging = true;
    this._lastTouchX = x;
  }

  onTouchMove(x: number): void {
    if (!this._dragging) return;
    const moveDelta = x - this._lastTouchX;
    this._x += moveDelta * (GameConfig.car.touchSensitivity ?? 1);
    this._lastTouchX = x;
  }

  onTouchEnd(): void {
    this._dragging = false;
    this._lastTouchX = 0;
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
    this._bonusMultiShot = 0;
    this._bonusSpreadCount = 0;
    this._burstQueue = [];
    this._burstTimer = 0;
    this._burstVisualStage = 0;
    this._dragging = false;
    this._lastTouchX = 0;
    this._keyLeft = false;
    this._keyRight = false;
    this._isFireAnim = false;
    this._frameIndex = 0;
    this._frameTimer = 0;
    this.node.setPosition(this._x, this._y, 0);
    // 重置到第一帧
    if (this._frames.length > 0) {
      if (this._carGraphicsNode) {
        const sprite = this._carGraphicsNode.getComponent(Sprite);
        if (sprite) {
          sprite.spriteFrame = this._frames[0];
        }
      }
    }
    this._rearThrusterNodes.forEach((node, index) => {
      node.setPosition(this._cachedThrusterBasePos[index] || node.position);
      node.setScale(this._cachedThrusterBaseScale[index] || new Vec3(1, 1, 1));
    });
    if (this._muzzleFlashNode && this._muzzleFlashOpacity) {
      this._muzzleFlashTimer = 0;
      this._muzzleFlashOpacity.opacity = 0;
      this._muzzleFlashNode.active = false;
      this._muzzleFlashNode.setScale(this._muzzleFlashDefaultScale);
    }
    this._idleTime = 0;
    this._thrusterFrameIndex = 0;
    this._thrusterFrameTimer = 0;
    this._recoilTweenActive = false;
    this._recoilCooldownTimer = 0;
  }
}
