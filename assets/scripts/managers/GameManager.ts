/**
 * GameManager.ts - 游戏管理器（单例）
 * 协调所有游戏系统，主循环，状态机
 */

import { _decorator, Component, Node, instantiate, Prefab, tween, Vec3, Color, Tween, input, Input, KeyCode, director, Sprite, UIOpacity, UITransform, SpriteFrame, Graphics, Label, Button, BlockInputEvents } from 'cc';
import { GameConfig, PermanentUpgradeId, SupplyChestConfigData, SupplyChestQuality, SupplyChestType, SupplyMode, SupplyOptionData, WaveDefinitionData, WeaponEvolutionData, WeaponEvolutionId } from '../data/GameConfig';
import { ExpSystem } from '../components/ExpSystem';
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

const { ccclass, property } = _decorator;

type GameState = 'start' | 'debug' | 'playing' | 'gameover' | 'victory' | 'revive' | 'supply' | 'ad';

@ccclass('GameManager')
export class GameManager extends Component {
  // 预制体引用（需在编辑器绑定）
  @property(Prefab)
  bulletPrefab: Prefab | null = null;

  @property(Prefab)
  enemyPrefab: Prefab | null = null;

  @property(Node)
  bulletPoolNode: Node | null = null;

  @property(Node)
  enemiesNode: Node | null = null;

  @property(Node)
  playerCarNode: Node | null = null;

  @property(Node)
  explosionGraphicsNode: Node | null = null;

  // 伤害闪烁效果
  private _damageFlashNode: Node | null = null;
  private _damageFlashOpacity: UIOpacity | null = null;
  private _borderLOpacity: UIOpacity | null = null;
  private _borderROpacity: UIOpacity | null = null;
  private _damageFlashTimer: number = 0;
  private readonly _damageFlashDuration: number = 0.3;

  // 游戏状态
  private _state: GameState = 'start';
  private _debugWave: number = 1;
  private _debugLevel: number = 1;

  // 系统
  private _expSystem: ExpSystem | null = null;
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
  private _kills: number = 0;
  private _reviveUsed: boolean = false;
  private _baseRunReward: RunReward = { coins: 0, parts: 0 };
  private _baseRewardGranted: boolean = false;
  private _doubleRewardClaimed: boolean = false;

  // 补给与临时增益
  private _lastSupplyWaveOffered: number = 0;
  private _supplyAdExtrasUsed: number = 0;
  private _damageMultiplier: number = 1;
  private _damageBoostUntilWave: number = 0;
  private _fireRateBoostUntilWave: number = 0;
  private _pendingFreezeSeconds: number = 0;
  private _freezeAppliedWave: number = 0;
  private _pendingAirstrikeDamage: number = 0;
  private _airstrikeAppliedWave: number = 0;
  private _pendingShieldSeconds: number = 0;
  private _pendingKnockbackDistance: number = 0;
  private _pendingSlowSeconds: number = 0;
  private _bonusCoinMultiplier: number = 1;
  private _bonusFlatParts: number = 0;
  private _bonusSupplyChoices: number = 0;
  private _bonusAdSupplyCount: number = 0;
  private _weaponEvolutionId: WeaponEvolutionId | null = null;
  private _enemySkillIds: WeakMap<Enemy, string> = new WeakMap();
  private _enemySkillSeq: number = 0;

  // 固定时间步长（避免帧率抖动导致子弹/敌人移动跳跃）
  private readonly _FIXED_DT: number = 1 / 60;  // 60Hz 固定步长
  private _accumulator: number = 0;

  // UI 引用
  private _hud: HUDController | null = null;
  private _startScreenNode: Node | null = null;
  private _gameOverScreen: GameOverScreen | null = null;
  private _debugScreen: DebugScreen | null = null;
  private _debugScreenNode: Node | null = null;
  private _garageScreen: GarageScreen | null = null;
  private _garageScreenNode: Node | null = null;
  private _gameLayerNode: Node | null = null;
  private _revivePanelNode: Node | null = null;
  private _supplyPanelNode: Node | null = null;
  private _waveBannerNode: Node | null = null;
  private _waveSupportTimers: Map<string, number> = new Map();
  private _supplyChest: SupplyChest | null = null;
  private _supplyChestNode: Node | null = null;
  private _chestSpawnTimer: number = 0;
  private _chestSpawnDelay: number = 0;
  private _chestSelectionsThisRun: number = 0;
  private _lastChestWaveSpawned: number = 0;
  private _battleFrozen: boolean = false;
  private _stageVictoryPending: boolean = false;
  private _currentStageIndex: number = 0;
  private _completedStageIndex: number = 0;

  // 触控
  private _touchStartX: number = 0;

  onLoad(): void {
    // 初始化系统
    this._expSystem = new ExpSystem();
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
    }

    // 绑定武装车回调
    if (this.playerCarNode) {
      this._playerCar = this.playerCarNode.getComponent(PlayerCar);
      if (this._playerCar) {
        this._playerCar.setExpSystem(this._expSystem);
        this._playerCar.setOnFire((x, y, level, angle, speedMult) => this._fireBullet(x, y, level, angle, speedMult));
        this._playerCar.setOnShoot(() => this._audioManager?.shoot());
      }
    }

    // 获取 UI 引用并设置初始状态
    const scene = director.getScene();
    if (scene) {
      const canvas = scene.getChildByName('Canvas');
      const overlayNode = canvas?.getChildByName('Overlay');
      this._adsManager.init(overlayNode || canvas || null);

      // StartScreen
      this._startScreenNode = overlayNode?.getChildByName('StartScreen') || null;
      if (this._startScreenNode) {
        this._startScreenNode.active = true;
        const startScreen = this._startScreenNode.getComponent(StartScreen);
        if (startScreen) {
          this._startScreenNode.active = true;
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
          this._debugScreen.setOnConfirm((wave, level, evolution) => {
            console.log('[GameManager] 调试模式开始，波次:', wave, '等级:', level, '分支:', evolution);
            this.startGame(wave, level, evolution);
          });
          this._debugScreen.setOnBack(() => {
            console.log('[GameManager] 返回开始界面');
            this._hideDebugScreen();
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

      // GameOverScreen
      const gameOverNode = overlayNode?.getChildByName('GameOverScreen') || null;
      if (gameOverNode) {
        this._gameOverScreen = gameOverNode.getComponent(GameOverScreen);
        if (this._gameOverScreen) {
          this._gameOverScreen.setOnRestart(() => {
            this.restart();
          });
          this._gameOverScreen.setOnDoubleReward(() => {
            this._handleDoubleRewardAd();
          });
          this._gameOverScreen.setOnMenu(() => {
            this._audioManager?.stopBGM();
            this._adsManager.showInterstitial('returnMenu');
            this._state = 'start';
            if (this._gameOverScreen) this._gameOverScreen.hide();
            if (this._hud) this._hud.node.active = false;
            this._syncCurrentStageSelectionFromProgress();
            if (this._startScreenNode) this._startScreenNode.active = true;
            this._refreshStartStageInfo();
            this._adsManager.showBanner('start');
          });
        }
        gameOverNode.active = false;
      }

      // HUD
      const hudNode = canvas?.getChildByName('HUD') || null;
      if (hudNode) {
        this._hud = hudNode.getComponent(HUDController);
        hudNode.active = false;
      }
    }

    // 获取爆炸绘制组件（GameLayer 是 Canvas 的子节点）
    if (!this.explosionGraphicsNode) {
      const canvas = director.getScene()?.getChildByName('Canvas');
      const gameLayer = canvas?.getChildByName('GameLayer');
      this.explosionGraphicsNode = gameLayer?.getChildByName('ExplosionGraphics') || null;
      if (this.explosionGraphicsNode) {
        console.log('[GameManager] ExplosionGraphics node found:', this.explosionGraphicsNode.name);
      } else {
        console.warn('[GameManager] ExplosionGraphics node NOT found!');
      }
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
    this._adsManager.showBanner('start');
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

  private _updatePlaying(dt: number): void {
    if (!this._waveManager || !this._playerCar || !this._expSystem) return;
    const supplyMode = this._getSupplyMode();

    // 更新屏幕闪红效果
    this._updateDamageFlash(dt);

    // 更新波次
    this._waveManager.update(dt);
    if (!this._stageVictoryPending && this._stageManager.isStageComplete(this._waveManager.currentWaveNum)) {
      this._stageVictoryPending = true;
    }
    this._refreshWaveBonuses();
    if (!this._stageVictoryPending && supplyMode === 'wave_break' && this._maybeShowSupplyOffer()) {
      return;
    }

    // 更新敌人
    const enemies = this._waveManager.activeEnemies;
    const chest = this._supplyChest;
    if (!this._battleFrozen) {
      chest?.updateChest(dt);
      this._updateChestSpawn(dt, enemies);
      enemies.forEach(e => e.update(dt));
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

    if (!this._battleFrozen && chest && !chest.dead && chest.reachedRail && chest.tryAttack(dt)) {
      this._playerCar.takeDamage(chest.atk);
      this._audioManager?.alarm();
      this.triggerDamageFlash();
      this._showFloatingNotice(chest.x, chest.y + 40, '宝箱冲撞', new Color(255, 210, 150));
    }

    // 检查玩家死亡
    if (this._playerCar.dead) {
      this._handlePlayerDeath();
      return;
    }

    if (this._stageVictoryPending && enemies.length === 0 && (!chest || chest.dead)) {
      this._enterVictory();
      return;
    }

    // 更新 HUD
    if (this._hud && this._expSystem && this._waveManager) {
      this._hud.updateHUD(
        this._getStageDisplayLabel(),
        this._getStageWaveNum(),
        this._playerCar.hp,
        this._playerCar.maxHp,
        this._getStageKillProgressPct(),
        this._getStageKillProgressText(),
        this._getWeaponDisplayName(),
        this._getStageEnemyHint(),
        this._getStageBuffSummary(),
        this._waveManager.inPause,
        this._waveManager.wavePause
      );
    }

    // 更新武装车
    this._playerCar.update(dt);

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
    // 更新子弹位置
    this._bullets.forEach(b => b.tickMove(dt));

    // 同步 _enemies 数组用于碰撞检测
    this._enemies = enemies;

    // 碰撞检测
    this._checkCollisions();

    // 更新爆炸
    this._updateExplosions(dt);
    this._updatePulses(dt);
    this._updateTrails(dt);
    this._updateLightnings(dt);

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
    if (!this._expSystem) return;
    const eCfg = GameConfig.enemy;
    const bCfg = GameConfig.bullet;

    this._bullets.forEach(b => {
      if (b.dead) return;

      if (this._supplyChest && !this._supplyChest.dead) {
        const chestDx = b.x - this._supplyChest.x;
        const chestDy = b.y - this._supplyChest.y;
        const chestThreshold = this._supplyChest.radius + bCfg.radius;
        if (chestDx * chestDx + chestDy * chestDy < chestThreshold * chestThreshold) {
          this._handleBulletHitChest(b, this._supplyChest);
          return;
        }
      }

      for (const e of this._enemies) {
        if (e.dead) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        // 距离平方比较，避免 Math.sqrt 开方运算
        const threshold = eCfg.width / 2 + bCfg.radius;
        const distSq = dx * dx + dy * dy;
        if (distSq < threshold * threshold) {
          this._audioManager?.enemyHit();
          this._handleBulletHit(b, e);
          break;
        }
      }
    });
  }

  private _handleBulletHitChest(bullet: Bullet, chest: SupplyChest): void {
    const destroyed = chest.takeDamage(bullet.damage);
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
    this._damageEnemy(enemy, bullet.damage);
    if (bullet.behavior === 'explode' && bullet.explodeRadius > 0) {
      this._applyExplosionDamage(
        enemy,
        bullet.explodeRadius,
        Math.max(1, Math.round(bullet.damage * Math.max(0.1, bullet.splashMultiplier)))
      );
      this._spawnPulse(enemy.x, enemy.y, bullet.explodeRadius * 0.72, '#ffb74d', 0.22);
      this._spawnBurstRing(enemy.x, enemy.y, bullet.explodeRadius * 0.82, '#ff8f00');
      this._showFloatingNotice(enemy.x, enemy.y + 24, '爆裂', new Color(255, 196, 120));
    }
    if (bullet.behavior === 'chain' && bullet.chainCount > 0 && bullet.chainRange > 0) {
      const chained = this._applyChainDamage(enemy, bullet.chainCount, bullet.chainRange, Math.max(1, Math.round(bullet.damage * Math.max(0.1, bullet.chainMultiplier))));
      if (chained > 0) {
        this._spawnPulse(enemy.x, enemy.y, Math.max(60, bullet.chainRange * 0.5), '#ce93d8', 0.2);
        this._showFloatingNotice(enemy.x, enemy.y + 24, '电弧', new Color(220, 180, 255));
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

  private _damageEnemy(enemy: Enemy, damage: number): boolean {
    if (enemy.dead) return false;
    enemy.takeDamage(damage);
    if (!enemy.dead && this._pendingKnockbackDistance > 0) {
      enemy.pushBack(this._pendingKnockbackDistance);
    }
    if (!enemy.dead && this._pendingSlowSeconds > 0) {
      enemy.freeze(this._pendingSlowSeconds);
    }
    if (enemy.dead) {
      this._handleEnemyKilled(enemy);
      return true;
    }
    return false;
  }

  private _applyExplosionDamage(centerEnemy: Enemy, radius: number, damage: number): void {
    const radiusSq = radius * radius;
    for (const enemy of this._enemies) {
      if (enemy.dead || enemy === centerEnemy) continue;
      const dx = enemy.x - centerEnemy.x;
      const dy = enemy.y - centerEnemy.y;
      if (dx * dx + dy * dy > radiusSq) continue;
      this._damageEnemy(enemy, damage);
    }
  }

  private _applyChainDamage(sourceEnemy: Enemy, chainCount: number, chainRange: number, damage: number): number {
    const hit = new Set<Enemy>([sourceEnemy]);
    let current = sourceEnemy;
    let chained = 0;
    for (let i = 0; i < chainCount; i++) {
      const next = this._findClosestEnemy(current, hit, chainRange);
      if (!next) break;
      hit.add(next);
      this._spawnLightning(current.x, current.y, next.x, next.y, '#d6b3ff', 0.12, 3);
      this._damageEnemy(next, damage);
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
    this._spawnExplosion(enemy.x, enemy.y);
    this._audioManager?.explode();
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
      this._showFloatingNotice(enemy.x, enemy.y + 34, '治疗脉冲', new Color(120, 255, 190));
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
    this._showFloatingNotice(enemy.x, enemy.y + 40, '冲锋增援', new Color(255, 210, 120));
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
      this._showFloatingNotice(enemy.x, enemy.y + 42, '全军加速', new Color(220, 180, 255));
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
      this._showFloatingNotice(enemy.x, enemy.y + 52, '援军到场', new Color(255, 170, 210));
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
    enemy.setWorldPosition(enemy.x, Math.min(GameConfig.bridge.top + 140, y));
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

  private _fireBullet(x: number, y: number, level: number, angle: number = 90, speedMult: number = 1.0): void {
    if (!this._bulletPool || !this.bulletPoolNode) return;

    const bullet = this._bulletPool.get();
    if (bullet) {
      bullet.init(
        x,
        y,
        level,
        angle,
        speedMult,
        this._damageMultiplier * (this._playerCar?.damageMultiplier || 1),
        this._getCurrentWeaponEvolution()
      );
      // 只在首次挂载时 addChild，避免重复挂载触发 transform 重建
      if (!bullet.node.parent) {
        this.bulletPoolNode.addChild(bullet.node);
      }
      this._bullets.push(bullet);
    }
  }

  private _spawnExplosion(x: number, y: number): void {
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

  private _showFloatingNotice(x: number, y: number, text: string, color: Color): void {
    const parent = this.explosionGraphicsNode?.parent;
    if (!parent) return;

    const node = new Node(`Notice_${text}`);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(220, 42);
    node.setPosition(x, y, 0);

    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = 22;
    label.lineHeight = 28;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = color.clone();

    const opacity = node.addComponent(UIOpacity);
    opacity.opacity = 255;
    parent.addChild(node);

    tween(node)
      .parallel(
        tween().to(0.85, { position: new Vec3(x, y + 72, 0) }),
        tween(opacity).to(0.85, { opacity: 0 })
      )
      .call(() => node.destroy())
      .start();
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
    const graphics = this.explosionGraphicsNode?.getComponent(Graphics);
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
    const graphics = this.explosionGraphicsNode?.getComponent(Graphics);
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
    const graphics = this.explosionGraphicsNode?.getComponent(Graphics);
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
    const graphics = this.explosionGraphicsNode?.getComponent(Graphics);
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

  // ==================== 广告、补给与结算 ====================

  private _handlePlayerDeath(): void {
    if (!this._playerCar || !this._waveManager || !this._expSystem) return;

    if (this._damageFlashNode) {
      this._damageFlashNode.active = false;
    }

    if (!this._reviveUsed && GameConfig.ads.rewarded.revive.enabled) {
      this._state = 'revive';
      this._showReviveOffer();
      return;
    }

    this._enterGameOver();
  }

  private _enterVictory(): void {
    if (!this._waveManager || !this._expSystem) return;

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
        this._gameOverScreen.setDoubleRewardAvailable(false, '双倍奖励已领取');
      }
    }
    if (this._hud) this._hud.node.active = false;
    this._adsManager.showBanner('gameOver');
  }

  private _showReviveOffer(): void {
    if (this._revivePanelNode?.isValid) return;

    const panel = this._createModalRoot('ReviveOfferPanel');
    this._createModalLabel(panel, 'ReviveTitle', '车辆损毁', 54, 180, new Color(255, 92, 92));
    this._createModalLabel(panel, 'ReviveBody', `看广告复活\n恢复${Math.round(GameConfig.gameplay.revive.hpRatio * 100)}%耐久，并获得${GameConfig.gameplay.revive.invulnerableSeconds}秒无敌`, 28, 70, Color.WHITE);
    this._createModalButton(panel, 'ReviveAdBtn', '看广告复活', 0, () => this._handleReviveAd(), 340, 78, new Color(255, 210, 92));
    this._createModalButton(panel, 'GiveUpBtn', '放弃并结算', -100, () => {
      this._closeRevivePanel();
      this._enterGameOver();
    }, 300, 66, new Color(70, 78, 92));

    this._addToOverlay(panel);
    this._revivePanelNode = panel;
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
    this._closeRevivePanel();
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
  }

  private _closeRevivePanel(): void {
    if (this._revivePanelNode?.isValid) {
      this._revivePanelNode.destroy();
    }
    this._revivePanelNode = null;
  }

  private _enterGameOver(): void {
    if (!this._waveManager || !this._expSystem) return;

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
        this._gameOverScreen.setDoubleRewardAvailable(false, '双倍奖励已领取');
      }
    }
    if (this._hud) this._hud.node.active = false;
    this._adsManager.showBanner('gameOver');
  }

  private _calculateRunReward(): RunReward {
    const wave = this._waveManager?.currentWaveNum || 1;
    const cfg = GameConfig.gameplay.settlement;
    const bonus = this._progressManager.getPermanentBonuses();
    const stageDefs = (GameConfig.stages || []) as Array<{ rewardBonus: { coins: number; parts: number } }>;
    const stage = stageDefs[this._completedStageIndex] || this._stageManager.currentStage;
    const bossBonusCoins = this._waveManager?.waveIndex
      ? this._countClearedBossBonuses(this._waveManager.waveIndex)
      : 0;
    const bossBonusParts = this._waveManager?.waveIndex
      ? this._countClearedBossParts(this._waveManager.waveIndex)
      : 0;
    return {
      coins: Math.floor((this._kills * cfg.coinsPerKill + wave * cfg.coinsPerWave + bossBonusCoins + bonus.startingCoins + stage.rewardBonus.coins) * this._bonusCoinMultiplier),
      parts: Math.floor(wave / 3) * cfg.partsPerThreeWaves + bossBonusParts + this._bonusFlatParts + bonus.partsFlatBonus + stage.rewardBonus.parts,
    };
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
    this._gameOverScreen?.setDoubleRewardAvailable(false, '双倍奖励已领取');
  }

  private _maybeShowSupplyOffer(): boolean {
    if (!this._waveManager || !this._playerCar) return false;
    if (!this._waveManager.inPause) return false;

    const nextWave = this._waveManager.currentWaveNum;
    if (this._lastSupplyWaveOffered === nextWave) return false;
    if (!this._shouldOfferSupply(nextWave)) return false;

    this._lastSupplyWaveOffered = nextWave;
    this._state = 'supply';
    this._showSupplyPanel(nextWave);
    return true;
  }

  private _shouldOfferSupply(nextWave: number): boolean {
    if (nextWave <= 1) return false;
    const cfg = GameConfig.gameplay.supply;
    const regular = cfg.offerEveryWaves > 0 && nextWave % cfg.offerEveryWaves === 0;
    const boss = cfg.bossWaveEvery > 0 && nextWave % cfg.bossWaveEvery === 0;
    return regular || boss;
  }

  private _showSupplyPanel(nextWave: number): void {
    if (this._supplyPanelNode?.isValid) return;

    this._freezeBattle();
    this._adsManager.showBanner('supply');
    const choices = this._pickSupplyOptions();
    const picked = new Set<string>();
    let freePicked = false;

    const panel = this._createModalRoot('SupplyPanel');
    this._createModalLabel(panel, 'SupplyTitle', `第${nextWave}波前补给`, 46, 250, new Color(255, 226, 130));
    this._createModalLabel(panel, 'SupplyHint', this._getStageEnemyHint(), 22, 205, new Color(190, 210, 255));
    const statusLabel = this._createModalLabel(panel, 'SupplyStatus', '选择一个免费补给', 24, 175, Color.WHITE);

    const optionButtons: Node[] = [];
    choices.forEach((option, index) => {
      const y = 115 - index * 82;
      const button = this._createModalButton(
        panel,
        `SupplyOption_${option.id}`,
        `${option.title}\n${this._getSupplyTagText(option)}\n${option.desc}`,
        y,
        () => {
          if (freePicked) return;
          freePicked = true;
          picked.add(option.id);
          this._applySupplyOption(option);
          const label = statusLabel.getComponent(Label);
          if (label) label.string = `已获得: ${option.title}`;
          optionButtons.forEach(btn => this._setButtonEnabled(btn, false));
        },
        500,
        72,
        new Color(52, 68, 86)
      );
      optionButtons.push(button);
    });

    this._createModalButton(panel, 'SupplyAdExtraBtn', '看广告再拿一项', -180, async () => {
      if (!freePicked) {
        const label = statusLabel.getComponent(Label);
        if (label) label.string = '请先选择一个免费补给';
        return;
      }
      if (this._supplyAdExtrasUsed >= GameConfig.gameplay.supply.maxAdExtrasPerRun + this._bonusAdSupplyCount) {
        const label = statusLabel.getComponent(Label);
        if (label) label.string = '本局额外补给次数已用完';
        return;
      }

      this._state = 'ad';
      const completed = await this._adsManager.showRewarded('supply');
      this._state = 'supply';
      if (!completed) return;

      const extra = choices.find(option => !picked.has(option.id));
      if (extra) {
        picked.add(extra.id);
        this._applySupplyOption(extra);
        this._supplyAdExtrasUsed++;
      }
      this._closeSupplyPanel(true);
    }, 360, 68, new Color(255, 210, 92));

    this._createModalButton(panel, 'SupplyContinueBtn', '继续战斗', -270, () => {
      this._closeSupplyPanel(true);
    }, 300, 62, new Color(70, 78, 92));

    this._addToOverlay(panel);
    this._supplyPanelNode = panel;
  }

  private _showSupplyChestReward(chest: SupplyChest): void {
    if (this._supplyPanelNode?.isValid) return;

    this._freezeBattle();
    this._adsManager.showBanner('supply');
    const choices = this._pickSupplyOptions(chest.chestType, chest.quality);
    const picked = new Set<string>();
    let freePicked = false;

    const panel = this._createModalRoot('ChestSupplyPanel');
    this._createModalLabel(panel, 'ChestSupplyTitle', `${this._getChestDisplayName(chest.chestType)}开启`, 42, 250, new Color(255, 226, 130));
    this._createModalLabel(panel, 'ChestSupplyHint', this._getStageEnemyHint(), 20, 208, new Color(190, 210, 255));
    const subtitle = `${this._getChestQualityName(chest.quality)}补给，当前关卡内生效`;
    this._createModalLabel(panel, 'ChestSupplySubTitle', subtitle, 22, 182, new Color(190, 210, 255));
    const statusLabel = this._createModalLabel(panel, 'ChestSupplyStatus', '选择一个战场补给', 24, 148, Color.WHITE);

    const optionButtons: Node[] = [];
    choices.forEach((option, index) => {
      const y = 70 - index * 82;
      const button = this._createModalButton(
        panel,
        `ChestSupplyOption_${option.id}`,
        `${option.title}\n${this._getSupplyTagText(option)}\n${option.desc}`,
        y,
        () => {
          if (freePicked) return;
          freePicked = true;
          picked.add(option.id);
          this._applySupplyOption(option);
          const label = statusLabel.getComponent(Label);
          if (label) label.string = `已获得: ${option.title}`;
          optionButtons.forEach(btn => this._setButtonEnabled(btn, false));
          this._showFloatingNotice(chest.x, chest.y + 44, option.title, new Color(255, 228, 150));
        },
        500,
        72,
        new Color(52, 68, 86)
      );
      optionButtons.push(button);
    });

    this._createModalButton(panel, 'ChestSupplyAdExtraBtn', '看广告再拿一项', -200, async () => {
      if (!freePicked) {
        const label = statusLabel.getComponent(Label);
        if (label) label.string = '请先选择一个免费补给';
        return;
      }
      if (this._supplyAdExtrasUsed >= GameConfig.gameplay.supply.maxAdExtrasPerRun + this._bonusAdSupplyCount) {
        const label = statusLabel.getComponent(Label);
        if (label) label.string = '本局额外补给次数已用完';
        return;
      }

      this._state = 'ad';
      const completed = await this._adsManager.showRewarded('supply');
      this._state = 'supply';
      if (!completed) return;

      const extra = choices.find(option => !picked.has(option.id));
      if (extra) {
        picked.add(extra.id);
        this._applySupplyOption(extra);
        this._supplyAdExtrasUsed++;
      }
      this._closeSupplyPanel(true);
    }, 360, 68, new Color(255, 210, 92));

    this._createModalButton(panel, 'ChestSupplyContinueBtn', '继续战斗', -290, () => {
      this._closeSupplyPanel(true);
    }, 300, 62, new Color(70, 78, 92));

    this._addToOverlay(panel);
    this._supplyPanelNode = panel;
    this._state = 'supply';
  }

  private _pickSupplyOptions(chestType?: SupplyChestType, chestQuality: SupplyChestQuality = 'normal'): SupplyOptionData[] {
    const options = [...(GameConfig.gameplay.supply.options as SupplyOptionData[])];
    if (!chestType && !this._weaponEvolutionId && this._expSystem?.canOfferEvolution) {
      options.push(...(GameConfig.gameplay.weaponEvolution.options as SupplyOptionData[]));
    }
    const supplyTier = this._progressManager.getPermanentBonuses().supplyQualityTier;
    const weightBonus = (GameConfig.gameplay.supply.qualityBonusPerTier || 0) * supplyTier;
    const weighted = options.map(option => {
      const highValueIds = new Set([
        'repair',
        'max_hp_up',
        'damage_boost',
        'fire_rate_boost_big',
        'shield',
        'bonus_parts',
        'extra_supply_choices',
        'weapon_evo_explode',
        'weapon_evo_pierce',
        'weapon_evo_arc',
      ]);
      let weight = highValueIds.has(option.id) ? 1 + weightBonus : 1;
      if (chestType) {
        weight *= this._getSupplyChestAffinity(option, chestType);
        if (chestQuality === 'elite') weight *= this._isPremiumSupply(option) ? 1.2 : 1;
        if (chestQuality === 'rare') weight *= this._isPremiumSupply(option) ? 1.4 : 1.05;
      }
      return { option, score: Math.random() * weight };
    });
    weighted.sort((a, b) => b.score - a.score);
    return weighted
      .slice(0, GameConfig.gameplay.supply.choiceCount + this._bonusSupplyChoices)
      .map(item => item.option);
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
        this._damageMultiplier *= option.effect.value || 1;
        this._damageBoostUntilWave = 0;
        break;
      case 'fireRateMultiplier':
        this._playerCar.setFireRateMultiplier(this._playerCar.fireRateMultiplier * (option.effect.value || 1));
        this._fireRateBoostUntilWave = 0;
        break;
      case 'shield':
        this._playerCar.setInvulnerable(option.effect.seconds || 0);
        break;
      case 'knockback':
        this._pendingKnockbackDistance += Math.max(0, option.effect.value || 0);
        break;
      case 'slow':
        this._pendingSlowSeconds += Math.max(0, option.effect.value || 0);
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
      case 'weaponEvolution':
        if (option.effect.evolutionId) {
          this._weaponEvolutionId = option.effect.evolutionId;
        }
        break;
    }
  }

  private _applyPendingWaveOpeningEffects(enemies: Enemy[]): void {
    if (!this._waveManager || enemies.length === 0) return;
  }

  private _refreshWaveBonuses(): void {
    if (!this._waveManager) return;
  }

  private _closeSupplyPanel(resumeGame: boolean): void {
    if (this._supplyPanelNode?.isValid) {
      this._supplyPanelNode.destroy();
    }
    this._supplyPanelNode = null;
    this._adsManager.hideBanner();
    this._unfreezeBattle();
    if (resumeGame) {
      this._state = 'playing';
    }
  }

  private _getSupplyMode(): SupplyMode {
    return (GameConfig.gameplay.supply.mode as SupplyMode) || 'wave_break';
  }

  private _buildAttackTargets(enemies: Enemy[]): AttackTarget[] {
    const targets: AttackTarget[] = [...enemies];
    if (this._supplyChest && !this._supplyChest.dead) {
      targets.push(this._supplyChest);
    }
    return targets;
  }

  private _getSupplyChestConfig(): SupplyChestConfigData {
    return GameConfig.gameplay.supply.chest as SupplyChestConfigData;
  }

  private _ensureSupplyChestNode(): SupplyChest {
    if (this._supplyChest?.node?.isValid) {
      return this._supplyChest;
    }

    const chestNode = new Node('SupplyChest');
    chestNode.addComponent(UITransform);
    const chest = chestNode.addComponent(SupplyChest);
    const parent = this.enemiesNode || this._gameLayerNode || director.getScene()?.getChildByName('Canvas');
    parent?.addChild(chestNode);
    chest.reset();
    this._supplyChestNode = chestNode;
    this._supplyChest = chest;
    return chest;
  }

  private _resetSupplyChestState(): void {
    this._ensureSupplyChestNode().reset();
    this._chestSpawnTimer = 0;
    this._chestSpawnDelay = this._rollNextChestDelay();
    this._chestSelectionsThisRun = 0;
    this._lastChestWaveSpawned = 0;
  }

  private _updateChestSpawn(dt: number, enemies: Enemy[]): void {
    if (this._getSupplyMode() !== 'chest_trigger') return;
    if (!this._waveManager || this._waveManager.inPause) return;
    if (this._supplyChest && !this._supplyChest.dead) return;

    const cfg = this._getSupplyChestConfig();
    const stageWaveNum = this._getStageWaveNum();
    if (this._chestSelectionsThisRun >= cfg.maxSelectionsPerRun) return;
    if (stageWaveNum < cfg.minWave) return;
    if (this._lastChestWaveSpawned === stageWaveNum) return;
    if (enemies.length === 0) return;

    this._chestSpawnTimer += dt;
    if (this._chestSpawnTimer < this._chestSpawnDelay) return;
    this._spawnSupplyChest(enemies);
  }

  private _spawnSupplyChest(enemies: Enemy[]): void {
    if (!this._waveManager) return;
    const cfg = this._getSupplyChestConfig();
    const quality = this._pickChestQuality();
    const type = this._pickChestType();
    const waveData = this._waveManager.getWaveData(Math.max(0, this._waveManager.waveIndex));
    const hpMult = cfg.hpMultiplier[quality] || cfg.hpMultiplier.normal;
    const hp = Math.max(60, Math.round(waveData.hp * hpMult));
    const speed = Math.max(16, waveData.speed * cfg.speedMultiplier);
    const atk = Math.max(4, Math.round(waveData.atk * cfg.attackMultiplier));
    const attackRate = Math.max(0.35, GameConfig.enemy.attackRate * cfg.attackRateMultiplier);
    const x = this._pickChestX(enemies);
    const y = this._pickChestY();

    this._ensureSupplyChestNode().init(type, quality, x, y, hp, cfg.radius, speed, atk, attackRate);
    this._lastChestWaveSpawned = this._getStageWaveNum();
    this._chestSpawnTimer = 0;
    this._chestSpawnDelay = this._rollNextChestDelay();
    this._showFloatingNotice(x, y + 56, `${this._getChestDisplayName(type)}出现`, new Color(255, 223, 140));
  }

  private _handleSupplyChestDestroyed(chest: SupplyChest): void {
    this._chestSelectionsThisRun++;
    this._spawnPulse(chest.x, chest.y, chest.radius * 1.8, '#ffd166', 0.25);
    this._spawnBurstRing(chest.x, chest.y, chest.radius * 1.2, '#ffd166');
    chest.reset();
    this._showSupplyChestReward(chest);
  }

  private _rollNextChestDelay(): number {
    const cfg = this._getSupplyChestConfig();
    return Math.max(3, cfg.baseSpawnDelay + (Math.random() * 2 - 1) * cfg.delayVariance);
  }

  private _pickChestType(): SupplyChestType {
    if (this._playerCar && this._playerCar.hp / this._playerCar.maxHp <= 0.35) {
      return Math.random() < 0.55 ? 'survival' : 'control';
    }
    const table: SupplyChestType[] = ['firepower', 'survival', 'control', 'resource', 'firepower', 'control'];
    return table[Math.floor(Math.random() * table.length)];
  }

  private _pickChestQuality(): SupplyChestQuality {
    if (!this._waveManager) return 'normal';
    const waveNum = this._getStageWaveNum();
    const roll = Math.random();
    if (waveNum >= 5 && roll > 0.86) return 'rare';
    if (waveNum >= 3 && roll > 0.58) return 'elite';
    return 'normal';
  }

  private _pickChestX(enemies: Enemy[]): number {
    const aliveAhead = enemies.filter(enemy => !enemy.dead && enemy.y > 40);
    if (aliveAhead.length > 0) {
      const sample = aliveAhead[Math.floor(Math.random() * aliveAhead.length)];
      return Math.max(GameConfig.bridge.left + 50, Math.min(GameConfig.bridge.right - 50, sample.x));
    }
    return GameConfig.bridge.left + 70 + Math.random() * (GameConfig.bridge.right - GameConfig.bridge.left - 140);
  }

  private _pickChestY(): number {
    const cfg = this._getSupplyChestConfig();
    return cfg.lowerY + Math.random() * Math.max(0, cfg.upperY - cfg.lowerY);
  }

  private _getSupplyChestAffinity(option: SupplyOptionData, chestType: SupplyChestType): number {
    const firepower = new Set(['damage_boost', 'fire_rate_boost', 'fire_rate_boost_big', 'extra_supply_choices']);
    const survival = new Set(['repair_small', 'repair', 'max_hp_up', 'shield']);
    const control = new Set(['knockback_round', 'slow_round']);
    const resource = new Set(['bonus_coins', 'bonus_parts', 'extra_ad_supply']);
    const rare = new Set(['repair', 'max_hp_up', 'fire_rate_boost_big', 'shield', 'bonus_parts']);

    const map: Record<SupplyChestType, Set<string>> = {
      firepower,
      survival,
      control,
      resource,
      rare,
    };
    if (map[chestType].has(option.id)) return 2.4;
    if (chestType === 'rare' && this._isPremiumSupply(option)) return 1.8;
    return 1;
  }

  private _isPremiumSupply(option: SupplyOptionData): boolean {
    return new Set(['repair', 'max_hp_up', 'fire_rate_boost_big', 'shield', 'bonus_parts']).has(option.id);
  }

  private _getChestDisplayName(chestType: SupplyChestType): string {
    const map: Record<SupplyChestType, string> = {
      firepower: '火力箱',
      survival: '生存箱',
      control: '控制箱',
      resource: '资源箱',
      rare: '稀有箱',
    };
    return map[chestType];
  }

  private _getChestQualityName(quality: SupplyChestQuality): string {
    const map: Record<SupplyChestQuality, string> = {
      normal: '普通',
      elite: '精英',
      rare: '稀有',
    };
    return map[quality];
  }

  private _freezeBattle(): void {
    if (this._battleFrozen) return;
    this._battleFrozen = true;
    this._enemies.forEach(enemy => enemy.setBattleFrozen(true));
    if (this._supplyChest && !this._supplyChest.dead) {
      this._supplyChest.setBattleFrozen(true);
    }
  }

  private _unfreezeBattle(): void {
    this._battleFrozen = false;
    this._enemies.forEach(enemy => enemy.setBattleFrozen(false));
    if (this._supplyChest && !this._supplyChest.dead) {
      this._supplyChest.setBattleFrozen(false);
    }
  }

  private _createModalRoot(name: string): Node {
    const panel = new Node(name);
    const transform = panel.addComponent(UITransform);
    transform.setContentSize(GameConfig.canvas.width, GameConfig.canvas.height);
    panel.addComponent(BlockInputEvents);

    const graphics = panel.addComponent(Graphics);
    graphics.fillColor = new Color(0, 0, 0, 210);
    graphics.rect(-GameConfig.canvas.width / 2, -GameConfig.canvas.height / 2, GameConfig.canvas.width, GameConfig.canvas.height);
    graphics.fill();

    graphics.fillColor = new Color(22, 28, 38, 245);
    graphics.roundRect(-290, -340, 580, 720, 18);
    graphics.fill();
    graphics.strokeColor = new Color(255, 210, 92, 180);
    graphics.lineWidth = 2;
    graphics.roundRect(-290, -340, 580, 720, 18);
    graphics.stroke();
    return panel;
  }

  private _createModalLabel(parent: Node, name: string, text: string, fontSize: number, y: number, color: Color): Node {
    const node = new Node(name);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(520, 120);
    node.setPosition(0, y, 0);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.25);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = color.clone();
    parent.addChild(node);
    return node;
  }

  private _createModalButton(parent: Node, name: string, text: string, y: number, callback: () => void, width: number, height: number, color: Color): Node {
    const node = new Node(name);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(0, y, 0);

    const graphics = node.addComponent(Graphics);
    graphics.fillColor = color.clone();
    graphics.roundRect(-width / 2, -height / 2, width, height, 12);
    graphics.fill();

    node.addComponent(Button);
    node.on(Node.EventType.TOUCH_END, callback, this);

    const labelNode = new Node('Label');
    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setContentSize(width - 28, height - 10);
    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = text.includes('\n') ? 22 : 26;
    label.lineHeight = text.includes('\n') ? 27 : 32;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.color = color.r > 180 ? new Color(60, 40, 0) : Color.WHITE.clone();
    node.addChild(labelNode);

    parent.addChild(node);
    return node;
  }

  private _setButtonEnabled(node: Node, enabled: boolean): void {
    const button = node.getComponent(Button);
    if (button) button.interactable = enabled;
    const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    opacity.opacity = enabled ? 255 : 110;
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
    banner.setPosition(0, 500, 0);

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
      .to(0.35, { position: new Vec3(0, 620, 0) })
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

  startGame(startWave?: number, startLevel?: number, forcedEvolution?: WeaponEvolutionId | 'none'): void {
    const permanentBonuses = this._progressManager.getPermanentBonuses();
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
    this._pendingFreezeSeconds = 0;
    this._freezeAppliedWave = 0;
    this._pendingAirstrikeDamage = 0;
    this._airstrikeAppliedWave = 0;
    this._pendingShieldSeconds = 0;
    this._pendingKnockbackDistance = 0;
    this._pendingSlowSeconds = 0;
    this._bonusCoinMultiplier = 1;
    this._bonusFlatParts = 0;
    this._bonusSupplyChoices = 0;
    this._bonusAdSupplyCount = 0;
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
    this._expSystem?.reset();
    this._waveManager?.reset();
    this._stageManager.reset();
    const targetStageIndex = startWave && startWave > 1
      ? this._resolveStageIndexByWave(startWave)
      : this._currentStageIndex;
    this._stageManager.setStageIndex(targetStageIndex);
    this._currentStageIndex = targetStageIndex;
    this._completedStageIndex = targetStageIndex;

    // 设置调试参数
    if (startLevel && startLevel > 1) {
      this._expSystem?.setLevel(startLevel);
      if (this._playerCar) {
        this._playerCar.setExpSystem(this._expSystem);
      }
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

    // 清空对象池
    this._bulletPool?.putAll();
    this._enemyPool?.putAll();

    // 开始第一波
    this._waveManager?.startWave();

    // 播放 BGM（在用户点击"开始游戏"的同步调用栈中，iOS 要求首次音频在用户手势内）
    this._audioManager?.startBGM();

    // 切换 UI 状态
    if (this._startScreenNode) this._startScreenNode.active = false;
    if (this._debugScreenNode) this._debugScreenNode.active = false;
    if (this._garageScreenNode) this._garageScreenNode.active = false;
    if (this._gameOverScreen) this._gameOverScreen.node.active = false;
    if (this._hud) this._hud.node.active = true;
  }

  restart(): void {
    this._audioManager?.stopBGM();
    this.startGame();
  }

  private _showDebugScreen(): void {
    if (this._startScreenNode) this._startScreenNode.active = false;
    if (this._garageScreenNode) this._garageScreenNode.active = false;
    if (this._debugScreenNode) this._debugScreenNode.active = true;
  }

  private _hideDebugScreen(): void {
    if (this._debugScreenNode) this._debugScreenNode.active = false;
    if (this._startScreenNode) this._startScreenNode.active = true;
    this._refreshStartStageInfo();
  }

  private _showGarageScreen(): void {
    if (!this._garageScreenNode || !this._garageScreen) return;
    if (this._startScreenNode) this._startScreenNode.active = false;
    if (this._debugScreenNode) this._debugScreenNode.active = false;
    this._garageScreenNode.active = true;
    this._garageScreen.refresh();
  }

  private _hideGarageScreen(): void {
    if (this._garageScreenNode) this._garageScreenNode.active = false;
    if (this._startScreenNode) this._startScreenNode.active = true;
    this._refreshStartStageInfo();
  }

  private _upgradePermanentNode(id: PermanentUpgradeId): boolean {
    const upgraded = this._progressManager.upgrade(id);
    if (upgraded) {
      this._garageScreen?.refresh();
    }
    return upgraded;
  }

  private _getCurrentWeaponEvolution(): WeaponEvolutionData | null {
    if (!this._weaponEvolutionId) return null;
    const defs = GameConfig.gameplay.weaponEvolution.defs as Record<WeaponEvolutionId, WeaponEvolutionData>;
    return defs[this._weaponEvolutionId] || null;
  }

  private _getWeaponDisplayName(): string {
    const evo = this._getCurrentWeaponEvolution();
    if (!evo || !this._expSystem) {
      return this._expSystem?.weaponName || '机炮';
    }
    return `${this._expSystem.weaponName}-${evo.shortName}`;
  }

  private _getStageDisplayLabel(): string {
    return `第${this._stageManager.currentStageIndex + 1}关`;
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
      return Math.max(1, waveDef.entries.reduce((sum, entry) => sum + entry.count, 0));
    }
    const waveData = this._waveManager?.getWaveData(waveIndex);
    return Math.max(1, waveData?.count || 1);
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
    const tags: string[] = [];
    switch (option.effect.type) {
      case 'damageMultiplier':
        tags.push('火力');
        tags.push('爆发');
        break;
      case 'fireRateMultiplier':
        tags.push('射速');
        tags.push('连发');
        break;
      case 'shield':
      case 'heal':
        tags.push('生存');
        tags.push('容错');
        break;
      case 'knockback':
      case 'slow':
        tags.push('控制');
        tags.push('减压');
        break;
      case 'bonusCoins':
      case 'bonusParts':
        tags.push('资源');
        break;
      case 'extraSupplyChoices':
      case 'extraAdSupply':
        tags.push('运营');
        break;
      case 'weaponEvolution':
        tags.push('分支');
        tags.push('流派');
        break;
    }
    return tags;
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

    if (this._pendingKnockbackDistance > 0) {
      parts.push(`击退 ${Math.round(this._pendingKnockbackDistance)}`);
    }
    if (this._pendingSlowSeconds > 0) {
      parts.push(`减速 ${this._pendingSlowSeconds.toFixed(1)}s`);
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

  private _getStageDefs(): Array<{ label: string; name: string; waveCount: number; rewardBonus: { coins: number; parts: number }; startWave?: number }> {
    return (GameConfig.stages || []) as Array<{ label: string; name: string; waveCount: number; rewardBonus: { coins: number; parts: number }; startWave?: number }>;
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
    const partsSuffix = stage.rewardBonus.parts > 0 ? ` · 零件+${stage.rewardBonus.parts}` : '';
    startScreen.updateStageInfo(
      '当前关卡',
      `第${this._currentStageIndex + 1}关 ${stage.name}`,
      `${stage.waveCount} 波 · 金币+${stage.rewardBonus.coins}${partsSuffix}`,
      canPrev,
      canNext
    );
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

  setDebugLevel(level: number): void {
    this._debugLevel = Math.max(1, Math.min(6, level));
  }

  get debugWave(): number { return this._debugWave; }
  get debugLevel(): number { return this._debugLevel; }
  get state(): GameState { return this._state; }
  get kills(): number { return this._kills; }
  get expSystem(): ExpSystem | null { return this._expSystem; }
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
    if (!this._playerCar) return;
    if (event.keyCode === KeyCode.ARROW_LEFT || event.keyCode === KeyCode.KEY_A) {
      this._playerCar.setKeyLeft(true);
    }
    if (event.keyCode === KeyCode.ARROW_RIGHT || event.keyCode === KeyCode.KEY_D) {
      this._playerCar.setKeyRight(true);
    }
  }

  private _onKeyUp(event: any): void {
    if (!this._playerCar) return;
    if (event.keyCode === KeyCode.ARROW_LEFT || event.keyCode === KeyCode.KEY_A) {
      this._playerCar.setKeyLeft(false);
    }
    if (event.keyCode === KeyCode.ARROW_RIGHT || event.keyCode === KeyCode.KEY_D) {
      this._playerCar.setKeyRight(false);
    }
  }

  private _onTouchStart(event: any): void {
    if (!this._playerCar) return;
    const worldX = this._screenToWorldX(event.getLocation().x);
    this._playerCar.onTouchStart(worldX);
  }

  private _onTouchMove(event: any): void {
    if (!this._playerCar) return;
    const worldX = this._screenToWorldX(event.getLocation().x);
    this._playerCar.onTouchMove(worldX);
  }

  /**
   * 将屏幕 X 像素坐标转换为游戏世界 X 坐标
   * 设计分辨率 720 宽，原点在中心 → 屏幕 x=0 → worldX=-360
   */
  private _screenToWorldX(screenX: number): number {
    return screenX - GameConfig.canvas.width / 2;
  }

  private _onTouchEnd(event: any): void {
    if (!this._playerCar) return;
    this._playerCar.onTouchEnd();
  }

  onDestroy(): void {
    this._audioManager?.stopBGM();
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
