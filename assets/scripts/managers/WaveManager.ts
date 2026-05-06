/**
 * WaveManager.ts - 波次管理系统
 * 管理敌人的生成、波次推进和波次数据计算
 */

import { Enemy } from '../components/Enemy';
import { GameConfig, WaveData } from '../data/GameConfig';

export class WaveManager {
  private _waveIndex: number = 0;      // 当前波次 0-indexed
  private _enemies: Enemy[] = [];        // 当前场景中的敌人
  private _spawnTimer: number = 0;
  private _spawnCount: number = 0;
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

  constructor() {}

  /**
   * 设置敌人工厂函数
   */
  setEnemyFactory(factory: () => Enemy): void {
    this._enemyFactory = factory;
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
      exp: base.exp + s.expAdd * extra,
      spawnInterval: Math.max(s.intervalMin, base.spawnInterval - 0.05 * extra),
    };
  }

  /**
   * 生成对称布局（固定8个槽位）
   * 8人：8槽全满 [1,1,1,1,1,1,1,1]
   * 6人：两边各3人，中间空2个 [1,1,1,0,0,1,1,1]
   * 4人：两边各2人，中间空4个 [1,1,0,0,0,0,1,1]
   * @param count 每行人数（4/6/8）
   * @returns 布局数组（8个元素）
   */
  private _generateSymmetricLayout(count: number): number[] {
    const slots = 8;  // 固定8个槽位
    const layout: number[] = new Array(slots).fill(0);

    if (count === 8) {
      // 全部放人
      for (let i = 0; i < 8; i++) layout[i] = 1;
    } else if (count === 6) {
      // 两边各3人，中间空2个
      // 位置: 0,1,2 放人；3,4 空；5,6,7 放人
      layout[0] = 1; layout[1] = 1; layout[2] = 1;
      layout[5] = 1; layout[6] = 1; layout[7] = 1;
    } else if (count === 4) {
      // 两边各2人，中间空4个
      // 位置: 0,1 放人；2,3,4,5 空；6,7 放人
      layout[0] = 1; layout[1] = 1;
      layout[6] = 1; layout[7] = 1;
    }

    return layout;
  }

  /**
   * 计算队列布局
   * @param total 总敌人数
   * @returns 布局、行数
   */
  private _calcFormation(total: number): { layout: number[], rows: number } {
    // 随机每行人数：4、6、8（偶数）
    const counts = [4, 6, 8];
    const rowCount = counts[Math.floor(Math.random() * counts.length)];
    // 生成对称布局
    const layout = this._generateSymmetricLayout(rowCount);
    // 计算总行数
    const rows = Math.ceil(total / rowCount);
    return { layout, rows };
  }

  /**
   * 开始新波次
   */
  startWave(): void {
    this._spawnCount = 0;
    this._spawnTimer = 0;
    this._inPause = false;
    this._announceTime = 2.0;
    this._justStarted = true;
    this._currentRow = 0;

    const waveData = this.getWaveData(this._waveIndex);
    const formation = this._calcFormation(waveData.count);
    this._layout = formation.layout;
    this._totalRows = formation.rows;
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

    const waveData = this.getWaveData(this._waveIndex);

    // 生成一行敌人
    this._spawnTimer += dt;
    if (this._spawnTimer >= waveData.spawnInterval && this._currentRow < this._totalRows) {
      this._spawnTimer = 0;
      this._spawnRow(waveData);
      this._currentRow++;
    }

    // 检查本波是否全部结束
    const aliveEnemies = this._enemies.filter(e => !e.dead);
    const waveEnded = this._currentRow >= this._totalRows && aliveEnemies.length === 0;

    if (waveEnded) {
      this._waveIndex++;
      this._inPause = true;
      this._wavePause = GameConfig.wavePauseTime;
    }
  }

  /**
   * 生成一行敌人（按对称布局）
   */
  private _spawnRow(waveData: WaveData): void {
    if (!this._enemyFactory) return;

    const cfg = GameConfig.bridge;
    const layout = this._layout;
    const currentRow = this._currentRow;
    const totalRows = this._totalRows;
    const totalSlots = layout.length;  // 固定8个槽位

    // 槽位宽度（根据布局元素数量）
    const slotWidth = (cfg.right - cfg.left) / (totalSlots + 1);

    // 遍历布局生成敌人
    for (let slotIndex = 0; slotIndex < layout.length; slotIndex++) {
      const count = layout[slotIndex];
      if (count === 0) continue;  // 空位跳过

      // 计算这个槽位的x坐标
      const x = cfg.left + slotWidth * (slotIndex + 1);

      // 生成这个位置的敌人（每个槽位1个）
      for (let i = 0; i < count; i++) {
        // 检查是否超出总数
        if (this._spawnCount >= waveData.count) break;

        const enemy = this._enemyFactory();
        // 传入位置参数
        enemy.init(waveData, this.currentWaveNum, slotIndex, currentRow, totalSlots, totalRows, x);
        this._enemies.push(enemy);
        this._spawnCount++;
      }
    }
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
    this._wavePause = 0;
    this._inPause = false;
    this._announceTime = 0;
    this._justStarted = false;
    this._totalSlots = 0;
    this._layout = [];
    this._totalRows = 0;
    this._currentRow = 0;
  }
}
