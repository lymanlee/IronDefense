/**
 * GameManager.ts - 游戏管理器（单例）
 * 协调所有游戏系统，主循环，状态机
 */

import { _decorator, Component, Node, instantiate, Prefab, tween, Vec3, Color, Tween, input, Input, KeyCode, director, Sprite, UIOpacity, UITransform, SpriteFrame, Graphics } from 'cc';
import { GameConfig } from '../data/GameConfig';
import { ExpSystem } from '../components/ExpSystem';
import { PlayerCar } from '../components/PlayerCar';
import { Enemy } from '../components/Enemy';
import { Bullet } from '../components/Bullet';
import { WaveManager } from '../managers/WaveManager';
import { AudioManager } from '../managers/AudioManager';
import { ObjectPool } from '../managers/ObjectPool';
import { StartScreen } from '../ui/StartScreen';
import { HUDController } from '../ui/HUDController';
import { GameOverScreen } from '../ui/GameOverScreen';
import { DebugScreen } from '../ui/DebugScreen';

const { ccclass, property } = _decorator;

type GameState = 'start' | 'debug' | 'playing' | 'gameover' | 'victory';

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

  // 对象池
  private _bulletPool: ObjectPool<Bullet> | null = null;
  private _enemyPool: ObjectPool<Enemy> | null = null;

  // 游戏数据
  private _bullets: Bullet[] = [];
  private _enemies: Enemy[] = [];
  private _explosions: ExplosionData[] = [];
  private _kills: number = 0;

  // 固定时间步长（避免帧率抖动导致子弹/敌人移动跳跃）
  private readonly _FIXED_DT: number = 1 / 60;  // 60Hz 固定步长
  private _accumulator: number = 0;

  // UI 引用
  private _hud: HUDController | null = null;
  private _startScreenNode: Node | null = null;
  private _gameOverScreen: GameOverScreen | null = null;
  private _debugScreen: DebugScreen | null = null;
  private _debugScreenNode: Node | null = null;
  private _gameLayerNode: Node | null = null;

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

      // StartScreen
      this._startScreenNode = overlayNode?.getChildByName('StartScreen') || null;
      if (this._startScreenNode) {
        this._startScreenNode.active = true;
        const startScreen = this._startScreenNode.getComponent(StartScreen);
        if (startScreen) {
          startScreen.setOnStart(() => {
            console.log('[GameManager] 开始游戏');
            this.startGame();
          });
          startScreen.setOnDebug(() => {
            console.log('[GameManager] 打开调试界面');
            this._showDebugScreen();
          });
        }
      }

      // DebugScreen
      this._debugScreenNode = overlayNode?.getChildByName('DebugScreen') || null;
      if (this._debugScreenNode) {
        this._debugScreenNode.active = false;
        this._debugScreen = this._debugScreenNode.getComponent(DebugScreen);
        if (this._debugScreen) {
          this._debugScreen.setOnConfirm((wave, level) => {
            console.log('[GameManager] 调试模式开始，波次:', wave, '等级:', level);
            this.startGame(wave, level);
          });
          this._debugScreen.setOnBack(() => {
            console.log('[GameManager] 返回开始界面');
            this._hideDebugScreen();
          });
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
          this._gameOverScreen.setOnMenu(() => {
            this._audioManager?.stopBGM();
            this._state = 'start';
            if (this._gameOverScreen) this._gameOverScreen.hide();
            if (this._hud) this._hud.node.active = false;
            if (this._startScreenNode) this._startScreenNode.active = true;
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

    // 更新屏幕闪红效果
    this._updateDamageFlash(dt);

    // 更新波次
    this._waveManager.update(dt);

    // 更新敌人
    const enemies = this._waveManager.activeEnemies;
    enemies.forEach(e => e.update(dt));

    // 已在护栏敌人攻击武装车
    enemies.forEach(e => {
      if (e.reachedRail && !e.dead) {
        if (e.tryAttack()) {
          this._playerCar!.takeDamage(e.atk);
          this._audioManager?.alarm();
          // 触发屏幕闪红效果
          this.triggerDamageFlash();
        }
      }
    });

    // 检查玩家死亡
    if (this._playerCar.dead) {
      this._state = 'gameover';
      this._audioManager?.stopBGM();

      // 隐藏闪红效果
      if (this._damageFlashNode) {
        this._damageFlashNode.active = false;
      }

      if (this._gameOverScreen) {
        this._gameOverScreen.showGameOver(
          this._kills,
          this._waveManager!.currentWaveNum,
          this._expSystem!.exp || 0,
          this._expSystem!.levelIndex + 1
        );
      }
      if (this._hud) this._hud.node.active = false;
      return;
    }

    // 更新 HUD
    if (this._hud && this._expSystem && this._waveManager) {
      this._hud.updateHUD(
        this._waveManager.currentWaveNum,
        this._playerCar.hp,
        this._playerCar.maxHp,
        this._expSystem.progressPct,
        this._expSystem.weaponName,
        this._expSystem.level,
        this._waveManager.inPause,
        this._waveManager.wavePause
      );
    }

    // 更新武装车
    this._playerCar.update(dt);

    // 新波次开始时重置射击计时器
    if (this._waveManager.consumeWaveStart()) {
      this._playerCar.resetFireTimer();
    }

    // 自动射击
    this._playerCar.tryFire(enemies, dt);

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

      for (const e of this._enemies) {
        if (e.dead) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        // 距离平方比较，避免 Math.sqrt 开方运算
        const threshold = eCfg.width / 2 + bCfg.radius;
        const distSq = dx * dx + dy * dy;
        if (distSq < threshold * threshold) {
          b.dead = true;
          b.node.active = false;
          e.takeDamage(b.damage);
          this._audioManager?.enemyHit();

          if (e.dead) {
            this._kills++;
            this._spawnExplosion(e.x, e.y);
            this._audioManager?.explode();

            const leveled = this._expSystem!.addExp(e.expDrop);
            if (leveled) {
              this._audioManager?.levelUp();
              this._playerCar?.setExpSystem(this._expSystem!);
            }
          }
          break;
        }
      }
    });
  }

  private _fireBullet(x: number, y: number, level: number, angle: number = 90, speedMult: number = 1.0): void {
    if (!this._bulletPool || !this.bulletPoolNode) return;

    const bullet = this._bulletPool.get();
    if (bullet) {
      bullet.init(x, y, level, angle, speedMult);
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

  // ==================== 状态切换 ====================

  startGame(startWave?: number, startLevel?: number): void {
    this._state = 'playing';
    this._kills = 0;
    this._bullets = [];
    this._explosions = [];
    this._accumulator = 0;

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

    // 设置调试参数
    if (startLevel && startLevel > 1) {
      this._expSystem?.setLevel(startLevel);
      if (this._playerCar) {
        this._playerCar.setExpSystem(this._expSystem);
      }
    }
    if (startWave && startWave > 1) {
      this._waveManager!.waveIndex = startWave - 1;
    }

    // 重置武装车
    this._playerCar?.reset();

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
    if (this._gameOverScreen) this._gameOverScreen.node.active = false;
    if (this._hud) this._hud.node.active = true;
  }

  restart(): void {
    this._audioManager?.stopBGM();
    this.startGame();
  }

  private _showDebugScreen(): void {
    if (this._startScreenNode) this._startScreenNode.active = false;
    if (this._debugScreenNode) this._debugScreenNode.active = true;
  }

  private _hideDebugScreen(): void {
    if (this._debugScreenNode) this._debugScreenNode.active = false;
    if (this._startScreenNode) this._startScreenNode.active = true;
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
