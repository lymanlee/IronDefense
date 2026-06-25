/**
 * Enemy.ts - 敌人组件
 * 控制敌人的移动、AI漫游、攻击和帧动画渲染
 */

import { _decorator, Component, Sprite, UIOpacity, Color, SpriteFrame, Node, UITransform, Graphics, Label } from 'cc';
import { GameConfig, WaveData, EnemyTypeId, EnemyTypeData } from '../data/GameConfig';
import { BundleLoader } from '../managers/BundleLoader';

const { ccclass, property } = _decorator;

@ccclass('Enemy')
export class Enemy extends Component {
  private static _nextSpawnToken: number = 1;

  // ==================== 敌人类型主色 ====================
  // 使用固定类型主色，保证跨波次识别一致性
  private static readonly TYPE_BASE_COLORS: Record<EnemyTypeId, Color> = {
    normal: new Color(214, 214, 214, 255),
    runner: new Color(110, 214, 255, 255),
    shield: new Color(255, 214, 120, 255),
    suicide: new Color(255, 134, 124, 255),
    healer: new Color(158, 220, 168, 255),
    boss_bulldozer: new Color(255, 196, 116, 255),
    boss_commander: new Color(212, 160, 255, 255),
  };

  // ==================== 组件引用 ====================
  private _sprite: Sprite | null = null;
  private _opacity: UIOpacity | null = null;

  // ==================== 怪物属性 ====================
  private _hp: number = 0;
  private _maxHp: number = 0;
  private _speed: number = 0;
  private _atk: number = 0;
  private _waveNum: number = 1;
  private _lane: number = 0;
  private _enemyType: EnemyTypeId = 'normal';
  private _enemyTypeData: EnemyTypeData = GameConfig.enemyTypes.normal;
  private _dead: boolean = false;
  private _reachedRail: boolean = false;
  private _attackTimer: number = 0;
  private _freezeTimer: number = 0;
  private _spawnTimer: number = 0;
  private _openingArmorTimer: number = 0;
  private _speedScale: number = 1;
  private _speedBoostTimer: number = 0;
  private _phaseTriggered: boolean = false;
  private _battleFrozen: boolean = false;
  private _spawnToken: number = 0;

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
  private _bossHpBarRoot: Node | null = null;
  private _bossHpBarBg: Graphics | null = null;
  private _bossHpBarFillNode: Node | null = null;
  private _bossHpBarFill: Graphics | null = null;
  private _bossHpBarFillTransform: UITransform | null = null;
  private _bossHpLabel: Label | null = null;
  private static readonly SHADOW_OFFSET_X: number = 3;    // 阴影X偏移（阳光从后方照射，影子向前）
  private static readonly SHADOW_OFFSET_Y: number = -50;   // 阴影Y偏移
  private static readonly SHADOW_SCALE_Y: number = 0.3;     // 阴影Y轴压扁
  private static readonly SHADOW_ALPHA: number = 60;        // 阴影透明度(0-255)
  private static readonly SUICIDE_BLINK_THRESHOLD: number = 0.35;
  private static readonly BOSS_HP_BAR_WIDTH: number = 68;
  private static readonly BOSS_HP_BAR_HEIGHT: number = 6;
  private static readonly BOSS_HP_BAR_INNER_HEIGHT: number = 3;

  // ==================== 初始化 ====================

  start(): void {
    this._sprite = this.node.getComponent(Sprite);
    this._opacity = this.node.getComponent(UIOpacity);
    if (!this._sprite) this._sprite = this.node.addComponent(Sprite);
    if (!this._opacity) this._opacity = this.node.addComponent(UIOpacity);

    // 创建阴影子节点
    this._createShadow();
    this._createBossHpBar();

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
    this._shadowSprite.sizeMode = Sprite.SizeMode.CUSTOM;
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

  private _createBossHpBar(): void {
    this._bossHpBarRoot = new Node('BossHpBar');
    this.node.addChild(this._bossHpBarRoot);

    const rootTransform = this._bossHpBarRoot.addComponent(UITransform);
    rootTransform.setContentSize(96, 24);
    this._bossHpBarRoot.setSiblingIndex(99);

    const bgNode = new Node('Bg');
    this._bossHpBarRoot.addChild(bgNode);
    const bgTransform = bgNode.addComponent(UITransform);
    bgTransform.setContentSize(Enemy.BOSS_HP_BAR_WIDTH, Enemy.BOSS_HP_BAR_HEIGHT);
    bgNode.setPosition(0, 5, 0);
    this._bossHpBarBg = bgNode.addComponent(Graphics);

    this._bossHpBarFillNode = new Node('Fill');
    this._bossHpBarRoot.addChild(this._bossHpBarFillNode);
    this._bossHpBarFillTransform = this._bossHpBarFillNode.addComponent(UITransform);
    this._bossHpBarFillTransform.setAnchorPoint(0, 0.5);
    this._bossHpBarFillTransform.setContentSize(Enemy.BOSS_HP_BAR_WIDTH - 6, Enemy.BOSS_HP_BAR_INNER_HEIGHT);
    this._bossHpBarFillNode.setPosition(-Enemy.BOSS_HP_BAR_WIDTH * 0.5 + 3, 5, 0);
    this._bossHpBarFill = this._bossHpBarFillNode.addComponent(Graphics);

    const hpLabelNode = new Node('BossHpLabel');
    this._bossHpBarRoot.addChild(hpLabelNode);
    const hpLabelTransform = hpLabelNode.addComponent(UITransform);
    hpLabelTransform.setContentSize(108, 14);
    hpLabelNode.setPosition(0, -6, 0);
    this._bossHpLabel = hpLabelNode.addComponent(Label);
    this._bossHpLabel.fontSize = 8;
    this._bossHpLabel.lineHeight = 10;
    this._bossHpLabel.isBold = true;
    this._bossHpLabel.enableOutline = true;
    this._bossHpLabel.outlineColor = new Color(8, 10, 14, 230);
    this._bossHpLabel.outlineWidth = 2;
    this._bossHpLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this._bossHpLabel.verticalAlign = Label.VerticalAlign.CENTER;

    this._redrawBossHpBarBg();
    this._refreshBossHpBar();
  }

  private _redrawBossHpBarBg(): void {
    if (!this._bossHpBarBg) return;
    const w = Enemy.BOSS_HP_BAR_WIDTH;
    const h = Enemy.BOSS_HP_BAR_HEIGHT;
    this._bossHpBarBg.clear();
    this._bossHpBarBg.fillColor = new Color(9, 13, 17, 170);
    this._bossHpBarBg.roundRect(-w * 0.5, -h * 0.5, w, h, 4);
    this._bossHpBarBg.fill();
  }

  private _refreshBossHpBar(): void {
    if (!this._bossHpBarRoot || !this._bossHpBarFill || !this._bossHpBarFillTransform) return;

    const visible = this.isBoss && !this._dead;
    this._bossHpBarRoot.active = visible;
    if (!visible) return;

    const offsetY = 42 + Math.max(0, this._enemyTypeData.scale - 1) * 10;
    this._bossHpBarRoot.setPosition(0, offsetY, 0);

    const maxWidth = Enemy.BOSS_HP_BAR_WIDTH - 6;
    const ratio = this._maxHp > 0 ? Math.max(0, Math.min(1, this._hp / this._maxHp)) : 0;
    const fillWidth = Math.max(ratio <= 0 ? 0 : 4, Math.round(maxWidth * ratio));
    this._bossHpBarFillTransform.setContentSize(fillWidth, Enemy.BOSS_HP_BAR_INNER_HEIGHT);

    this._bossHpBarFill.clear();
    if (this._bossHpLabel) {
      this._bossHpLabel.string = `${this._formatCompactValue(this._hp)} / ${this._formatCompactValue(this._maxHp)}`;
      this._bossHpLabel.color = new Color(255, 248, 232, 255);
    }
    if (fillWidth <= 0) return;

    const fillColor = ratio <= 0.22
      ? new Color(255, 112, 84, 255)
      : ratio <= 0.55
        ? new Color(255, 184, 92, 255)
        : new Color(255, 160, 66, 255);
    this._bossHpBarFill.fillColor = fillColor;
    this._bossHpBarFill.roundRect(0, -Enemy.BOSS_HP_BAR_INNER_HEIGHT * 0.5, fillWidth, Enemy.BOSS_HP_BAR_INNER_HEIGHT, 2);
    this._bossHpBarFill.fill();
  }

  private _formatCompactValue(value: number): string {
    const safeValue = Math.max(0, Math.round(value));
    if (safeValue >= 100000000) {
      return this._formatCompactUnit(safeValue, 100000000, '亿');
    }
    if (safeValue >= 10000) {
      return this._formatCompactUnit(safeValue, 10000, '万');
    }
    return `${safeValue}`;
  }

  private _formatCompactUnit(value: number, unitValue: number, unitLabel: string): string {
    const scaled = value / unitValue;
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    const text = scaled.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    return `${text}${unitLabel}`;
  }

  private _loadFrames(): void {
    BundleLoader.loadDir('battle', 'sprites', SpriteFrame, (err, assets) => {
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
  init(waveData: WaveData, waveNum: number, col?: number, row?: number, totalCols?: number, totalRows?: number, x?: number, enemyType: EnemyTypeId = 'normal'): void {
    const cfg = GameConfig.bridge;
    this._enemyType = enemyType;
    this._enemyTypeData = GameConfig.enemyTypes[enemyType] || GameConfig.enemyTypes.normal;
    this._spawnToken = Enemy._nextSpawnToken++;
    const spawnY = cfg.battleTop + 30;

    if (col !== undefined && row !== undefined && totalCols !== undefined && totalRows !== undefined) {
      const horizontalJitter = 30;
      this._x = x! + (Math.random() - 0.5) * horizontalJitter * 2;
      this._y = spawnY;
    } else {
      const laneCount = cfg.laneCount;
      this._lane = Math.floor(Math.random() * laneCount);
      const laneWidth = (cfg.right - cfg.left) / laneCount;
      this._x = cfg.left + (this._lane + 0.5) * laneWidth;
      this._y = spawnY;
    }

    this._maxHp = Math.max(1, Math.round(waveData.hp * this._enemyTypeData.hpMult));
    this._hp = this._maxHp;
    this._speed = Math.max(1, waveData.speed * this._enemyTypeData.speedMult);
    this._atk = Math.max(1, Math.round(waveData.atk * this._enemyTypeData.atkMult));
    this._waveNum = waveNum;

    this._dead = false;
    this._reachedRail = false;
    this._attackTimer = 0;
    this._freezeTimer = 0;
    this._spawnTimer = 0;
    this._openingArmorTimer = this._enemyTypeData.openingArmorSeconds;
    this._speedScale = 1;
    this._speedBoostTimer = 0;
    this._phaseTriggered = false;
    this._battleFrozen = false;
    this._flashTimer = 0;
    this._attackEffectTimer = 0;
    this._deathTimer = 0;

    // 根据敌人类型设置固定主色
    this._baseColor = (Enemy.TYPE_BASE_COLORS[this._enemyType] || Enemy.TYPE_BASE_COLORS.normal).clone();
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
      this._sprite.color = this._resolveBaseColor();
    }
    this.node.setScale(this._enemyTypeData.scale, this._enemyTypeData.scale, 1);
    this._refreshBossHpBar();
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

  // Manual tick driven by GameManager. Avoid Cocos Component.update auto-running in parallel.
  tick(dt: number, movementLocked: boolean = false): void {
    if (this._battleFrozen) return;
    this._spawnTimer += dt;
    if (this._openingArmorTimer > 0) {
      this._openingArmorTimer = Math.max(0, this._openingArmorTimer - dt);
    }
    if (this._speedBoostTimer > 0) {
      this._speedBoostTimer = Math.max(0, this._speedBoostTimer - dt);
      if (this._speedBoostTimer <= 0) {
        this._speedBoostTimer = 0;
        this._speedScale = 1;
      }
    }

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
    if (this._freezeTimer > 0) {
      this._freezeTimer = Math.max(0, this._freezeTimer - dt);
      return;
    }

    if (!movementLocked) {
      this._updateMovement(dt);
    }
  }

  /**
   * 闪白效果更新 - 使用 Sprite color 属性
   */
  private _updateFlash(dt: number): void {
    if (this._flashTimer <= 0) {
      // 恢复正常颜色
      if (this._sprite) {
        this._sprite.color = this._resolveBaseColor();
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
    this._y -= this._speed * this._speedScale * dt;
    this.node.setPosition(this._x, this._y, 0);

    const contactY = GameConfig.bridge.railY + GameConfig.enemy.railContactOffset;
    if (this._y <= contactY) {
      this._y = contactY;
      this._reachedRail = true;
      this.node.setPosition(this._x, this._y, 0);
    }
  }

  // ==================== 受击 ====================

  takeDamage(dmg: number): void {
    let actualDamage = dmg;
    if (this._openingArmorTimer > 0) {
      actualDamage *= 1 - this._enemyTypeData.openingArmorReduce;
    }
    if (this._enemyTypeData.damageReduce > 0) {
      actualDamage *= 1 - this._enemyTypeData.damageReduce;
    }
    this._hp -= Math.max(1, Math.round(actualDamage));
    this._flashTimer = this._flashDuration;
    if (this._hp <= 0) {
      this._hp = 0;
      this._dead = true;
    }
    this._refreshBossHpBar();
  }

  heal(amount: number): void {
    if (this._dead || amount <= 0) return;
    this._hp = Math.min(this._maxHp, this._hp + amount);
    this._flashTimer = this._flashDuration * 0.4;
    this._refreshBossHpBar();
  }

  /**
   * 临时冻结移动
   */
  freeze(seconds: number): void {
    if (this._dead || seconds <= 0) return;
    this._freezeTimer = Math.max(this._freezeTimer, seconds);
  }

  /**
   * 将敌人从护栏处推回
   */
  pushBack(distance: number): void {
    if (this._dead || distance <= 0) return;
    this._y = Math.min(GameConfig.bridge.battleTop + 120, this._y + distance);
    this._reachedRail = false;
    this.node.setPosition(this._x, this._y, 0);
  }

  setWorldPosition(x: number, y: number): void {
    this._x = x;
    this._y = y;
    this._reachedRail = y <= GameConfig.bridge.railY + GameConfig.enemy.railContactOffset;
    this.node.setPosition(this._x, this._y, 0);
  }

  applySpeedBoost(multiplier: number, seconds: number): void {
    if (this._dead || multiplier <= 1 || seconds <= 0) return;
    this._speedScale = Math.max(this._speedScale, multiplier);
    this._speedBoostTimer = Math.max(this._speedBoostTimer, seconds);
  }

  // ==================== 攻击 ====================

  tryAttack(): boolean {
    if (!this._reachedRail || this._dead) return false;
    this._attackTimer += 1 / 60;
    if (this._enemyType === 'suicide') {
      if (this._attackTimer >= this.explodeDelay) {
        this._dead = true;
        this._triggerAttackEffect();
        return true;
      }
      return false;
    }
    const attackRate = GameConfig.enemy.attackRate * this._enemyTypeData.attackRateMult;
    if (this._attackTimer >= 1 / attackRate) {
      this._attackTimer = 0;
      this._triggerAttackEffect();
      return true;
    }
    return false;
  }

  private _triggerAttackEffect(): void {
    this._attackEffectTimer = this._attackEffectDuration;
    if (this._enemyType === 'suicide' && this._sprite) {
      this._sprite.color = new Color(255, 244, 214, 255);
    }
  }

  private _resolveBaseColor(): Color {
    const color = this._baseColor.clone();
    if (!this._enemyTypeData.tint) {
      return color;
    }
    const tint = new Color();
    tint.fromHEX(this._enemyTypeData.tint);
    return new Color(
      Math.floor((color.r + tint.r) / 2),
      Math.floor((color.g + tint.g) / 2),
      Math.floor((color.b + tint.b) / 2),
      255
    );
  }

  // ==================== Getters ====================

  get dead(): boolean { return this._dead; }
  get hp(): number { return this._hp; }
  get maxHp(): number { return this._maxHp; }
  get atk(): number { return this._atk; }
  get reachedRail(): boolean { return this._reachedRail; }
  get waveNum(): number { return this._waveNum; }
  get x(): number { return this._x; }
  get y(): number { return this._y; }
  get frozen(): boolean { return this._freezeTimer > 0; }
  get enemyType(): EnemyTypeId { return this._enemyType; }
  get rewardCoins(): number { return this._enemyTypeData.rewardCoins; }
  get rewardParts(): number { return this._enemyTypeData.rewardParts; }
  get isBoss(): boolean { return this._enemyType.startsWith('boss_'); }
  get isSuicide(): boolean { return this._enemyType === 'suicide'; }
  get isHealer(): boolean { return this._enemyType === 'healer'; }
  get openingArmorActive(): boolean { return this._openingArmorTimer > 0; }
  get explodeDelay(): number { return this._enemyTypeData.explodeDelay || 0; }
  get spawnTime(): number { return this._spawnTimer; }
  get healPercent(): number { return this._enemyTypeData.healPercent || 0; }
  get healInterval(): number { return this._enemyTypeData.healInterval || 0; }
  get healRange(): number { return this._enemyTypeData.healRange || 0; }
  get phaseTriggered(): boolean { return this._phaseTriggered; }
  get hpRatio(): number { return this._maxHp > 0 ? this._hp / this._maxHp : 0; }
  get spawnToken(): number { return this._spawnToken; }

  markPhaseTriggered(): void {
    this._phaseTriggered = true;
  }

  setBattleFrozen(value: boolean): void {
    this._battleFrozen = value;
  }

  // ==================== 重置 ====================

  reset(): void {
    this._dead = true;
    this._spawnToken = 0;
    this._reachedRail = false;
    this._freezeTimer = 0;
    this._spawnTimer = 0;
    this._openingArmorTimer = 0;
    this._speedScale = 1;
    this._speedBoostTimer = 0;
    this._phaseTriggered = false;
    this._battleFrozen = false;
    this._refreshBossHpBar();
    this.node.setPosition(0, -2000, 0);
    this.node.setScale(1, 1, 1);
  }
}
