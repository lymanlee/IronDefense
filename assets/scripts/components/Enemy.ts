/**
 * Enemy.ts - 敌人组件
 * 控制敌人的移动、AI漫游、攻击和帧动画渲染
 */

import { _decorator, Component, Sprite, UIOpacity, Color, SpriteFrame, resources, Node, UITransform, Vec3 } from 'cc';
import { GameConfig, WaveData } from '../data/GameConfig';

const { ccclass, property } = _decorator;

@ccclass('Enemy')
export class Enemy extends Component {
  // ==================== 波次颜色映射 ====================
  // 注意：颜色会被 Sprite.color 乘法调制，太浅的颜色闪白不明显
  // 调低基础亮度以便闪白效果清晰可见
  private static readonly WAVE_COLORS: Color[] = [
    new Color(200, 200, 200),  // 波次1: 中灰色（原白色太浅）
    new Color(80, 180, 80),    // 波次2: 深绿色
    new Color(80, 100, 200),   // 波次3: 深蓝色
    new Color(200, 160, 80),   // 波次4: 深橙色
    new Color(200, 100, 200),  // 波次5: 深紫色
    new Color(200, 80, 80),    // 波次6: 深红色
    new Color(80, 180, 180),  // 波次7: 深青色
    new Color(200, 200, 80),  // 波次8+: 橙黄色
  ];

  // ==================== 组件引用 ====================
  private _sprite: Sprite | null = null;
  private _opacity: UIOpacity | null = null;

  // ==================== 怪物属性 ====================
  private _hp: number = 0;
  private _maxHp: number = 0;
  private _speed: number = 0;
  private _atk: number = 0;
  private _expDrop: number = 0;
  private _waveNum: number = 1;
  private _lane: number = 0;
  private _dead: boolean = false;
  private _reachedRail: boolean = false;
  private _attackTimer: number = 0;

  // ==================== 位置 ====================
  private _x: number = 0;
  private _y: number = 0;

  // ==================== 闪白效果 ====================
  private _flashTimer: number = 0;
  private readonly _flashDuration: number = 0.25;  // 闪白总时长
  private _baseColor: Color = Color.WHITE.clone();
  private _flashColor: Color = Color.WHITE.clone();  // 当前闪白颜色

  // ==================== 攻击效果 ====================
  private _attackEffectTimer: number = 0;
  private readonly _attackEffectDuration: number = 0.3;

  // ==================== 死亡效果 ====================
  private _deathTimer: number = 0;
  private readonly _deathDuration: number = 0.4;

  // ==================== 帧动画 ====================
  private _frames: SpriteFrame[] = [];
  private _frameIndex: number = 0;
  private _frameTimer: number = 0;
  private readonly _frameInterval: number = 1 / 12; // 12 FPS

  // ==================== 阴影 ====================
  private _shadowNode: Node | null = null;
  private _shadowSprite: Sprite | null = null;
  private _shadowOpacity: UIOpacity | null = null;
  private static readonly SHADOW_OFFSET_X: number = 3;    // 阴影X偏移（阳光从后方照射，影子向前）
  private static readonly SHADOW_OFFSET_Y: number = -50;   // 阴影Y偏移
  private static readonly SHADOW_SCALE_Y: number = 0.3;     // 阴影Y轴压扁
  private static readonly SHADOW_ALPHA: number = 60;        // 阴影透明度(0-255)

  // ==================== 初始化 ====================

  start(): void {
    this._sprite = this.node.getComponent(Sprite);
    this._opacity = this.node.getComponent(UIOpacity);
    if (!this._sprite) this._sprite = this.node.addComponent(Sprite);
    if (!this._opacity) this._opacity = this.node.addComponent(UIOpacity);

    // 创建阴影子节点
    this._createShadow();

    // 预加载帧动画
    this._loadFrames();
  }

  /**
   * 创建阴影子节点（压扁+半透明+偏移）
   */
  private _createShadow(): void {
    this._shadowNode = new Node('Shadow');
    this.node.addChild(this._shadowNode);

    // UITransform 必须有，否则 Sprite 不渲染
    const ut = this._shadowNode.addComponent(UITransform);
    ut.setContentSize(64, 85);

    // Sprite 组件（黑色+半透明 = 阴影效果）
    this._shadowSprite = this._shadowNode.addComponent(Sprite);
    this._shadowSprite.type = Sprite.Type.SIMPLE;
    this._shadowSprite.sizeMode = Sprite.SizeMode.UNIFIED;
    this._shadowSprite.color = new Color(0, 0, 0, 255);

    // 透明度
    this._shadowOpacity = this._shadowNode.addComponent(UIOpacity);
    this._shadowOpacity.opacity = Enemy.SHADOW_ALPHA;

    // 偏移 + 压扁 + Y轴取负翻转（影子头朝下腿朝上）
    this._shadowNode.setPosition(Enemy.SHADOW_OFFSET_X, Enemy.SHADOW_OFFSET_Y, 0);
    this._shadowNode.setScale(1, -Enemy.SHADOW_SCALE_Y, 1);

    // 置于角色下方（z 越小越先渲染 = 越底层）
    this._shadowNode.setSiblingIndex(0);
  }

  private _loadFrames(): void {
    resources.loadDir('sprites', SpriteFrame, (err, assets) => {
      if (err) {
        console.warn('[Enemy] 加载 sprites 失败:', err);
        return;
      }
      // 过滤 walk_ 开头并排序
      this._frames = (assets as SpriteFrame[])
        .filter(f => f.name && f.name.startsWith('walk_'))
        .sort((a, b) => {
          const numA = parseInt(a.name.replace('walk_', ''));
          const numB = parseInt(b.name.replace('walk_', ''));
          return numA - numB;
        });
      console.log('[Enemy] 加载了', this._frames.length, '帧动画');
    });
  }

  /**
   * 初始化敌人
   */
  init(waveData: WaveData, waveNum: number, col?: number, row?: number, totalCols?: number, totalRows?: number, x?: number): void {
    const cfg = GameConfig.bridge;

    if (col !== undefined && row !== undefined && totalCols !== undefined && totalRows !== undefined) {
      this._x = x!;
      const verticalSpacing = 50;
      this._y = cfg.top + 30 + row * verticalSpacing;
    } else {
      const laneCount = cfg.laneCount;
      this._lane = Math.floor(Math.random() * laneCount);
      const laneWidth = (cfg.right - cfg.left) / laneCount;
      this._x = cfg.left + (this._lane + 0.5) * laneWidth;
      this._y = cfg.top + 30 + Math.random() * 40;
    }

    this._maxHp = waveData.hp;
    this._hp = waveData.hp;
    this._speed = waveData.speed;
    this._atk = waveData.atk;
    this._expDrop = waveData.exp;
    this._waveNum = waveNum;

    this._dead = false;
    this._reachedRail = false;
    this._attackTimer = 0;
    this._flashTimer = 0;
    this._attackEffectTimer = 0;
    this._deathTimer = 0;

    // 根据波次设置基础颜色
    const colorIndex = Math.min(waveNum - 1, Enemy.WAVE_COLORS.length - 1);
    this._baseColor = Enemy.WAVE_COLORS[colorIndex].clone();
    this._flashColor = Color.WHITE.clone();

    // 重置帧动画
    this._frameIndex = 0;
    this._frameTimer = 0;
    if (this._frames.length > 0) {
      this._setFrame(0);
    }

    this.node.setPosition(this._x, this._y, 0);
    if (this._opacity) {
      this._opacity.opacity = 255;
    }
    if (this._sprite) {
      this._sprite.color = this._baseColor.clone();
    }
  }

  private _setFrame(index: number): void {
    if (this._frames.length === 0) return;
    const i = index % this._frames.length;
    if (this._sprite) {
      this._sprite.spriteFrame = this._frames[i];
    }
    // 同步阴影帧
    if (this._shadowSprite) {
      this._shadowSprite.spriteFrame = this._frames[i];
    }
  }

  // ==================== 每帧更新 ====================

  update(dt: number): void {
    // 帧动画更新
    if (!this._dead && this._frames.length > 0) {
      this._frameTimer += dt;
      if (this._frameTimer >= this._frameInterval) {
        this._frameTimer -= this._frameInterval;
        this._frameIndex = (this._frameIndex + 1) % this._frames.length;
        this._setFrame(this._frameIndex);
      }
    }

    if (this._dead) {
      this._updateDeath(dt);
      return;
    }

    this._updateFlash(dt);
    this._updateAttackEffect(dt);

    if (this._reachedRail) return;

    this._updateMovement(dt);
  }

  /**
   * 闪白效果更新 - 使用 Sprite color 属性
   */
  private _updateFlash(dt: number): void {
    if (this._flashTimer <= 0) {
      // 恢复正常颜色
      if (this._sprite) {
        this._sprite.color = this._baseColor.clone();
      }
      return;
    }

    this._flashTimer -= dt;
    const progress = 1 - (this._flashTimer / this._flashDuration);

    // 颜色插值：白色 → 基础颜色
    // 前70%保持白色峰值，后30%渐变回基础色
    if (progress < 0.7) {
      // 白色峰值
      if (this._sprite) {
        this._sprite.color = Color.WHITE.clone();
      }
    } else {
      // 渐变回基础颜色
      const t = (progress - 0.7) / 0.3;
      const tClamped = Math.min(1, Math.max(0, t));
      if (this._sprite) {
        this._sprite.color = new Color(
          Math.floor(255 - (255 - this._baseColor.r) * tClamped),
          Math.floor(255 - (255 - this._baseColor.g) * tClamped),
          Math.floor(255 - (255 - this._baseColor.b) * tClamped),
          255
        );
      }
    }
  }

  private _updateAttackEffect(dt: number): void {
    if (this._attackEffectTimer <= 0) return;
    this._attackEffectTimer -= dt;
    const progress = 1 - (this._attackEffectTimer / this._attackEffectDuration);
    if (this._opacity) {
      this._opacity.opacity = Math.max(80, Math.floor(255 * (1 - progress * 0.5)));
    }
    if (this._attackEffectTimer <= 0) {
      this._attackEffectTimer = 0;
      if (this._opacity) this._opacity.opacity = 255;
    }
  }

  private _updateDeath(dt: number): void {
    this._deathTimer += dt;
    const progress = Math.min(1, this._deathTimer / this._deathDuration);
    if (this._opacity) {
      this._opacity.opacity = Math.floor(255 * (1 - progress));
    }
    // 阴影同步淡出
    if (this._shadowOpacity) {
      this._shadowOpacity.opacity = Math.floor(Enemy.SHADOW_ALPHA * (1 - progress));
    }
    // 死亡时轻微抖动效果
    const shake = Math.sin(this._deathTimer * 30) * (3 * (1 - progress));
    this.node.setPosition(this._x + shake, this._y - progress * 10, 0);
  }

  private _updateMovement(dt: number): void {
    this._y -= this._speed * dt;
    this.node.setPosition(this._x, this._y, 0);

    if (this._y <= GameConfig.bridge.railY + 10) {
      this._y = GameConfig.bridge.railY + 10;
      this._reachedRail = true;
      this.node.setPosition(this._x, this._y, 0);
    }
  }

  // ==================== 受击 ====================

  takeDamage(dmg: number): void {
    this._hp -= dmg;
    this._flashTimer = this._flashDuration;
    if (this._hp <= 0) {
      this._hp = 0;
      this._dead = true;
    }
  }

  // ==================== 攻击 ====================

  tryAttack(): boolean {
    if (!this._reachedRail || this._dead) return false;
    this._attackTimer += 1 / 60;
    if (this._attackTimer >= 1 / GameConfig.enemy.attackRate) {
      this._attackTimer = 0;
      this._triggerAttackEffect();
      return true;
    }
    return false;
  }

  private _triggerAttackEffect(): void {
    this._attackEffectTimer = this._attackEffectDuration;
  }

  // ==================== Getters ====================

  get dead(): boolean { return this._dead; }
  get hp(): number { return this._hp; }
  get maxHp(): number { return this._maxHp; }
  get atk(): number { return this._atk; }
  get expDrop(): number { return this._expDrop; }
  get reachedRail(): boolean { return this._reachedRail; }
  get waveNum(): number { return this._waveNum; }
  get x(): number { return this._x; }
  get y(): number { return this._y; }

  // ==================== 重置 ====================

  reset(): void {
    this._dead = true;
    this._reachedRail = false;
    this.node.setPosition(0, -2000, 0);
  }
}
