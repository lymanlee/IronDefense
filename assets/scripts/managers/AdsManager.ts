/**
 * AdsManager.ts - 广告占位与后续微信广告接入适配层
 * 当前默认使用 3 秒模拟观看，所有广告触点通过 placement 语义调用。
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
    const wxApi = (globalThis as any).wx;
    if (provider === 'wechat' && wxApi && config.adUnitId) {
      return this._showWechatRewarded(config.adUnitId);
    }

    return this._showSimulatedAd(config.title || '模拟广告');
  }

  async showInterstitial(placement: InterstitialAdPlacement): Promise<boolean> {
    const config = GameConfig.ads.interstitial;
    if (!config.enabled) return false;

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

    const wxApi = (globalThis as any).wx;
    if (GameConfig.ads.provider === 'wechat' && wxApi && config.adUnitId) {
      // 后续真机接入时在这里创建 wx.createBannerAd，并根据 safe area 调整位置。
      return;
    }

    this.hideBanner();
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
  }

  hideBanner(): void {
    if (this._bannerNode?.isValid) {
      this._bannerNode.destroy();
    }
    this._bannerNode = null;
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
