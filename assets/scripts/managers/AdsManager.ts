/**
 * AdsManager.ts - 广告管理（免费 / 模拟 / 微信三模式）
 * free 模式：生产过渡模式，不展示广告，直接发放奖励
 * simulated 模式：本地 3 秒模拟观看，用于开发调试
 * wechat 模式：调用 wx 广告 API，用于微信小游戏真机上线
 * 所有广告触点通过 placement 语义调用，切换模式只需改 GameConfig.ads.provider
 */

import { Node, director, UITransform, Label, Color, Graphics, BlockInputEvents } from 'cc';
import { GameConfig } from '../data/GameConfig';

export type RewardedAdPlacement = 'revive' | 'supply' | 'doubleReward';
export type InterstitialAdPlacement = 'returnMenu' | 'gameOver' | 'waveBreak';
export type BannerPlacement = 'start' | 'supply' | 'gameOver';

interface RewardedConfig {
  enabled: boolean;
  adUnitId: string;
  title: string;
}

export class AdsManager {
  private static _instance: AdsManager | null = null;

  static get instance(): AdsManager {
    if (!this._instance) {
      this._instance = new AdsManager();
    }
    return this._instance;
  }

  private _root: Node | null = null;
  private _bannerNode: Node | null = null;
  private _ownsBannerNode: boolean = false;
  private _wechatBannerAd: any | null = null;
  private _activeAdNode: Node | null = null;
  private _lastInterstitialAt: number = -Infinity;
  private _runStartedAt: number = 0;

  init(root?: Node | null): void {
    this._root = root || this._findDefaultRoot();
  }

  markRunStart(): void {
    this._runStartedAt = Date.now() / 1000;
  }

  async showRewarded(placement: RewardedAdPlacement): Promise<boolean> {
    const config = (GameConfig.ads.rewarded as Record<RewardedAdPlacement, RewardedConfig>)[placement];
    if (!config || !config.enabled) return false;

    const provider = GameConfig.ads.provider;
    if (provider === 'free') return true;

    const wxApi = (globalThis as any).wx;
    if (provider === 'wechat' && wxApi && config.adUnitId) {
      return this._showWechatRewarded(config.adUnitId);
    }

    return this._showSimulatedAd(config.title || '模拟广告');
  }

  async showInterstitial(placement: InterstitialAdPlacement): Promise<boolean> {
    const config = GameConfig.ads.interstitial;
    if (!config.enabled) return false;
    if (GameConfig.ads.provider === 'free') return false;

    const now = Date.now() / 1000;
    if (now - this._runStartedAt < config.minRunTimeSec) return false;
    if (now - this._lastInterstitialAt < config.cooldownSec) return false;

    this._lastInterstitialAt = now;
    const wxApi = (globalThis as any).wx;
    if (GameConfig.ads.provider === 'wechat' && wxApi && config.adUnitId) {
      return this._showWechatInterstitial(config.adUnitId);
    }

    return this._showSimulatedAd(`模拟插屏广告: ${placement}`);
  }

  showBanner(placement: BannerPlacement): void {
    const config = GameConfig.ads.banner;
    if (!config.enabled) return;
    if (GameConfig.ads.provider === 'free') {
      this.hideBanner();
      return;
    }

    const wxApi = (globalThis as any).wx;
    if (GameConfig.ads.provider === 'wechat' && wxApi && config.adUnitId) {
      this._showWechatBanner(config.adUnitId);
      return;
    }

    this.hideBanner();
    const configuredNode = this._findConfiguredBannerNode(placement);
    if (configuredNode) {
      this._bannerNode = configuredNode;
      this._ownsBannerNode = false;
      this._applyBannerLabel(configuredNode, placement);
      configuredNode.active = true;
      return;
    }

    const root = this._getRoot();
    if (!root) return;

    const banner = new Node(`SimBanner_${placement}`);
    const transform = banner.addComponent(UITransform);
    transform.setContentSize(560, 72);
    banner.setPosition(0, -560, 0);

    const graphics = banner.addComponent(Graphics);
    graphics.fillColor = new Color(20, 24, 32, 230);
    graphics.roundRect(-280, -36, 560, 72, 10);
    graphics.fill();
    graphics.strokeColor = new Color(255, 210, 92, 180);
    graphics.lineWidth = 2;
    graphics.roundRect(-280, -36, 560, 72, 10);
    graphics.stroke();

    const label = this._createLabel('BannerLabel', `广告位预留: ${placement}`, 24, new Color(255, 232, 150));
    label.setPosition(0, 0, 0);
    banner.addChild(label);

    root.addChild(banner);
    this._bannerNode = banner;
    this._ownsBannerNode = true;
  }

  hideBanner(): void {
    // 微信模式：destroy 原生 Banner 实例
    if (this._wechatBannerAd) {
      this._wechatBannerAd.destroy?.();
      this._wechatBannerAd = null;
      return;
    }

    // 模拟模式：移除或隐藏 Banner 节点
    if (this._bannerNode?.isValid) {
      if (this._ownsBannerNode) {
        this._bannerNode.destroy();
      } else {
        this._bannerNode.active = false;
      }
    }
    this._bannerNode = null;
    this._ownsBannerNode = false;
  }

  private async _showWechatRewarded(adUnitId: string): Promise<boolean> {
    const wxApi = (globalThis as any).wx;
    if (!wxApi?.createRewardedVideoAd) return false;

    return new Promise<boolean>((resolve) => {
      const ad = wxApi.createRewardedVideoAd({ adUnitId });
      const cleanup = () => {
        ad.offClose?.(onClose);
        ad.offError?.(onError);
      };
      const onClose = (res: any) => {
        cleanup();
        resolve(res?.isEnded || res === undefined);
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };

      ad.onClose?.(onClose);
      ad.onError?.(onError);
      ad.show?.().catch(() => {
        ad.load?.()
          .then(() => ad.show())
          .catch(onError);
      });
    });
  }

  private async _showWechatInterstitial(adUnitId: string): Promise<boolean> {
    const wxApi = (globalThis as any).wx;
    if (!wxApi?.createInterstitialAd) return false;

    return new Promise<boolean>((resolve) => {
      const ad = wxApi.createInterstitialAd({ adUnitId });
      const done = () => resolve(true);
      const fail = () => resolve(false);
      ad.onClose?.(done);
      ad.onError?.(fail);
      ad.show?.().catch(fail);
    });
  }

  /** 微信小游戏 Banner 广告：创建并定位到屏幕底部居中 */
  private _showWechatBanner(adUnitId: string): void {
    const wxApi = (globalThis as any).wx;
    if (!wxApi?.createBannerAd) return;

    // 先销毁旧实例（每次 createBannerAd 都返回新实例，需避免泄漏）
    if (this._wechatBannerAd) {
      this._wechatBannerAd.destroy?.();
      this._wechatBannerAd = null;
    }

    // 获取屏幕信息用于定位
    const sysInfo = wxApi.getSystemInfoSync?.() || {};
    const screenWidth: number = sysInfo.screenWidth || 720;
    const screenHeight: number = sysInfo.screenHeight || 1280;
    const safeArea: { bottom?: number } = sysInfo.safeArea || {};

    // 创建 Banner 广告实例，初始宽度设为屏幕宽度
    const bannerAd = wxApi.createBannerAd({
      adUnitId,
      style: {
        left: 0,
        top: screenHeight - 100,  // 临时位置，onResize 后修正
        width: screenWidth,
      },
    });

    // onResize：根据实际尺寸居中定位到屏幕底部
    const onResize = (size: { width: number; height: number }) => {
      if (!bannerAd) return;
      bannerAd.style.left = (screenWidth - size.width) / 2;
      bannerAd.style.top = screenHeight - size.height - (safeArea.bottom || 0);
    };
    bannerAd.onResize?.(onResize);

    // onError：加载失败时销毁实例并清空引用
    const onError = () => {
      bannerAd.offResize?.(onResize);
      bannerAd.offError?.(onError);
      bannerAd.destroy?.();
      if (this._wechatBannerAd === bannerAd) {
        this._wechatBannerAd = null;
      }
    };
    bannerAd.onError?.(onError);

    // 保存实例引用（用于 hideBanner destroy）
    this._wechatBannerAd = bannerAd;

    // 显示 Banner
    bannerAd.show?.().catch(() => {
      // show 失败时不立即销毁，保留实例以便后续 retry
      // 真实场景中可在此处做静默降级（如延迟重试）
    });
  }

  private _showSimulatedAd(title: string): Promise<boolean> {
    const root = this._getRoot();
    if (!root) return Promise.resolve(true);

    if (this._activeAdNode?.isValid) {
      this._activeAdNode.destroy();
    }

    const seconds = Math.max(1, GameConfig.ads.simulateSeconds);
    const overlay = this._createOverlay('SimulatedAdOverlay');
    const titleNode = this._createLabel('AdTitle', title, 36, Color.WHITE);
    titleNode.setPosition(0, 80, 0);
    overlay.addChild(titleNode);

    const countdownNode = this._createLabel('Countdown', `${seconds}`, 80, new Color(255, 210, 92));
    countdownNode.setPosition(0, -20, 0);
    overlay.addChild(countdownNode);

    const tipNode = this._createLabel('AdTip', '模拟观看完成后自动发放奖励', 24, new Color(220, 230, 255));
    tipNode.setPosition(0, -120, 0);
    overlay.addChild(tipNode);

    root.addChild(overlay);
    this._activeAdNode = overlay;

    return new Promise<boolean>((resolve) => {
      let remaining = seconds;
      const timer = setInterval(() => {
        remaining--;
        const label = countdownNode.getComponent(Label);
        if (label) label.string = `${Math.max(0, remaining)}`;
        if (remaining <= 0) {
          clearInterval(timer);
          if (overlay.isValid) overlay.destroy();
          if (this._activeAdNode === overlay) this._activeAdNode = null;
          resolve(true);
        }
      }, 1000);
    });
  }

  private _getRoot(): Node | null {
    if (!this._root || !this._root.isValid) {
      this._root = this._findDefaultRoot();
    }
    return this._root;
  }

  private _findDefaultRoot(): Node | null {
    const canvas = director.getScene()?.getChildByName('Canvas');
    return canvas?.getChildByName('Overlay') || canvas || null;
  }

  private _findConfiguredBannerNode(placement: BannerPlacement): Node | null {
    const canvas = director.getScene()?.getChildByName('Canvas');
    if (!canvas) return null;

    const paths: Record<BannerPlacement, string[]> = {
      start: [
        'Overlay/StartScreen/BannerAdSlot',
      ],
      supply: [
        'Overlay/SupplyPanel/BannerAdSlot',
        'Overlay/SupplyPanel/PanelRoot/BannerAdSlot',
      ],
      gameOver: [
        'Overlay/GameOverScreen/BannerAdSlot',
        'Overlay/GameOverScreen/Bg/BannerAdSlot',
      ],
    };

    for (const path of paths[placement]) {
      const node = this._findNodeByPath(canvas, path);
      if (node) return node;
    }
    return null;
  }

  private _findNodeByPath(root: Node, path: string): Node | null {
    const segments = path.split('/').filter(Boolean);
    let current: Node | null = root;
    for (const segment of segments) {
      current = current?.getChildByName(segment) || null;
      if (!current) return null;
    }
    return current;
  }

  private _applyBannerLabel(node: Node, placement: BannerPlacement): void {
    const text = `广告位预留: ${placement}`;
    const selfLabel = node.getComponent(Label);
    if (selfLabel) {
      selfLabel.string = text;
      return;
    }

    const labelNode = node.getChildByName('BannerLabel') || node.getChildByName('Label');
    const label = labelNode?.getComponent(Label) || null;
    if (label) {
      label.string = text;
    }
  }

  private _createOverlay(name: string): Node {
    const overlay = new Node(name);
    const transform = overlay.addComponent(UITransform);
    transform.setContentSize(GameConfig.canvas.width, GameConfig.canvas.height);
    overlay.addComponent(BlockInputEvents);

    const graphics = overlay.addComponent(Graphics);
    graphics.fillColor = new Color(0, 0, 0, 230);
    graphics.rect(-GameConfig.canvas.width / 2, -GameConfig.canvas.height / 2, GameConfig.canvas.width, GameConfig.canvas.height);
    graphics.fill();
    return overlay;
  }

  private _createLabel(name: string, text: string, fontSize: number, color: Color): Node {
    const node = new Node(name);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(GameConfig.canvas.width - 120, 100);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.25);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = color.clone();
    return node;
  }
}
