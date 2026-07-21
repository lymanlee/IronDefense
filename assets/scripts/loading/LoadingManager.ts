import { _decorator, assetManager, AssetManager, Color, Component, director, Graphics, Label, Node, resources, Sprite, SpriteFrame, UITransform } from 'cc';
const { ccclass } = _decorator;

type RemoteBundleName = 'game' | 'battle' | 'audio';

@ccclass('LoadingManager')
export class LoadingManager extends Component {
  private static readonly REMOTE_BUNDLES: RemoteBundleName[] = ['game', 'battle', 'audio'];
  private static readonly ROOT_WIDTH = 720;
  private static readonly ROOT_HEIGHT = 1280;
  private static readonly PROGRESS_BAR_WIDTH = 480;
  private static readonly PROGRESS_BAR_HEIGHT = 18;
  private static readonly LOCAL_BG_PATH = 'loading/remote-loading-bg/spriteFrame';

  private _gameBundle: AssetManager.Bundle | null = null;
  private _progressLabel: Label | null = null;
  private _statusLabel: Label | null = null;
  private _progressGraphics: Graphics | null = null;

  start(): void {
    this._createLoadingUI();
    this._setProgress(0.02, '初始化资源加载器...');
    this._loadRemoteBundles(0);
  }

  private _createLoadingUI(): void {
    const canvas = director.getScene()?.getChildByName('Canvas');
    if (!canvas) return;

    const root = new Node('LoadingRoot');
    canvas.addChild(root);
    const rootTransform = root.addComponent(UITransform);
    rootTransform.setContentSize(LoadingManager.ROOT_WIDTH, LoadingManager.ROOT_HEIGHT);

    const bg = root.addComponent(Graphics);
    bg.clear();
    bg.fillColor = new Color(5, 14, 18, 255);
    bg.rect(
      -LoadingManager.ROOT_WIDTH / 2,
      -LoadingManager.ROOT_HEIGHT / 2,
      LoadingManager.ROOT_WIDTH,
      LoadingManager.ROOT_HEIGHT
    );
    bg.fill();

    this._loadLocalBackground(root);

    const overlayNode = new Node('BackgroundOverlay');
    root.addChild(overlayNode);
    const overlayTransform = overlayNode.addComponent(UITransform);
    overlayTransform.setContentSize(LoadingManager.ROOT_WIDTH, LoadingManager.ROOT_HEIGHT);
    const overlay = overlayNode.addComponent(Graphics);
    overlay.fillColor = new Color(4, 12, 16, 128);
    overlay.rect(
      -LoadingManager.ROOT_WIDTH / 2,
      -LoadingManager.ROOT_HEIGHT / 2,
      LoadingManager.ROOT_WIDTH,
      LoadingManager.ROOT_HEIGHT
    );
    overlay.fill();

    const titleNode = new Node('TitleLabel');
    root.addChild(titleNode);
    titleNode.setPosition(0, 130, 0);
    const titleTransform = titleNode.addComponent(UITransform);
    titleTransform.setContentSize(620, 64);
    const title = titleNode.addComponent(Label);
    title.string = '钢铁防线';
    title.fontSize = 46;
    title.lineHeight = 56;
    title.isBold = true;
    title.color = new Color(234, 243, 232, 255);
    title.horizontalAlign = Label.HorizontalAlign.CENTER;
    title.verticalAlign = Label.VerticalAlign.CENTER;

    const subTitleNode = new Node('SubTitleLabel');
    root.addChild(subTitleNode);
    subTitleNode.setPosition(0, 72, 0);
    const subTitleTransform = subTitleNode.addComponent(UITransform);
    subTitleTransform.setContentSize(620, 40);
    const subTitle = subTitleNode.addComponent(Label);
    subTitle.string = '远程资源加载中';
    subTitle.fontSize = 22;
    subTitle.lineHeight = 28;
    subTitle.color = new Color(142, 174, 159, 255);
    subTitle.horizontalAlign = Label.HorizontalAlign.CENTER;
    subTitle.verticalAlign = Label.VerticalAlign.CENTER;

    const barBgNode = new Node('ProgressBarBg');
    root.addChild(barBgNode);
    barBgNode.setPosition(0, -30, 0);
    const barBgTransform = barBgNode.addComponent(UITransform);
    barBgTransform.setContentSize(LoadingManager.PROGRESS_BAR_WIDTH, LoadingManager.PROGRESS_BAR_HEIGHT);
    const barBg = barBgNode.addComponent(Graphics);
    barBg.fillColor = new Color(27, 43, 47, 255);
    barBg.roundRect(
      -LoadingManager.PROGRESS_BAR_WIDTH / 2,
      -LoadingManager.PROGRESS_BAR_HEIGHT / 2,
      LoadingManager.PROGRESS_BAR_WIDTH,
      LoadingManager.PROGRESS_BAR_HEIGHT,
      LoadingManager.PROGRESS_BAR_HEIGHT / 2
    );
    barBg.fill();

    const barFillNode = new Node('ProgressBarFill');
    root.addChild(barFillNode);
    barFillNode.setPosition(0, -30, 0);
    const barFillTransform = barFillNode.addComponent(UITransform);
    barFillTransform.setContentSize(LoadingManager.PROGRESS_BAR_WIDTH, LoadingManager.PROGRESS_BAR_HEIGHT);
    this._progressGraphics = barFillNode.addComponent(Graphics);

    const progressNode = new Node('ProgressLabel');
    root.addChild(progressNode);
    progressNode.setPosition(0, -78, 0);
    const progressTransform = progressNode.addComponent(UITransform);
    progressTransform.setContentSize(480, 32);
    this._progressLabel = progressNode.addComponent(Label);
    this._progressLabel.fontSize = 22;
    this._progressLabel.lineHeight = 28;
    this._progressLabel.color = new Color(226, 234, 219, 255);
    this._progressLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this._progressLabel.verticalAlign = Label.VerticalAlign.CENTER;

    const statusNode = new Node('StatusLabel');
    root.addChild(statusNode);
    statusNode.setPosition(0, -124, 0);
    const statusTransform = statusNode.addComponent(UITransform);
    statusTransform.setContentSize(620, 40);
    this._statusLabel = statusNode.addComponent(Label);
    this._statusLabel.fontSize = 18;
    this._statusLabel.lineHeight = 24;
    this._statusLabel.color = new Color(111, 139, 129, 255);
    this._statusLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this._statusLabel.verticalAlign = Label.VerticalAlign.CENTER;
  }

  private _loadLocalBackground(root: Node): void {
    const bgNode = new Node('BackgroundImage');
    root.addChild(bgNode);
    const bgTransform = bgNode.addComponent(UITransform);
    bgTransform.setContentSize(LoadingManager.ROOT_WIDTH, LoadingManager.ROOT_HEIGHT);
    const bgSprite = bgNode.addComponent(Sprite);
    bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;

    resources.load(LoadingManager.LOCAL_BG_PATH, SpriteFrame, (err, spriteFrame) => {
      if (err || !spriteFrame) {
        console.warn('[LoadingManager] load local loading background failed:', err);
        return;
      }
      bgSprite.spriteFrame = spriteFrame;
    });
  }

  private _setProgress(progress: number, status: string): void {
    const clamped = Math.max(0, Math.min(1, progress));
    if (this._progressLabel) {
      this._progressLabel.string = `${Math.round(clamped * 100)}%`;
    }
    if (this._statusLabel) {
      this._statusLabel.string = status;
    }
    if (this._progressGraphics) {
      const width = LoadingManager.PROGRESS_BAR_WIDTH * clamped;
      this._progressGraphics.clear();
      this._progressGraphics.fillColor = new Color(220, 153, 59, 255);
      this._progressGraphics.roundRect(
        -LoadingManager.PROGRESS_BAR_WIDTH / 2,
        -LoadingManager.PROGRESS_BAR_HEIGHT / 2,
        width,
        LoadingManager.PROGRESS_BAR_HEIGHT,
        LoadingManager.PROGRESS_BAR_HEIGHT / 2
      );
      this._progressGraphics.fill();
    }
  }

  private _loadRemoteBundles(index: number): void {
    if (index >= LoadingManager.REMOTE_BUNDLES.length) {
      this._loadRemoteMainScene();
      return;
    }

    const bundleName = LoadingManager.REMOTE_BUNDLES[index];
    const baseProgress = index / (LoadingManager.REMOTE_BUNDLES.length + 1);
    this._setProgress(baseProgress, `加载资源包 ${bundleName}...`);

    assetManager.loadBundle(bundleName, (err, bundle) => {
      if (err || !bundle) {
        console.warn(`[LoadingManager] load remote bundle ${bundleName} failed:`, err);
        this._setProgress(baseProgress, `资源包 ${bundleName} 加载失败，2 秒后重试...`);
        this.scheduleOnce(() => this._loadRemoteBundles(index), 2);
        return;
      }

      if (bundleName === 'game') {
        this._gameBundle = bundle;
      }
      this._setProgress((index + 1) / (LoadingManager.REMOTE_BUNDLES.length + 1), `资源包 ${bundleName} 已就绪`);
      this._loadRemoteBundles(index + 1);
    });
  }

  private _loadRemoteMainScene(): void {
    if (!this._gameBundle) {
      this._setProgress(0.75, '主资源包未就绪，正在重试...');
      this.scheduleOnce(() => this._loadRemoteBundles(0), 2);
      return;
    }

    const sceneBaseProgress = 0.75;
    this._setProgress(sceneBaseProgress, '加载主场景...');
    this._gameBundle.loadScene(
      'MainScene',
      (finished, total) => {
        const sceneProgress = total > 0 ? finished / total : 0;
        this._setProgress(sceneBaseProgress + sceneProgress * 0.24, '加载主场景...');
      },
      (err, sceneAsset) => {
        if (err || !sceneAsset) {
          console.warn('[LoadingManager] load MainScene failed:', err);
          this._setProgress(sceneBaseProgress, '主场景加载失败，2 秒后重试...');
          this.scheduleOnce(() => this._loadRemoteMainScene(), 2);
          return;
        }
        this._setProgress(1, '进入游戏...');
        director.runScene(sceneAsset);
      }
    );
  }
}
