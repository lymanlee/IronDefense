/**
 * WaveManager.ts - 波次管理系统
 * 管理敌人的生成、波次推进和波次数据计算
 */

import { Enemy } from '../components/Enemy';
import {
  GameConfig,
  WaveData,
  EnemyTypeId,
  WaveDefinitionData,
  WaveSpawnEntryData,
  WaveKind,
  SupplyChestConfigData,
} from '../data/GameConfig';

export class WaveManager {
  private _waveIndex: number = 0;      // 当前波次 0-indexed
  private _enemies: Enemy[] = [];        // 当前场景中的敌人
  private _spawnTimer: number = 0;
  private _spawnCount: number = 0;
  private _spawnPlanIndex: number = 0;
  private _spawnPlanProgress: number = 0;
  private _spawnSlotCursor: number = 0;
  private _wavePause: number = 0;
  private _inPause: boolean = false;
  private _announceTime: number = 0;
  private _justStarted: boolean = false;
  private _enemyFactory: (() => Enemy) | null = null;

  // 队列生成参数
  private _totalSlots: number = 0;        // 总槽位数（第一行的对称布局）
  private _layout: number[] = [];          // 第一行的对称布局（每行的人数分布）
  private _totalRows: number = 0;           // 总行数
  private _currentRow: number = 0;          // 当前生成的行号
  private _spawnPlan: WaveSpawnEntryData[] = [];
  private _spawnRemaining: number[] = [];
  private _activeWaveDef: WaveDefinitionData | null = null;
  private _activeWaveData: WaveData | null = null;
  private _waveStatScaleProvider: ((waveIndex: number) => { hp: number; atk: number; speed: number }) | null = null;
  constructor() {}

  /**
   * 设置敌人工厂函数
   */
  setEnemyFactory(factory: () => Enemy): void {
    this._enemyFactory = factory;
  }

  setWaveStatScaleProvider(provider: (waveIndex: number) => { hp: number; atk: number; speed: number }): void {
    this._waveStatScaleProvider = provider;
  }

  get currentWaveNum(): number {
    return this._waveIndex + 1;
  }

  get waveIndex(): number {
    return this._waveIndex;
  }

  set waveIndex(value: number) {
    this._waveIndex = Math.max(0, value);
  }

  get enemies(): Enemy[] {
    return this._enemies;
  }

  get inPause(): boolean {
    return this._inPause;
  }

  get announceTime(): number {
    return this._announceTime;
  }

  get wavePause(): number {
    return this._wavePause;
  }

  get currentWaveDef(): WaveDefinitionData | null {
    return this._activeWaveDef;
  }

  private _getScaledWaveData(waveData: WaveData, waveIndex: number): WaveData {
    const scale = this._waveStatScaleProvider?.(waveIndex) || { hp: 1, atk: 1, speed: 1 };
    return {
      ...waveData,
      hp: Math.max(1, Math.round(waveData.hp * Math.max(0.1, scale.hp || 1))),
      atk: Math.max(1, Math.round(waveData.atk * Math.max(0.1, scale.atk || 1))),
      speed: Math.max(1, waveData.speed * Math.max(0.1, scale.speed || 1)),
    };
  }

  /**
   * 获取指定波次的数据
   */
  getWaveData(index: number): WaveData {
    if (index < GameConfig.waves.length) {
      return { ...GameConfig.waves[index] };
    }

    // 超出预设波次，根据缩放公式生成
    const base = GameConfig.waves[GameConfig.waves.length - 1];
    const s = GameConfig.waveScaling;
    const extra = index - GameConfig.waves.length + 1;

    return {
      count: base.count + s.countAdd * extra,
      hp: Math.round(base.hp * Math.pow(s.hpMult, extra)),
      speed: base.speed + s.speedAdd * extra,
      atk: Math.round(base.atk * Math.pow(s.atkMult, extra)),
      spawnInterval: Math.max(s.intervalMin, base.spawnInterval - 0.05 * extra),
    };
  }

  getWaveDefinition(index: number): WaveDefinitionData {
    if (index < GameConfig.waveDefs.length) {
      const waveDef = GameConfig.waveDefs[index] as WaveDefinitionData & { mixMode?: 'sequential' | 'round_robin' };
      const defaultMixMode = waveDef.kind === 'normal' || waveDef.kind === 'boss' ? 'sequential' : 'round_robin';
      return {
        ...waveDef,
        kind: waveDef.kind as WaveKind,
        mixMode: waveDef.mixMode || defaultMixMode,
        entries: waveDef.entries.map((entry) => ({
          type: entry.type as EnemyTypeId,
          count: Math.max(1, Math.round(entry.count)),
        })),
      };
    }

    const data = this.getWaveData(index);
    const loop = index % 5;
    const entries: WaveSpawnEntryData[] = [];

    if (loop === 0) {
      entries.push({ type: 'normal' as EnemyTypeId, count: Math.max(12, Math.floor(data.count * 0.6)) });
      entries.push({ type: 'runner' as EnemyTypeId, count: Math.max(8, Math.floor(data.count * 0.4)) });
    } else if (loop === 1) {
      entries.push({ type: 'normal' as EnemyTypeId, count: Math.max(16, Math.floor(data.count * 0.55)) });
      entries.push({ type: 'shield' as EnemyTypeId, count: Math.max(6, Math.floor(data.count * 0.2)) });
      entries.push({ type: 'runner' as EnemyTypeId, count: Math.max(8, Math.floor(data.count * 0.25)) });
    } else if (loop === 2) {
      entries.push({ type: 'normal' as EnemyTypeId, count: Math.max(16, Math.floor(data.count * 0.45)) });
      entries.push({ type: 'runner' as EnemyTypeId, count: Math.max(10, Math.floor(data.count * 0.35)) });
      entries.push({ type: 'suicide' as EnemyTypeId, count: Math.max(6, Math.floor(data.count * 0.2)) });
    } else if (loop === 3) {
      entries.push({ type: 'shield' as EnemyTypeId, count: Math.max(10, Math.floor(data.count * 0.35)) });
      entries.push({ type: 'runner' as EnemyTypeId, count: Math.max(10, Math.floor(data.count * 0.35)) });
      entries.push({ type: 'suicide' as EnemyTypeId, count: Math.max(8, Math.floor(data.count * 0.3)) });
    } else {
      entries.push({ type: 'boss_bulldozer' as EnemyTypeId, count: 1 });
      entries.push({ type: 'runner' as EnemyTypeId, count: Math.max(10, Math.floor(data.count * 0.28)) });
      entries.push({ type: 'shield' as EnemyTypeId, count: Math.max(8, Math.floor(data.count * 0.18)) });
    }

    return {
      kind: loop === 4 ? 'boss' : loop === 3 ? 'crisis' : 'mixed',
      title: loop === 4 ? `装甲压境 ${index + 1}` : `扩展波次 ${index + 1}`,
      mixMode: loop === 4 ? 'sequential' : 'round_robin',
      entries: entries.map((entry) => ({
        type: entry.type as EnemyTypeId,
        count: Math.max(1, Math.round(entry.count)),
      })),
      spawnInterval: Math.max(0.18, data.spawnInterval),
      pauseTime: loop === 4 ? 8 : GameConfig.wavePauseTime,
    };
  }

  /**
   * 计算队列布局
   * @param total 总敌人数
   * @returns 布局、行数
   */
  private _calcFormation(total: number): { layout: number[], rows: number } {
    const rowCount = 8;
    const layout = new Array(rowCount).fill(1);
    const rows = Math.ceil(total / rowCount);
    return { layout, rows };
  }

  /**
   * 开始新波次
   */
  startWave(): void {
    this._spawnCount = 0;
    this._spawnTimer = 0;
    this._spawnPlanIndex = 0;
    this._spawnPlanProgress = 0;
    this._spawnSlotCursor = 0;
    this._inPause = false;
    this._announceTime = 2.0;
    this._justStarted = true;
    this._currentRow = 0;

    const waveData = this.getWaveData(this._waveIndex);
    const waveDef = this.getWaveDefinition(this._waveIndex);
    this._activeWaveData = {
      ...waveData,
      spawnInterval: Math.max(0.01, waveDef.spawnInterval || waveData.spawnInterval),
    };
    this._activeWaveDef = waveDef;
    this._spawnPlan = waveDef.entries.map(entry => ({ ...entry }));
    this._spawnRemaining = this._spawnPlan.map(entry => entry.count);

    const totalCount = this._spawnPlan.reduce((sum, entry) => sum + entry.count, 0);
    const formation = this._calcFormation(totalCount);
    this._layout = formation.layout;
    this._totalRows = formation.rows;
    this._totalSlots = formation.layout.length;
  }

  /**
   * 消费波次开始标志
   */
  consumeWaveStart(): boolean {
    if (this._justStarted) {
      this._justStarted = false;
      return true;
    }
    return false;
  }

  /**
   * 更新波次
   */
  update(dt: number): void {
    // 波次宣告中
    if (this._announceTime > 0) {
      this._announceTime -= dt;
      return;
    }

    // 波次间隔中
    if (this._inPause) {
      this._wavePause -= dt;
      if (this._wavePause <= 0) {
        this.startWave();
      }
      return;
    }

    const waveData = this._activeWaveData || this.getWaveData(this._waveIndex);

    const totalPlanned = this._spawnPlan.reduce((sum, entry) => sum + entry.count, 0);

    // 持续流式生成敌人，避免波次后段出现长时间空窗
    this._spawnTimer += dt;
    if (this._spawnTimer >= waveData.spawnInterval && this._spawnCount < totalPlanned) {
      this._spawnTimer = 0;
      this._spawnBatch(waveData, totalPlanned);
    }

    // 检查本波是否全部结束
    const aliveEnemies = this._enemies.filter(e => !e.dead);
    const waveEnded = this._spawnCount >= totalPlanned && aliveEnemies.length === 0;

    if (waveEnded) {
      this._waveIndex++;
      this._inPause = true;
      this._wavePause = this._activeWaveDef?.pauseTime || GameConfig.wavePauseTime;
    }
  }

  /**
   * 生成一行敌人（按对称布局）
   */
  private _spawnBatch(waveData: WaveData, totalPlanned: number): void {
    if (!this._enemyFactory) return;
    if (this._spawnPlan.length === 0) return;

    const cfg = GameConfig.bridge;
    const chestCfg = (GameConfig.gameplay.supply.chest || {}) as SupplyChestConfigData;
    const totalSlots = Math.max(1, this._totalSlots || this._layout.length || 8);
    const totalRows = Math.max(1, this._totalRows || Math.ceil(totalPlanned / totalSlots));

    const laneCount = Math.max(1, cfg.laneCount);
    const bridgeWidth = cfg.right - cfg.left;
    const laneWidth = bridgeWidth / laneCount;
    const reservedLaneIndex = Math.max(0, Math.min(laneCount - 1, chestCfg.enemyStartLaneIndex || 1));
    const enemyLeft = cfg.left + laneWidth * reservedLaneIndex;
    const enemyWidth = Math.max(bridgeWidth * 0.5, cfg.right - enemyLeft);
    const slotWidth = enemyWidth / (totalSlots + 1);
    const batchSize = this._resolveSpawnBatchSize(totalPlanned);

    for (let i = 0; i < batchSize; i++) {
      if (this._spawnCount >= totalPlanned) break;

      const slotIndex = this._spawnSlotCursor % totalSlots;
      const rowIndex = Math.floor(this._spawnCount / totalSlots);
      const x = enemyLeft + slotWidth * (slotIndex + 1);

      const enemy = this._enemyFactory();
      const enemyType = this._consumeNextEnemyType();
      enemy.init(this._getScaledWaveData(waveData, this._waveIndex), this.currentWaveNum, slotIndex, rowIndex, totalSlots, totalRows, x, enemyType);
      this._enemies.push(enemy);
      this._spawnCount++;
      this._spawnSlotCursor++;
    }

    this._currentRow = Math.floor(this._spawnCount / totalSlots);
  }

  private _resolveSpawnBatchSize(totalPlanned: number): number {
    if (totalPlanned >= 220) return 4;
    if (totalPlanned >= 140) return 3;
    if (totalPlanned >= 70) return 2;
    return 1;
  }

  private _consumeNextEnemyType(): EnemyTypeId {
    if (this._spawnPlan.length === 0) return 'normal';

    if (this._activeWaveDef?.mixMode === 'round_robin') {
      const entryCount = this._spawnPlan.length;
      for (let offset = 0; offset < entryCount; offset++) {
        const idx = (this._spawnPlanIndex + offset) % entryCount;
        if ((this._spawnRemaining[idx] || 0) <= 0) continue;
        this._spawnRemaining[idx]--;
        this._spawnPlanIndex = (idx + 1) % entryCount;
        return this._spawnPlan[idx].type;
      }
      return this._spawnPlan[this._spawnPlan.length - 1].type;
    }

    while (this._spawnPlanIndex < this._spawnPlan.length) {
      const entry = this._spawnPlan[this._spawnPlanIndex];
      if (this._spawnPlanProgress < entry.count) {
        this._spawnPlanProgress++;
        return entry.type;
      }
      this._spawnPlanIndex++;
      this._spawnPlanProgress = 0;
    }

    return this._spawnPlan[this._spawnPlan.length - 1].type;
  }

  /**
   * 获取活跃敌人列表
   */
  get activeEnemies(): Enemy[] {
    return this._enemies.filter(e => !e.dead);
  }

  /**
   * 清理死亡敌人，返回需要被回收的敌人列表
   */
  cleanupEnemies(dt: number): Enemy[] {
    const removed: Enemy[] = [];
    this._enemies = this._enemies.filter(e => {
      if (e.dead) {
        removed.push(e);
        return false;
      }
      return true;
    });
    return removed;
  }

  /**
   * 重置
   */
  reset(): void {
    this._waveIndex = 0;
    this._enemies = [];
    this._spawnTimer = 0;
    this._spawnCount = 0;
    this._spawnPlanIndex = 0;
    this._spawnPlanProgress = 0;
    this._spawnSlotCursor = 0;
    this._wavePause = 0;
    this._inPause = false;
    this._announceTime = 0;
    this._justStarted = false;
    this._totalSlots = 0;
    this._layout = [];
    this._totalRows = 0;
    this._currentRow = 0;
    this._spawnPlan = [];
    this._spawnRemaining = [];
    this._activeWaveDef = null;
    this._activeWaveData = null;
  }
}
