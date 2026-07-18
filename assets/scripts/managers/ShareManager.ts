/**
 * ShareManager.ts - 微信分享管理（单例）
 *
 * 背景：微信小游戏右上角「···」菜单里的「转发给朋友 / 分享到朋友圈」默认是禁用（灰色）的，
 * 必须游戏主动调用 wx.showShareMenu 声明后才会点亮，并配合 onShareAppMessage /
 * onShareTimeline 提供分享内容。
 *
 * 用法：在游戏启动处调用一次 ShareManager.instance.init() 即可。
 * 平台隔离：非微信环境（H5 等）没有 globalThis.wx，全部 API 调用会安全跳过，不影响其它平台。
 */

import { GameConfig } from '../data/GameConfig';

interface ApprovedImage {
  imageUrlId: string; // 审核通过的图片编号（MP 后台「分享图片」审核通过后下发）
  imageUrl: string;   // 审核通过的图片地址（与编号成对，缺一不可）
}

interface ShareContent {
  title: string;
  imageUrl?: string;   // 普通链接（未审核）或审核通过地址；不填时微信默认截取当前游戏画面
  imageUrlId?: string; // 审核通过的图片编号（与 imageUrl 成对使用）
  query?: string;
}

export class ShareManager {
  private static _instance: ShareManager | null = null;

  static get instance(): ShareManager {
    if (!this._instance) {
      this._instance = new ShareManager();
    }
    return this._instance;
  }

  private _inited: boolean = false;

  // 转发给朋友 / 群 的默认分享内容
  private _appMessage: ShareContent = {
    title: '桥防守卫｜驾驶战车死守废土防线，来一起守城！',
    query: 'from=share',
  };

  // 分享到朋友圈 的默认分享内容
  private _timeline: ShareContent = {
    title: '桥防守卫｜废土机甲塔防射击，你能守到第几波？',
    query: 'from=timeline',
  };

  /** 普通分享图链接数组（兜底通道：仅当无审核图时回退使用；来自 GameConfig.share.images） */
  private _images: string[] = [];

  /** 审核通过的分享图数组（来自 GameConfig.share.approvedImages），每项为 { imageUrlId, imageUrl } 成对 */
  private _approvedImages: ApprovedImage[] = [];

  constructor() {
    // 初始化时从全局配置载入分享图列表（过滤掉无效项）
    try {
      const cfg = (GameConfig as any).share;
      if (cfg) {
        if (Array.isArray(cfg.images)) {
          this._images = cfg.images.filter(
            (x: unknown) => typeof x === 'string' && x.trim().length > 0,
          );
        }
        if (Array.isArray(cfg.approvedImages)) {
          this._approvedImages = cfg.approvedImages.filter(
            (x: any) =>
              x && typeof x.imageUrlId === 'string' && typeof x.imageUrl === 'string',
          );
        }
      }
    } catch (err) {
      // 配置缺失不影响主流程
      this._images = [];
      this._approvedImages = [];
    }
  }

  /**
   * 初始化分享能力：点亮系统菜单里的转发 / 分享朋友圈按钮，并注册分享内容回调。
   * 可安全重复调用，仅首次生效。
   */
  init(): void {
    if (this._inited) return;

    const wxApi = (globalThis as any).wx;
    if (!wxApi || typeof wxApi.showShareMenu !== 'function') {
      // 非微信环境（H5 / 编辑器预览等），直接跳过
      return;
    }

    // 点亮系统菜单：同时声明转发与分享朋友圈
    try {
      wxApi.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    } catch (err) {
      console.warn('[ShareManager] showShareMenu 调用失败:', err);
    }

    // 转发给朋友 / 群
    if (typeof wxApi.onShareAppMessage === 'function') {
      wxApi.onShareAppMessage(() => this._buildShareContent(this._appMessage));
    }

    // 分享到朋友圈（需在小游戏后台开通「分享朋友圈」能力，且仅真机生效）
    if (typeof wxApi.onShareTimeline === 'function') {
      wxApi.onShareTimeline(() => this._buildShareContent(this._timeline));
    }

    this._inited = true;
    console.log(
      `[ShareManager] 微信分享菜单已启用（审核图 ${this._approvedImages.length} 张 / 普通图 ${this._images.length} 张，审核图优先）`,
    );
  }

  /** 更新「转发给朋友」的分享文案 / 图片 */
  setAppMessage(content: Partial<ShareContent>): void {
    this._appMessage = { ...this._appMessage, ...content };
  }

  /** 更新「分享到朋友圈」的分享文案 / 图片 */
  setTimeline(content: Partial<ShareContent>): void {
    this._timeline = { ...this._timeline, ...content };
  }

  /** 覆盖普通链接图数组（运行时可调用）；传空数组则回退微信默认截图 */
  setImages(images: string[]): void {
    this._images = Array.isArray(images)
      ? images.filter((x) => typeof x === 'string' && x.trim().length > 0)
      : [];
  }

  /** 覆盖审核通过的分享图数组（运行时可调用）；每项为 { imageUrlId, imageUrl } 成对 */
  setApprovedImages(images: ApprovedImage[]): void {
    this._approvedImages = Array.isArray(images)
      ? images.filter(
          (x) => x && typeof x.imageUrlId === 'string' && typeof x.imageUrl === 'string',
        )
      : [];
  }

  /** 选一张分享图载体：审核图优先，无审核图时回退普通链接；都为空返回 undefined（微信用默认截图） */
  private _pickImage(): { imageUrl?: string; imageUrlId?: string } | undefined {
    // 优先级：审核图（朋友圈可靠、免域名）> 普通链接（本地图/网络图）> 微信默认截图
    const pool: Array<{ imageUrl?: string; imageUrlId?: string }> =
      this._approvedImages.length > 0
        ? this._approvedImages.map((a) => ({ imageUrl: a.imageUrl, imageUrlId: a.imageUrlId }))
        : this._images.map((u) => ({ imageUrl: u }));
    if (pool.length === 0) return undefined;
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  }

  /**
   * 主动拉起「转发给朋友」面板（可绑定到游戏内自绘分享按钮）。
   * 系统菜单入口不需要调用此方法，微信会自动回调 onShareAppMessage。
   */
  shareToFriend(content?: Partial<ShareContent>): void {
    const wxApi = (globalThis as any).wx;
    if (!wxApi || typeof wxApi.shareAppMessage !== 'function') return;
    const merged = content ? { ...this._appMessage, ...content } : this._appMessage;
    wxApi.shareAppMessage(this._buildShareContent(merged));
  }

  private _buildShareContent(content: ShareContent): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      title: content.title,
      query: content.query || '',
    };
    // 优先用显式指定的图（setAppMessage/setTimeline 传入）；否则每次分享随机选一张配置图
    const picked =
      content.imageUrl || content.imageUrlId
        ? { imageUrl: content.imageUrl, imageUrlId: content.imageUrlId }
        : this._pickImage();
    if (picked?.imageUrl) payload.imageUrl = picked.imageUrl;
    if (picked?.imageUrlId) payload.imageUrlId = picked.imageUrlId;
    return payload;
  }
}
