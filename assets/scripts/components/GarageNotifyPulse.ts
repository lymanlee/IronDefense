import { _decorator, Color, Component, Graphics, Mask, Node, tween, Tween, UIOpacity, UITransform } from 'cc';

const { ccclass } = _decorator;

@ccclass('GarageNotifyPulse')
export class GarageNotifyPulse extends Component {
  private _shineNode: Node | null = null;
  private _shineDriver: { t: number } = { t: 0 };

  onEnable(): void {
    this.play();
  }

  onDisable(): void {
    this.stop();
  }

  play(): void {
    if (!this.node.isValid || !this.node.activeInHierarchy) return;

    const shineNode = this._ensureShineNode();
    const shineOpacity = shineNode ? this._ensureOpacity(shineNode) : null;
    if (!shineNode || !shineOpacity) return;

    Tween.stopAllByTarget(this._shineDriver);
    Tween.stopAllByTarget(shineNode);
    Tween.stopAllByTarget(shineOpacity);
    this._shineDriver.t = 0;
    this._applyShineFrame(this._shineDriver.t);

    tween(this._shineDriver)
      .delay(0.18)
      .to(0.34, { t: 1 }, {
        easing: 'quadOut',
        onUpdate: () => {
          this._applyShineFrame(this._shineDriver.t);
        },
      })
      .delay(1.05)
      .call(() => {
        this._shineDriver.t = 0;
        this._applyShineFrame(this._shineDriver.t);
      })
      .union()
      .repeatForever()
      .start();
  }

  stop(): void {
    Tween.stopAllByTarget(this._shineDriver);
    this._shineDriver.t = 0;
    this._applyShineFrame(0);
  }

  private _applyShineFrame(t: number): void {
    const shineNode = this._shineNode;
    if (!shineNode?.isValid) return;

    const shineOpacity = this._ensureOpacity(shineNode);
    shineNode.setPosition(-16 + 32 * t, 8 - 16 * t, 0);
    shineOpacity.opacity = Math.round(Math.max(0, Math.sin(t * Math.PI)) * 210);
  }

  private _ensureShineNode(): Node | null {
    if (this._shineNode?.isValid) {
      return this._shineNode;
    }

    const existingMask = this.node.getChildByName('NotifyShineMask');
    const existingShine = existingMask?.getChildByName('NotifyShine') || null;
    if (existingShine?.isValid) {
      this._shineNode = existingShine;
      return this._shineNode;
    }

    const maskNode = new Node('NotifyShineMask');
    const maskTransform = maskNode.addComponent(UITransform);
    maskTransform.setContentSize(20, 20);
    const mask = maskNode.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_ELLIPSE;
    maskNode.setPosition(0, 0, 0);
    this.node.addChild(maskNode);

    const shineNode = new Node('NotifyShine');
    const transform = shineNode.addComponent(UITransform);
    transform.setContentSize(18, 28);
    const graphics = shineNode.addComponent(Graphics);
    const opacity = shineNode.addComponent(UIOpacity);
    opacity.opacity = 0;

    graphics.fillColor = new Color(255, 255, 255, 36);
    graphics.rect(-7, -14, 4, 28);
    graphics.fill();
    graphics.fillColor = new Color(255, 255, 255, 108);
    graphics.rect(-3, -14, 4, 28);
    graphics.fill();
    graphics.fillColor = new Color(255, 255, 255, 198);
    graphics.rect(1, -14, 3, 28);
    graphics.fill();
    graphics.fillColor = new Color(255, 255, 255, 72);
    graphics.rect(4, -14, 3, 28);
    graphics.fill();

    shineNode.angle = -28;
    shineNode.setPosition(-16, 8, 0);
    maskNode.addChild(shineNode);

    this._shineNode = shineNode;
    return shineNode;
  }

  private _ensureOpacity(node: Node): UIOpacity {
    return node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
  }
}
