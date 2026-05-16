/**
 * SupplyChest.ts - 战斗中可击毁的补给宝箱
 */

import { _decorator, Color, Component, Graphics, Label, Node, UITransform, UIOpacity, Vec3 } from 'cc';
import { SupplyChestQuality, SupplyChestType } from '../data/GameConfig';

const { ccclass } = _decorator;

@ccclass('SupplyChest')
export class SupplyChest extends Component {
  private _type: SupplyChestType = 'firepower';
  private _quality: SupplyChestQuality = 'normal';
  private _x: number = 0;
  private _y: number = 0;
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
  private _graphics: Graphics | null = null;
  private _label: Label | null = null;
  private _hpLabel: Label | null = null;
  private _opacity: UIOpacity | null = null;
  private _flashTimer: number = 0;

  onLoad(): void {
    const transform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
    transform.setAnchorPoint(0.5, 0.5);
    this._graphics = this.node.getComponent(Graphics) || this.node.addComponent(Graphics);
    this._opacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);

    const titleNode = new Node('ChestTitle');
    const titleTransform = titleNode.addComponent(UITransform);
    titleTransform.setContentSize(180, 32);
    titleNode.setPosition(0, 8, 0);
    this._label = titleNode.addComponent(Label);
    this._label.fontSize = 22;
    this._label.lineHeight = 24;
    this._label.horizontalAlign = Label.HorizontalAlign.CENTER;
    this._label.verticalAlign = Label.VerticalAlign.CENTER;
    this.node.addChild(titleNode);

    const hpNode = new Node('ChestHp');
    const hpTransform = hpNode.addComponent(UITransform);
    hpTransform.setContentSize(180, 24);
    hpNode.setPosition(0, -18, 0);
    this._hpLabel = hpNode.addComponent(Label);
    this._hpLabel.fontSize = 16;
    this._hpLabel.lineHeight = 18;
    this._hpLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this._hpLabel.verticalAlign = Label.VerticalAlign.CENTER;
    this.node.addChild(hpNode);
  }

  init(
    type: SupplyChestType,
    quality: SupplyChestQuality,
    x: number,
    y: number,
    hp: number,
    radius: number,
    speed: number,
    atk: number,
    attackRate: number
  ): void {
    this._type = type;
    this._quality = quality;
    this._x = x;
    this._y = y;
    this._radius = radius;
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
    this.node.active = true;
    this.node.setPosition(x, y, 0);
    const transform = this.node.getComponent(UITransform);
    transform?.setContentSize(radius * 2 + 42, radius * 2 + 48);
    if (this._opacity) this._opacity.opacity = 255;
    this._refreshView();
  }

  updateChest(dt: number): void {
    if (this._battleFrozen) return;
    if (this._dead) return;
    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
    }
    if (this._freezeTimer > 0) {
      this._freezeTimer = Math.max(0, this._freezeTimer - dt);
      this._refreshView();
      return;
    }
    if (!this._reachedRail) {
      this._y -= this._speed * dt;
      if (this._y <= -510) {
        this._y = -510;
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

  tryAttack(dt: number): boolean {
    if (this._dead || this._battleFrozen || !this._reachedRail || this._freezeTimer > 0) return false;
    this._attackTimer += dt;
    if (this._attackTimer < 1 / this._attackRate) return false;
    this._attackTimer = 0;
    this._flashTimer = 0.12;
    return true;
  }

  private _refreshView(): void {
    if (!this._graphics) return;

    const bodyColor = this._getBodyColor();
    const strokeColor = this._getStrokeColor();
    const textColor = this._getTextColor();
    const flashBoost = this._flashTimer > 0 ? 30 : 0;

    this._graphics.clear();
    this._graphics.fillColor = new Color(
      Math.min(255, bodyColor.r + flashBoost),
      Math.min(255, bodyColor.g + flashBoost),
      Math.min(255, bodyColor.b + flashBoost),
      235
    );
    this._graphics.roundRect(-this._radius, -this._radius, this._radius * 2, this._radius * 2, 12);
    this._graphics.fill();
    this._graphics.strokeColor = strokeColor;
    this._graphics.lineWidth = this._quality === 'rare' ? 5 : this._quality === 'elite' ? 4 : 3;
    this._graphics.roundRect(-this._radius, -this._radius, this._radius * 2, this._radius * 2, 12);
    this._graphics.stroke();

    this._graphics.fillColor = new Color(255, 255, 255, 70);
    this._graphics.rect(-this._radius + 8, 2, this._radius * 2 - 16, 10);
    this._graphics.fill();

    const ratio = this.hpRatio;
    this._graphics.fillColor = textColor;
    this._graphics.rect(-this._radius + 8, 2, (this._radius * 2 - 16) * ratio, 10);
    this._graphics.fill();

    if (this._label) {
      this._label.string = this._getTitle();
      this._label.color = textColor;
    }
    if (this._hpLabel) {
      this._hpLabel.string = `${Math.ceil(this._hp)}/${Math.ceil(this._maxHp)}`;
      this._hpLabel.color = new Color(240, 244, 255, 220);
    }
  }

  private _getTitle(): string {
    const typeLabel: Record<SupplyChestType, string> = {
      firepower: '火力箱',
      survival: '生存箱',
      control: '控制箱',
      resource: '资源箱',
      rare: '稀有箱',
    };
    const qualityLabel: Record<SupplyChestQuality, string> = {
      normal: '普通',
      elite: '精英',
      rare: '稀有',
    };
    return `${qualityLabel[this._quality]}${typeLabel[this._type]}`;
  }

  private _getBodyColor(): Color {
    const colors: Record<SupplyChestType, Color> = {
      firepower: new Color(129, 47, 28),
      survival: new Color(41, 96, 68),
      control: new Color(55, 73, 148),
      resource: new Color(112, 84, 24),
      rare: new Color(92, 52, 122),
    };
    return colors[this._type].clone();
  }

  private _getStrokeColor(): Color {
    if (this._quality === 'rare') return new Color(244, 207, 255, 255);
    if (this._quality === 'elite') return new Color(255, 225, 130, 255);
    return new Color(220, 230, 240, 220);
  }

  private _getTextColor(): Color {
    if (this._quality === 'rare') return new Color(236, 196, 255, 255);
    if (this._quality === 'elite') return new Color(255, 214, 110, 255);
    return new Color(210, 230, 255, 255);
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

  get chestType(): SupplyChestType {
    return this._type;
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
}
