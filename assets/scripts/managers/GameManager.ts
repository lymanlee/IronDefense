/**
 * GameManager.ts - 游戏管理器（单例）
 * 协调所有游戏系统，主循环，状态机
 */

import { _decorator, Component, Node, instantiate, Prefab, tween, Vec3, Color, Tween, input, Input, KeyCode, director, Sprite, UIOpacity, UITransform, Graphics, Label, Button, SpriteFrame, Vec3 as CcVec3, view } from 'cc';
import { GameConfig, PermanentUpgradeId, SupplyCardStar, SupplyCardType, SupplyChestConfigData, SupplyChestQuality, SupplyChestQualityRuleData, SupplyConfigData, SupplyOptionData, SupplyStarRuleData, WaveData, WaveDefinitionData, WeaponBehavior, WeaponEvolutionData, WeaponEvolutionId } from '../data/GameConfig';
import { WeaponTierSystem } from '../components/WeaponTierSystem';
import { AttackTarget, PlayerCar } from '../components/PlayerCar';
import { Enemy } from '../components/Enemy';
import { Bullet } from '../components/Bullet';
import { SupplyChest } from '../components/SupplyChest';
import { WaveManager } from '../managers/WaveManager';
import { AudioManager } from '../managers/AudioManager';
import { ObjectPool } from '../managers/ObjectPool';
import { AdsManager } from '../managers/AdsManager';
import { ProgressManager, RunReward } from '../managers/ProgressManager';
import { StageManager } from '../managers/StageManager';
import { StartScreen } from '../ui/StartScreen';
import { HUDController } from '../ui/HUDController';
import { GameOverScreen } from '../ui/GameOverScreen';
import { DebugScreen } from '../ui/DebugScreen';
import { GarageScreen } from '../ui/GarageScreen';
import { BundleLoader } from './BundleLoader';

const { ccclass, property } = _decorator;

type GameState = 'start' | 'debug' | 'playing' | 'paused' | 'gameover' | 'victory' | 'revive' | 'supply' | 'ad';
type PreviewEnemyType = 'mixed' | 'normal' | 'shield' | 'runner' | 'suicide' | 'healer' | 'boss_bulldozer' | 'boss_commander';

interface ChestSlotData {
  x: number;
  y: number;
}

type DamageNumberSource = WeaponBehavior | 'shockwave' | 'airstrike';

interface DamageResult {
  killed: boolean;
  appliedDamage: number;
}

interface FloatingTextStyle {
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  outlineWidth: number;
  startOffsetY: number;
  floatDistance: number;
  duration: number;
  startScale: number;
  peakScale: number;
  endScale: number;
}

interface FloatingTextEntry {
  node: Node;
  label: Label;
  opacity: UIOpacity;
  styleKey: string;
  generation: number;
  active: boolean;
  isFinishing: boolean;
  pendingReplay: {
    x: number;
    y: number;
    text: string;
    color: Color;
    styleKey: string;
    style: FloatingTextStyle;
  } | null;
}

interface TargetFloatingTextBinding {
  entry: FloatingTextEntry;
  entryGeneration: number;
  targetToken: number;
  expireAt: number;
}

@ccclass('GameManager')
export class GameManager extends Component {
  private static readonly MAX_ACTIVE_EXPLOSIONS = 14;
  private static readonly MAX_ACTIVE_FLOATING_TEXTS = 50;
  private static readonly AIRSTRIKE_HIT_FX_LIMIT = 8;
  private static readonly AIRSTRIKE_EXPLOSION_FX_LIMIT = 5;
  private static readonly AIRSTRIKE_DAMAGE_DELAY = 0.56;
  private static readonly SHOCKWAVE_HIT_FX_LIMIT = 5;
  private static readonly SHOCKWAVE_DAMAGE_DELAY = 0.54;
  private static readonly AREA_DAMAGE_FX_MIN_SIZE = 92;
  private static readonly AREA_DAMAGE_FX_SIZE_MULTIPLIER = 0.26;
  private static readonly AREA_DAMAGE_FX_SCALE_STAGE_1 = 0.32;
  private static readonly AREA_DAMAGE_FX_SCALE_STAGE_2 = 0.52;
  private static readonly AREA_DAMAGE_FX_SCALE_STAGE_3 = 0.74;
  private static readonly POPUP_SHOW_DURATION = 0.28;
  private static readonly POPUP_HIDE_DURATION = 0.18;

  // 预制体引用（需在编辑器绑定）
  @property(Prefab)
  bulletPrefab: Prefab | null = null;

  @property(Prefab)
  enemyPrefab: Prefab | null = null;

  @property(Prefab)
  supplyChestPrefab: Prefab | null = null;

  @property(Node)
  bulletPoolNode: Node | null = null;

  @property(Node)
  enemiesNode: Node | null = null;

  @property(Node)
  playerCarNode: Node | null = null;

  @property(Node)
  explosionGraphicsNode: Node | null = null;
  private _explosionGraphics: Graphics | null = null;

  // 伤害闪烁效果
  private _damageFlashNode: Node | null = null;
  private _damageFlashOpacity: UIOpacity | null = null;
  private _borderLOpacity: UIOpacity | null = null;
  private _borderROpacity: UIOpacity | null = null;
  private _damageFlashTimer: number = 0;
  private readonly _damageFlashDuration: number = 0.3;
  private readonly _supplyChestRewardDelay: number = 0.32;

  // 游戏状态
  private _state: GameState = 'start';
  private _debugWave: number = 1;
  private _debugTier: number = 1;

  // 系统
  private _weaponTierSystem: WeaponTierSystem | null = null;
  private _waveManager: WaveManager | null = null;
  private _audioManager: AudioManager | null = null;
  private _playerCar: PlayerCar | null = null;
  private _adsManager: AdsManager = AdsManager.instance;
  private _progressManager: ProgressManager = ProgressManager.instance;
  private _stageManager: StageManager = new StageManager();

  // 对象池
  private _bulletPool: ObjectPool<Bullet> | null = null;
  private _enemyPool: ObjectPool<Enemy> | null = null;

  // 游戏数据
  private _bullets: Bullet[] = [];
  private _enemies: Enemy[] = [];
  private _explosions: ExplosionData[] = [];
  private _pulses: PulseVisualData[] = [];
  private _trails: TrailVisualData[] = [];
  private _lightnings: LightningVisualData[] = [];
  private _fragments: FragmentVisualData[] = [];
  private _floatingTextPool: FloatingTextEntry[] = [];
  private _activeFloatingTexts: FloatingTextEntry[] = [];
  private _enemyDamageTextBindings: WeakMap<Enemy, TargetFloatingTextBinding> = new WeakMap();
  private _chestDamageTextBindings: WeakMap<SupplyChest, TargetFloatingTextBinding> = new WeakMap();
  private _areaExplosionFrame: SpriteFrame | null = null;
  private _suppressEnemyKillFx: number = 0;
  private _enemyRenderOrderTimer: number = 0;
  private _kills: number = 0;
  private _reviveUsed: boolean = false;
  private _baseRunReward: RunReward = { coins: 0, parts: 0 };
  private _baseRewardGranted: boolean = false;
  private _doubleRewardClaimed: boolean = false;
  private _runSerial: number = 0;

  // 补给与临时增益
  private _lastSupplyWaveOffered: number = 0;
  private _supplyAdExtrasUsed: number = 0;
  private _damageMultiplier: number = 1;
  private _damageBoostUntilWave: number = 0;
  private _fireRateBoostUntilWave: number = 0;
  private _pendingShieldSeconds: number = 0;
  private _bonusCoinMultiplier: number = 1;
  private _bonusFlatParts: number = 0;
  private _bonusSupplyChoices: number = 0;
  private _bonusAdSupplyCount: number = 0;
  private _projectileSpeedMultiplier: number = 1;
  private _weaponEvolutionId: WeaponEvolutionId | null = null;
  private _previewEnemyType: PreviewEnemyType = 'mixed';
  private _isPreviewMode: boolean = false;
  private _previewMovementLocked: boolean = false;
  private _enemySkillIds: WeakMap<Enemy, string> = new WeakMap();
  private _enemySkillSeq: number = 0;

  // 固定时间步长（避免帧率抖动导致子弹/敌人移动跳跃）
  private readonly _FIXED_DT: number = 1 / 60;  // 60Hz 固定步长
  private _accumulator: number = 0;
  private _battleElapsed: number = 0;

  // UI 引用
  private _hud: HUDController | null = null;
  private _pauseButtonNode: Node | null = null;
  private _pauseButtonLabel: Label | null = null;
  private _pauseIconNode: Node | null = null;
  private _playIconNode: Node | null = null;
  private _startScreenNode: Node | null = null;
  private _gameOverScreen: GameOverScreen | null = null;
  private _debugScreen: DebugScreen | null = null;
  private _debugScreenNode: Node | null = null;
  private _garageScreen: GarageScreen | null = null;
  private _garageScreenNode: Node | null = null;
  private _gameLayerNode: Node | null = null;
  private _revivePanelNode: Node | null = null;
  private _reviveBodyLabel: Label | null = null;
  private _reviveAdButtonNode: Node | null = null;
  private _reviveGiveUpButtonNode: Node | null = null;
  private _reviveBackdropNode: Node | null = null;
  private _reviveDialogPanelNode: Node | null = null;
  private _supplyPanelNode: Node | null = null;
  private _supplyPanelTitleLabel: Label | null = null;
  private _supplyPanelHintLabel: Label | null = null;
  private _supplyPanelSubTitleLabel: Label | null = null;
  private _supplyPanelStatusLabel: Label | null = null;
  private _supplyPanelAdButton: Node | null = null;
  private _supplyPanelAdCountLabel: Label | null = null;
  private _supplyPanelBlockerNode: Node | null = null;
  private _supplyPanelRootNode: Node | null = null;
  private _waveBannerNode: Node | null = null;
  private _waveSupportTimers: Map<string, number> = new Map();
  private _supplyChests: SupplyChest[] = [];
  private _chestSpawnTimer: number = 0;
  private _chestSpawnDelay: number = 0;
  private _chestSelectionsThisRun: number = 0;
  private _chestSpawnSerial: number = 0;
  private _chestSlots: ChestSlotData[] = [];
  private _chestTrackX: number = 0;
  private _battleFrozen: boolean = false;
  private _stageVictoryPending: boolean = false;
  private _currentStageIndex: number = 0;
  private _completedStageIndex: number = 0;
  private _bonusMultiShot: number = 0;
  private _bonusSpreadCount: number = 0;
  private _bonusExplodeRadiusMultiplier: number = 1;
  private _bonusPierceCount: number = 0;
  private _bonusChainCount: number = 0;
  private _bonusChainRangeMultiplier: number = 1;

  // 触控
  private _touchStartX: number = 0;

  onLoad(): void {
    // 初始化系统
    this._weaponTierSystem = new WeaponTierSystem();
    this._waveManager = new WaveManager();
    // AudioManager 现在是场景组件，通过 find 获取
    this._audioManager = this.node.getComponent(AudioManager);

    // 初始化对象池
    if (this.bulletPrefab) {
      this._bulletPool = new ObjectPool(this.bulletPrefab, 150, Bullet);
    }
    if (this.enemyPrefab) {
      this._enemyPool = new ObjectPool(this.enemyPrefab, 100, Enemy);
    }

    // 设置波次管理器工厂
    if (this._waveManager && this._enemyPool) {
      this._waveManager.setEnemyFactory(() => {
        const enemy = this._enemyPool!.get();
        if (enemy) {
          // 只在首次挂载时 addChild，避免重复挂载
          if (!enemy.node.parent && this.enemiesNode) {
            this.enemiesNode.addChild(enemy.node);
          }
        }
        return enemy;
      });
      this._waveManager.setWaveStatScaleProvider((waveIndex) => ({
        hp: this._getStageEnemyHpScale(waveIndex),
        atk: this._getStageEnemyAtkScale(waveIndex),
        speed: this._getStageEnemySpeedScale(waveIndex),
      }));
    }

    // 绑定武装车回调
    if (this.playerCarNode) {
      this._playerCar = this.playerCarNode.getComponent(PlayerCar);
      if (this._playerCar) {
        this._playerCar.setWeaponTierSystem(this._weaponTierSystem);
        this._playerCar.setOnFire((x, y, tierIndex, angle, speedMult) => this._fireBullet(x, y, tierIndex, angle, speedMult));
        this._playerCar.setOnShoot(() => this._audioManager?.shoot());
      }
    }

    // 获取 UI 引用并设置初始状态
    const scene = director.getScene();
    if (scene) {
      const canvas = scene.getChildByName('Canvas');
      const overlayNode = canvas?.getChildByName('Overlay');
      if (overlayNode) {
        // 启动时强制恢复 Overlay 可见，避免编辑器里的调试显隐影响实际开局流程。
        overlayNode.active = true;
      }
      this._adsManager.init(overlayNode || canvas || null);

      // StartScreen
      this._startScreenNode = overlayNode?.getChildByName('StartScreen') || null;
      if (this._startScreenNode) {
        const startScreen = this._startScreenNode.getComponent(StartScreen);
        if (startScreen) {
          startScreen.show(false);
          startScreen.setOnStart(() => {
            console.log('[GameManager] 开始游戏');
            this.startGame();
          });
          startScreen.setOnDebug(() => {
            console.log('[GameManager] 打开调试界面');
            this._showDebugScreen();
          });
          startScreen.setOnGarage(() => {
            console.log('[GameManager] 打开车库');
            this._showGarageScreen();
          });
          startScreen.setOnPrevStage(() => this._changeStageSelection(-1));
          startScreen.setOnNextStage(() => this._changeStageSelection(1));
          this._currentStageIndex = this._progressManager.currentStageIndex;
          this._refreshStartStageInfo();
        }
      }

      // DebugScreen
      this._debugScreenNode = overlayNode?.getChildByName('DebugScreen') || null;
      if (this._debugScreenNode) {
        this._debugScreenNode.active = false;
        this._debugScreen = this._debugScreenNode.getComponent(DebugScreen);
        if (this._debugScreen) {
          this._debugScreen.setOnConfirm((wave, tier, evolution, enemyType) => {
            console.log('[GameManager] 调试模式开始，波次:', wave, '武器档位:', tier, '分支:', evolution, '敌军类型:', enemyType);
            this.startGame(wave, tier, evolution, enemyType);
          });
          this._debugScreen.setOnBack(() => {
            console.log('[GameManager] 返回开始界面');
            this._hideDebugScreen();
          });
          this._debugScreen.setOnResetProgress(() => {
            console.log('[GameManager] 清空车库存档');
            this._resetGarageProgress();
          });
        }
      }

      this._garageScreenNode = overlayNode?.getChildByName('GarageScreen') || null;
      if (this._garageScreenNode) {
        this._garageScreenNode.active = false;
        this._garageScreen = this._garageScreenNode.getComponent(GarageScreen);
        if (this._garageScreen) {
          this._garageScreen.setOnBack(() => {
            this._hideGarageScreen();
          });
          this._garageScreen.setOnUpgrade((id) => this._upgradePermanentNode(id));
        }
      }

      this._cacheRevivePanelRefs(overlayNode);

      // GameOverScreen
      const gameOverNode = overlayNode?.getChildByName('GameOverScreen') || null;
      if (gameOverNode) {
        this._gameOverScreen = gameOverNode.getComponent(GameOverScreen);
        if (this._gameOverScreen) {
          this._gameOverScreen.setOnRestart(() => {
            this.restart();
          });
          this._gameOverScreen.setOnGarage(() => {
            this._gameOverScreen?.hide();
            this._showGarageScreen();
          });
          this._refreshGarageNotifyState();
          this._gameOverScreen.setOnDoubleReward(() => {
            this._handleDoubleRewardAd();
          });
          this._gameOverScreen.setOnMenu(() => {
            this._audioManager?.stopBGM();
            this._state = 'start';
            if (this._gameOverScreen) this._gameOverScreen.hide();
            if (this._hud) this._hud.node.active = false;
            this._syncCurrentStageSelectionFromProgress();
            this._startScreenNode?.getComponent(StartScreen)?.show();
            this._refreshStartStageInfo();
            this._refreshPauseButtonState();
          });
          this._refreshAdModeIcons(gameOverNode);
        }
        gameOverNode.active = false;
      }

      this._cacheSupplyPanelRefs(overlayNode);

      // HUD
      const hudNode = canvas?.getChildByName('HUD') || null;
      if (hudNode) {
        this._hud = hudNode.getComponent(HUDController);
        this._cachePauseButtonRefs(hudNode);
        this._refreshPauseButtonState();
        hudNode.active = false;
      }
    }

    // 获取爆炸绘制组件（GameLayer 是 Canvas 的子节点）
    if (!this.explosionGraphicsNode) {
      const canvas = director.getScene()?.getChildByName('Canvas');
      const gameLayer = canvas?.getChildByName('GameLayer');
      this.explosionGraphicsNode = gameLayer?.getChildByName('ExplosionGraphics') || null;
      if (this.explosionGraphicsNode) {
        this._explosionGraphics = this.explosionGraphicsNode.getComponent(Graphics);
        console.log('[GameManager] ExplosionGraphics node found:', this.explosionGraphicsNode.name);
      } else {
        console.warn('[GameManager] ExplosionGraphics node NOT found!');
      }
    } else {
      this._explosionGraphics = this.explosionGraphicsNode.getComponent(Graphics);
    }

    // 创建或获取屏幕伤害闪烁节点
    this._createDamageFlashNode();

    // 获取 GameLayer 节点引用（触摸监听用，避免 HUD 区域误触）
    const canvas = director.getScene()?.getChildByName('Canvas');
    if (canvas) {
      this._gameLayerNode = canvas.getChildByName('GameLayer') || null;
      if (!this._gameLayerNode) {
        console.warn('[GameManager] GameLayer node not found!');
      }
    }

    // 绑定输入
    this._bindInput();
  }

  /**
   * 初始化屏幕伤害闪烁效果
   * 从编辑器创建的 DamageFlash 节点获取引用
   */
  private _createDamageFlashNode(): void {
    const canvas = director.getScene()?.getChildByName('Canvas');
    if (!canvas) {
      console.warn('[GameManager] Canvas not found!');
      return;
    }

    // 从编辑器获取已创建的 DamageFlash 节点
    this._damageFlashNode = canvas.getChildByName('DamageFlash');
    if (this._damageFlashNode) {
      // 获取父节点 UIOpacity
      this._damageFlashOpacity = this._damageFlashNode.getComponent(UIOpacity);

      // 获取 BorderL 节点的 UIOpacity
      const borderL = this._damageFlashNode.getChildByName('BorderL');
      if (borderL) {
        this._borderLOpacity = borderL.getComponent(UIOpacity);
        if (!this._borderLOpacity) {
          this._borderLOpacity = borderL.addComponent(UIOpacity);
        }
        this._borderLOpacity.opacity = 0;
      }

      // 获取 BorderR 节点的 UIOpacity
      const borderR = this._damageFlashNode.getChildByName('BorderR');
      if (borderR) {
        this._borderROpacity = borderR.getComponent(UIOpacity);
        if (!this._borderROpacity) {
          this._borderROpacity = borderR.addComponent(UIOpacity);
        }
        this._borderROpacity.opacity = 0;
      }

      console.log('[GameManager] DamageFlash nodes found, BorderL:', this._borderLOpacity ? 'OK' : 'null', 'BorderR:', this._borderROpacity ? 'OK' : 'null');
    } else {
      console.warn('[GameManager] DamageFlash node not found in editor!');
    }
  }



  /**
   * 触发屏幕闪红效果
   */
  public triggerDamageFlash(): void {
    if (this._damageFlashNode) {
      this._damageFlashTimer = this._damageFlashDuration;
      console.log('[GameManager] Damage flash triggered!');
    } else {
      console.warn('[GameManager] DamageFlash node is null!');
    }
  }

  start(): void {
    this._loadVfxResources();
  }

  update(dt: number): void {
    switch (this._state) {
      case 'start':
      case 'debug':
      case 'gameover':
      case 'victory':
      case 'revive':
      case 'supply':
      case 'ad':
      case 'paused':
        // 非游戏状态不更新逻辑
        break;
      case 'playing':
        // 固定时间步长：累积真实 dt，按固定间隔更新逻辑
        // 防止帧率抖动（尤其游戏开始时）导致子弹/敌人位移跳跃
        this._accumulator += dt;
        // 上限防 死 spiral：如果某帧卡太久，最多补 5 帧逻辑
        if (this._accumulator > this._FIXED_DT * 5) {
          this._accumulator = this._FIXED_DT * 5;
        }
        while (this._accumulator >= this._FIXED_DT) {
          this._updatePlaying(this._FIXED_DT);
          this._accumulator -= this._FIXED_DT;
        }
        break;
    }
  }

  private _loadVfxResources(): void {
    if (this._areaExplosionFrame) {
      this._loadSceneSpriteFrames();
      return;
    }
    BundleLoader.loadAsset('battle', 'vfx/area-explosion-v1/spriteFrame', SpriteFrame, (err, frame) => {
      if (err) {
        console.warn('[GameManager] failed to load area explosion sprite:', err);
        return;
      }
      this._areaExplosionFrame = frame;
    });
    this._loadSceneSpriteFrames();
  }

  private _loadSceneSpriteFrames(): void {
    const sceneSprites: [string[], string][] = [
      [['Canvas', 'Bridge'], 'ui/game/battle-bg-road-supply-lane-v3/spriteFrame'],
      [['Canvas', 'Bridge', 'PlayerZoneOverlay'], 'ui/game/battle-player-zone-v1/spriteFrame'],
      [['Canvas', 'Bridge', 'RailFence'], 'ui/game/battle-rail-fence-v1/spriteFrame'],
      [['Canvas', 'GameLayer', 'PlayerCar', 'CarGraphics'], 'car_frames_v3/car_0/spriteFrame'],
      [['Canvas', 'GameLayer', 'PlayerCar', 'MuzzleFlash'], 'car_fx/muzzle_v2/muzzle_flash_0/spriteFrame'],
      [['Canvas', 'GameLayer', 'PlayerCar', 'RearThruster'], 'car_fx/thruster/thruster_0/spriteFrame'],
      [['Canvas', 'HUD', 'HUDBack'], 'ui/hud-panel-top-v2/spriteFrame'],
      [['Canvas', 'HUD', 'LeftGroup', 'HPRow', 'HPBar', 'HPBarBg'], 'ui/common/hud-bar-frame-v2/spriteFrame'],
      [['Canvas', 'HUD', 'LeftGroup', 'HPRow', 'HPBar', 'HPBarFill'], 'ui/common/hud-bar-fill-hp-v1/spriteFrame'],
      [['Canvas', 'HUD', 'PauseButton', 'PauseIcon'], 'ui/common/icon-pause-white-256/spriteFrame'],
      [['Canvas', 'HUD', 'PauseButton', 'PlayIcon'], 'ui/common/icon-play-white-256/spriteFrame'],
      [['Canvas', 'HUD', 'RightGroup', 'KillRow', 'ExpBar', 'ExpBarBg'], 'ui/common/hud-bar-frame-v2/spriteFrame'],
      [['Canvas', 'HUD', 'RightGroup', 'KillRow', 'ExpBar', 'ExpBarFill'], 'ui/common/hud-bar-fill-progress-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'DebugScreen', 'Bg'], 'ui/panel_fill_v1/spriteFrame'],
      [['Canvas', 'Overlay', 'DebugScreen', 'BackBtn'], 'ui/common/btn-secondary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'DebugScreen', 'ConfirmBtn'], 'ui/common/btn-secondary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'DebugScreen', 'LevelMinusBtn'], 'ui/common/btn-arrow-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'DebugScreen', 'LevelPlusBtn'], 'ui/common/btn-arrow-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'DebugScreen', 'EnemyTypePrevBtn'], 'ui/common/btn-arrow-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'DebugScreen', 'EnemyTypeNextBtn'], 'ui/common/btn-arrow-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'DebugScreen', 'ResetProgressBtn'], 'ui/common/btn-secondary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'DebugScreen', 'WaveMinusBtn'], 'ui/common/btn-arrow-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'DebugScreen', 'WavePlusBtn'], 'ui/common/btn-arrow-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GameOverScreen', 'Bg'], 'ui/start/start-bg-wasteland-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GameOverScreen', 'Bg', 'BannerAdSlot'], 'ui/panel_fill_v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GameOverScreen', 'Bg', 'ContentShade'], 'ui/panel_fill_v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GameOverScreen', 'Bg', 'DoubleRewardBtn'], 'ui/common/btn-primary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GameOverScreen', 'Bg', 'DoubleRewardBtn', 'AdVideo'], 'ui/common/video-icon-transparent-256/spriteFrame'],
      [['Canvas', 'Overlay', 'GameOverScreen', 'Bg', 'DoubleRewardBtn', 'GiftIcon'], 'ui/common/gift-icon-transparent-256/spriteFrame'],
      [['Canvas', 'Overlay', 'GameOverScreen', 'Bg', 'MenuBtn'], 'ui/common/btn-secondary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GameOverScreen', 'Bg', 'Panel'], 'ui/supply-panel-frame-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GameOverScreen', 'Bg', 'RestartBtn'], 'ui/common/btn-secondary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Bg'], 'ui/panel_fill_v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel'], 'ui/common/supply-card-portrait-v2/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'BackBtn'], 'ui/common/btn-secondary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'TopBar', 'CoinsChip'], 'ui/common/btn-secondary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'TopBar', 'CoinsChip', 'CoinIcon'], 'ui/common/icons_reward_v2/icon_coin/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'TopBar', 'PartsChip'], 'ui/common/btn-secondary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'TopBar', 'PartsChip', 'PartsIcon'], 'ui/common/icons_reward_v2/icon_parts/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeCarAttackRow'], 'ui/hud-panel-top-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeCarAttackRow', 'StarLabel'], 'ui/common/icon-weapon-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeCarHpRow'], 'ui/hud-panel-top-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeCarHpRow', 'StarLabel'], 'ui/common/icon-hp-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradePartsBonusRow'], 'ui/hud-panel-top-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradePartsBonusRow', 'Icon'], 'ui/common/icons_reward_v2/icon_parts/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeReviveBonusRow'], 'ui/hud-panel-top-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeReviveBonusRow', 'Icon'], 'ui/common/icons_reward_v2/icon_energy_core/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeStartingCoinsRow'], 'ui/hud-panel-top-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeStartingCoinsRow', 'Icon'], 'ui/common/icons_reward_v2/icon_coin/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeSupplyQualityRow'], 'ui/hud-panel-top-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeSupplyQualityRow', 'Icon'], 'ui/common/icons_reward_v2/icon_supply_token/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeWeaponTierRow'], 'ui/hud-panel-top-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'GarageScreen', 'Panel', 'UpgradeWeaponTierRow', 'Icon'], 'ui/common/icon-stage-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'ReviveOfferPanel', 'Backdrop'], 'ui/panel_fill_v1/spriteFrame'],
      [['Canvas', 'Overlay', 'ReviveOfferPanel', 'DialogPanel'], 'ui/panel_fill_v1/spriteFrame'],
      [['Canvas', 'Overlay', 'ReviveOfferPanel', 'DialogPanel', 'AccentBar'], 'ui/panel_fill_v1/spriteFrame'],
      [['Canvas', 'Overlay', 'ReviveOfferPanel', 'DialogPanel', 'GiveUpBtn'], 'ui/common/btn-secondary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'ReviveOfferPanel', 'DialogPanel', 'ReviveAdBtn'], 'ui/common/btn-primary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'ReviveOfferPanel', 'DialogPanel', 'ReviveAdBtn', 'AdVideo'], 'ui/common/video-icon-transparent-256/spriteFrame'],
      [['Canvas', 'Overlay', 'ReviveOfferPanel', 'DialogPanel', 'ReviveAdBtn', 'GiftIcon'], 'ui/common/gift-icon-transparent-256/spriteFrame'],
      [['Canvas', 'Overlay', 'StartScreen', 'ActionBlock', 'GarageButton'], 'ui/hud-panel-top-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'StartScreen', 'ActionBlock', 'StartButton'], 'ui/common/btn-primary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'StartScreen', 'Bg'], 'ui/start/start-bg-wasteland-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'StartScreen', 'HeroBlock', 'HeroPanel', 'Bg'], 'ui/panel_fill_v1/spriteFrame'],
      [['Canvas', 'Overlay', 'StartScreen', 'HeroBlock', 'HeroPanel', 'HeroBackdrop'], 'ui/hud-panel-top-v2/spriteFrame'],
      [['Canvas', 'Overlay', 'StartScreen', 'StageBlock', 'NextStageButton'], 'ui/common/btn-arrow-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'StartScreen', 'StageBlock', 'PrevStageButton'], 'ui/common/btn-arrow-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'StartScreen', 'StageBlock', 'StageCard'], 'ui/start/start-stage-card-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'StartScreen', 'UtilityBar', 'DebugButton'], 'ui/common/btn-secondary-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'SupplyPanel', 'BannerAdSlot'], 'ui/panel_fill_v1/spriteFrame'],
      [['Canvas', 'Overlay', 'SupplyPanel', 'PanelBg'], 'ui/supply-panel-frame-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'SupplyPanel', 'PanelRoot'], 'ui/supply-panel-frame-v1/spriteFrame'],
      [['Canvas', 'Overlay', 'SupplyPanel', 'PanelRoot', 'AdButton'], 'ui/common/supply-ad-button-wide-v2/spriteFrame'],
      [['Canvas', 'Overlay', 'SupplyPanel', 'PanelRoot', 'AdButton', 'AdVideo'], 'ui/common/video-icon-transparent-256/spriteFrame'],
      [['Canvas', 'Overlay', 'SupplyPanel', 'PanelRoot', 'AdButton', 'GiftIcon'], 'ui/common/gift-icon-transparent-256/spriteFrame'],
      [['Canvas', 'Overlay', 'SupplyPanel', 'PanelRoot', 'Cards', 'CardCenter'], 'ui/common/supply-card-portrait-v2/spriteFrame'],
      [['Canvas', 'Overlay', 'SupplyPanel', 'PanelRoot', 'Cards', 'CardLeft'], 'ui/common/supply-card-portrait-v2/spriteFrame'],
      [['Canvas', 'Overlay', 'SupplyPanel', 'PanelRoot', 'Cards', 'CardRight'], 'ui/common/supply-card-portrait-v2/spriteFrame'],
    ];
    for (const [nodePath, assetPath] of sceneSprites) {
      this._loadNodeSpriteFrame(nodePath, assetPath);
    }
  }

  private _loadNodeSpriteFrame(path: string[], assetPath: string): void {
    const target = this._findNodeByPath(path);
    const sprites = target?.getComponents(Sprite) || [];
    if (sprites.length === 0) return;
    BundleLoader.loadAsset('battle', assetPath, SpriteFrame, (err, frame) => {
      if (err || !frame) {
        console.warn(`[GameManager] failed to load ${assetPath}:`, err);
        return;
      }
      for (const sprite of sprites) {
        if (sprite.isValid) {
          sprite.spriteFrame = frame;
        }
      }
    });
  }

  private _findNodeByPath(path: string[]): Node | null {
    let current: Node | null = director.getScene() || null;
    for (const name of path) {
      current = current?.getChildByName(name) || null;
      if (!current) return null;
    }
    return current;
  }

  private _updatePlaying(dt: number): void {
    if (!this._waveManager || !this._playerCar || !this._weaponTierSystem) return;
    this._battleElapsed += dt;

    // 更新屏幕闪红效果
    this._updateDamageFlash(dt);

    // 更新波次
    this._waveManager.update(dt);
    if (!this._stageVictoryPending && this._stageManager.isStageComplete(this._waveManager.currentWaveNum)) {
      this._stageVictoryPending = true;
    }
    this._refreshWaveBonuses();

    // 更新敌人
    const enemies = this._waveManager.activeEnemies;
    if (!this._battleFrozen) {
      this._supplyChests.forEach(activeChest => activeChest.updateChest(dt));
      this._updateChestSpawn(dt, enemies);
      enemies.forEach(e => e.tick(dt, this._previewMovementLocked));
      this._applyPendingWaveOpeningEffects(enemies);
      this._updateSpecialEnemies(enemies, dt);
    }

    // 已在护栏敌人攻击武装车
    if (!this._battleFrozen) {
      enemies.forEach(e => {
        if (e.reachedRail && !e.dead) {
          if (e.tryAttack()) {
            this._playerCar!.takeDamage(e.atk);
            this._audioManager?.alarm();
            if (e.isSuicide) {
              this._spawnExplosion(e.x, e.y);
            }
            // 触发屏幕闪红效果
            this.triggerDamageFlash();
          }
        }
      });
    }

    // 检查玩家死亡
    if (this._playerCar.dead) {
      this._handlePlayerDeath();
      return;
    }

    if (this._stageVictoryPending && enemies.length === 0 && this._getActiveSupplyChests().length === 0) {
      this._enterVictory();
      return;
    }

    // 更新 HUD
    if (this._hud && this._weaponTierSystem && this._waveManager) {
      this._hud.updateHUD(
        this._getStageDisplayLabel(),
        this._getStageWaveNum(),
        this._playerCar.hp,
        this._playerCar.maxHp,
        this._getStageKillProgressPct(),
        this._getStageKillProgressHUDText(),
        this._getWeaponDisplayName(),
        this._getStageEnemyHint(),
        this._getStageBuffSummary(),
        this._waveManager.inPause,
        this._waveManager.wavePause
      );
    }

    // 更新武装车
    this._playerCar.tick(dt);

    // 新波次开始时重置射击计时器
    if (this._waveManager.consumeWaveStart()) {
      this._playerCar.resetFireTimer();
      if (this._pendingShieldSeconds > 0) {
        this._playerCar.setInvulnerable(this._pendingShieldSeconds);
        this._pendingShieldSeconds = 0;
      }
      this._showWaveBanner(this._waveManager.currentWaveDef);
    }

    // 自动射击
    const targets = this._buildAttackTargets(enemies);
    this._playerCar.tryFire(targets, dt);

    // 同步 _enemies 数组用于碰撞检测
    this._enemies = enemies;

    // 先检测一次碰撞，避免护栏前近距离目标被高速子弹跨帧穿透
    this._checkCollisions();

    // 更新子弹位置
    this._bullets.forEach(b => {
      if (!b.dead) {
        b.tickMove(dt);
      }
    });

    // 再检测一次碰撞，覆盖正常飞行过程中的命中
    this._checkCollisions();

    // 回收死亡子弹到对象池（swap-and-pop，零分配）
    for (let i = this._bullets.length - 1; i >= 0; i--) {
      if (this._bullets[i].dead) {
        this._bulletPool?.put(this._bullets[i]);
        // swap-and-pop: O(1) 移除，避免 filter 创建新数组
        const last = this._bullets.length - 1;
        if (i !== last) {
          this._bullets[i] = this._bullets[last];
        }
        this._bullets.pop();
      }
    }

    // 更新爆炸
    this._updateExplosions(dt);
    this._updatePulses(dt);
    this._updateTrails(dt);
    this._updateLightnings(dt);
    this._updateFragments(dt);
    this._refreshEnemyRenderOrder(dt);

    // 清理死亡敌人并回收到对象池（节点保留在父节点下，通过 active 控制显隐）
    const removedEnemies = this._waveManager.cleanupEnemies(dt);
    for (const enemy of removedEnemies) {
      this._enemyPool?.put(enemy);
    }
  }

  /**
   * 更新屏幕闪红效果
   * 同时控制 BorderL 和 BorderR 两个边框节点的透明度
   */
  private _updateDamageFlash(dt: number): void {
    if ((!this._borderLOpacity && !this._borderROpacity) || this._damageFlashTimer <= 0) return;

    this._damageFlashTimer -= dt;
    const progress = Math.max(0, this._damageFlashTimer / this._damageFlashDuration);

    // 闪红效果：快速淡入 → 快速淡出（使用 smoothstep）
    const easedProgress = progress * progress * (3 - 2 * progress);
    const opacity = Math.floor(easedProgress * 200); // 最大透明度 200

    // 同时控制两个边框节点
    if (this._borderLOpacity) {
      this._borderLOpacity.opacity = opacity;
    }
    if (this._borderROpacity) {
      this._borderROpacity.opacity = opacity;
    }

    if (this._damageFlashTimer <= 0) {
      this._damageFlashTimer = 0;
      if (this._borderLOpacity) this._borderLOpacity.opacity = 0;
      if (this._borderROpacity) this._borderROpacity.opacity = 0;
    }
  }

  private _checkCollisions(): void {
    if (!this._weaponTierSystem) return;
    const eCfg = GameConfig.enemy;
    const bCfg = GameConfig.bullet;
    const activeChests = this._getActiveSupplyChests();

    this._bullets.forEach(b => {
      if (b.dead) return;

      for (const chest of activeChests) {
        const chestDx = b.x - chest.x;
        const chestDy = b.y - chest.y;
        const chestThreshold = chest.radius + bCfg.radius;
        if (chestDx * chestDx + chestDy * chestDy < chestThreshold * chestThreshold) {
          this._handleBulletHitChest(b, chest);
          return;
        }
      }

      const bestEnemy =
        this._pickBestCollisionEnemy(b, this._enemies, eCfg.width / 2 + bCfg.radius, true) ||
        this._pickBestCollisionEnemy(b, this._enemies, eCfg.width / 2 + bCfg.radius);

      if (bestEnemy) {
        this._audioManager?.enemyHit();
        this._handleBulletHit(b, bestEnemy);
      }
    });
  }

  private _pickBestCollisionEnemy(bullet: Bullet, enemies: Enemy[], threshold: number, reachedRailOnly: boolean = false): Enemy | null {
    if (enemies.length === 0) return null;

    let bestEnemy: Enemy | null = null;
    let bestDistSq = Infinity;
    let bestY = Infinity;
    let bestSibling = -1;
    const thresholdSq = threshold * threshold;

    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (reachedRailOnly && !enemy.reachedRail) continue;
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= thresholdSq) continue;

      const sibling = enemy.node.getSiblingIndex();
      const isMoreFront = enemy.y < bestY - 0.001;
      const isSameRowButHigher = Math.abs(enemy.y - bestY) <= 0.001 && sibling > bestSibling;
      const isSameDepthButCloser = Math.abs(enemy.y - bestY) <= 0.001 && sibling === bestSibling && distSq < bestDistSq;

      if (!bestEnemy || isMoreFront || isSameRowButHigher || isSameDepthButCloser) {
        bestEnemy = enemy;
        bestDistSq = distSq;
        bestY = enemy.y;
        bestSibling = sibling;
      }
    }

    return bestEnemy;
  }

  private _refreshEnemyRenderOrder(dt: number): void {
    if (!this.enemiesNode || this._enemies.length <= 1) return;
    this._enemyRenderOrderTimer += dt;
    if (this._enemyRenderOrderTimer < 0.08) return;
    this._enemyRenderOrderTimer = 0;

    const ordered = [...this._enemies].filter(enemy => !enemy.dead && enemy.node.parent === this.enemiesNode);
    ordered.sort((a, b) => b.y - a.y);
    ordered.forEach((enemy, index) => {
      enemy.node.setSiblingIndex(index);
    });
  }

  private _handleBulletHitChest(bullet: Bullet, chest: SupplyChest): void {
    this._spawnBulletImpactFx(bullet, chest.x, chest.y, 'chest');
    const prevHp = chest.hp;
    const destroyed = chest.takeDamage(bullet.damage);
    const appliedDamage = Math.max(0, prevHp - chest.hp);
    if (appliedDamage > 0 && !destroyed) {
      this._showChestDamageNumber(chest, chest.x, chest.y + 24, appliedDamage, this._getDamageNumberColor(bullet.behavior));
    }
    if (destroyed) {
      this._clearTargetDamageBinding(this._chestDamageTextBindings, chest);
    }
    const canContinue = bullet.behavior === 'pierce' && bullet.consumePierce();
    if (bullet.behavior === 'pierce') {
      this._spawnTrail(bullet.x, bullet.y, bullet.x, bullet.y + 34, '#ffe082', 0.1, 2.2);
    }
    if (!canContinue) {
      bullet.dead = true;
      bullet.node.active = false;
    }
    if (destroyed) {
      this._handleSupplyChestDestroyed(chest);
    }
  }

  private _handleBulletHit(bullet: Bullet, enemy: Enemy): void {
    this._spawnBulletImpactFx(bullet, enemy.x, enemy.y, 'enemy');
    this._damageEnemy(enemy, bullet.damage, bullet.behavior);
    if (bullet.behavior === 'explode' && bullet.explodeRadius > 0) {
      this._applyExplosionDamage(
        enemy,
        bullet.explodeRadius,
        Math.max(1, Math.round(bullet.damage * Math.max(0.1, bullet.splashMultiplier))),
        bullet.behavior
      );
      this._playExplodeProcFx(enemy.x, enemy.y, bullet.explodeRadius);
    }
    if (bullet.behavior === 'chain' && bullet.chainCount > 0 && bullet.chainRange > 0) {
      const chained = this._applyChainDamage(
        enemy,
        bullet.chainCount,
        bullet.chainRange,
        Math.max(1, Math.round(bullet.damage * Math.max(0.1, bullet.chainMultiplier))),
        bullet.behavior
      );
      if (chained > 0) {
        this._playChainProcFx(enemy.x, enemy.y, Math.max(60, bullet.chainRange * 0.5), chained);
      }
    }

    const canContinue = bullet.behavior === 'pierce' && bullet.consumePierce();
    if (bullet.behavior === 'pierce') {
      this._spawnTrail(bullet.x, bullet.y, bullet.x, bullet.y + 44, '#81d4fa', 0.12, 2.5);
    }
    if (!canContinue) {
      bullet.dead = true;
      bullet.node.active = false;
    }
  }

  private _damageEnemy(enemy: Enemy, damage: number, source: DamageNumberSource = 'normal'): DamageResult {
    if (enemy.dead) {
      return { killed: false, appliedDamage: 0 };
    }
    const prevHp = enemy.hp;
    enemy.takeDamage(damage);
    const appliedDamage = Math.max(0, prevHp - enemy.hp);
    if (enemy.dead) {
      this._clearTargetDamageBinding(this._enemyDamageTextBindings, enemy);
      this._showKillValueNumber(enemy.x, enemy.y + 18, enemy.maxHp);
      this._handleEnemyKilled(enemy);
      return { killed: true, appliedDamage };
    }
    if (appliedDamage > 0) {
      this._showEnemyDamageNumber(enemy, enemy.x, enemy.y + 10, appliedDamage, this._getDamageNumberColor(source));
    }
    return { killed: false, appliedDamage };
  }

  private _applyExplosionDamage(centerEnemy: Enemy, radius: number, damage: number, source: DamageNumberSource): void {
    const radiusSq = radius * radius;
    for (const enemy of this._enemies) {
      if (enemy.dead || enemy === centerEnemy) continue;
      const dx = enemy.x - centerEnemy.x;
      const dy = enemy.y - centerEnemy.y;
      if (dx * dx + dy * dy > radiusSq) continue;
      this._damageEnemy(enemy, damage, source);
    }
  }

  private _applyChainDamage(
    sourceEnemy: Enemy,
    chainCount: number,
    chainRange: number,
    damage: number,
    source: DamageNumberSource
  ): number {
    const hit = new Set<Enemy>([sourceEnemy]);
    let current = sourceEnemy;
    let chained = 0;
    for (let i = 0; i < chainCount; i++) {
      const next = this._findClosestEnemy(current, hit, chainRange);
      if (!next) break;
      hit.add(next);
      this._spawnLightning(current.x, current.y, next.x, next.y, '#d6b3ff', 0.12, 3);
      this._damageEnemy(next, damage, source);
      current = next;
      chained++;
    }
    return chained;
  }

  private _findClosestEnemy(origin: Enemy, excluded: Set<Enemy>, range: number): Enemy | null {
    let closest: Enemy | null = null;
    let bestDist = range * range;
    for (const enemy of this._enemies) {
      if (enemy.dead || excluded.has(enemy)) continue;
      const dx = enemy.x - origin.x;
      const dy = enemy.y - origin.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > bestDist) continue;
      bestDist = distSq;
      closest = enemy;
    }
    return closest;
  }

  private _handleEnemyKilled(enemy: Enemy): void {
    this._kills++;
    if (this._suppressEnemyKillFx <= 0) {
      this._spawnExplosion(enemy.x, enemy.y);
      this._audioManager?.explode();
    }
  }

  private _updateSpecialEnemies(enemies: Enemy[], dt: number): void {
    if (!this._waveManager) return;

    enemies.forEach((enemy, index) => {
      if (enemy.isHealer) {
        this._updateHealerSupport(enemy, enemies, dt, index);
      }
      if (enemy.enemyType === 'boss_bulldozer') {
        this._updateBulldozerBoss(enemy, dt);
      }
      if (enemy.enemyType === 'boss_commander') {
        this._updateCommanderBoss(enemy, enemies, dt);
      }
    });
  }

  private _updateHealerSupport(enemy: Enemy, enemies: Enemy[], dt: number, index: number): void {
    const key = this._getEnemySkillKey(enemy, `healer_${index}`);
    const timer = (this._waveSupportTimers.get(key) || 0) + dt;
    if (timer < enemy.healInterval) {
      this._waveSupportTimers.set(key, timer);
      return;
    }

    this._waveSupportTimers.set(key, 0);
    let healed = 0;
    for (const target of enemies) {
      if (target.dead || target === enemy) continue;
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      if (dx * dx + dy * dy > enemy.healRange * enemy.healRange) continue;
      target.heal(Math.max(2, Math.round(target.maxHp * enemy.healPercent)));
      healed++;
      if (healed >= 3) break;
    }
    if (healed > 0) {
      this._spawnPulse(enemy.x, enemy.y, Math.max(60, enemy.healRange * 0.55), '#6bffb0', 0.45);
    }
  }

  private _updateBulldozerBoss(enemy: Enemy, dt: number): void {
    if (!this._waveManager || !this._enemyPool || !this.enemiesNode) return;

    const key = this._getEnemySkillKey(enemy, 'boss_spawn');
    const timer = (this._waveSupportTimers.get(key) || 0) + dt;
    if (timer < 6) {
      this._waveSupportTimers.set(key, timer);
      return;
    }

    this._waveSupportTimers.set(key, 0);
    this._spawnPulse(enemy.x, enemy.y, 95, '#ffb347', 0.4);
    for (let i = 0; i < 3; i++) {
      this._spawnSupportEnemy('runner', enemy.x + (i - 1) * 36, enemy.y + 40);
    }
  }

  private _updateCommanderBoss(enemy: Enemy, enemies: Enemy[], dt: number): void {
    if (!this._waveManager) return;

    const key = this._getEnemySkillKey(enemy, 'boss_buff');
    const timer = (this._waveSupportTimers.get(key) || 0) + dt;
    if (timer >= 5) {
      this._waveSupportTimers.set(key, 0);
      this._spawnPulse(enemy.x, enemy.y, 150, '#c084fc', 0.5);
      enemies.forEach(target => {
        if (target.dead || target === enemy) return;
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        if (dx * dx + dy * dy > 220 * 220) return;
        target.applySpeedBoost(1.35, 3);
      });
    } else {
      this._waveSupportTimers.set(key, timer);
    }

    if (!enemy.phaseTriggered && enemy.hpRatio <= 0.5) {
      enemy.markPhaseTriggered();
      this._spawnPulse(enemy.x, enemy.y, 180, '#ff80ab', 0.6);
      this._spawnCommanderReinforcements(enemy);
    }
  }

  private _spawnCommanderReinforcements(enemy: Enemy): void {
    const offsets = [-72, -24, 24, 72];
    offsets.forEach((offset, index) => {
      const type = index % 2 === 0 ? 'runner' : 'shield';
      this._spawnSupportEnemy(type, enemy.x + offset, enemy.y + 55 + Math.floor(index / 2) * 35);
    });
  }

  private _spawnSupportEnemy(type: 'runner' | 'shield' | 'suicide' | 'healer', x: number, y: number): void {
    if (!this._enemyPool || !this.enemiesNode || !this._waveManager) return;

    const enemy = this._enemyPool.get();
    if (!enemy) return;
    if (!enemy.node.parent) {
      this.enemiesNode.addChild(enemy.node);
    }

    const waveData = this._waveManager.getWaveData(Math.max(0, this._waveManager.waveIndex));
    enemy.init(waveData, this._waveManager.currentWaveNum, 0, 0, 1, 1, Math.max(GameConfig.bridge.left + 20, Math.min(GameConfig.bridge.right - 20, x)), type);
    enemy.setWorldPosition(enemy.x, Math.min(GameConfig.bridge.battleTop + 140, y));
    this._waveManager.enemies.push(enemy);
  }

  private _getEnemySkillKey(enemy: Enemy, prefix: string): string {
    let id = this._enemySkillIds.get(enemy);
    if (!id) {
      this._enemySkillSeq++;
      id = `${prefix}_${this._enemySkillSeq}`;
      this._enemySkillIds.set(enemy, id);
    }
    return id;
  }

  private _fireBullet(x: number, y: number, tierIndex: number, angle: number = 90, speedMult: number = 1.0): void {
    if (!this._bulletPool || !this.bulletPoolNode) return;

    const bullet = this._bulletPool.get();
    if (bullet) {
      const evolution = this._applyRunWeaponBonuses(this._getCurrentWeaponEvolution());
      bullet.init(
        x,
        y,
        tierIndex,
        angle,
        speedMult * this._projectileSpeedMultiplier,
        this._damageMultiplier * (this._playerCar?.damageMultiplier || 1),
        evolution
      );
      // 只在首次挂载时 addChild，避免重复挂载触发 transform 重建
      if (!bullet.node.parent) {
        this.bulletPoolNode.addChild(bullet.node);
      }
      this._bullets.push(bullet);
    }
  }

  private _spawnExplosion(x: number, y: number): void {
    if (this._explosions.length >= GameManager.MAX_ACTIVE_EXPLOSIONS) {
      this._explosions.shift();
    }
    this._explosions.push({
      x, y,
      particles: this._generateExplosionParticles(x, y),
      life: 1,
    });
  }

  private _spawnPulse(x: number, y: number, maxRadius: number, color: string, life: number): void {
    this._pulses.push({
      x,
      y,
      radius: 10,
      maxRadius,
      life,
      maxLife: life,
      color,
    });
  }

  private _spawnTrail(x1: number, y1: number, x2: number, y2: number, color: string, life: number, width: number): void {
    this._trails.push({
      x1,
      y1,
      x2,
      y2,
      life,
      maxLife: life,
      width,
      color,
    });
  }

  private _spawnBulletImpactFx(bullet: Bullet, x: number, y: number, target: 'enemy' | 'chest'): void {
    if (target === 'enemy') return;

    const vx = bullet.velocityX;
    const vy = bullet.velocityY;
    const speedSq = vx * vx + vy * vy;
    const speed = speedSq > 0.001 ? Math.sqrt(speedSq) : 1;
    const dirX = vx / speed;
    const dirY = vy / speed;
    const baseColor = bullet.color;
    const flashColor = target === 'chest' ? '#ffd089' : '#f7fbff';
    const pulseRadius = target === 'chest' ? 26 : 18;
    const sparkCount = target === 'chest' ? 8 : 6;
    const spread = target === 'chest' ? 2.0 : 1.45;
    const baseLength = target === 'chest' ? 18 : 11;
    const life = target === 'chest' ? 0.13 : 0.1;

    this._spawnPulse(x, y, pulseRadius, baseColor, life);
    this._spawnPulse(x, y, pulseRadius * 0.62, flashColor, life * 0.82);
    this._spawnTrail(
      x - dirX * 5,
      y - dirY * 5,
      x + dirX * 9,
      y + dirY * 9,
      flashColor,
      0.05,
      target === 'chest' ? 2.4 : 1.9
    );

    const baseAngle = Math.atan2(dirY, dirX) + Math.PI;
    for (let i = 0; i < sparkCount; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const length = baseLength + Math.random() * (target === 'chest' ? 20 : 12);
      const startOffset = 2 + Math.random() * 5;
      const startX = x + dirX * startOffset + (Math.random() - 0.5) * 4;
      const startY = y + dirY * startOffset + (Math.random() - 0.5) * 4;
      const endX = startX + Math.cos(angle) * length;
      const endY = startY + Math.sin(angle) * length;
      this._spawnTrail(
        startX,
        startY,
        endX,
        endY,
        i % 3 === 0 ? flashColor : baseColor,
        life + Math.random() * 0.04,
        target === 'chest' ? 2.2 : 1.6
      );
    }
  }

  private _spawnLightning(x1: number, y1: number, x2: number, y2: number, color: string, life: number, width: number): void {
    const segments: Vec3[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const baseX = x1 + (x2 - x1) * t;
      const baseY = y1 + (y2 - y1) * t;
      const offset = i === 0 || i === steps ? 0 : (Math.random() - 0.5) * 26;
      segments.push(new Vec3(baseX + offset, baseY + (Math.random() - 0.5) * 14, 0));
    }
    this._lightnings.push({
      points: segments,
      life,
      maxLife: life,
      width,
      color,
    });
  }

  private _spawnBurstRing(x: number, y: number, radius: number, color: string): void {
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10;
      const x2 = x + Math.cos(angle) * radius * 0.55;
      const y2 = y + Math.sin(angle) * radius * 0.55;
      this._spawnTrail(x, y, x2, y2, color, 0.16, 3);
    }
  }

  private _playExplodeProcFx(x: number, y: number, radius: number): void {
    const pulseRadius = Math.max(54, radius * 0.72);
    this._spawnPulse(x, y, pulseRadius, '#ffb74d', 0.22);
    this._spawnPulse(x, y, pulseRadius * 0.58, '#ffe0a3', 0.16);
    this._spawnBurstRing(x, y, Math.max(68, radius * 0.82), '#ff8f00');

    const streakCount = 6;
    for (let i = 0; i < streakCount; i++) {
      const angle = (Math.PI * 2 * i) / streakCount + Math.random() * 0.18;
      const streakRadius = Math.max(34, radius * (0.36 + Math.random() * 0.16));
      const x2 = x + Math.cos(angle) * streakRadius;
      const y2 = y + Math.sin(angle) * streakRadius;
      this._spawnTrail(x, y, x2, y2, i % 2 === 0 ? '#ffd180' : '#ffb74d', 0.12 + Math.random() * 0.05, 2.4 + Math.random() * 0.8);
    }
  }

  private _playChainProcFx(x: number, y: number, radius: number, chainedCount: number): void {
    const pulseRadius = Math.max(56, radius);
    this._spawnPulse(x, y, pulseRadius, '#ce93d8', 0.2);
    this._spawnPulse(x, y, pulseRadius * 0.52, '#f3e5ff', 0.13);

    const spokeCount = Math.min(6, Math.max(3, chainedCount + 2));
    for (let i = 0; i < spokeCount; i++) {
      const angle = (Math.PI * 2 * i) / spokeCount + Math.random() * 0.28;
      const length = Math.max(28, radius * (0.26 + Math.random() * 0.12));
      const x2 = x + Math.cos(angle) * length;
      const y2 = y + Math.sin(angle) * length;
      this._spawnLightning(x, y, x2, y2, i % 2 === 0 ? '#d6b3ff' : '#9fe7ff', 0.08 + Math.random() * 0.03, 2.2);
      this._spawnTrail(x, y, x2, y2, '#e9d5ff', 0.08, 1.4);
    }
  }

  private _spawnFragment(
    x: number,
    y: number,
    vx: number,
    vy: number,
    width: number,
    height: number,
    rotation: number,
    angularVelocity: number,
    life: number,
    color: string,
    edgeColor: string
  ): void {
    this._fragments.push({
      x,
      y,
      vx,
      vy,
      width,
      height,
      rotation,
      angularVelocity,
      life,
      maxLife: life,
      color,
      edgeColor,
    });
  }

  private _showFloatingNotice(x: number, y: number, text: string, color: Color): void {
    this._playFloatingText(x, y, text, color, 'notice', {
      width: 220,
      height: 42,
      fontSize: 22,
      lineHeight: 28,
      outlineWidth: 2,
      startOffsetY: 0,
      floatDistance: 72,
      duration: 0.85,
      startScale: 1,
      peakScale: 1,
      endScale: 1,
    });
  }

  private _showDamageNumber(
    x: number,
    y: number,
    value: number,
    color: Color
  ): void {
    if (value <= 0) return;
    this._playFloatingText(
      x + (Math.random() - 0.5) * 10,
      y + Math.random() * 6,
      `${Math.max(1, Math.round(value))}`,
      color,
      'damage',
      {
        width: 116,
        height: 30,
        fontSize: 18,
        lineHeight: 22,
        outlineWidth: 2,
        startOffsetY: 16,
        floatDistance: 50,
        duration: 0.4,
        startScale: 0.94,
        peakScale: 1.02,
        endScale: 0.96,
      }
    );
  }

  private _showEnemyDamageNumber(enemy: Enemy, x: number, y: number, value: number, color: Color): void {
    this._showTargetBoundDamageNumber(
      this._enemyDamageTextBindings,
      enemy,
      enemy.spawnToken,
      x,
      y,
      value,
      color,
      0.1
    );
  }

  private _showChestDamageNumber(chest: SupplyChest, x: number, y: number, value: number, color: Color): void {
    this._showTargetBoundDamageNumber(
      this._chestDamageTextBindings,
      chest,
      chest.serial,
      x,
      y,
      value,
      color,
      0.12
    );
  }

  private _showKillValueNumber(x: number, y: number, value: number): void {
    if (value <= 0) return;
    this._playFloatingText(
      x + (Math.random() - 0.5) * 12,
      y + Math.random() * 8,
      `${Math.max(1, Math.round(value))}`,
      new Color(255, 214, 120, 255),
      'kill',
      {
        width: 156,
        height: 42,
        fontSize: 28,
        lineHeight: 32,
        outlineWidth: 3,
        startOffsetY: 22,
        floatDistance: 74,
        duration: 0.62,
        startScale: 0.92,
        peakScale: 1.08,
        endScale: 0.98,
      }
    );
  }

  private _showTargetBoundDamageNumber<T extends object>(
    bindings: WeakMap<T, TargetFloatingTextBinding>,
    target: T,
    targetToken: number,
    x: number,
    y: number,
    value: number,
    color: Color,
    reuseWindow: number
  ): void {
    if (value <= 0) return;

    const existing = bindings.get(target);
    const canReuse = !!existing
      && existing.entry.active
      && existing.entry.generation === existing.entryGeneration
      && existing.targetToken === targetToken
      && this._battleElapsed <= existing.expireAt;

    if (canReuse && existing) {
      existing.expireAt = this._battleElapsed + reuseWindow;
      this._queueFloatingTextReplay(
        existing.entry,
        x + (Math.random() - 0.5) * 10,
        y + Math.random() * 6,
        `${Math.max(1, Math.round(value))}`,
        color,
        'damage',
        {
          width: 116,
          height: 30,
          fontSize: 18,
          lineHeight: 22,
          outlineWidth: 2,
          startOffsetY: 16,
          floatDistance: 50,
          duration: 0.4,
          startScale: 0.94,
          peakScale: 1.02,
          endScale: 0.96,
        }
      );
      return;
    }

    const entry = this._playFloatingText(
      x + (Math.random() - 0.5) * 10,
      y + Math.random() * 6,
      `${Math.max(1, Math.round(value))}`,
      color,
      'damage',
      {
        width: 116,
        height: 30,
        fontSize: 18,
        lineHeight: 22,
        outlineWidth: 2,
        startOffsetY: 16,
        floatDistance: 50,
        duration: 0.4,
        startScale: 0.94,
        peakScale: 1.02,
        endScale: 0.96,
      }
    );
    if (!entry) return;

    bindings.set(target, {
      entry,
      entryGeneration: entry.generation,
      targetToken,
      expireAt: this._battleElapsed + reuseWindow,
    });
  }

  private _playFloatingText(
    x: number,
    y: number,
    text: string,
    color: Color,
    styleKey: string,
    style: FloatingTextStyle
  ): FloatingTextEntry | null {
    const parent = this.explosionGraphicsNode?.parent;
    if (!parent || !text) return null;
    const entry = this._acquireFloatingText(parent, styleKey, style);
    if (!entry) return null;

    this._replayFloatingText(entry, x, y, text, color, styleKey, style);
    return entry;
  }

  private _queueFloatingTextReplay(
    entry: FloatingTextEntry,
    x: number,
    y: number,
    text: string,
    color: Color,
    styleKey: string,
    style: FloatingTextStyle
  ): void {
    entry.pendingReplay = {
      x,
      y,
      text,
      color: color.clone(),
      styleKey,
      style,
    };

    if (entry.isFinishing) {
      return;
    }
    entry.isFinishing = true;

    Tween.stopAllByTarget(entry.node);
    Tween.stopAllByTarget(entry.opacity);

    const currentPosition = entry.node.getPosition();
    const fastFinishDuration = 0.14;
    const fastEndY = currentPosition.y + Math.max(12, style.floatDistance * 0.24);

    tween(entry.node)
      .parallel(
        tween().to(fastFinishDuration, { position: new Vec3(currentPosition.x, fastEndY, 0) }),
        tween().to(fastFinishDuration, { scale: new Vec3(style.endScale, style.endScale, 1) }),
        tween(entry.opacity).to(fastFinishDuration, { opacity: 0 })
      )
      .call(() => {
        if (!entry.active) return;
        entry.isFinishing = false;
        const replay = entry.pendingReplay;
        entry.pendingReplay = null;
        if (!replay) return;
        this._replayFloatingText(
          entry,
          replay.x,
          replay.y,
          replay.text,
          replay.color,
          replay.styleKey,
          replay.style
        );
      })
      .start();
  }

  private _replayFloatingText(
    entry: FloatingTextEntry,
    x: number,
    y: number,
    text: string,
    color: Color,
    styleKey: string,
    style: FloatingTextStyle
  ): void {
    this._applyFloatingTextStyle(entry, styleKey, style);
    const startY = y + style.startOffsetY;
    entry.node.name = `${styleKey}_${text}`;
    entry.node.setPosition(x, startY, 0);
    entry.node.setScale(style.startScale, style.startScale, 1);
    entry.label.string = text;
    entry.label.color = color.clone();
    entry.opacity.opacity = 255;

    Tween.stopAllByTarget(entry.node);
    Tween.stopAllByTarget(entry.opacity);

    tween(entry.node)
      .parallel(
        tween().to(style.duration, { position: new Vec3(x, startY + style.floatDistance, 0) }),
        tween().to(style.duration * 0.28, {
          scale: new Vec3(style.peakScale, style.peakScale, 1),
        }).to(style.duration * 0.72, {
          scale: new Vec3(style.endScale, style.endScale, 1),
        }),
        tween(entry.opacity).to(style.duration, { opacity: 0 })
      )
      .call(() => this._releaseFloatingText(entry))
      .start();
  }

  private _acquireFloatingText(
    parent: Node,
    styleKey: string,
    style: FloatingTextStyle
  ): FloatingTextEntry | null {
    let entry = this._floatingTextPool.pop();
    if (!entry) {
      if (this._activeFloatingTexts.length >= GameManager.MAX_ACTIVE_FLOATING_TEXTS) {
        this._releaseFloatingText(this._activeFloatingTexts[0]);
      }
      if (this._activeFloatingTexts.length >= GameManager.MAX_ACTIVE_FLOATING_TEXTS) {
        return null;
      }
      entry = this._createFloatingTextEntry(parent);
    }

    if (!entry.node.parent) {
      parent.addChild(entry.node);
    } else if (entry.node.parent !== parent) {
      entry.node.removeFromParent();
      parent.addChild(entry.node);
    }

    this._applyFloatingTextStyle(entry, styleKey, style);
    entry.node.active = true;
    entry.generation += 1;
    entry.active = true;
    this._activeFloatingTexts.push(entry);
    return entry;
  }

  private _createFloatingTextEntry(parent: Node): FloatingTextEntry {
    const node = new Node('FloatingText');
    const transform = node.addComponent(UITransform);
    transform.setContentSize(128, 32);

    const label = node.addComponent(Label);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.isBold = true;
    label.enableOutline = true;
    label.outlineColor = new Color(16, 18, 24, 220);
    label.outlineWidth = 2;

    const opacity = node.addComponent(UIOpacity);
    opacity.opacity = 255;

    parent.addChild(node);
    node.active = false;

    return {
      node,
      label,
      opacity,
      styleKey: '',
      generation: 0,
      active: false,
      isFinishing: false,
      pendingReplay: null,
    };
  }

  private _applyFloatingTextStyle(entry: FloatingTextEntry, styleKey: string, style: FloatingTextStyle): void {
    entry.styleKey = styleKey;
    const transform = entry.node.getComponent(UITransform);
    transform?.setContentSize(style.width, style.height);
    entry.label.fontSize = style.fontSize;
    entry.label.lineHeight = style.lineHeight;
    entry.label.outlineWidth = style.outlineWidth;
  }

  private _releaseFloatingText(entry: FloatingTextEntry): void {
    if (!entry.active) return;
    entry.active = false;
    entry.isFinishing = false;
    entry.pendingReplay = null;
    entry.styleKey = '';
    Tween.stopAllByTarget(entry.node);
    Tween.stopAllByTarget(entry.opacity);
    entry.node.active = false;
    entry.opacity.opacity = 255;

    const idx = this._activeFloatingTexts.indexOf(entry);
    if (idx !== -1) {
      const last = this._activeFloatingTexts.length - 1;
      if (idx !== last) {
        this._activeFloatingTexts[idx] = this._activeFloatingTexts[last];
      }
      this._activeFloatingTexts.pop();
    }
    this._floatingTextPool.push(entry);
  }

  private _clearFloatingTexts(): void {
    while (this._activeFloatingTexts.length > 0) {
      this._releaseFloatingText(this._activeFloatingTexts[this._activeFloatingTexts.length - 1]);
    }
    this._enemyDamageTextBindings = new WeakMap();
    this._chestDamageTextBindings = new WeakMap();
  }

  private _clearTargetDamageBinding<T extends object>(
    bindings: WeakMap<T, TargetFloatingTextBinding>,
    target: T
  ): void {
    const binding = bindings.get(target);
    if (!binding) return;
    if (binding.entry.active) {
      this._releaseFloatingText(binding.entry);
    }
    bindings.delete(target);
  }

  private _getDamageNumberColor(source: DamageNumberSource): Color {
    switch (source) {
      case 'explode':
      case 'airstrike':
        return new Color(255, 172, 88, 255);
      case 'chain':
        return new Color(196, 182, 255, 255);
      case 'pierce':
        return new Color(128, 224, 255, 255);
      case 'shockwave':
        return new Color(255, 224, 148, 255);
      case 'normal':
      default:
        return new Color(255, 240, 186, 255);
    }
  }

  private _generateExplosionParticles(x: number, y: number): ExplosionParticle[] {
    const particles: ExplosionParticle[] = [];

    // 核心闪光 — 白色大圆，快速扩散后消失
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 40;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 12 + Math.random() * 8,
        life: 1,
        color: '#ffffff',
      });
    }

    // 主体火焰粒子 — 数量多、尺寸大、速度高
    const count = 35 + Math.floor(Math.random() * 20);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 4 + Math.random() * 7,
        life: 1,
        color: GameConfig.explosionColors[Math.floor(Math.random() * GameConfig.explosionColors.length)],
      });
    }

    // 大碎片 — 慢速、大尺寸、红色
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 7 + Math.random() * 6,
        life: 1,
        color: '#ff2222',
      });
    }

    // 烟雾尾迹 — 灰色、慢速、大尺寸
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        r: 8 + Math.random() * 8,
        life: 1,
        color: '#555555',
      });
    }

    return particles;
  }

  private _updateExplosions(dt: number): void {
    const graphics = this._explosionGraphics;
    if (!graphics) {
      return;
    }
    graphics.clear();

    // 预缓存 Color 对象，避免每个粒子每帧 new Color()
    const _colorCache = new Color();

    this._explosions = this._explosions.filter(ex => {
      ex.life -= dt * 1.8;
      if (ex.life <= 0) return false;

      ex.particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy -= 25 * dt;
        p.vx *= 0.97;
        p.life = Math.max(0, p.life - dt * 1.8);
      });

      ex.particles.forEach(p => {
        if (p.life <= 0) return;
        const alpha = Math.floor(p.life * 255);
        _colorCache.fromHEX(p.color);
        _colorCache.a = alpha;
        graphics.fillColor = _colorCache;
        graphics.circle(p.x, p.y, Math.max(0.5, p.r * p.life));
        graphics.fill();
      });

      return true;
    });
  }

  private _updatePulses(dt: number): void {
    const graphics = this._explosionGraphics;
    if (!graphics) return;

    const colorCache = new Color();
    this._pulses = this._pulses.filter(pulse => {
      pulse.life -= dt;
      if (pulse.life <= 0) return false;

      const progress = 1 - pulse.life / pulse.maxLife;
      pulse.radius = 10 + (pulse.maxRadius - 10) * progress;
      colorCache.fromHEX(pulse.color);
      colorCache.a = Math.floor((1 - progress) * 180);
      graphics.strokeColor = colorCache;
      graphics.lineWidth = 3;
      graphics.circle(pulse.x, pulse.y, pulse.radius);
      graphics.stroke();
      return true;
    });
  }

  private _updateTrails(dt: number): void {
    const graphics = this._explosionGraphics;
    if (!graphics) return;

    const colorCache = new Color();
    this._trails = this._trails.filter(trail => {
      trail.life -= dt;
      if (trail.life <= 0) return false;
      const alpha = Math.floor((trail.life / trail.maxLife) * 220);
      colorCache.fromHEX(trail.color);
      colorCache.a = alpha;
      graphics.strokeColor = colorCache;
      graphics.lineWidth = trail.width;
      graphics.moveTo(trail.x1, trail.y1);
      graphics.lineTo(trail.x2, trail.y2);
      graphics.stroke();
      return true;
    });
  }

  private _updateLightnings(dt: number): void {
    const graphics = this._explosionGraphics;
    if (!graphics) return;

    const colorCache = new Color();
    this._lightnings = this._lightnings.filter(lightning => {
      lightning.life -= dt;
      if (lightning.life <= 0) return false;
      const alpha = Math.floor((lightning.life / lightning.maxLife) * 255);
      colorCache.fromHEX(lightning.color);
      colorCache.a = alpha;
      graphics.strokeColor = colorCache;
      graphics.lineWidth = lightning.width;
      for (let i = 0; i < lightning.points.length - 1; i++) {
        graphics.moveTo(lightning.points[i].x, lightning.points[i].y);
        graphics.lineTo(lightning.points[i + 1].x, lightning.points[i + 1].y);
      }
      graphics.stroke();
      return true;
    });
  }

  private _updateFragments(dt: number): void {
    const graphics = this._explosionGraphics;
    if (!graphics) return;

    const fillColor = new Color();
    const edgeColor = new Color();
    this._fragments = this._fragments.filter(fragment => {
      fragment.life -= dt;
      if (fragment.life <= 0) return false;

      fragment.x += fragment.vx * dt;
      fragment.y += fragment.vy * dt;
      fragment.vx *= 0.988;
      fragment.vy -= 420 * dt;
      fragment.rotation += fragment.angularVelocity * dt;
      fragment.angularVelocity *= 0.992;

      const fade = fragment.life / fragment.maxLife;
      const hw = fragment.width * (0.86 + fade * 0.18) * 0.5;
      const hh = fragment.height * (0.86 + fade * 0.18) * 0.5;
      const cos = Math.cos(fragment.rotation);
      const sin = Math.sin(fragment.rotation);
      const corners = [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
      ].map(point => ({
        x: fragment.x + point.x * cos - point.y * sin,
        y: fragment.y + point.x * sin + point.y * cos,
      }));

      fillColor.fromHEX(fragment.color);
      fillColor.a = Math.floor(220 * fade);
      graphics.fillColor = fillColor;
      graphics.moveTo(corners[0].x, corners[0].y);
      graphics.lineTo(corners[1].x, corners[1].y);
      graphics.lineTo(corners[2].x, corners[2].y);
      graphics.lineTo(corners[3].x, corners[3].y);
      graphics.close();
      graphics.fill();

      edgeColor.fromHEX(fragment.edgeColor);
      edgeColor.a = Math.floor(235 * fade);
      graphics.strokeColor = edgeColor;
      graphics.lineWidth = 1.4;
      graphics.moveTo(corners[0].x, corners[0].y);
      graphics.lineTo(corners[1].x, corners[1].y);
      graphics.lineTo(corners[2].x, corners[2].y);
      graphics.lineTo(corners[3].x, corners[3].y);
      graphics.close();
      graphics.stroke();
      return true;
    });
  }

  // ==================== 广告、补给与结算 ====================

  private _handlePlayerDeath(): void {
    if (!this._playerCar || !this._waveManager || !this._weaponTierSystem) return;

    if (this._damageFlashNode) {
      this._damageFlashNode.active = false;
    }

    if (!this._reviveUsed && GameConfig.ads.rewarded.revive.enabled) {
      this._state = 'revive';
      this._refreshPauseButtonState();
      this._showReviveOffer();
      return;
    }

    this._enterGameOver();
  }

  private _enterVictory(): void {
    if (!this._waveManager || !this._weaponTierSystem) return;

    this._completedStageIndex = this._stageManager.currentStageIndex;
    const advanced = this._stageManager.advanceToNextStage();
    if (advanced) {
      this._currentStageIndex = this._stageManager.currentStageIndex;
      this._progressManager.unlockStage(this._currentStageIndex);
      this._progressManager.setCurrentStageIndex(this._currentStageIndex);
    }

    this._state = 'victory';
    this._audioManager?.stopBGM();
    this._closeRevivePanel();
    this._closeSupplyPanel(false);

    if (this._damageFlashNode) {
      this._damageFlashNode.active = false;
    }

    if (!this._baseRewardGranted) {
      this._baseRunReward = this._calculateRunReward();
      this._progressManager.addReward(this._baseRunReward);
      this._baseRewardGranted = true;
    }

    if (this._gameOverScreen) {
      this._gameOverScreen.showVictory(
        `第${this._completedStageIndex + 1}关`,
        this._kills,
        this._stageManager.currentStage.waveCount,
        this._getStageKillProgressText(this._completedStageIndex),
        this._baseRunReward.coins,
        this._baseRunReward.parts
      );
      if (this._doubleRewardClaimed) {
        this._gameOverScreen.setDoubleRewardAvailable(false);
      }
      this._refreshAdModeIcons(this._gameOverScreen.node);
    }
    if (this._hud) this._hud.node.active = false;
    this._refreshPauseButtonState();
  }

  private _showReviveOffer(): void {
    if (!this._revivePanelNode?.isValid) {
      console.warn('[GameManager] ReviveOfferPanel node missing, skip revive offer');
      this._enterGameOver();
      return;
    }

    this._refreshRevivePanelContent();
    this._playRevivePanelShow();
  }

  private async _handleReviveAd(): Promise<void> {
    if (this._state !== 'revive') return;

    this._state = 'ad';
    const completed = await this._adsManager.showRewarded('revive');
    if (!completed || !this._playerCar || !this._waveManager) {
      this._enterGameOver();
      return;
    }

    this._reviveUsed = true;
    this._closeRevivePanel(() => {
      if (!this._playerCar || !this._waveManager) return;
      const bonus = this._progressManager.getPermanentBonuses();
      this._playerCar.reviveWithHpRatio(
        GameConfig.gameplay.revive.hpRatio + bonus.reviveHpBonusRatio,
        GameConfig.gameplay.revive.invulnerableSeconds + bonus.reviveShieldSeconds
      );

      const clearRange = GameConfig.gameplay.revive.clearRailRange;
      for (const enemy of this._waveManager.activeEnemies) {
        if (enemy.reachedRail || enemy.y <= GameConfig.bridge.railY + clearRange) {
          enemy.pushBack(clearRange);
          enemy.freeze(1);
        }
      }

      if (this._damageFlashNode) this._damageFlashNode.active = true;
      if (this._hud) this._hud.node.active = true;
      this._state = 'playing';
      this._refreshPauseButtonState();
    });
  }

  private _closeRevivePanel(afterClose?: () => void): void {
    if (!this._revivePanelNode?.isValid) {
      afterClose?.();
      return;
    }

    this._playPopupHide(
      this._revivePanelNode,
      this._reviveBackdropNode,
      this._reviveDialogPanelNode,
      afterClose
    );
  }

  onReviveAdClick(): void {
    void this._handleReviveAd();
  }

  onReviveGiveUpClick(): void {
    if (this._state !== 'revive') return;
    this._closeRevivePanel(() => {
      this._enterGameOver();
    });
  }

  private _enterGameOver(): void {
    if (!this._waveManager || !this._weaponTierSystem) return;

    this._state = 'gameover';
    this._audioManager?.stopBGM();
    this._closeRevivePanel();
    this._closeSupplyPanel(false);

    if (this._damageFlashNode) {
      this._damageFlashNode.active = false;
    }

    if (!this._baseRewardGranted) {
      this._baseRunReward = this._calculateRunReward();
      this._progressManager.addReward(this._baseRunReward);
      this._baseRewardGranted = true;
    }

    if (this._gameOverScreen) {
      this._gameOverScreen.showGameOver(
        `第${this._stageManager.currentStageIndex + 1}关`,
        this._kills,
        this._getStageWaveNum(),
        this._getStageKillProgressText(this._stageManager.currentStageIndex),
        this._baseRunReward.coins,
        this._baseRunReward.parts
      );
      if (this._doubleRewardClaimed) {
        this._gameOverScreen.setDoubleRewardAvailable(false);
      }
      this._refreshGarageNotifyState();
      this._refreshAdModeIcons(this._gameOverScreen.node);
    }
    if (this._hud) this._hud.node.active = false;
    this._refreshPauseButtonState();
  }

  private _calculateRunReward(): RunReward {
    const cfg = GameConfig.gameplay.settlement;
    const bonus = this._progressManager.getPermanentBonuses();
    const stageDefs = (GameConfig.stages || []) as Array<{
      rewardBonus: { coins: number; parts: number };
      startWave?: number;
      waveCount: number;
    }>;
    const stage = stageDefs[this._completedStageIndex] || this._stageManager.currentStage;
    const completedWaves = this._getCompletedStageWaveCount(stage);
    const isVictoryReward = this._state === 'victory';
    const bossBonusCoins = this._waveManager?.waveIndex
      ? this._countClearedBossBonuses(this._waveManager.waveIndex)
      : 0;
    const bossBonusParts = this._waveManager?.waveIndex
      ? this._countClearedBossParts(this._waveManager.waveIndex)
      : 0;
    const stageBonusCoins = isVictoryReward ? stage.rewardBonus.coins : 0;
    const stageBonusParts = isVictoryReward ? stage.rewardBonus.parts : 0;
    return {
      coins: Math.floor((this._kills * cfg.coinsPerKill + completedWaves * cfg.coinsPerWave + bossBonusCoins + bonus.startingCoins + stageBonusCoins) * this._bonusCoinMultiplier),
      parts: Math.floor(completedWaves / 3) * cfg.partsPerThreeWaves + bossBonusParts + this._bonusFlatParts + bonus.partsFlatBonus + stageBonusParts,
    };
  }

  private _getCompletedStageWaveCount(stage: { startWave?: number; waveCount: number }): number {
    if (this._state === 'victory') {
      return Math.max(0, stage.waveCount || 0);
    }

    const startWave = Math.max(1, stage.startWave || 1);
    const currentWaveNum = this._waveManager?.currentWaveNum || startWave;
    const completed = Math.max(0, currentWaveNum - startWave);
    return Math.min(Math.max(0, stage.waveCount || 0), completed);
  }

  private async _handleDoubleRewardAd(): Promise<void> {
    if ((this._state !== 'gameover' && this._state !== 'victory') || this._doubleRewardClaimed) return;

    const settleState = this._state;
    this._state = 'ad';
    const completed = await this._adsManager.showRewarded('doubleReward');
    this._state = settleState;

    if (!completed) return;
    this._progressManager.addReward(this._baseRunReward);
    this._doubleRewardClaimed = true;
    this._gameOverScreen?.showDoubleRewardClaimed(this._baseRunReward.coins * 2, this._baseRunReward.parts * 2);
    this._gameOverScreen?.setDoubleRewardAvailable(false);
  }

  private _showSupplyChestReward(chest: SupplyChest): boolean {
    this._cacheSupplyPanelRefs();
    if (!this._supplyPanelNode?.isValid) return false;
    let currentQuality = chest.quality;
    let currentSerial = chest.serial;
    let currentChoices = this._pickSupplyOptions(currentQuality, currentSerial);
    if (currentChoices.length === 0) {
      this._showFloatingNotice(chest.x, chest.y + 44, '暂无可用补给', new Color(255, 228, 150));
      return false;
    }
    this._freezeBattle();
    this._refreshPauseButtonState();
    const renderPanel = (statusText: string): void => {
      this._populateSupplyPanel(
        `${this._getChestQualityName(currentQuality)}补给开启`,
        this._getStageEnemyHint(),
        `${this._getChestQualityName(currentQuality)}补给，当前关卡内生效`,
        statusText,
        currentChoices,
        async () => {
          if (this._getSupplyAdRefreshRemaining() <= 0) {
            this._refreshSupplyAdArea();
            if (this._supplyPanelStatusLabel) this._supplyPanelStatusLabel.string = '本局刷新次数已用完';
            return;
          }
          this._state = 'ad';
          this._refreshPauseButtonState();
          const completed = await this._adsManager.showRewarded('supply');
          this._state = 'supply';
          this._refreshPauseButtonState();
          if (!completed) {
            this._refreshSupplyAdArea();
            return;
          }
          this._supplyAdExtrasUsed++;
          currentQuality = this._getSupplyAdRefreshQuality(currentQuality);
          currentSerial += 2;
          const refreshed = this._pickSupplyOptions(currentQuality, currentSerial + this._supplyAdExtrasUsed);
          if (refreshed.length === 0) {
            this._refreshSupplyAdArea();
            if (this._supplyPanelStatusLabel) this._supplyPanelStatusLabel.string = '暂无可刷新的补给卡';
            return;
          }
          currentChoices = refreshed;
          renderPanel(`已刷新补给卡 · ${this._getChestQualityName(currentQuality)}品质概率提升`);
        },
        (option) => {
          this._closeSupplyPanelWithCallback(true, () => {
            this._applySupplyOptionAfterPanelClose(option, () => {
              this._showFloatingNotice(chest.x, chest.y + 44, option.title, new Color(255, 228, 150));
            });
          });
        }
      );
    };
    renderPanel('选择一张补给卡');
    this._state = 'supply';
    this._refreshPauseButtonState();
    return true;
  }

  private _pickSupplyOptions(chestQuality: SupplyChestQuality = 'normal', chestSerial: number = 0): SupplyOptionData[] {
    const desiredCount = Math.max(1, this._getSupplyConfig().choiceCount + this._bonusSupplyChoices);
    const maxAllowedStar = this._getMaxSupplyStarForChestQuality(chestQuality);
    const options = [...this._getSupplyConfig().options]
      .filter(option => option.star <= maxAllowedStar && this._canOfferSupplyOption(option));
    const minChestSerialToOffer = Math.max(0, Math.floor(GameConfig.gameplay.weaponEvolution.minChestSerialToOffer || 0));
    const canOfferEvolution = !!this._weaponTierSystem?.canOfferEvolution;
    if (chestSerial >= minChestSerialToOffer && canOfferEvolution && !this._weaponEvolutionId) {
      options.push(
        ...(GameConfig.gameplay.weaponEvolution.options as SupplyOptionData[])
          .filter(option => option.star <= maxAllowedStar && this._canOfferSupplyOption(option))
      );
    }
    if (options.length === 0) return [];

    const supplyTier = this._progressManager.getPermanentBonuses().supplyQualityTier || 0;
    const desiredStars = this._getSupplyStarsForChestQuality(chestQuality, chestSerial, desiredCount, supplyTier);
    const result: SupplyOptionData[] = [];
    const pickedIds = new Set<string>();

    for (const star of desiredStars) {
      const starPool = options.filter(option => option.star === star && !pickedIds.has(option.id));
      const candidate = this._pickWeightedSupplyOption(starPool, star);
      if (!candidate) continue;
      result.push(candidate);
      pickedIds.add(candidate.id);
      if (result.length >= desiredCount) {
        return result;
      }
    }

    const remaining = options.filter(option => !pickedIds.has(option.id));
    while (result.length < desiredCount && remaining.length > 0) {
      const candidate = this._pickWeightedSupplyOption(remaining, null);
      if (!candidate) break;
      result.push(candidate);
      pickedIds.add(candidate.id);
      const idx = remaining.findIndex(option => option.id === candidate.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }

    return result;
  }

  private _canOfferSupplyOption(option: SupplyOptionData): boolean {
    switch (option.effect.type) {
      case 'damageMultiplier':
        if (this._isRunDamageCapped()) return false;
        break;
      case 'fireRateMultiplier':
        if (this._isRunFireRateCapped()) return false;
        break;
      case 'projectileSpeedMultiplier':
        if (this._projectileSpeedMultiplier >= 2.2) return false;
        break;
      case 'multiShotAdd':
        if (this._getRunMultiShotCap() <= 0) return false;
        break;
      case 'spreadCountAdd':
        if (this._getRunSpreadCountCap() <= 0) return false;
        break;
      case 'weaponEvolution':
        if (!!this._weaponEvolutionId || !option.effect.evolutionId) return false;
        break;
    }

    switch (option.id) {
      case 'explode_radius_up':
        return this._weaponEvolutionId === 'mg_explode';
      case 'pierce_up':
        return this._weaponEvolutionId === 'mg_pierce';
      case 'chain_up':
      case 'chain_range_up':
        return this._weaponEvolutionId === 'mg_arc';
      default:
        return true;
    }
  }

  private _applySupplyOption(option: SupplyOptionData): void {
    if (!this._playerCar || !this._waveManager) return;

    switch (option.effect.type) {
      case 'heal':
        if (option.id === 'max_hp_up') {
          this._playerCar.increaseMaxHp(25, option.effect.value || 0);
          break;
        }
        this._playerCar.heal(option.effect.value || 0);
        break;
      case 'damageMultiplier':
        this._damageMultiplier = this._getCappedRunDamageMultiplier(this._damageMultiplier * (option.effect.value || 1));
        this._damageBoostUntilWave = 0;
        break;
      case 'fireRateMultiplier':
        this._playerCar.setFireRateMultiplier(
          this._getCappedRunFireRateMultiplier(this._playerCar.fireRateMultiplier * (option.effect.value || 1))
        );
        this._fireRateBoostUntilWave = 0;
        break;
      case 'projectileSpeedMultiplier':
        this._projectileSpeedMultiplier = Math.min(2.2, this._projectileSpeedMultiplier * Math.max(1, option.effect.value || 1));
        break;
      case 'multiShotAdd':
        this._bonusMultiShot += Math.min(
          this._getRunMultiShotCap(),
          Math.max(0, Math.round(option.effect.value || 0))
        );
        this._playerCar.setRunFirePatternBonus(this._bonusMultiShot, this._bonusSpreadCount);
        break;
      case 'spreadCountAdd':
        this._bonusSpreadCount += Math.min(
          this._getRunSpreadCountCap(),
          Math.max(0, Math.round(option.effect.value || 0))
        );
        this._playerCar.setRunFirePatternBonus(this._bonusMultiShot, this._bonusSpreadCount);
        break;
      case 'shield':
        this._playerCar.setInvulnerable(option.effect.seconds || 0);
        break;
      case 'bonusCoins':
        this._bonusCoinMultiplier *= option.effect.value || 1;
        break;
      case 'bonusParts':
        this._bonusFlatParts += Math.max(0, Math.round(option.effect.value || 0));
        break;
      case 'extraSupplyChoices':
        this._bonusSupplyChoices += Math.max(0, Math.round(option.effect.value || 0));
        break;
      case 'extraAdSupply':
        this._bonusAdSupplyCount += Math.max(0, Math.round(option.effect.value || 0));
        break;
      case 'explodeRadiusMultiplier':
        this._bonusExplodeRadiusMultiplier *= option.effect.value || 1;
        break;
      case 'pierceAdd':
        this._bonusPierceCount += Math.max(0, Math.round(option.effect.value || 0));
        break;
      case 'chainAdd':
        this._bonusChainCount += Math.max(0, Math.round(option.effect.value || 0));
        break;
      case 'chainRangeMultiplier':
        this._bonusChainRangeMultiplier *= option.effect.value || 1;
        break;
      case 'freezeAll':
        this._applyFreezeAll(option.effect.seconds || 0);
        break;
      case 'shockwave':
        this._applyShockwave(option.effect.value || 0, option.effect.damage || 0);
        break;
      case 'airstrike':
        this._applyAirstrike(option.effect.damage || 0, option.effect.radius || 0);
        break;
      case 'weaponEvolution':
        if (option.effect.evolutionId) {
          this._weaponEvolutionId = option.effect.evolutionId;
      }
        break;
    }
  }

  private _applySupplyOptionAfterPanelClose(option: SupplyOptionData, afterApply?: () => void): void {
    const apply = (): void => {
      this._applySupplyOption(option);
      afterApply?.();
    };

    if (this._isDelayedVisualSupplyOption(option)) {
      const runSerial = this._runSerial;
      this.scheduleOnce(() => {
        if (!this.node?.isValid || runSerial !== this._runSerial) return;
        apply();
      }, 0);
      return;
    }

    apply();
  }

  private _isDelayedVisualSupplyOption(option: SupplyOptionData): boolean {
    switch (option.effect.type) {
      case 'freezeAll':
      case 'shockwave':
      case 'airstrike':
        return true;
      default:
        return false;
    }
  }

  private _getUpgradedChestQuality(quality: SupplyChestQuality): SupplyChestQuality | null {
    switch (quality) {
      case 'normal':
        return 'elite';
      case 'elite':
        return 'rare';
      case 'rare':
        return 'legendary';
      default:
        return null;
    }
  }

  private _getSupplyAdRefreshQuality(baseQuality: SupplyChestQuality): SupplyChestQuality {
    return this._getUpgradedChestQuality(baseQuality) || baseQuality;
  }

  private _getSupplyAdRefreshRemaining(): number {
    return Math.max(0, GameConfig.gameplay.supply.maxAdExtrasPerRun + this._bonusAdSupplyCount - this._supplyAdExtrasUsed);
  }

  private _getSupplyConfig(): SupplyConfigData {
    return GameConfig.gameplay.supply as SupplyConfigData;
  }

  private _getSupplyStarRule(chestQuality: SupplyChestQuality): SupplyStarRuleData {
    const rules = this._getSupplyConfig().starRules;
    return rules[chestQuality] || rules.normal;
  }

  private _getSupplyStarsForChestQuality(
    chestQuality: SupplyChestQuality,
    chestSerial: number,
    desiredCount: number,
    supplyTier: number
  ): SupplyCardStar[] {
    const starRule = this._getSupplyStarRule(chestQuality);
    const maxStar = starRule.maxStar;
    const result: SupplyCardStar[] = [];
    const guaranteedStar = starRule.guaranteedStar;
    if (guaranteedStar) {
      result.push(guaranteedStar);
    }

    while (result.length < desiredCount) {
      const candidate = this._rollSupplyStar(maxStar, chestSerial, supplyTier);
      result.push(candidate);
    }

    return result;
  }

  private _getMaxSupplyStarForChestQuality(chestQuality: SupplyChestQuality): SupplyCardStar {
    return this._getSupplyStarRule(chestQuality).maxStar;
  }

  private _rollSupplyStar(maxStar: SupplyCardStar, chestSerial: number, supplyTier: number): SupplyCardStar {
    const weights = new Map<SupplyCardStar, number>();
    for (let star = 1 as SupplyCardStar; star <= maxStar; star = (star + 1) as SupplyCardStar) {
      const distanceToTop = maxStar - star;
      const baseWeight = Math.max(0.45, 2.2 - distanceToTop * 0.55);
      const serialBonus = star === maxStar ? Math.min(1.25, chestSerial * 0.1) : Math.max(0, chestSerial - distanceToTop) * 0.04;
      const qualityBonus = star === maxStar ? supplyTier * 0.16 : supplyTier * 0.05;
      weights.set(star, baseWeight + serialBonus + qualityBonus);
    }

    const total = Array.from(weights.values()).reduce((sum, value) => sum + value, 0);
    let roll = Math.random() * Math.max(0.001, total);
    for (let star = 1 as SupplyCardStar; star <= maxStar; star = (star + 1) as SupplyCardStar) {
      roll -= weights.get(star) || 0;
      if (roll <= 0) {
        return star;
      }
    }
    return maxStar;
  }

  private _pickWeightedSupplyOption(pool: SupplyOptionData[], preferredStar: SupplyCardStar | null): SupplyOptionData | null {
    if (pool.length === 0) return null;
    const weighted = pool.map(option => {
      let weight = 1 + option.star * 0.2;
      if (preferredStar && option.star === preferredStar) {
        weight *= 1.18;
      }
      if (option.cardType === 'control') {
        weight *= option.triggerMode === 'instant' ? 1.08 : 1;
      }
      weight *= this._getEvolutionSynergyWeight(option);
      return { option, score: Math.random() * weight };
    });
    weighted.sort((a, b) => b.score - a.score);
    return weighted[0]?.option || null;
  }

  private _applyFreezeAll(seconds: number): void {
    if (seconds <= 0) return;
    const enemies = this._enemies.filter(enemy => !enemy.dead);
    enemies.forEach(enemy => enemy.freeze(seconds));
    this._spawnPulse(0, GameConfig.bridge.railY + 150, 320, '#9bdcff', 0.34);
    this._spawnBurstRing(0, GameConfig.bridge.railY + 150, 210, '#b7ecff');
    this._showFloatingNotice(0, GameConfig.bridge.railY + 190, `冻结 ${seconds.toFixed(1)}s`, new Color(196, 238, 255));
  }

  private _applyShockwave(distance: number, damage: number): void {
    const originX = this._playerCar?.x || 0;
    const originY = (this._playerCar?.y || GameConfig.bridge.railY) + 96;
    this._playVisibleEnemyAreaDamageFx({
      centerX: originX,
      centerY: originY,
      maxBlastRadius: 330,
      coreHex: '#ffcb8f',
      flashHex: '#ffd79c',
      damageDelay: GameManager.SHOCKWAVE_DAMAGE_DELAY,
      onDamage: (enemy) => {
        enemy.pushBack(distance);
        if (damage > 0) {
          this._damageEnemy(enemy, damage, 'shockwave');
        }
      },
    });
  }

  private _applyAirstrike(damage: number, radius: number): void {
    this._playVisibleEnemyAreaDamageFx({
      centerX: 0,
      centerY: GameConfig.bridge.railY + 180,
      maxBlastRadius: Math.max(360, radius * 3.2),
      coreHex: '#ffb55f',
      flashHex: '#ffe7b4',
      damageDelay: GameManager.AIRSTRIKE_DAMAGE_DELAY,
      onDamage: (enemy) => {
        this._damageEnemy(enemy, Math.max(1, damage), 'airstrike');
      },
    });
  }

  private _playVisibleEnemyAreaDamageFx(config: {
    centerX: number;
    centerY: number;
    maxBlastRadius: number;
    coreHex: string;
    flashHex: string;
    damageDelay: number;
    onDamage: (enemy: Enemy) => void;
  }): void {
    const enemies = this._getAliveEnemiesSnapshot();
    if (enemies.length === 0) return;
    const targets = enemies.map(enemy => ({
      enemy,
      spawnToken: enemy.spawnToken,
    }));

    const hitPositions = enemies.map(enemy => ({ x: enemy.x, y: enemy.y }));
    this._showAreaBlastFx(
      hitPositions,
      config.centerX,
      config.centerY,
      config.maxBlastRadius,
      config.coreHex,
      config.flashHex
    );

    const runSerial = this._runSerial;
    this.scheduleOnce(() => {
      if (!this.node?.isValid || runSerial !== this._runSerial) return;
      this._suppressEnemyKillFx++;
      for (const target of targets) {
        const { enemy, spawnToken } = target;
        if (!enemy.dead && enemy.spawnToken === spawnToken) {
          config.onDamage(enemy);
        }
      }
      this._suppressEnemyKillFx--;
    }, config.damageDelay);
  }

  private _showAreaBlastFx(
    hitPositions: Array<{ x: number; y: number }>,
    centerX: number,
    centerY: number,
    maxBlastRadius: number,
    coreHex: string,
    flashHex: string
  ): void {
    const parent = this.explosionGraphicsNode?.parent || this.explosionGraphicsNode;
    if (!parent || hitPositions.length === 0) return;

    const node = new Node('AreaBlastFx');
    const transform = node.addComponent(UITransform);
    transform.setContentSize(GameConfig.canvas.width, GameConfig.canvas.height);
    node.setPosition(0, 0, 0);
    const opacity = node.addComponent(UIOpacity);
    opacity.opacity = 255;
    parent.addChild(node);

    const count = Math.min(GameManager.AIRSTRIKE_HIT_FX_LIMIT, hitPositions.length);
    const sampledHits: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < count; i++) {
      const index = Math.floor((i + 0.5) * hitPositions.length / count);
      sampledHits.push(hitPositions[Math.min(hitPositions.length - 1, index)]);
    }

    if (this._areaExplosionFrame) {
      const echoNodes = sampledHits.map((pos, index) => {
        const echoNode = new Node(`ExplosionEcho_${index}`);
        const echoTransform = echoNode.addComponent(UITransform);
        const echoSize = Math.max(
          GameManager.AREA_DAMAGE_FX_MIN_SIZE,
          maxBlastRadius * GameManager.AREA_DAMAGE_FX_SIZE_MULTIPLIER
        );
        echoTransform.setContentSize(echoSize, echoSize);
        echoNode.setPosition(pos.x, pos.y, 0);
        echoNode.setScale(new CcVec3(0.18, 0.18, 1));
        const echoSprite = echoNode.addComponent(Sprite);
        echoSprite.spriteFrame = this._areaExplosionFrame;
        echoSprite.color = index % 2 === 0
          ? new Color(255, 244, 218, 220)
          : new Color(255, 226, 184, 205);
        const echoOpacity = echoNode.addComponent(UIOpacity);
        echoOpacity.opacity = 0;
        node.addChild(echoNode);
        return { node: echoNode, opacity: echoOpacity };
      });

      tween(opacity)
        .to(0.16, { opacity: 255 })
        .to(0.56, { opacity: 220 })
        .to(0.32, { opacity: 0 })
        .call(() => {
          if (node.isValid) {
            node.destroy();
          }
        })
        .start();

      echoNodes.forEach(({ node: echoNode, opacity: echoOpacity }, index) => {
        const delay = 0.03 + index * 0.06;
        const volume = Math.max(0.72, 1.34 - index * 0.1);
        const runSerial = this._runSerial;
        this.scheduleOnce(() => {
          if (!this.node?.isValid || runSerial !== this._runSerial) return;
          this._audioManager?.heavyExplodeAt(volume);
        }, delay);
        tween(echoOpacity)
          .delay(delay)
          .to(0.1, { opacity: 235 })
          .to(0.34, { opacity: 150 })
          .to(0.24, { opacity: 0 })
          .start();
        tween(echoNode)
          .delay(delay)
          .to(0.16, { scale: new CcVec3(GameManager.AREA_DAMAGE_FX_SCALE_STAGE_1, GameManager.AREA_DAMAGE_FX_SCALE_STAGE_1, 1) })
          .to(0.28, { scale: new CcVec3(GameManager.AREA_DAMAGE_FX_SCALE_STAGE_2, GameManager.AREA_DAMAGE_FX_SCALE_STAGE_2, 1) })
          .to(0.24, { scale: new CcVec3(GameManager.AREA_DAMAGE_FX_SCALE_STAGE_3, GameManager.AREA_DAMAGE_FX_SCALE_STAGE_3, 1) })
          .start();
      });
      return;
    }

    const graphics = node.addComponent(Graphics);
    const state = { t: 0 };
    const draw = (): void => {
      const t = Math.max(0, Math.min(1, state.t));
      const charge = Math.min(1, t / 0.5);
      const blast = Math.max(0, (t - 0.22) / 0.78);
      const fade = 1 - Math.max(0, (t - 0.84) / 0.16);

      graphics.clear();

      const flash = new Color();
      flash.fromHEX(flashHex);
      flash.a = Math.floor(210 * (1 - Math.min(1, blast * 0.9)) * fade);
      graphics.fillColor = flash;
      graphics.circle(centerX, centerY, 42 + charge * 76);
      graphics.fill();

      const core = new Color();
      core.fromHEX(coreHex);
      core.a = Math.floor(225 * fade);
      graphics.fillColor = core;
      graphics.circle(centerX, centerY, 70 + blast * (maxBlastRadius * 0.7));
      graphics.fill();

      const smoke = new Color(56, 34, 24, Math.floor(108 * fade));
      graphics.fillColor = smoke;
      graphics.circle(centerX, centerY, 150 + blast * (maxBlastRadius * 0.82));
      graphics.fill();

      const burst = new Color();
      burst.fromHEX(coreHex);
      burst.a = Math.floor(180 * fade);
      graphics.fillColor = burst;
      for (const pos of sampledHits) {
        graphics.circle(pos.x, pos.y, 22 + blast * 72);
        graphics.fill();
      }

      const spark = new Color();
      spark.fromHEX(flashHex);
      spark.a = Math.floor(210 * fade);
      graphics.fillColor = spark;
      for (const pos of sampledHits) {
        graphics.circle(pos.x, pos.y, 10 + blast * 30);
        graphics.fill();
      }
    };
    draw();

    tween(state)
      .to(2.4, { t: 1 }, { onUpdate: draw })
      .call(() => node.destroy())
      .start();
  }

  private _getAliveEnemiesSnapshot(): Enemy[] {
    const alive: Enemy[] = [];
    for (const enemy of this._enemies) {
      if (!enemy.dead) {
        alive.push(enemy);
      }
    }
    return alive;
  }

  private _getSupplyCardTypeLabel(cardType: SupplyCardType): string {
    return cardType === 'control' ? '控制' : '火力';
  }

  private _getSupplyStarText(star: number): string {
    const safeStar = Math.max(0, Math.min(5, Math.round(star)));
    return '★'.repeat(safeStar);
  }

  private _getSupplyStarColor(option: SupplyOptionData): Color {
    if (option.star >= 5) {
      return new Color(255, 226, 148, 255);
    }
    return option.cardType === 'control'
      ? new Color(143, 226, 255, 255)
      : new Color(255, 204, 116, 255);
  }

  private _getRunMultiShotCap(): number {
    const basePattern = this._weaponTierSystem?.firePattern;
    const maxBurst = Math.max(...GameConfig.weaponBase.baseBurstCount, 1);
    const currentBurst = (basePattern?.multiShot || 1) + this._bonusMultiShot;
    return Math.max(0, maxBurst - currentBurst);
  }

  private _getRunSpreadCountCap(): number {
    const basePattern = this._weaponTierSystem?.firePattern;
    const maxSpread = Math.max(...GameConfig.weaponBase.baseSpreadCount, 1);
    const currentSpread = (basePattern?.count || 1) + this._bonusSpreadCount;
    return Math.max(0, maxSpread - currentSpread);
  }

  private _getCappedRunFireRateMultiplier(nextMultiplier: number): number {
    const currentBaseFireRate = this._weaponTierSystem?.fireRate || 1;
    const maxFireRate = Math.max(...GameConfig.weaponBase.fireRate, currentBaseFireRate);
    const maxMultiplier = maxFireRate / Math.max(0.001, currentBaseFireRate);
    return Math.max(0.2, Math.min(nextMultiplier, maxMultiplier));
  }

  private _isRunFireRateCapped(): boolean {
    const currentBaseFireRate = this._weaponTierSystem?.fireRate || 1;
    const maxFireRate = Math.max(...GameConfig.weaponBase.fireRate, currentBaseFireRate);
    return currentBaseFireRate * this._playerCar!.fireRateMultiplier >= maxFireRate - 0.001;
  }

  private _getCappedRunDamageMultiplier(nextMultiplier: number): number {
    const currentBaseDamage = this._weaponTierSystem?.damage || 1;
    const maxDamage = Math.max(...GameConfig.weaponBase.damage, currentBaseDamage);
    const maxMultiplier = maxDamage / Math.max(0.001, currentBaseDamage);
    return Math.max(1, Math.min(nextMultiplier, maxMultiplier));
  }

  private _isRunDamageCapped(): boolean {
    const currentBaseDamage = this._weaponTierSystem?.damage || 1;
    const maxDamage = Math.max(...GameConfig.weaponBase.damage, currentBaseDamage);
    return currentBaseDamage * this._damageMultiplier >= maxDamage - 0.001;
  }

  private _applyPendingWaveOpeningEffects(enemies: Enemy[]): void {
    if (!this._waveManager || enemies.length === 0) return;
  }

  private _refreshWaveBonuses(): void {
    if (!this._waveManager) return;
  }

  private _closeSupplyPanel(resumeGame: boolean): void {
    this._closeSupplyPanelWithCallback(resumeGame);
  }

  private _closeSupplyPanelWithCallback(resumeGame: boolean, afterClose?: () => void): void {
    const finalize = (): void => {
      this._adsManager.hideBanner();
      this._unfreezeBattle();
      if (resumeGame) {
        this._state = 'playing';
      }
      this._refreshPauseButtonState();
      afterClose?.();
    };

    if (!this._supplyPanelNode?.isValid) {
      finalize();
      return;
    }

    this._playPopupHide(
      this._supplyPanelNode,
      this._supplyPanelBlockerNode,
      this._supplyPanelRootNode,
      finalize
    );
  }

  private _buildAttackTargets(enemies: Enemy[]): AttackTarget[] {
    const targets: AttackTarget[] = [...enemies];
    targets.push(...this._getActiveSupplyChests());
    return targets;
  }

  private _getSupplyChestConfig(): SupplyChestConfigData {
    return GameConfig.gameplay.supply.chest as SupplyChestConfigData;
  }

  private _ensureSupplyChestNodes(): SupplyChest[] {
    const capacity = Math.max(1, this._getSupplyChestConfig().capacity || 1);
    const parent = this.enemiesNode || this._gameLayerNode || director.getScene()?.getChildByName('Canvas');
    while (this._supplyChests.length < capacity) {
      const chestNode = this.supplyChestPrefab ? instantiate(this.supplyChestPrefab) : new Node(`SupplyChest_${this._supplyChests.length}`);
      if (!this.supplyChestPrefab) {
        chestNode.addComponent(UITransform);
        chestNode.addComponent(SupplyChest);
      }
      chestNode.name = `SupplyChest_${this._supplyChests.length}`;
      const chest = chestNode.getComponent(SupplyChest);
      if (!chest) {
        console.warn('[GameManager] SupplyChest prefab missing SupplyChest component');
        break;
      }
      parent?.addChild(chestNode);
      chest.reset();
      this._supplyChests.push(chest);
    }
    return this._supplyChests;
  }

  private _resetSupplyChestState(): void {
    this._ensureSupplyChestNodes().forEach(chest => chest.reset());
    this._chestSpawnTimer = 0;
    this._chestSpawnDelay = this._rollNextChestDelay();
    this._chestSelectionsThisRun = 0;
    this._chestSpawnSerial = 0;
    this._setupChestTrack();
  }

  private _updateChestSpawn(dt: number, enemies: Enemy[]): void {
    if (!this._waveManager || this._waveManager.inPause) return;

    const cfg = this._getSupplyChestConfig();
    const stageWaveNum = this._getStageWaveNum();
    if (this._chestSelectionsThisRun >= cfg.maxSelectionsPerRun) return;
    if (stageWaveNum < cfg.minWave) return;
    if (enemies.length === 0) return;
    if (this._getActiveSupplyChests().length >= Math.max(1, cfg.capacity || 1)) return;

    this._chestSpawnTimer += dt;
    if (this._chestSpawnTimer < this._chestSpawnDelay) return;
    this._spawnSupplyChest();
  }

  private _spawnSupplyChest(): void {
    if (!this._waveManager) return;
    const cfg = this._getSupplyChestConfig();
    const chest = this._supplyChests.find(item => item.dead);
    if (!chest) return;
    const waveData = this._waveManager.getWaveData(Math.max(0, this._waveManager.waveIndex));
    const serial = this._chestSpawnSerial;
    const quality = this._pickChestQuality();
    const hp = this._getSupplyChestHp(serial, waveData.hp, quality);
    const slot = this._chestSlots[0];
    chest.init(quality, slot.x, this._getChestSpawnY(), hp, cfg.radius, serial, cfg.moveSpeed, 0, 0);
    chest.setTrackTarget(slot.x, slot.y);
    this._chestSpawnSerial++;
    this._reflowChestTrack();
    this._chestSpawnTimer = 0;
    this._chestSpawnDelay = this._rollNextChestDelay();
    this._showFloatingNotice(slot.x, slot.y + 56, `${this._getChestQualityName(quality)}补给入列`, new Color(255, 223, 140));
  }

  private _handleSupplyChestDestroyed(chest: SupplyChest): void {
    const cfg = this._getSupplyChestConfig();
    this._chestSelectionsThisRun++;
    this._spawnChestDestroyFx(chest);
    this._playChestDestroySfx(chest);
    this._freezeBattle();
    chest.reset();
    this._reflowChestTrack();
    this._chestSpawnTimer = 0;
    this._chestSpawnDelay = Math.max(0.15, cfg.refillDelay || 0.45);
    const runSerial = this._runSerial;
    this.scheduleOnce(() => {
      if (!this.node?.isValid || runSerial !== this._runSerial) return;
      if (!this.node?.isValid) return;
      const shown = this._showSupplyChestReward(chest);
      if (!shown) {
        this._state = 'playing';
        this._unfreezeBattle();
      }
    }, this._supplyChestRewardDelay);
  }

  private _spawnChestDestroyFx(chest: SupplyChest): void {
    const coreColor = chest.quality === 'legendary'
      ? '#ffcb69'
      : chest.quality === 'rare'
      ? '#d8a8ff'
      : chest.quality === 'elite'
        ? '#ffd36b'
        : '#ffb65c';
    const sparkColor = chest.quality === 'legendary'
      ? '#fff0c7'
      : chest.quality === 'rare'
      ? '#f4d9ff'
      : chest.quality === 'elite'
        ? '#fff1b3'
        : '#fff0d6';
    const accentColor = chest.quality === 'legendary'
      ? '#ff9465'
      : chest.quality === 'rare'
      ? '#79d6ff'
      : '#6fd3ff';
    const fragmentColor = chest.quality === 'legendary'
      ? '#726046'
      : chest.quality === 'rare'
      ? '#655a74'
      : chest.quality === 'elite'
        ? '#6c6256'
        : '#58524c';
    const fragmentEdgeColor = chest.quality === 'legendary'
      ? '#f7deb2'
      : chest.quality === 'rare'
      ? '#d7c9ea'
      : chest.quality === 'elite'
        ? '#f4dfb4'
        : '#f0d8bf';
    const baseRadius = Math.max(54, chest.radius * 1.55);

    this._spawnPulse(chest.x, chest.y, baseRadius * 1.2, coreColor, 0.2);
    this._spawnPulse(chest.x, chest.y, baseRadius * 1.75, accentColor, 0.28);
    this._spawnBurstRing(chest.x, chest.y, baseRadius * 0.95, coreColor);
    this._spawnBurstRing(chest.x, chest.y, baseRadius * 1.25, sparkColor);
    this._spawnExplosion(chest.x, chest.y);

    const arcCount = chest.quality === 'legendary' ? 16 : chest.quality === 'rare' ? 14 : chest.quality === 'elite' ? 12 : 10;
    for (let index = 0; index < arcCount; index++) {
      const angle = (Math.PI * 2 * index) / arcCount + (Math.random() - 0.5) * 0.22;
      const inner = baseRadius * (0.22 + Math.random() * 0.08);
      const outer = baseRadius * (0.92 + Math.random() * 0.55);
      const x1 = chest.x + Math.cos(angle) * inner;
      const y1 = chest.y + Math.sin(angle) * inner * 0.78;
      const x2 = chest.x + Math.cos(angle) * outer;
      const y2 = chest.y + Math.sin(angle) * outer * 0.86;
      this._spawnTrail(x1, y1, x2, y2, sparkColor, 0.18 + Math.random() * 0.06, 2.4 + Math.random() * 1.6);
    }

    const shardCount = chest.quality === 'rare' ? 9 : chest.quality === 'elite' ? 8 : 7;
    for (let index = 0; index < shardCount; index++) {
      const angle = -Math.PI * 0.82 + (Math.PI * 1.64 * index) / Math.max(1, shardCount - 1) + (Math.random() - 0.5) * 0.18;
      const distance = baseRadius * (0.65 + Math.random() * 0.45);
      const x2 = chest.x + Math.cos(angle) * distance;
      const y2 = chest.y + Math.sin(angle) * distance - Math.random() * 18;
      this._spawnTrail(chest.x, chest.y, x2, y2, accentColor, 0.14 + Math.random() * 0.05, 1.8 + Math.random() * 1.2);
    }

    const fragmentCount = chest.quality === 'rare' ? 7 : chest.quality === 'elite' ? 6 : 5;
    for (let index = 0; index < fragmentCount; index++) {
      const angle = -Math.PI * 0.74 + (Math.PI * 1.48 * index) / Math.max(1, fragmentCount - 1) + (Math.random() - 0.5) * 0.22;
      const speed = 135 + Math.random() * 95 + index * 6;
      const spawnOffset = 10 + Math.random() * 10;
      const x = chest.x + Math.cos(angle) * spawnOffset;
      const y = chest.y + Math.sin(angle) * spawnOffset * 0.7;
      this._spawnFragment(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * 0.82 + 28,
        10 + Math.random() * 9,
        5 + Math.random() * 4,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 11,
        0.34 + Math.random() * 0.08,
        fragmentColor,
        fragmentEdgeColor
      );
    }
  }

  private _playChestDestroySfx(chest: SupplyChest): void {
    if (!this._audioManager) return;

    switch (chest.quality) {
      case 'legendary':
        this._audioManager.heavyExplodeAt(0.9);
        break;
      case 'rare':
        this._audioManager.explodeAt(1.1);
        break;
      case 'elite':
        this._audioManager.explodeAt(1.0);
        break;
      default:
        this._audioManager.explodeAt(0.92);
        break;
    }
  }

  private _rollNextChestDelay(): number {
    const cfg = this._getSupplyChestConfig();
    return Math.max(0.15, cfg.baseSpawnDelay + (Math.random() * 2 - 1) * cfg.delayVariance);
  }

  private _pickChestQuality(): SupplyChestQuality {
    const serial = this._chestSpawnSerial;
    const supplyTier = this._progressManager.getPermanentBonuses().supplyQualityTier || 0;
    const rules = this._getSupplyChestConfig().qualityRules || [];
    if (rules.length === 0) return 'normal';

    const rule = rules.find((item) => serial <= item.serialMax) || rules[rules.length - 1];
    return this._rollChestQualityFromRule(rule, supplyTier);
  }

  private _rollChestQualityFromRule(rule: SupplyChestQualityRuleData, supplyTier: number): SupplyChestQuality {
    const qualityOrder: SupplyChestQuality[] = ['normal', 'elite', 'rare', 'legendary'];
    const weights = qualityOrder.map((quality) => {
      const baseWeight = Math.max(0, rule.weights[quality] || 0);
      if (quality === 'elite') return baseWeight * (1 + supplyTier * 0.08);
      if (quality === 'rare') return baseWeight * (1 + supplyTier * 0.14);
      if (quality === 'legendary') return baseWeight * (1 + supplyTier * 0.2);
      return baseWeight;
    });

    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return 'normal';

    let roll = Math.random() * total;
    for (let i = 0; i < qualityOrder.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return qualityOrder[i];
      }
    }
    return qualityOrder[qualityOrder.length - 1];
  }

  private _getChestQualityName(quality: SupplyChestQuality): string {
    const map: Record<SupplyChestQuality, string> = {
      normal: '普通',
      elite: '精英',
      rare: '稀有',
      legendary: '传奇',
    };
    return map[quality];
  }

  private _freezeBattle(): void {
    if (this._battleFrozen) return;
    this._battleFrozen = true;
    this._enemies.forEach(enemy => enemy.setBattleFrozen(true));
    this._getActiveSupplyChests().forEach(chest => chest.setBattleFrozen(true));
  }

  private _unfreezeBattle(): void {
    this._battleFrozen = false;
    this._enemies.forEach(enemy => enemy.setBattleFrozen(false));
    this._getActiveSupplyChests().forEach(chest => chest.setBattleFrozen(false));
  }

  private _populateSupplyPanel(
    title: string,
    hint: string,
    subTitle: string,
    status: string,
    choices: SupplyOptionData[],
    onAdClick: () => void | Promise<void>,
    onPick: (option: SupplyOptionData, nodes: Node[]) => void
  ): void {
    this._cacheSupplyPanelRefs();
    if (!this._supplyPanelNode) return;
    if (this._supplyPanelTitleLabel) this._supplyPanelTitleLabel.string = title;
    if (this._supplyPanelHintLabel) this._supplyPanelHintLabel.string = hint;
    if (this._supplyPanelSubTitleLabel) this._supplyPanelSubTitleLabel.string = subTitle;
    if (this._supplyPanelStatusLabel) this._supplyPanelStatusLabel.string = status;

    const panelRoot = this._supplyPanelRootNode || this._supplyPanelNode.getChildByName('PanelRoot');
    const cardsRoot = panelRoot?.getChildByName('Cards');
    const cardNames = ['CardLeft', 'CardCenter', 'CardRight'];
    const cardNodes = cardNames
      .map(name => cardsRoot?.getChildByName(name) || null)
      .filter((node): node is Node => Boolean(node));

    cardNodes.forEach((card, index) => {
      const option = choices[index];
      card.active = !!option;
      if (!option) return;

      const cardSprite = card.getComponent(Sprite);
      const titleLabel = card.getChildByName('TitleLabel')?.getComponent(Label);
      const tagLabel = card.getChildByName('TagLabel')?.getComponent(Label);
      const descLabel = card.getChildByName('DescLabel')?.getComponent(Label);
      const starLabel = card.getChildByName('StarLabel')?.getComponent(Label) || null;
      const button = card.getComponent(Button);

      if (titleLabel) titleLabel.string = option.title;
      if (tagLabel) tagLabel.string = this._getSupplyTagText(option);
      if (descLabel) descLabel.string = option.desc;

      const titleColor = option.cardType === 'control'
        ? option.star >= 5 ? new Color(255, 224, 160, 255) : new Color(158, 229, 255, 255)
        : option.star >= 5 ? new Color(255, 224, 160, 255) : new Color(255, 245, 225, 255);
      const descColor = option.cardType === 'control'
        ? new Color(208, 240, 255, 255)
        : new Color(240, 230, 214, 255);
      const starColor = this._getSupplyStarColor(option);

      if (cardSprite) {
        cardSprite.color = option.cardType === 'control'
          ? option.star >= 5 ? new Color(236, 244, 255, 255) : new Color(222, 240, 250, 255)
          : option.star >= 5 ? new Color(255, 244, 222, 255) : new Color(252, 236, 214, 255);
      }

      if (starLabel) {
        starLabel.string = this._getSupplyStarText(option.star);
        starLabel.color = starColor;
      }

      if (titleLabel) {
        titleLabel.color = titleColor;
      }
      if (descLabel) {
        descLabel.color = descColor;
      }
      if (tagLabel) {
        tagLabel.color = option.cardType === 'control'
          ? new Color(140, 226, 255, 255)
          : new Color(255, 210, 136, 255);
      }

      card.targetOff(Node.EventType.TOUCH_END);
      card.on(Node.EventType.TOUCH_END, () => onPick(option, cardNodes), this);
      if (button) button.interactable = true;
      const opacity = card.getComponent(UIOpacity) || card.addComponent(UIOpacity);
      opacity.opacity = 255;
    });

    if (this._supplyPanelAdButton) {
      this._supplyPanelAdButton.targetOff(Node.EventType.TOUCH_END);
      this._supplyPanelAdButton.on(Node.EventType.TOUCH_END, () => { void onAdClick(); }, this);
    }
    this._refreshSupplyAdArea();
    this._playSupplyPanelShow(cardNodes);
  }

  private _refreshSupplyAdArea(): void {
    const remaining = this._getSupplyAdRefreshRemaining();
    this._refreshAdModeIcons(this._supplyPanelAdButton);
    if (this._supplyPanelAdCountLabel) {
      this._supplyPanelAdCountLabel.string = `本局剩余${remaining}次`;
    }
    if (this._supplyPanelAdButton) {
      this._supplyPanelAdButton.active = remaining > 0;
    }
  }

  private _setButtonEnabled(node: Node, enabled: boolean): void {
    const button = node.getComponent(Button);
    if (button) button.interactable = enabled;
    const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    opacity.opacity = enabled ? 255 : 110;
  }

  private _cacheSupplyPanelRefs(overlayNode?: Node | null): void {
    const overlay = overlayNode
      || director.getScene()?.getChildByName('Canvas')?.getChildByName('Overlay')
      || null;

    this._supplyPanelNode = overlay?.getChildByName('SupplyPanel') || null;
    if (!this._supplyPanelNode) {
      this._supplyPanelTitleLabel = null;
      this._supplyPanelHintLabel = null;
      this._supplyPanelSubTitleLabel = null;
      this._supplyPanelStatusLabel = null;
      this._supplyPanelAdButton = null;
      this._supplyPanelAdCountLabel = null;
      this._supplyPanelBlockerNode = null;
      this._supplyPanelRootNode = null;
      return;
    }

    this._supplyPanelNode.active = false;
    this._supplyPanelBlockerNode = this._supplyPanelNode.getChildByName('Blocker') || null;
    this._supplyPanelRootNode = this._supplyPanelNode.getChildByName('PanelRoot') || null;
    const panelRoot = this._supplyPanelRootNode;
    this._supplyPanelTitleLabel = panelRoot?.getChildByName('TitleLabel')?.getComponent(Label) || null;
    this._supplyPanelHintLabel = panelRoot?.getChildByName('HintLabel')?.getComponent(Label) || null;
    this._supplyPanelSubTitleLabel = panelRoot?.getChildByName('SubTitleLabel')?.getComponent(Label) || null;
    this._supplyPanelStatusLabel = panelRoot?.getChildByName('StatusLabel')?.getComponent(Label) || null;
    this._supplyPanelAdButton = panelRoot?.getChildByName('AdButton') || null;
    this._supplyPanelAdCountLabel = this._supplyPanelAdButton?.getChildByName('AdCountLabel')?.getComponent(Label) || null;
    this._refreshAdModeIcons(this._supplyPanelAdButton);
  }

  private _cacheRevivePanelRefs(overlayNode?: Node | null): void {
    const overlay = overlayNode
      || director.getScene()?.getChildByName('Canvas')?.getChildByName('Overlay')
      || null;

    this._revivePanelNode = overlay?.getChildByName('ReviveOfferPanel') || null;
    this._reviveBackdropNode = this._revivePanelNode?.getChildByName('Backdrop') || null;
    this._reviveDialogPanelNode = this._revivePanelNode?.getChildByName('DialogPanel') || null;
    const dialogPanel = this._reviveDialogPanelNode;
    this._reviveBodyLabel = dialogPanel?.getChildByName('BodyLabel')?.getComponent(Label) || null;
    this._reviveAdButtonNode = dialogPanel?.getChildByName('ReviveAdBtn') || null;
    this._reviveGiveUpButtonNode = dialogPanel?.getChildByName('GiveUpBtn') || null;
    this._reviveAdButtonNode?.off(Node.EventType.TOUCH_END, this.onReviveAdClick, this);
    this._reviveGiveUpButtonNode?.off(Node.EventType.TOUCH_END, this.onReviveGiveUpClick, this);
    this._reviveAdButtonNode?.on(Node.EventType.TOUCH_END, this.onReviveAdClick, this);
    this._reviveGiveUpButtonNode?.on(Node.EventType.TOUCH_END, this.onReviveGiveUpClick, this);
    this._refreshAdModeIcons(this._reviveAdButtonNode);
    if (this._revivePanelNode) {
      this._revivePanelNode.active = false;
    }
  }

  private _refreshRevivePanelContent(): void {
    if (!this._reviveBodyLabel) return;
    const bonus = this._progressManager.getPermanentBonuses();
    const hpRatio = Math.round((GameConfig.gameplay.revive.hpRatio + bonus.reviveHpBonusRatio) * 100);
    const shieldSeconds = GameConfig.gameplay.revive.invulnerableSeconds + bonus.reviveShieldSeconds;
    this._reviveBodyLabel.string = `立即复活\n恢复${hpRatio}%耐久，并获得${shieldSeconds}秒无敌`;
  }

  private _isFreeAdMode(): boolean {
    return GameConfig.ads.provider === 'free';
  }

  private _refreshAdModeIcons(root: Node | null | undefined): void {
    if (!root?.isValid) return;
    const showGift = this._isFreeAdMode();
    this._setAdIconVisibility(root, showGift);
    for (const child of root.children) {
      this._refreshAdModeIcons(child);
    }
  }

  private _setAdIconVisibility(node: Node, showGift: boolean): void {
    const videoIcon = node.getChildByName('AdVideo');
    const giftIcon = node.getChildByName('GiftIcon');
    if (videoIcon) videoIcon.active = !showGift;
    if (giftIcon) giftIcon.active = showGift;
  }

  private _playSupplyPanelShow(cardNodes: Node[]): void {
    this._refreshAdModeIcons(this._supplyPanelAdButton);
    const contentNodes: Node[] = [
      this._supplyPanelTitleLabel?.node,
      this._supplyPanelHintLabel?.node,
      this._supplyPanelSubTitleLabel?.node,
      this._supplyPanelStatusLabel?.node,
      ...cardNodes,
      this._supplyPanelAdButton,
    ].filter((node): node is Node => Boolean(node));

    this._playPopupShow(
      this._supplyPanelNode,
      this._supplyPanelBlockerNode,
      this._supplyPanelRootNode,
      contentNodes
    );
  }

  private _playRevivePanelShow(): void {
    this._refreshAdModeIcons(this._reviveAdButtonNode);
    const contentNodes: Node[] = [
      this._reviveDialogPanelNode?.getChildByName('AccentBar') || null,
      this._reviveDialogPanelNode?.getChildByName('TitleLabel') || null,
      this._reviveBodyLabel?.node,
      this._reviveDialogPanelNode?.getChildByName('HintLabel') || null,
      this._reviveAdButtonNode,
      this._reviveGiveUpButtonNode,
    ].filter((node): node is Node => Boolean(node));

    this._playPopupShow(
      this._revivePanelNode,
      this._reviveBackdropNode,
      this._reviveDialogPanelNode,
      contentNodes
    );
  }

  private _playPopupShow(root: Node | null, maskNode: Node | null, panelNode: Node | null, contentNodes: Node[] = []): void {
    if (!root?.isValid || !panelNode?.isValid) return;

    root.active = true;
    this._resetPopupMask(maskNode);
    this._resetPopupPanel(panelNode);
    const uniqueContentNodes = Array.from(new Set(contentNodes.filter(node => node?.isValid)));
    uniqueContentNodes.forEach((node, index) => this._resetPopupContent(node, index));
    const panelTarget = this._getPopupBasePosition(panelNode);

    const maskOpacity = maskNode ? this._ensureOpacity(maskNode) : null;
    if (maskOpacity) {
      Tween.stopAllByTarget(maskOpacity);
      tween(maskOpacity)
        .to(GameManager.POPUP_SHOW_DURATION * 0.75, { opacity: 178 }, { easing: 'quadOut' })
        .start();
    }

    Tween.stopAllByTarget(panelNode);
    tween(panelNode)
      .to(GameManager.POPUP_SHOW_DURATION * 0.58, {
        scale: new Vec3(1.03, 1.03, 1),
        position: panelTarget.clone(),
      }, { easing: 'backOut' })
      .to(GameManager.POPUP_SHOW_DURATION * 0.42, {
        scale: new Vec3(1, 1, 1),
        position: panelTarget,
      }, { easing: 'quadOut' })
      .start();

    const panelOpacity = this._ensureOpacity(panelNode);
    Tween.stopAllByTarget(panelOpacity);
    tween(panelOpacity)
      .to(GameManager.POPUP_SHOW_DURATION * 0.82, { opacity: 255 }, { easing: 'quadOut' })
      .start();

    uniqueContentNodes.forEach((node, index) => {
      const opacity = this._ensureOpacity(node);
      const targetPosition = this._getPopupBasePosition(node);
      Tween.stopAllByTarget(node);
      Tween.stopAllByTarget(opacity);
      tween(opacity)
        .delay(0.04 + index * 0.028)
        .to(0.16, { opacity: 255 }, { easing: 'quadOut' })
        .start();
      tween(node)
        .delay(0.04 + index * 0.028)
        .to(0.18, { position: targetPosition }, { easing: 'backOut' })
        .start();
    });
  }

  private _playPopupHide(root: Node | null, maskNode: Node | null, panelNode: Node | null, afterClose?: () => void): void {
    if (!root?.isValid || !panelNode?.isValid) {
      if (root?.isValid) root.active = false;
      afterClose?.();
      return;
    }

    const maskOpacity = maskNode ? this._ensureOpacity(maskNode) : null;
    if (maskOpacity) {
      Tween.stopAllByTarget(maskOpacity);
      tween(maskOpacity)
        .to(GameManager.POPUP_HIDE_DURATION, { opacity: 0 }, { easing: 'quadIn' })
        .start();
    }

    const panelOpacity = this._ensureOpacity(panelNode);
    Tween.stopAllByTarget(panelOpacity);
    tween(panelOpacity)
      .to(GameManager.POPUP_HIDE_DURATION, { opacity: 0 }, { easing: 'quadIn' })
      .start();

    Tween.stopAllByTarget(panelNode);
    tween(panelNode)
      .to(GameManager.POPUP_HIDE_DURATION, {
        scale: new Vec3(0.96, 0.96, 1),
        position: this._getPopupBasePosition(panelNode).clone().add3f(0, -12, 0),
      }, { easing: 'quadIn' })
      .call(() => {
        if (root.isValid) {
          root.active = false;
        }
        if (panelNode.isValid) {
          panelNode.setScale(1, 1, 1);
          panelNode.setPosition(this._getPopupBasePosition(panelNode));
          this._ensureOpacity(panelNode).opacity = 255;
        }
        if (maskNode?.isValid) {
          this._ensureOpacity(maskNode).opacity = 0;
        }
        afterClose?.();
      })
      .start();
  }

  private _resetPopupMask(node: Node | null): void {
    if (!node?.isValid) return;
    const opacity = this._ensureOpacity(node);
    Tween.stopAllByTarget(opacity);
    opacity.opacity = 0;
  }

  private _resetPopupPanel(node: Node): void {
    const opacity = this._ensureOpacity(node);
    const basePosition = this._getPopupBasePosition(node);
    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(opacity);
    node.setScale(0.92, 0.92, 1);
    node.setPosition(basePosition.clone().add3f(0, 22, 0));
    opacity.opacity = 0;
  }

  private _resetPopupContent(node: Node, index: number): void {
    if (!node?.isValid) return;
    const opacity = this._ensureOpacity(node);
    const basePosition = this._getPopupBasePosition(node);
    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(opacity);
    node.setPosition(basePosition.clone().add3f(0, 10 + Math.min(index, 3) * 2, 0));
    opacity.opacity = 0;
  }

  private _getPopupBasePosition(node: Node): Vec3 {
    const carrier = node as Node & { __popupBasePosition?: Vec3 };
    if (!carrier.__popupBasePosition) {
      carrier.__popupBasePosition = node.getPosition().clone();
    }
    return carrier.__popupBasePosition.clone();
  }

  private _ensureOpacity(node: Node): UIOpacity {
    return node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
  }

  private _addToOverlay(node: Node): void {
    const canvas = director.getScene()?.getChildByName('Canvas');
    const overlay = canvas?.getChildByName('Overlay') || canvas;
    overlay?.addChild(node);
  }

  private _showWaveBanner(waveDef: WaveDefinitionData | null): void {
    if (!waveDef) return;

    if (this._waveBannerNode?.isValid) {
      this._waveBannerNode.destroy();
    }

    const banner = new Node('WaveBanner');
    const transform = banner.addComponent(UITransform);
    transform.setContentSize(420, 90);
    banner.setPosition(0, 430, 0);

    const graphics = banner.addComponent(Graphics);
    graphics.fillColor = waveDef.kind === 'boss' ? new Color(90, 34, 22, 235) : new Color(22, 32, 52, 220);
    graphics.roundRect(-210, -45, 420, 90, 12);
    graphics.fill();

    const labelNode = new Node('Label');
    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(380, 70);
    const label = labelNode.addComponent(Label);
    label.string = `第${this._getStageWaveNum()}波 ${waveDef.title}`;
    label.fontSize = 28;
    label.lineHeight = 34;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = waveDef.kind === 'boss' ? new Color(255, 224, 180) : Color.WHITE.clone();
    banner.addChild(labelNode);

    this._addToOverlay(banner);
    this._waveBannerNode = banner;
    tween(banner)
      .delay(1.6)
      .to(0.35, { position: new Vec3(0, 575, 0) })
      .call(() => {
        if (banner.isValid) banner.destroy();
        if (this._waveBannerNode === banner) this._waveBannerNode = null;
      })
      .start();
  }

  private _countClearedBossBonuses(clearedWaveIndex: number): number {
    let total = 0;
    for (let i = 0; i < clearedWaveIndex; i++) {
      const waveDef = this._waveManager?.getWaveDefinition(i);
      if (waveDef?.kind !== 'boss') continue;
      for (const entry of waveDef.entries) {
        const enemyType = GameConfig.enemyTypes[entry.type];
        total += (enemyType?.rewardCoins || 0) * entry.count;
      }
    }
    return total;
  }

  private _countClearedBossParts(clearedWaveIndex: number): number {
    let total = 0;
    for (let i = 0; i < clearedWaveIndex; i++) {
      const waveDef = this._waveManager?.getWaveDefinition(i);
      if (waveDef?.kind !== 'boss') continue;
      for (const entry of waveDef.entries) {
        const enemyType = GameConfig.enemyTypes[entry.type];
        total += (enemyType?.rewardParts || 0) * entry.count;
      }
    }
    return total;
  }

  // ==================== 状态切换 ====================

  startGame(
    startWave?: number,
    startTier?: number,
    forcedEvolution?: WeaponEvolutionId | 'none',
    previewEnemyType: PreviewEnemyType = 'mixed'
  ): void {
    const permanentBonuses = this._progressManager.getPermanentBonuses();
    this._runSerial++;
    this.unscheduleAllCallbacks();
    this._state = 'playing';
    this._kills = 0;
    this._bullets = [];
    this._explosions = [];
    this._pulses = [];
    this._accumulator = 0;
    this._reviveUsed = false;
    this._baseRunReward = { coins: 0, parts: 0 };
    this._baseRewardGranted = false;
    this._doubleRewardClaimed = false;
    this._lastSupplyWaveOffered = 0;
    this._supplyAdExtrasUsed = 0;
    this._damageMultiplier = 1;
    this._damageBoostUntilWave = 0;
    this._fireRateBoostUntilWave = 0;
    this._pendingShieldSeconds = 0;
    this._bonusCoinMultiplier = 1;
    this._bonusFlatParts = 0;
    this._bonusSupplyChoices = 0;
    this._bonusAdSupplyCount = 0;
    this._projectileSpeedMultiplier = 1;
    this._bonusMultiShot = 0;
    this._bonusSpreadCount = 0;
    this._bonusExplodeRadiusMultiplier = 1;
    this._bonusPierceCount = 0;
    this._bonusChainCount = 0;
    this._bonusChainRangeMultiplier = 1;
    this._previewEnemyType = previewEnemyType;
    this._isPreviewMode = startWave === 0;
    this._previewMovementLocked = false;
    this._weaponEvolutionId = forcedEvolution && forcedEvolution !== 'none' ? forcedEvolution : null;
    this._waveSupportTimers.clear();
    this._enemySkillIds = new WeakMap();
    this._enemySkillSeq = 0;
    this._battleFrozen = false;
    this._stageVictoryPending = false;
    this._currentStageIndex = this._progressManager.currentStageIndex;
    this._completedStageIndex = this._currentStageIndex;
    this._resetSupplyChestState();
    this._closeRevivePanel();
    this._closeSupplyPanel(false);
    if (this._waveBannerNode?.isValid) {
      this._waveBannerNode.destroy();
    }
    this._waveBannerNode = null;
    this._adsManager.hideBanner();
    this._adsManager.markRunStart();

    // 恢复并重置闪红效果
    if (this._damageFlashNode) {
      this._damageFlashNode.active = true;
    }
    if (this._borderLOpacity) this._borderLOpacity.opacity = 0;
    if (this._borderROpacity) this._borderROpacity.opacity = 0;
    this._damageFlashTimer = 0;

    // 重置系统
    this._weaponTierSystem?.reset();
    this._waveManager?.reset();
    this._stageManager.reset();
    const targetStageIndex = startWave && startWave > 1
      ? this._resolveStageIndexByWave(startWave)
      : this._currentStageIndex;
    this._stageManager.setStageIndex(targetStageIndex);
    this._currentStageIndex = targetStageIndex;
    this._completedStageIndex = targetStageIndex;

    // 设置开局基础武器档位：默认读取局外成长，调试入口可覆盖
    const resolvedStartTier = startTier && startTier > 0
      ? startTier
      : permanentBonuses.baseWeaponTier;
    this._weaponTierSystem?.setTier(resolvedStartTier);
    if (this._playerCar) {
      this._playerCar.setWeaponTierSystem(this._weaponTierSystem);
    }
    if (startWave && startWave > 1) {
      this._waveManager!.waveIndex = startWave - 1;
    } else {
      this._waveManager!.waveIndex = this._stageManager.getStageStartWave() - 1;
    }

    // 重置武装车
    this._playerCar?.setPermanentStats(GameConfig.car.hp + permanentBonuses.carHpFlat, permanentBonuses.carDamageMultiplier);
    this._playerCar?.reset();
    this._playerCar?.setFireRateMultiplier(1);
    this._playerCar?.setRunFirePatternBonus(0, 0);

    // 清空对象池
    this._bulletPool?.putAll();
    this._enemyPool?.putAll();
    this._clearFloatingTexts();

    if (startWave === 0) {
      this._startEvolutionPreview(forcedEvolution, previewEnemyType);
    } else {
      // 开始第一波
      this._waveManager?.startWave();
    }

    // 播放 BGM（在用户点击"开始游戏"的同步调用栈中，iOS 要求首次音频在用户手势内）
    this._audioManager?.startBGM();

    // 切换 UI 状态
    this._startScreenNode?.getComponent(StartScreen)?.hide();
    if (this._debugScreenNode) this._debugScreenNode.active = false;
    this._garageScreen?.hide();
    if (this._gameOverScreen) this._gameOverScreen.node.active = false;
    if (this._hud) this._hud.node.active = true;
    this._refreshPauseButtonState();
  }

  private _startEvolutionPreview(forcedEvolution?: WeaponEvolutionId | 'none', previewEnemyType: PreviewEnemyType = 'mixed'): void {
    if (!this._waveManager) return;
    this._waveManager.waveIndex = 0;

    const previewEvolution = forcedEvolution && forcedEvolution !== 'none' ? forcedEvolution : 'mg_explode';
    this._weaponEvolutionId = previewEvolution;

    const previewWave = this._waveManager.getWaveData(8);
    const formations = previewEnemyType === 'mixed'
      ? (previewEvolution === 'mg_arc'
        ? this._buildArcPreviewFormation()
        : this._buildExplodePreviewFormation())
      : this._buildSingleTypePreviewFormation(previewEnemyType);

    formations.forEach((item) => {
      this._spawnPreviewEnemy(item.type, item.x, item.y, previewWave);
    });
  }

  private _buildExplodePreviewFormation(): Array<{ type: 'normal' | 'shield' | 'boss_bulldozer'; x: number; y: number }> {
    const formations: Array<{ type: 'normal' | 'shield' | 'boss_bulldozer'; x: number; y: number }> = [];
    const columns = 6;
    const rows = 6;
    const minX = this._getPreviewEnemyMinX();
    const maxX = GameConfig.bridge.right - 34;
    const topY = GameConfig.bridge.battleTop - 118;
    const bottomY = GameConfig.bridge.railY + 264;
    const xStep = (maxX - minX) / (columns - 1);
    const yStep = (topY - bottomY) / (rows - 1);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const centerBias = Math.abs(col - (columns - 1) / 2);
        const isBossAnchor = row === 2 && (col === 2 || col === 3);
        const type = isBossAnchor ? 'boss_bulldozer' : row >= 2 && centerBias <= 1 ? 'shield' : 'normal';
        formations.push({
          type,
          x: minX + col * xStep + (row % 2 === 0 ? 0 : xStep * 0.14),
          y: topY - row * yStep,
        });
      }
    }
    return formations;
  }

  private _buildArcPreviewFormation(): Array<{ type: 'normal' | 'shield' | 'boss_commander'; x: number; y: number }> {
    const formations: Array<{ type: 'normal' | 'shield' | 'boss_commander'; x: number; y: number }> = [];
    const columns = 5;
    const rows = 6;
    const minX = this._getPreviewEnemyMinX();
    const maxX = GameConfig.bridge.right - 42;
    const topY = GameConfig.bridge.battleTop - 108;
    const bottomY = GameConfig.bridge.railY + 258;
    const xStep = (maxX - minX) / (columns - 1);
    const yStep = (topY - bottomY) / (rows - 1);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const isBossAnchor = row === 2 && col === 2;
        formations.push({
          type: isBossAnchor
            ? 'boss_commander'
            : (col === 2 && row >= 1 && row <= 4) || (row >= 2 && row <= 3 && col >= 1 && col <= 3)
              ? 'shield'
              : 'normal',
          x: minX + col * xStep + (row % 2 === 0 ? 0 : xStep * 0.1),
          y: topY - row * yStep,
        });
      }
    }
    return formations;
  }

  private _buildSingleTypePreviewFormation(
    type: 'normal' | 'shield' | 'runner' | 'suicide' | 'healer' | 'boss_bulldozer' | 'boss_commander'
  ): Array<{ type: 'normal' | 'shield' | 'runner' | 'suicide' | 'healer' | 'boss_bulldozer' | 'boss_commander'; x: number; y: number }> {
    const formations: Array<{ type: 'normal' | 'shield' | 'runner' | 'suicide' | 'healer' | 'boss_bulldozer' | 'boss_commander'; x: number; y: number }> = [];
    const isBoss = type === 'boss_bulldozer' || type === 'boss_commander';
    const columns = isBoss ? 3 : 6;
    const rows = isBoss ? 3 : 6;
    const minX = this._getPreviewEnemyMinX();
    const maxX = GameConfig.bridge.right - (isBoss ? 90 : 34);
    const topY = GameConfig.bridge.battleTop - 118;
    const bottomY = GameConfig.bridge.railY + (isBoss ? 300 : 264);
    const xStep = columns > 1 ? (maxX - minX) / (columns - 1) : 0;
    const yStep = rows > 1 ? (topY - bottomY) / (rows - 1) : 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        formations.push({
          type,
          x: minX + col * xStep + (isBoss ? 0 : (row % 2 === 0 ? 0 : xStep * 0.12)),
          y: topY - row * yStep,
        });
      }
    }
    return formations;
  }

  private _getPreviewEnemyMinX(): number {
    const chestCfg = this._getSupplyChestConfig();
    const laneCount = GameConfig.bridge.laneCount;
    const laneWidth = (GameConfig.bridge.right - GameConfig.bridge.left) / laneCount;
    const enemyStartLaneIndex = Math.max(0, Math.min(laneCount - 1, chestCfg.enemyStartLaneIndex ?? 1));
    return GameConfig.bridge.left + enemyStartLaneIndex * laneWidth + 18;
  }

  private _spawnPreviewEnemy(
    type: 'normal' | 'shield' | 'runner' | 'suicide' | 'healer' | 'boss_bulldozer' | 'boss_commander',
    x: number,
    y: number,
    waveData: WaveData
  ): void {
    if (!this._enemyPool || !this.enemiesNode || !this._waveManager) return;

    const enemy = this._enemyPool.get();
    if (!enemy) return;
    if (!enemy.node.parent) {
      this.enemiesNode.addChild(enemy.node);
    }

    enemy.init(waveData, 1, 0, 0, 1, 1, x, type);
    enemy.setWorldPosition(
      Math.max(GameConfig.bridge.left + 24, Math.min(GameConfig.bridge.right - 24, x)),
      Math.max(GameConfig.bridge.railY + 180, Math.min(GameConfig.bridge.battleTop - 80, y))
    );
    this._waveManager.enemies.push(enemy);
  }

  restart(): void {
    this._audioManager?.stopBGM();
    this.startGame();
  }

  private _showDebugScreen(): void {
    this._startScreenNode?.getComponent(StartScreen)?.hide();
    this._garageScreen?.hide();
    if (this._debugScreenNode) this._debugScreenNode.active = true;
    this._refreshPauseButtonState();
  }

  private _hideDebugScreen(): void {
    if (this._debugScreenNode) this._debugScreenNode.active = false;
    this._startScreenNode?.getComponent(StartScreen)?.show();
    this._refreshStartStageInfo();
    this._refreshPauseButtonState();
  }

  private _showGarageScreen(): void {
    if (!this._garageScreenNode || !this._garageScreen) return;
    this._startScreenNode?.getComponent(StartScreen)?.hide();
    if (this._debugScreenNode) this._debugScreenNode.active = false;
    this._garageScreen.refresh();
    this._garageScreen.show();
    this._refreshPauseButtonState();
  }

  private _hideGarageScreen(): void {
    this._garageScreen?.hide();
    this._startScreenNode?.getComponent(StartScreen)?.show();
    this._refreshStartStageInfo();
    this._refreshPauseButtonState();
  }

  private _upgradePermanentNode(id: PermanentUpgradeId): boolean {
    const upgraded = this._progressManager.upgrade(id);
    if (upgraded) {
      this._garageScreen?.refresh();
      this._refreshGarageNotifyState();
    }
    return upgraded;
  }

  private _resetGarageProgress(): void {
    this._progressManager.resetAll();
    this._syncCurrentStageSelectionFromProgress();
    this._garageScreen?.refresh();
    this._refreshStartStageInfo();
    this._refreshGarageNotifyState();
  }

  private _cachePauseButtonRefs(hudNode?: Node | null): void {
    const root = hudNode || this._hud?.node || director.getScene()?.getChildByName('Canvas')?.getChildByName('HUD') || null;
    this._pauseButtonNode = this._pauseButtonNode || root?.getChildByName('PauseButton') || null;
    this._pauseButtonLabel = this._pauseButtonLabel
      || this._pauseButtonNode?.getChildByName('Label')?.getComponent(Label)
      || null;
    this._pauseIconNode = this._pauseIconNode || this._pauseButtonNode?.getChildByName('PauseIcon') || null;
    this._playIconNode = this._playIconNode || this._pauseButtonNode?.getChildByName('PlayIcon') || null;
  }

  private _refreshPauseButtonState(): void {
    this._cachePauseButtonRefs();
    const visible = this._state === 'playing' || this._state === 'paused';
    const previewMoveToggle = this._state === 'playing' && this._isPreviewMode;
    if (this._pauseButtonNode) {
      this._pauseButtonNode.active = visible;
    }
    if (this._pauseIconNode) {
      this._pauseIconNode.active = previewMoveToggle ? !this._previewMovementLocked : this._state === 'playing';
    }
    if (this._playIconNode) {
      this._playIconNode.active = previewMoveToggle ? this._previewMovementLocked : this._state === 'paused';
    }
    if (this._pauseButtonLabel) {
      this._pauseButtonLabel.string = previewMoveToggle
        ? (this._previewMovementLocked ? '敌军放行' : '敌军禁行')
        : (this._state === 'paused' ? '继续' : '暂停');
    }
  }

  private _setPaused(paused: boolean): void {
    if (paused) {
      if (this._state !== 'playing') return;
      this._state = 'paused';
      this._accumulator = 0;
      this._playerCar?.setKeyLeft(false);
      this._playerCar?.setKeyRight(false);
      this._playerCar?.onTouchEnd();
    } else {
      if (this._state !== 'paused') return;
    this._state = 'playing';
    this._accumulator = 0;
    this._battleElapsed = 0;
    }
    this._refreshPauseButtonState();
  }

  onPauseToggleClicked(): void {
    if (this._state === 'playing' && this._isPreviewMode) {
      this._previewMovementLocked = !this._previewMovementLocked;
      this._refreshPauseButtonState();
      return;
    }
    if (this._state === 'playing') {
      this._setPaused(true);
    } else if (this._state === 'paused') {
      this._setPaused(false);
    }
  }

  private _getCurrentWeaponEvolution(): WeaponEvolutionData | null {
    if (!this._weaponEvolutionId) return null;
    const defs = GameConfig.gameplay.weaponEvolution.defs as Record<WeaponEvolutionId, WeaponEvolutionData>;
    return defs[this._weaponEvolutionId] || null;
  }

  private _getWeaponDisplayName(): string {
    const evo = this._getCurrentWeaponEvolution();
    if (!evo || !this._weaponTierSystem) {
      return this._weaponTierSystem?.weaponName || '机炮';
    }
    return `${this._weaponTierSystem.weaponName}-${evo.shortName}`;
  }

  private _getStageDisplayLabel(): string {
    return `第${this._stageManager.currentStageIndex + 1}关`;
  }

  private _getStageNameWithIndex(stageIndex: number): string {
    const stageDefs = this._getStageDefs();
    const stage = stageDefs[stageIndex];
    const stageName = stage?.name || `第${stageIndex + 1}关`;
    return `${stageIndex + 1}.${stageName}`;
  }

  private _getStageWaveNum(): number {
    if (!this._waveManager) return 1;
    return this._stageManager.getStageWaveNum(this._waveManager.currentWaveNum);
  }

  private _getStageKillGoal(stageIndex: number = this._stageManager.currentStageIndex): number {
    const stageDefs = this._getStageDefs();
    const stage = stageDefs[stageIndex];
    if (!stage) return Math.max(1, this._kills);

    const startWave = Math.max(1, stage.startWave || 1);
    const endWave = startWave + stage.waveCount - 1;
    let total = 0;
    for (let wave = startWave; wave <= endWave; wave++) {
      total += this._getWaveKillCount(wave - 1);
    }
    return Math.max(1, total);
  }

  private _getWaveKillCount(waveIndex: number): number {
    const waveDef = GameConfig.waveDefs[waveIndex] || this._waveManager?.getWaveDefinition(waveIndex) || null;
    if (waveDef) {
      let raw = 0;
      for (const entry of waveDef.entries) {
        raw += entry.count;
      }
      return Math.max(1, raw);
    }
    const waveData = this._waveManager?.getWaveData(waveIndex);
    return Math.max(1, Math.round(waveData?.count || 1));
  }

  private _getStageKillProgressPct(stageIndex: number = this._stageManager.currentStageIndex): number {
    const goal = this._getStageKillGoal(stageIndex);
    return Math.min(1, this._kills / goal);
  }

  private _getStageKillProgressText(stageIndex: number = this._stageManager.currentStageIndex): string {
    const goal = this._getStageKillGoal(stageIndex);
    const current = Math.min(this._kills, goal);
    const pct = Math.floor((current / goal) * 100);
    return `本关击杀: ${current}/${goal} (${pct}%)`;
  }

  private _getStageKillProgressHUDText(stageIndex: number = this._stageManager.currentStageIndex): string {
    const goal = this._getStageKillGoal(stageIndex);
    const current = Math.min(this._kills, goal);
    return `击毁 ${current}/${goal}`;
  }

  private _getStageEnemyHint(stageIndex: number = this._stageManager.currentStageIndex): string {
    const stageDefs = this._getStageDefs();
    const stage = stageDefs[stageIndex];
    if (!stage) return '敌情提示: 常规推进';

    const startWave = Math.max(1, stage.startWave || 1);
    const endWave = startWave + stage.waveCount - 1;
    const counts = new Map<string, number>();
    for (let wave = startWave - 1; wave < endWave; wave++) {
      const waveDef = this._waveManager?.getWaveDefinition(wave) || null;
      if (!waveDef) continue;
      for (const entry of waveDef.entries) {
        counts.set(entry.type, (counts.get(entry.type) || 0) + entry.count);
      }
    }

    const hints: string[] = [];
    if ((counts.get('runner') || 0) > 0) hints.push('高速敌多');
    if ((counts.get('shield') || 0) > 0 || (counts.get('boss_bulldozer') || 0) > 0) hints.push('重甲压力');
    if ((counts.get('healer') || 0) > 0 || (counts.get('boss_commander') || 0) > 0) hints.push('治疗/指挥');
    if ((counts.get('suicide') || 0) > 0) hints.push('自爆威胁');
    if (hints.length === 0) hints.push('常规推进');
    return `敌情提示: ${hints.join(' · ')}`;
  }

  private _getSupplyTagText(option: SupplyOptionData): string {
    const tags = this._getSupplyTags(option);
    return tags.length > 0 ? `标签: ${tags.join(' / ')}` : '标签: 通用';
  }

  private _getSupplyTags(option: SupplyOptionData): string[] {
    return [
      this._getSupplyCardTypeLabel(option.cardType),
      option.triggerMode === 'instant' ? '即时' : '持续',
    ];
  }

  private _getStageBuffSummary(): string {
    const parts: string[] = [];
    const damageBoostPct = Math.max(0, Math.round((this._damageMultiplier - 1) * 100));
    if (damageBoostPct > 0) {
      parts.push(`伤害+${damageBoostPct}%`);
    }

    const fireRateBoostPct = this._playerCar
      ? Math.max(0, Math.round((this._playerCar.fireRateMultiplier - 1) * 100))
      : 0;
    if (fireRateBoostPct > 0) {
      parts.push(`射速+${fireRateBoostPct}%`);
    }
    if (this._bonusMultiShot > 0) {
      parts.push(`连发+${this._bonusMultiShot}`);
    }
    if (this._bonusSpreadCount > 0) {
      parts.push(`并发+${this._bonusSpreadCount}`);
    }
    if (this._bonusPierceCount > 0) {
      parts.push(`穿透+${this._bonusPierceCount}`);
    }
    if (this._bonusChainCount > 0) {
      parts.push(`电弧+${this._bonusChainCount}`);
    }
    const projectileSpeedBoostPct = Math.max(0, Math.round((this._projectileSpeedMultiplier - 1) * 100));
    if (projectileSpeedBoostPct > 0) {
      parts.push(`弹速+${projectileSpeedBoostPct}%`);
    }
    const coinBoostPct = Math.max(0, Math.round((this._bonusCoinMultiplier - 1) * 100));
    if (coinBoostPct > 0) {
      parts.push(`金币+${coinBoostPct}%`);
    }
    if (this._bonusFlatParts > 0) {
      parts.push(`零件+${this._bonusFlatParts}`);
    }

    if (parts.length === 0) {
      return '本关增益: 无';
    }
    return `本关增益: ${parts.join(' · ')}`;
  }

  private _getActiveSupplyChests(): SupplyChest[] {
    return this._supplyChests.filter(chest => !chest.dead);
  }

  private _setupChestTrack(): void {
    const cfg = this._getSupplyChestConfig();
    const bridgeHeight = GameConfig.bridge.battleTop - GameConfig.bridge.railY;
    const capacity = Math.max(1, cfg.capacity || 1);
    const laneCount = GameConfig.bridge.laneCount;
    const laneWidth = (GameConfig.bridge.right - GameConfig.bridge.left) / laneCount;
    const laneIndex = Math.max(0, Math.min(laneCount - 1, cfg.laneIndex || 0));
    const laneAnchor = laneIndex <= 0 ? 0.34 : laneIndex >= laneCount - 1 ? 0.66 : 0.5;
    this._chestTrackX = GameConfig.bridge.left + (laneIndex + laneAnchor) * laneWidth;
    const stopY = GameConfig.bridge.battleTop - bridgeHeight * Math.max(0.1, Math.min(0.9, cfg.stopRatio || 0.75));
    const gap = Math.max((cfg.radius || 58) * 1.35, cfg.slotGap || 18);
    this._chestSlots = [];
    for (let i = 0; i < capacity; i++) {
      this._chestSlots.push({
        x: this._chestTrackX,
        y: stopY + gap * (capacity - 1 - i),
      });
    }
  }

  private _reflowChestTrack(): void {
    const active = this._getActiveSupplyChests().sort((a, b) => b.serial - a.serial);
    const slotCount = this._chestSlots.length;
    const startIndex = Math.max(0, slotCount - active.length);
    active.forEach((chest, index) => {
      const slot = this._chestSlots[startIndex + index];
      if (!slot) return;
      chest.setTrackTarget(slot.x, slot.y);
    });
  }

  private _getSupplyChestHp(serial: number, waveHp: number, quality: SupplyChestQuality): number {
    const cfg = this._getSupplyChestConfig();
    const waveFactor = this._getStageChestHpMultiplier();
    const qualityFactor = cfg.qualityHpMultiplier?.[quality] || 1;
    const serialGrowth = Math.max(0, cfg.serialGrowth || 0.09);
    const serialFactor = Math.pow(1 + serialGrowth, serial);
    return Math.max(50, Math.round(waveHp * (cfg.baseHpFactor || 4.8) * waveFactor * qualityFactor * serialFactor));
  }

  private _getEvolutionSynergyWeight(option: SupplyOptionData): number {
    if (!this._weaponEvolutionId) return 1;
    if (this._weaponEvolutionId === 'mg_explode' && new Set(['explode_radius_up', 'spread_count_up', 'damage_boost']).has(option.id)) return 1.8;
    if (this._weaponEvolutionId === 'mg_pierce' && new Set(['pierce_up', 'multishot_up', 'damage_boost']).has(option.id)) return 1.8;
    if (this._weaponEvolutionId === 'mg_arc' && new Set(['chain_up', 'chain_range_up']).has(option.id)) return 1.8;
    return 1;
  }

  private _applyRunWeaponBonuses(baseEvolution: WeaponEvolutionData | null): WeaponEvolutionData | null {
    if (!baseEvolution) return null;
    return {
      ...baseEvolution,
      explodeRadius: Math.round((baseEvolution.explodeRadius || 0) * this._bonusExplodeRadiusMultiplier),
      pierceCount: (baseEvolution.pierceCount || 0) + this._bonusPierceCount,
      chainCount: (baseEvolution.chainCount || 0) + this._bonusChainCount,
      chainRange: Math.round((baseEvolution.chainRange || 0) * this._bonusChainRangeMultiplier),
    };
  }

  private _getChestSpawnY(): number {
    return GameConfig.bridge.battleTop + Math.max(40, (this._getSupplyChestConfig().radius || 58) * 1.8);
  }

  private _getStageDefs(): Array<{ label: string; name: string; waveCount: number; rewardBonus: { coins: number; parts: number }; startWave?: number }> {
    return (GameConfig.stages || []) as Array<{ label: string; name: string; waveCount: number; rewardBonus: { coins: number; parts: number }; startWave?: number }>;
  }

  private _getCurrentStageDef(): {
    label: string;
    name: string;
    waveCount: number;
    rewardBonus: { coins: number; parts: number };
    startWave?: number;
    enemyHpScaleByWave?: number[];
    enemyAtkScaleByWave?: number[];
    enemySpeedScaleByWave?: number[];
    chestHpMultiplierByWave?: number[];
  } | null {
    const stageDefs = this._getStageDefs() as Array<{
      label: string;
      name: string;
      waveCount: number;
      rewardBonus: { coins: number; parts: number };
      startWave?: number;
      enemyHpScaleByWave?: number[];
      enemyAtkScaleByWave?: number[];
      enemySpeedScaleByWave?: number[];
      chestHpMultiplierByWave?: number[];
    }>;
    return stageDefs[this._stageManager.currentStageIndex] || null;
  }

  private _getStageEnemyHpScale(waveIndex: number = Math.max(0, (this._waveManager?.currentWaveNum || 1) - 1)): number {
    const stage = this._getCurrentStageDef();
    if (!stage?.enemyHpScaleByWave?.length) return 1;
    const localWave = Math.max(0, waveIndex - ((stage.startWave || 1) - 1));
    return stage.enemyHpScaleByWave[Math.min(localWave, stage.enemyHpScaleByWave.length - 1)] || 1;
  }

  private _getStageEnemyAtkScale(waveIndex: number = Math.max(0, (this._waveManager?.currentWaveNum || 1) - 1)): number {
    const stage = this._getCurrentStageDef();
    if (!stage?.enemyAtkScaleByWave?.length) return 1;
    const localWave = Math.max(0, waveIndex - ((stage.startWave || 1) - 1));
    return stage.enemyAtkScaleByWave[Math.min(localWave, stage.enemyAtkScaleByWave.length - 1)] || 1;
  }

  private _getStageEnemySpeedScale(waveIndex: number = Math.max(0, (this._waveManager?.currentWaveNum || 1) - 1)): number {
    const stage = this._getCurrentStageDef();
    if (!stage?.enemySpeedScaleByWave?.length) return 1;
    const localWave = Math.max(0, waveIndex - ((stage.startWave || 1) - 1));
    return stage.enemySpeedScaleByWave[Math.min(localWave, stage.enemySpeedScaleByWave.length - 1)] || 1;
  }

  private _getStageChestHpMultiplier(): number {
    const stage = this._getCurrentStageDef();
    if (!stage?.chestHpMultiplierByWave?.length) {
      return 1;
    }
    const localWave = Math.max(0, this._getStageWaveNum() - 1);
    return stage.chestHpMultiplierByWave[Math.min(localWave, stage.chestHpMultiplierByWave.length - 1)] || 1;
  }

  private _clampStageIndex(index: number, maxIndex?: number): number {
    const stageDefs = this._getStageDefs();
    if (stageDefs.length === 0) return 0;
    const upperBound = typeof maxIndex === 'number'
      ? Math.max(0, Math.min(maxIndex, stageDefs.length - 1))
      : stageDefs.length - 1;
    return Math.max(0, Math.min(upperBound, Math.floor(index)));
  }

  private _syncCurrentStageSelectionFromProgress(): void {
    this._currentStageIndex = this._clampStageIndex(
      this._progressManager.currentStageIndex,
      this._progressManager.unlockedStageIndex
    );
  }

  private _refreshStartStageInfo(): void {
    if (!this._startScreenNode) return;
    const startScreen = this._startScreenNode.getComponent(StartScreen);
    if (!startScreen) return;

    const stageDefs = this._getStageDefs();
    if (stageDefs.length === 0) return;
    this._currentStageIndex = this._clampStageIndex(this._currentStageIndex, this._progressManager.unlockedStageIndex);
    const stage = stageDefs[this._currentStageIndex];
    if (!stage) return;

    const canPrev = this._currentStageIndex > 0;
    const canNext = this._currentStageIndex < this._progressManager.unlockedStageIndex && this._currentStageIndex < stageDefs.length - 1;
    startScreen.updateStageInfo({
      eyebrow: '当前作战关卡',
      code: '',
      name: this._getStageNameWithIndex(this._currentStageIndex),
      waveText: `${stage.waveCount} 波`,
      rewardText: `金币 +${stage.rewardBonus.coins}`,
      partsText: stage.rewardBonus.parts > 0 ? `零件 +${stage.rewardBonus.parts}` : '',
      hintText: this._getStageEnemyHint(this._currentStageIndex).replace(/^敌情提示:\s*/, ''),
      canPrev,
      canNext,
    });
    this._refreshGarageNotifyState();
  }

  private _refreshGarageNotifyState(): void {
    const hasAvailable = this._hasAnyGarageUpgradeAvailable();
    this._startScreenNode?.getComponent(StartScreen)?.setGarageNotifyVisible(hasAvailable);
    this._gameOverScreen?.setGarageNotifyVisible(hasAvailable);
  }

  private _hasAnyGarageUpgradeAvailable(): boolean {
    const upgrades = GameConfig.progression.upgrades as Array<{ id: PermanentUpgradeId }>;
    return upgrades.some(upgrade => this._progressManager.canUpgrade(upgrade.id));
  }

  private _changeStageSelection(offset: number): void {
    const stageDefs = this._getStageDefs();
    if (stageDefs.length === 0) return;
    const maxUnlocked = Math.min(this._progressManager.unlockedStageIndex, stageDefs.length - 1);
    const next = this._clampStageIndex(this._currentStageIndex + offset, maxUnlocked);
    if (next === this._currentStageIndex) return;
    this._currentStageIndex = next;
    this._progressManager.setCurrentStageIndex(next);
    this._refreshStartStageInfo();
  }

  private _resolveStageIndexByWave(startWave: number): number {
    const stages = this._getStageDefs() as Array<{ startWave: number; waveCount: number }>;
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const endWave = stage.startWave + stage.waveCount - 1;
      if (startWave >= stage.startWave && startWave <= endWave) {
        return i;
      }
    }
    return this._clampStageIndex(this._currentStageIndex, this._progressManager.unlockedStageIndex);
  }

  setDebugWave(wave: number): void {
    this._debugWave = Math.max(1, Math.min(99, wave));
  }

  setDebugTier(tier: number): void {
    this._debugTier = Math.max(1, Math.min(6, tier));
  }

  get debugWave(): number { return this._debugWave; }
  get debugTier(): number { return this._debugTier; }
  get state(): GameState { return this._state; }
  get kills(): number { return this._kills; }
  get weaponTierSystem(): WeaponTierSystem | null { return this._weaponTierSystem; }
  get waveManager(): WaveManager | null { return this._waveManager; }
  get playerCar(): PlayerCar | null { return this._playerCar; }

  // ==================== 输入绑定 ====================

  private _bindInput(): void {
    // 键盘（全局监听）
    input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this._onKeyUp, this);

    // 触控：绑定在 GameLayer 上，只有点击游戏区域才响应，避免 HUD 区域误触
    if (this._gameLayerNode) {
      this._gameLayerNode.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
      this._gameLayerNode.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
      this._gameLayerNode.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
      this._gameLayerNode.on(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    } else {
      // 降级：GameLayer 未找到时仍用全局监听
      console.warn('[GameManager] GameLayer not found, falling back to global touch');
      input.on(Input.EventType.TOUCH_START, this._onTouchStart, this);
      input.on(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
      input.on(Input.EventType.TOUCH_END, this._onTouchEnd, this);
    }
  }

  private _onKeyDown(event: any): void {
    if (event.keyCode === KeyCode.ESCAPE) {
      this.onPauseToggleClicked();
      return;
    }
    if (!this._playerCar) return;
    if (this._state !== 'playing') return;
    if (event.keyCode === KeyCode.DIGIT_7) {
      this._applyShockwave(110, 20);
      return;
    }
    if (event.keyCode === KeyCode.DIGIT_8) {
      this._applyShockwave(170, 55);
      return;
    }
    if (event.keyCode === KeyCode.DIGIT_9) {
      this._applyAirstrike(180, 96);
      return;
    }
    if (event.keyCode === KeyCode.ARROW_LEFT || event.keyCode === KeyCode.KEY_A) {
      this._playerCar.setKeyLeft(true);
    }
    if (event.keyCode === KeyCode.ARROW_RIGHT || event.keyCode === KeyCode.KEY_D) {
      this._playerCar.setKeyRight(true);
    }
  }

  private _onKeyUp(event: any): void {
    if (this._state !== 'playing' && this._state !== 'paused') return;
    if (!this._playerCar) return;
    if (event.keyCode === KeyCode.ARROW_LEFT || event.keyCode === KeyCode.KEY_A) {
      this._playerCar.setKeyLeft(false);
    }
    if (event.keyCode === KeyCode.ARROW_RIGHT || event.keyCode === KeyCode.KEY_D) {
      this._playerCar.setKeyRight(false);
    }
  }

  private _onTouchStart(event: any): void {
    if (this._state !== 'playing') return;
    if (!this._playerCar) return;
    const worldX = this._touchToWorldX(event);
    this._playerCar.onTouchStart(worldX);
  }

  private _onTouchMove(event: any): void {
    if (this._state !== 'playing') return;
    if (!this._playerCar) return;
    const worldX = this._touchToWorldX(event);
    this._playerCar.onTouchMove(worldX);
  }

  /**
   * 将触摸 X 坐标转换为设计分辨率下的世界 X。
   * 微信小游戏与 H5 的触摸坐标缩放可能不同，统一按可见视图宽映射到 720 设计宽。
   */
  private _touchToWorldX(event: any): number {
    const location = event.getUILocation ? event.getUILocation() : event.getLocation();
    const visibleWidth = Math.max(1, view.getVisibleSize().width);
    const designX = location.x / visibleWidth * GameConfig.canvas.width;
    return designX - GameConfig.canvas.width / 2;
  }

  private _onTouchEnd(event: any): void {
    if (!this._playerCar) return;
    this._playerCar.onTouchEnd();
  }

  onDestroy(): void {
    this._audioManager?.stopBGM();
    this._clearFloatingTexts();
    // 移除键盘监听
    input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
    // 移除触控监听（根据绑定目标对应解绑）
    if (this._gameLayerNode) {
      this._gameLayerNode.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
      this._gameLayerNode.off(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
      this._gameLayerNode.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
      this._gameLayerNode.off(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    } else {
      input.off(Input.EventType.TOUCH_START, this._onTouchStart, this);
      input.off(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
      input.off(Input.EventType.TOUCH_END, this._onTouchEnd, this);
    }
  }
}

// 类型定义
interface ExplosionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  color: string;
}

interface ExplosionData {
  x: number;
  y: number;
  particles: ExplosionParticle[];
  life: number;
}

interface PulseVisualData {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

interface TrailVisualData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
  width: number;
  color: string;
}

interface LightningVisualData {
  points: Vec3[];
  life: number;
  maxLife: number;
  width: number;
  color: string;
}

interface FragmentVisualData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  rotation: number;
  angularVelocity: number;
  life: number;
  maxLife: number;
  color: string;
  edgeColor: string;
}
