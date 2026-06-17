/**
 * SupplyChest.ts - 战斗中可击毁的补给宝箱
 */

import { _decorator, Color, Component, Graphics, Label, Node, Sprite, SpriteFrame, UITransform, UIOpacity, Vec3 } from 'cc';
import { SupplyChestQuality } from '../data/GameConfig';
import { BundleLoader } from '../managers/BundleLoader';

const { ccclass } = _decorator;

type ChestVisualKey = 'normal' | 'elite' | 'rare' | 'legendary';

interface ImpactSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  trail: number;
  warm: boolean;
}

@ccclass('SupplyChest')
export class SupplyChest extends Component {
  private static readonly CHEST_RESOURCE_DIR = 'ui/game/chests_v2';
  private static readonly HIT_ANIM_DURATION = 0.18;
  private static readonly HIT_SHAKE_DURATION = 0.24;
  private static readonly HIT_FX_DURATION = 0.2;
  private static readonly _instances = new Set<SupplyChest>();

  private static readonly CHEST_FRAME_NAMES: Record<ChestVisualKey, string> = {
    normal: 'chest_normal_v2',
    elite: 'chest_elite_v2',
    rare: 'chest_rare_v2',
    legendary: 'chest_legendary_v2',
  };

  private static readonly _spriteCache: Partial<Record<ChestVisualKey, SpriteFrame | null>> = {};
  private static _loadingAll = false;
  private static _loadedAll = false;

  private _quality: SupplyChestQuality = 'normal';
  private _serial: number = 0;
  private _x: number = 0;
  private _y: number = 0;
  private _targetX: number = 0;
  private _targetY: number = 0;
  private _radius: number = 30;
  private _hp: number = 1;
  private _maxHp: number = 1;
  private _dead: boolean = false;
  private _reachedRail: boolean = false;
  private _speed: number = 0;
  private _atk: number = 0;
  private _attackRate: number = 1;
  private _attackTimer: number = 0;
  private _freezeTimer: number = 0;
  private _battleFrozen: boolean = false;
  private _shadowNode: Node | null = null;
  private _shadowGraphics: Graphics | null = null;
  private _visualNode: Node | null = null;
  private _visualSprite: Sprite | null = null;
  private _impactFxNode: Node | null = null;
  private _impactFxGraphics: Graphics | null = null;
  private _titleLabel: Label | null = null;
  private _hpLabel: Label | null = null;
  private _hpFillGraphics: Graphics | null = null;
  private _hpFillTransform: UITransform | null = null;
  private _opacity: UIOpacity | null = null;
  private _flashTimer: number = 0;
  private _hitAnimTimer: number = 0;
  private _hitShakeTimer: number = 0;
  private _hitFxTimer: number = 0;
  private _animTime: number = 0;
  private _impactSparks: ImpactSpark[] = [];
  private _currentVisualKey: ChestVisualKey | null = null;

  onLoad(): void {
    SupplyChest._instances.add(this);
    const transform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
    transform.setAnchorPoint(0.5, 0.5);
    this._opacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);

    const shadowNode = this._getOrCreateChild('ChestShadow');
    const shadowTransform = shadowNode.getComponent(UITransform) || shadowNode.addComponent(UITransform);
    shadowTransform.setContentSize(96, 22);
    shadowNode.setPosition(0, -32, 0);
    this._shadowGraphics = shadowNode.getComponent(Graphics) || shadowNode.addComponent(Graphics);
    this._shadowNode = shadowNode;
    this._shadowNode.setSiblingIndex(0);
    this._redrawShadow(1);

    const visualNode = this._getOrCreateChild('ChestVisual');
    const visualTransform = visualNode.getComponent(UITransform) || visualNode.addComponent(UITransform);
    visualTransform.setContentSize(128, 88);
    visualNode.setPosition(0, -4, 0);
    this._visualSprite = visualNode.getComponent(Sprite) || visualNode.addComponent(Sprite);
    this._visualSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this._visualNode = visualNode;
    this._visualNode.setSiblingIndex(1);

    const impactFxNode = this._getOrCreateChild('ChestImpactFx');
    const impactFxTransform = impactFxNode.getComponent(UITransform) || impactFxNode.addComponent(UITransform);
    impactFxTransform.setContentSize(168, 128);
    impactFxNode.setPosition(0, -2, 0);
    this._impactFxGraphics = impactFxNode.getComponent(Graphics) || impactFxNode.addComponent(Graphics);
    this._impactFxNode = impactFxNode;
    this._impactFxNode.setSiblingIndex(2);

    const titleNode = this._getOrCreateChild('ChestTitle');
    const titleTransform = titleNode.getComponent(UITransform) || titleNode.addComponent(UITransform);
    titleTransform.setContentSize(140, 22);
    titleNode.setPosition(0, 50, 0);
    this._titleLabel = titleNode.getComponent(Label) || titleNode.addComponent(Label);
    this._titleLabel.fontSize = 13;
    this._titleLabel.lineHeight = 15;
    this._titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this._titleLabel.verticalAlign = Label.VerticalAlign.CENTER;

    const hpBgNode = this._getOrCreateChild('ChestHpBarBg');
    const hpBgTransform = hpBgNode.getComponent(UITransform) || hpBgNode.addComponent(UITransform);
    hpBgTransform.setContentSize(90, 10);
    hpBgNode.setPosition(0, 36, 0);
    const hpBgGraphics = hpBgNode.getComponent(Graphics) || hpBgNode.addComponent(Graphics);
    hpBgGraphics.clear();
    hpBgGraphics.fillColor = new Color(9, 13, 17, 170);
    hpBgGraphics.roundRect(-45, -5, 90, 10, 5);
    hpBgGraphics.fill();

    const hpFillNode = this._getOrCreateChild('ChestHpBarFill');
    this._hpFillTransform = hpFillNode.getComponent(UITransform) || hpFillNode.addComponent(UITransform);
    this._hpFillTransform.setContentSize(84, 6);
    hpFillNode.setPosition(-42, 36, 0);
    this._hpFillTransform.setAnchorPoint(0, 0.5);
    this._hpFillGraphics = hpFillNode.getComponent(Graphics) || hpFillNode.addComponent(Graphics);

    const hpLabelNode = this._getOrCreateChild('ChestHpLabel');
    const hpLabelTransform = hpLabelNode.getComponent(UITransform) || hpLabelNode.addComponent(UITransform);
    hpLabelTransform.setContentSize(150, 22);
    hpLabelNode.setPosition(0, 18, 0);
    this._hpLabel = hpLabelNode.getComponent(Label) || hpLabelNode.addComponent(Label);
    this._hpLabel.fontSize = 13;
    this._hpLabel.lineHeight = 16;
    this._hpLabel.isBold = true;
    this._hpLabel.enableOutline = true;
    this._hpLabel.outlineColor = new Color(8, 10, 14, 230);
    this._hpLabel.outlineWidth = 2;
    this._hpLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this._hpLabel.verticalAlign = Label.VerticalAlign.CENTER;

    this._preloadVisuals();
    this._refreshTransforms();
  }

  onDestroy(): void {
    SupplyChest._instances.delete(this);
  }

  init(
    quality: SupplyChestQuality,
    x: number,
    y: number,
    hp: number,
    radius: number,
    serial: number,
    speed: number,
    atk: number,
    attackRate: number
  ): void {
    this._quality = quality;
    this._x = x;
    this._y = y;
    this._targetX = x;
    this._targetY = y;
    this._radius = radius;
    this._serial = Math.max(0, Math.floor(serial));
    this._hp = Math.max(1, Math.round(hp));
    this._maxHp = this._hp;
    this._dead = false;
    this._reachedRail = false;
    this._speed = Math.max(1, speed);
    this._atk = Math.max(1, Math.round(atk));
    this._attackRate = Math.max(0.2, attackRate);
    this._attackTimer = 0;
    this._freezeTimer = 0;
    this._battleFrozen = false;
    this._flashTimer = 0;
    this._hitAnimTimer = 0;
    this._hitShakeTimer = 0;
    this._hitFxTimer = 0;
    this.node.active = true;
    this.node.setPosition(x, y, 0);
    const transform = this.node.getComponent(UITransform);
    transform?.setContentSize(156, 120);
    if (this._opacity) this._opacity.opacity = 255;
    this._currentVisualKey = this._getVisualKey();
    this._updateVisualSprite();
    this._refreshView();
  }

  updateChest(dt: number): void {
    if (this._battleFrozen || this._dead) return;
    this._animTime += dt;
    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
    }
    if (this._hitAnimTimer > 0) {
      this._hitAnimTimer = Math.max(0, this._hitAnimTimer - dt);
    }
    if (this._hitShakeTimer > 0) {
      this._hitShakeTimer = Math.max(0, this._hitShakeTimer - dt);
    }
    if (this._hitFxTimer > 0) {
      this._hitFxTimer = Math.max(0, this._hitFxTimer - dt);
    }
    this._updateImpactSparks(dt);
    if (this._freezeTimer > 0) {
      this._freezeTimer = Math.max(0, this._freezeTimer - dt);
      this._refreshView();
      return;
    }
    if (this._x !== this._targetX) {
      this._x = this._targetX;
    }
    if (this._y > this._targetY) {
      this._y = Math.max(this._targetY, this._y - this._speed * dt);
      if (this._y <= this._targetY + 0.5) {
        this._y = this._targetY;
        this._reachedRail = true;
      }
      this.node.setPosition(this._x, this._y, 0);
    }
    this._refreshView();
  }

  takeDamage(amount: number): boolean {
    if (this._dead) return false;
    this._hp = Math.max(0, this._hp - Math.max(1, Math.round(amount)));
    this._flashTimer = 0.08;
    this._hitAnimTimer = SupplyChest.HIT_ANIM_DURATION;
    this._hitShakeTimer = SupplyChest.HIT_SHAKE_DURATION;
    this._hitFxTimer = SupplyChest.HIT_FX_DURATION;
    this._spawnImpactSparks();
    if (this._hp <= 0) {
      this._dead = true;
      this._hp = 0;
      this._refreshView();
      return true;
    }
    this._refreshView();
    return false;
  }

  reset(): void {
    this._dead = true;
    this._reachedRail = false;
    this._hp = 0;
    this._maxHp = 1;
    this._attackTimer = 0;
    this._freezeTimer = 0;
    this._battleFrozen = false;
    this._hitAnimTimer = 0;
    this._hitShakeTimer = 0;
    this._hitFxTimer = 0;
    this._impactSparks.length = 0;
    this.node.active = false;
    this.node.setPosition(new Vec3(0, -2000, 0));
  }

  freeze(seconds: number): void {
    if (this._dead || seconds <= 0) return;
    this._freezeTimer = Math.max(this._freezeTimer, seconds);
  }

  setBattleFrozen(value: boolean): void {
    this._battleFrozen = value;
  }

  setTrackTarget(x: number, y: number): void {
    this._targetX = x;
    this._targetY = y;
    this._reachedRail = this._y <= y;
  }

  setPositionInstant(x: number, y: number, reachedRail: boolean = false): void {
    this._x = x;
    this._y = y;
    this._targetX = x;
    this._targetY = y;
    this._reachedRail = reachedRail;
    this.node.setPosition(x, y, 0);
    this._refreshView();
  }

  tryAttack(dt: number): boolean {
    if (this._dead || this._battleFrozen || !this._reachedRail || this._freezeTimer > 0) return false;
    this._attackTimer += dt;
    if (this._attackTimer < 1 / this._attackRate) return false;
    this._attackTimer = 0;
    this._flashTimer = 0.12;
    return true;
  }

  private _refreshView(): void {
    const textColor = this._getTextColor();
    const barColor = this._getBarColor();
    this._updateVisualSprite();

    if (this._titleLabel) {
      this._titleLabel.string = this._getTitle();
      this._titleLabel.color = textColor;
    }
    if (this._hpLabel) {
      this._hpLabel.string = `${this._formatCompactValue(this._hp)} / ${this._formatCompactValue(this._maxHp)}`;
      this._hpLabel.color = new Color(255, 248, 232, 255);
    }
    if (this._visualSprite) {
      this._visualSprite.color = this._flashTimer > 0 ? new Color(255, 236, 210, 255) : new Color(255, 255, 255, 255);
    }
    if (this._hpFillGraphics && this._hpFillTransform) {
      const width = Math.max(4, Math.round(84 * this.hpRatio));
      this._hpFillTransform.setContentSize(width, 6);
      this._hpFillGraphics.clear();
      this._hpFillGraphics.fillColor = barColor;
      this._hpFillGraphics.roundRect(0, -3, width, 6, 3);
      this._hpFillGraphics.fill();
    }
    this._refreshTransforms();
    this._refreshImpactFx();
  }

  private _getTitle(): string {
    const qualityLabel: Record<SupplyChestQuality, string> = {
      normal: '普通补给',
      elite: '精英补给',
      rare: '稀有补给',
      legendary: '传奇补给',
    };
    return qualityLabel[this._quality];
  }

  private _getTextColor(): Color {
    if (this._quality === 'legendary') return new Color(255, 225, 142, 255);
    if (this._quality === 'rare') return new Color(236, 196, 255, 255);
    if (this._quality === 'elite') return new Color(255, 214, 110, 255);
    return new Color(210, 230, 255, 255);
  }

  private _getBarColor(): Color {
    if (this._quality === 'legendary') return new Color(255, 182, 56, 255);
    if (this._quality === 'rare') return new Color(180, 108, 255, 255);
    if (this._quality === 'elite') return new Color(255, 196, 74, 255);
    return new Color(255, 160, 66, 255);
  }

  private _getVisualKey(): ChestVisualKey {
    if (this._quality === 'legendary') return 'legendary';
    if (this._quality === 'rare') return 'rare';
    if (this._quality === 'elite') return 'elite';
    return 'normal';
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

  private _getOrCreateChild(name: string): Node {
    const existing = this._findDescendantByName(this.node, name);
    if (existing) return existing;
    const child = new Node(name);
    this.node.addChild(child);
    return child;
  }

  private _redrawShadow(scale: number): void {
    if (!this._shadowGraphics) return;
    const width = 96 * scale;
    const height = 22 * Math.max(0.82, scale * 0.92);
    this._shadowGraphics.clear();
    this._shadowGraphics.fillColor = new Color(0, 0, 0, 86);
    this._shadowGraphics.ellipse(0, 0, width / 2, height / 2);
    this._shadowGraphics.fill();
  }

  private _refreshTransforms(): void {
    const hitProgress = this._hitAnimTimer > 0
      ? 1 - this._hitAnimTimer / SupplyChest.HIT_ANIM_DURATION
      : 1;
    const hitPulse = this._hitAnimTimer > 0 ? Math.sin(hitProgress * Math.PI) : 0;
    const scaleX = 1 + hitPulse * 0.09;
    const scaleY = 1 - hitPulse * 0.08;
    const shakeOffset = this._computeShakeOffset();
    const hoverOffset = Math.sin(this._animTime * 2.4 + this._serial * 0.7) * 1.6;

    if (this._visualNode) {
      this._visualNode.setScale(scaleX, scaleY, 1);
      this._visualNode.setPosition(shakeOffset, -4 + hoverOffset, 0);
    }
    if (this._shadowNode) {
      this._shadowNode.setPosition(shakeOffset * 0.3, -32, 0);
      this._redrawShadow(1 + hitPulse * 0.06);
    }
  }

  private _computeShakeOffset(): number {
    if (this._hitShakeTimer <= 0) return 0;
    const elapsed = SupplyChest.HIT_SHAKE_DURATION - this._hitShakeTimer;
    const burstA = this._sampleShakeBurst(elapsed, 0.0, 0.08, 3.2, 2.5);
    const burstB = this._sampleShakeBurst(elapsed, 0.13, 0.08, 2.4, 2.0);
    return burstA + burstB;
  }

  private _sampleShakeBurst(
    elapsed: number,
    start: number,
    duration: number,
    amplitude: number,
    oscillations: number
  ): number {
    if (elapsed < start || elapsed > start + duration) return 0;
    const t = (elapsed - start) / duration;
    const envelope = Math.sin(t * Math.PI);
    const wave = Math.sin(t * Math.PI * 2 * oscillations);
    return wave * envelope * amplitude;
  }

  private _refreshImpactFx(): void {
    if (!this._impactFxGraphics) return;
    this._impactFxGraphics.clear();
    if (this._hitFxTimer <= 0 && this._impactSparks.length === 0) return;

    const progress = this._hitFxTimer > 0 ? 1 - this._hitFxTimer / SupplyChest.HIT_FX_DURATION : 1;
    const fade = this._hitFxTimer > 0 ? 1 - progress : 0;
    const centerY = -2;
    const ringRadius = 14 + progress * 22;
    const glowColor = this._quality === 'rare'
      ? new Color(202, 136, 255, Math.round(205 * fade))
      : this._quality === 'elite'
        ? new Color(255, 214, 110, Math.round(210 * fade))
        : new Color(255, 186, 96, Math.round(195 * fade));
    const sparkColor = new Color(255, 248, 232, Math.round(245 * fade));
    const hotCoreColor = new Color(255, 234, 180, Math.round(180 * fade));

    this._impactFxGraphics.lineWidth = 2.6;
    this._impactFxGraphics.strokeColor = glowColor;
    this._impactFxGraphics.circle(0, centerY, ringRadius);
    this._impactFxGraphics.stroke();

    this._impactFxGraphics.fillColor = hotCoreColor;
    this._impactFxGraphics.circle(0, centerY, 5 + fade * 4);
    this._impactFxGraphics.fill();

    for (const spark of this._impactSparks) {
      const sparkFade = Math.max(0, spark.life / spark.maxLife);
      const tailLength = spark.trail * (0.35 + sparkFade * 0.9);
      const speed = Math.max(1, Math.hypot(spark.vx, spark.vy));
      const dirX = spark.vx / speed;
      const dirY = spark.vy / speed;
      const tailX = dirX * tailLength;
      const tailY = dirY * tailLength;
      const px = spark.x;
      const py = centerY + spark.y;
      const trailColor = spark.warm
        ? new Color(255, 198, 110, Math.round(225 * sparkFade))
        : new Color(255, 246, 228, Math.round(245 * sparkFade));
      const tipColor = spark.warm
        ? new Color(255, 226, 164, Math.round(235 * sparkFade))
        : new Color(255, 252, 244, Math.round(255 * sparkFade));

      this._impactFxGraphics.strokeColor = trailColor;
      this._impactFxGraphics.lineWidth = 1.2 + sparkFade * (spark.warm ? 2.2 : 1.6);
      this._impactFxGraphics.moveTo(px - tailX, py - tailY);
      this._impactFxGraphics.lineTo(px, py);
      this._impactFxGraphics.stroke();

      this._impactFxGraphics.fillColor = tipColor;
      this._impactFxGraphics.circle(px, py, spark.size * (0.55 + sparkFade * 0.65));
      this._impactFxGraphics.fill();
    }
  }

  private _spawnImpactSparks(): void {
    this._impactSparks.length = 0;
    const sparkCount = this._quality === 'rare' ? 16 : this._quality === 'elite' ? 14 : 12;
    for (let index = 0; index < sparkCount; index++) {
      const angleBase = -Math.PI * 0.78 + (Math.PI * 1.56 * index) / Math.max(1, sparkCount - 1);
      const angle = angleBase + (Math.random() - 0.5) * 0.28;
      const speed = 150 + Math.random() * 110 + (index % 3) * 18;
      const life = 0.11 + Math.random() * 0.08;
      this._impactSparks.push({
        x: (Math.random() - 0.5) * 8,
        y: -2 + (Math.random() - 0.5) * 5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.72,
        life,
        maxLife: life,
        size: 1.3 + Math.random() * 1.8,
        trail: 9 + Math.random() * 13,
        warm: index % 3 !== 0,
      });
    }
  }

  private _updateImpactSparks(dt: number): void {
    if (this._impactSparks.length === 0) return;
    const gravity = 520;
    for (let index = this._impactSparks.length - 1; index >= 0; index--) {
      const spark = this._impactSparks[index];
      spark.life = Math.max(0, spark.life - dt);
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.985;
      spark.vy -= gravity * dt;
      if (spark.life <= 0) {
        this._impactSparks.splice(index, 1);
      }
    }
  }

  private _findDescendantByName(root: Node, name: string): Node | null {
    if (root.name === name) return root;
    for (const child of root.children) {
      const match = this._findDescendantByName(child, name);
      if (match) return match;
    }
    return null;
  }

  private _updateVisualSprite(): void {
    if (!this._visualSprite) return;
    const key = this._currentVisualKey || this._getVisualKey();
    this._currentVisualKey = key;
    const cached = SupplyChest._spriteCache[key];
    if (cached) {
      this._visualSprite.spriteFrame = cached;
      return;
    }
    this._visualSprite.spriteFrame = null;
    this._preloadVisuals();
  }

  private _preloadVisuals(): void {
    if (SupplyChest._loadedAll || SupplyChest._loadingAll) return;
    SupplyChest._loadingAll = true;
    BundleLoader.loadDir('battle', SupplyChest.CHEST_RESOURCE_DIR, SpriteFrame, (err, frames) => {
      SupplyChest._loadingAll = false;
      if (err || !frames) {
        console.warn('[SupplyChest] Failed to load chest sprite frames:', err);
        return;
      }

      const frameMap = new Map(frames.map(frame => [frame.name, frame] as const));
      (Object.keys(SupplyChest.CHEST_FRAME_NAMES) as ChestVisualKey[]).forEach(key => {
        const frameName = SupplyChest.CHEST_FRAME_NAMES[key];
        const frame = frameMap.get(frameName) || null;
        if (!frame) {
          console.warn(`[SupplyChest] Missing chest sprite frame: ${frameName}`);
        }
        SupplyChest._spriteCache[key] = frame;
      });
      SupplyChest._loadedAll = true;

      SupplyChest._instances.forEach(instance => {
        if (!instance._visualSprite?.isValid) return;
        const key = instance._currentVisualKey || instance._getVisualKey();
        const frame = SupplyChest._spriteCache[key];
        if (frame) {
          instance._visualSprite.spriteFrame = frame;
        }
      });
    });
  }

  get dead(): boolean {
    return this._dead;
  }

  get x(): number {
    return this._x;
  }

  get y(): number {
    return this._y;
  }

  get radius(): number {
    return this._radius;
  }

  get hpRatio(): number {
    if (this._maxHp <= 0) return 0;
    return Math.max(0, Math.min(1, this._hp / this._maxHp));
  }

  get quality(): SupplyChestQuality {
    return this._quality;
  }

  get reachedRail(): boolean {
    return this._reachedRail;
  }

  get atk(): number {
    return this._atk;
  }

  get serial(): number {
    return this._serial;
  }
}
