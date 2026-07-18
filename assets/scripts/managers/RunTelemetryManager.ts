import { sys } from 'cc';
import { GameConfig, SupplyChestQuality, SupplyConfigData, SupplyOptionData, WaveDefinitionData, WeaponEvolutionId } from '../data/GameConfig';

export interface RuntimeChestTrace {
  serial: number;
  quality: SupplyChestQuality;
  wave: number;
  spawnedAt: number;
  destroyedAt?: number;
  maxHp: number;
}

export interface RuntimeWaveTrace {
  wave: number;
  startedAt: number;
  endedAt?: number;
  duration?: number;
  plannedEnemies: number;
  spawnedEnemies: number;
  killedEnemies: number;
  playerHpStart: number;
  playerHpEnd?: number;
  chestsSpawned: number;
  chestsDestroyed: number;
}

export interface RuntimeRunTrace {
  version: 2;
  runSerial: number;
  stageIndex: number;
  stageLabel: string;
  startedAtIso: string;
  startedAtBattleTime: number;
  endedAtBattleTime?: number;
  result?: 'victory' | 'gameover';
  failureWave?: number;
  currentWave?: number;
  startTier: number;
  forcedEvolution: WeaponEvolutionId | 'none';
  previewMode: boolean;
  baselineCalibrationMode?: boolean;
  playerHpMax: number;
  playerHpEnd?: number;
  kills: number;
  totalEnemySpawned: number;
  totalEnemyKilled: number;
  totalEnemyDamage: number;
  totalPlayerDamage: number;
  configSnapshot: {
    waveDefs: WaveDefinitionData[];
    stages: Array<Record<string, unknown>>;
    supply: SupplyConfigData;
  };
  waves: RuntimeWaveTrace[];
  chests: RuntimeChestTrace[];
  supplyChoices: Array<{
    serial: number;
    wave: number;
    sourceQuality: SupplyChestQuality;
    shownAt: number;
    options: Array<{
      id: string;
      title: string;
      star: number;
      cardType: string;
      triggerMode: string;
    }>;
    pickedOptionId?: string;
    pickedAt?: number;
    refreshCount: number;
  }>;
  events: Array<Record<string, unknown>>;
}

export class RunTelemetryManager {
  private static readonly STORAGE_KEY = 'bridge_guard_runtime_trace_latest';
  private static readonly LEGACY_STORAGE_KEYS = ['bridge_guard_runtime_trace_latest_v1'];

  private _current: RuntimeRunTrace | null = null;
  private _waveMap: Map<number, RuntimeWaveTrace> = new Map();
  private _chestMap: Map<number, RuntimeChestTrace> = new Map();

  constructor() {
    this._restorePersistedTraceToWindow();
  }

  startRun(payload: {
    runSerial: number;
    stageIndex: number;
    stageLabel: string;
    battleTime: number;
    startTier: number;
    forcedEvolution: WeaponEvolutionId | 'none';
    previewMode: boolean;
    baselineCalibrationMode?: boolean;
    playerHpMax: number;
  }): void {
    this._waveMap.clear();
    this._chestMap.clear();
    this._current = {
      version: 2,
      runSerial: payload.runSerial,
      stageIndex: payload.stageIndex,
      stageLabel: payload.stageLabel,
      startedAtIso: new Date().toISOString(),
      startedAtBattleTime: payload.battleTime,
      startTier: payload.startTier,
      forcedEvolution: payload.forcedEvolution,
      previewMode: payload.previewMode,
      baselineCalibrationMode: !!payload.baselineCalibrationMode,
      playerHpMax: payload.playerHpMax,
      kills: 0,
      totalEnemySpawned: 0,
      totalEnemyKilled: 0,
      totalEnemyDamage: 0,
      totalPlayerDamage: 0,
      configSnapshot: this._buildConfigSnapshot(),
      waves: [],
      chests: [],
      supplyChoices: [],
      events: [],
    };
    this._pushEvent('run_started', {
      stageIndex: payload.stageIndex,
      stageLabel: payload.stageLabel,
      startTier: payload.startTier,
      forcedEvolution: payload.forcedEvolution,
      previewMode: payload.previewMode,
      baselineCalibrationMode: !!payload.baselineCalibrationMode,
    });
  }

  finishRun(payload: {
    battleTime: number;
    result: 'victory' | 'gameover';
    failureWave?: number;
    currentWave: number;
    playerHpEnd: number;
    kills: number;
  }): RuntimeRunTrace | null {
    if (!this._current) return null;
    this._current.endedAtBattleTime = payload.battleTime;
    this._current.result = payload.result;
    this._current.failureWave = payload.failureWave || 0;
    this._current.currentWave = payload.currentWave;
    this._current.playerHpEnd = payload.playerHpEnd;
    this._current.kills = payload.kills;
    this._pushEvent('run_finished', {
      result: payload.result,
      failureWave: payload.failureWave || 0,
      currentWave: payload.currentWave,
      playerHpEnd: payload.playerHpEnd,
      kills: payload.kills,
    });
    this._emitDebugSummary();
    this._persist();
    return this.getCurrentTrace();
  }

  startWave(payload: {
    wave: number;
    battleTime: number;
    plannedEnemies: number;
    playerHpStart: number;
  }): void {
    if (!this._current) return;
    const waveTrace: RuntimeWaveTrace = {
      wave: payload.wave,
      startedAt: payload.battleTime,
      plannedEnemies: payload.plannedEnemies,
      spawnedEnemies: 0,
      killedEnemies: 0,
      playerHpStart: payload.playerHpStart,
      chestsSpawned: 0,
      chestsDestroyed: 0,
    };
    this._waveMap.set(payload.wave, waveTrace);
    this._current.waves.push(waveTrace);
    this._pushEvent('wave_started', {
      wave: payload.wave,
      plannedEnemies: payload.plannedEnemies,
      playerHpStart: payload.playerHpStart,
    });
  }

  finishWave(payload: {
    wave: number;
    battleTime: number;
    playerHpEnd: number;
  }): void {
    const waveTrace = this._waveMap.get(payload.wave);
    if (!waveTrace || waveTrace.endedAt != null) return;
    waveTrace.endedAt = payload.battleTime;
    waveTrace.duration = Math.max(0, payload.battleTime - waveTrace.startedAt);
    waveTrace.playerHpEnd = payload.playerHpEnd;
    this._pushEvent('wave_finished', {
      wave: payload.wave,
      duration: waveTrace.duration,
      playerHpEnd: payload.playerHpEnd,
      spawnedEnemies: waveTrace.spawnedEnemies,
      killedEnemies: waveTrace.killedEnemies,
      chestsSpawned: waveTrace.chestsSpawned,
      chestsDestroyed: waveTrace.chestsDestroyed,
    });
  }

  recordEnemySpawn(wave: number): void {
    if (!this._current) return;
    const waveTrace = this._waveMap.get(wave);
    if (!waveTrace) return;
    waveTrace.spawnedEnemies++;
    this._current.totalEnemySpawned++;
  }

  recordEnemyKilled(wave: number, enemyHpMax: number): void {
    if (!this._current) return;
    const waveTrace = this._waveMap.get(wave);
    if (waveTrace) {
      waveTrace.killedEnemies++;
    }
    this._current.totalEnemyKilled++;
    this._current.kills++;
    this._pushEvent('enemy_killed', {
      wave,
      enemyHpMax,
    });
  }

  recordEnemyDamage(wave: number, source: string, damage: number, killed: boolean): void {
    if (!this._current || damage <= 0) return;
    this._current.totalEnemyDamage += damage;
    this._pushEvent('enemy_damaged', {
      wave,
      source,
      damage,
      killed,
    });
  }

  recordPlayerDamaged(wave: number, damage: number, playerHpAfter: number, battleTime?: number): void {
    if (!this._current || damage <= 0) return;
    this._current.totalPlayerDamage += damage;
    this._pushEvent('player_damaged', {
      wave,
      damage,
      playerHpAfter,
      battleTime,
    });
  }

  recordChestSpawn(payload: {
    serial: number;
    quality: SupplyChestQuality;
    wave: number;
    battleTime: number;
    maxHp: number;
  }): void {
    if (!this._current) return;
    const trace: RuntimeChestTrace = {
      serial: payload.serial,
      quality: payload.quality,
      wave: payload.wave,
      spawnedAt: payload.battleTime,
      maxHp: payload.maxHp,
    };
    this._chestMap.set(payload.serial, trace);
    this._current.chests.push(trace);
    const waveTrace = this._waveMap.get(payload.wave);
    if (waveTrace) waveTrace.chestsSpawned++;
    this._pushEvent('chest_spawned', {
      serial: payload.serial,
      quality: payload.quality,
      wave: payload.wave,
      maxHp: payload.maxHp,
    });
  }

  recordChestDestroyed(payload: {
    serial: number;
    wave: number;
    battleTime: number;
  }): void {
    if (!this._current) return;
    const trace = this._chestMap.get(payload.serial);
    if (trace && trace.destroyedAt == null) {
      trace.destroyedAt = payload.battleTime;
    }
    const waveTrace = this._waveMap.get(payload.wave);
    if (waveTrace) waveTrace.chestsDestroyed++;
    this._pushEvent('chest_destroyed', {
      serial: payload.serial,
      wave: payload.wave,
    });
  }

  recordSupplyShown(payload: {
    serial: number;
    wave: number;
    sourceQuality: SupplyChestQuality;
    battleTime: number;
    options: SupplyOptionData[];
  }): void {
    if (!this._current) return;
    this._current.supplyChoices.push({
      serial: payload.serial,
      wave: payload.wave,
      sourceQuality: payload.sourceQuality,
      shownAt: payload.battleTime,
      refreshCount: 0,
      options: payload.options.map((option) => ({
        id: option.id,
        title: option.title,
        star: option.star,
        cardType: option.cardType,
        triggerMode: option.triggerMode,
      })),
    });
    this._pushEvent('supply_shown', {
      serial: payload.serial,
      wave: payload.wave,
      sourceQuality: payload.sourceQuality,
      optionIds: payload.options.map((option) => option.id),
    });
  }

  recordSupplyRefresh(payload: {
    serial: number;
    wave: number;
    refreshedQuality: SupplyChestQuality;
    battleTime: number;
    options: SupplyOptionData[];
  }): void {
    if (!this._current) return;
    const target = this._findLatestSupplyChoice(payload.serial, payload.wave);
    if (!target) return;
    target.refreshCount += 1;
    target.options = payload.options.map((option) => ({
      id: option.id,
      title: option.title,
      star: option.star,
      cardType: option.cardType,
      triggerMode: option.triggerMode,
    }));
    this._pushEvent('supply_refreshed', {
      serial: payload.serial,
      wave: payload.wave,
      refreshedQuality: payload.refreshedQuality,
      optionIds: payload.options.map((option) => option.id),
    });
  }

  recordSupplyPicked(payload: {
    serial: number;
    wave: number;
    battleTime: number;
    option: SupplyOptionData;
  }): void {
    if (!this._current) return;
    const target = this._findLatestSupplyChoice(payload.serial, payload.wave);
    if (target) {
      target.pickedOptionId = payload.option.id;
      target.pickedAt = payload.battleTime;
    }
    this._pushEvent('supply_picked', {
      serial: payload.serial,
      wave: payload.wave,
      optionId: payload.option.id,
      optionTitle: payload.option.title,
      star: payload.option.star,
      cardType: payload.option.cardType,
      triggerMode: payload.option.triggerMode,
    });
  }

  getCurrentTrace(): RuntimeRunTrace | null {
    return this._current ? JSON.parse(JSON.stringify(this._current)) as RuntimeRunTrace : null;
  }

  pushCustomEvent(type: string, payload: Record<string, unknown>): void {
    this._pushEvent(type, payload);
  }

  private _findLatestSupplyChoice(serial: number, wave: number) {
    if (!this._current) return null;
    for (let i = this._current.supplyChoices.length - 1; i >= 0; i--) {
      const item = this._current.supplyChoices[i];
      if (item.serial === serial && item.wave === wave) {
        return item;
      }
    }
    return null;
  }

  private _pushEvent(type: string, payload: Record<string, unknown>): void {
    if (!this._current) return;
    this._current.events.push({
      type,
      ...payload,
    });
  }

  private _buildConfigSnapshot(): RuntimeRunTrace['configSnapshot'] {
    return JSON.parse(JSON.stringify({
      waveDefs: GameConfig.waveDefs || [],
      stages: GameConfig.stages || [],
      supply: GameConfig.gameplay?.supply || {},
    })) as RuntimeRunTrace['configSnapshot'];
  }

  private _persist(): void {
    if (!this._current) return;
    try {
      sys.localStorage.setItem(
        RunTelemetryManager.STORAGE_KEY,
        JSON.stringify(this._current)
      );
      if (typeof window !== 'undefined') {
        (window as typeof window & { __BRIDGE_GUARD_RUNTIME_TRACE__?: RuntimeRunTrace }).__BRIDGE_GUARD_RUNTIME_TRACE__ = this.getCurrentTrace() || undefined;
      }
    } catch (err) {
      console.warn('[RunTelemetryManager] persist failed:', err);
    }
  }

  private _restorePersistedTraceToWindow(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw =
        sys.localStorage.getItem(RunTelemetryManager.STORAGE_KEY)
        || RunTelemetryManager.LEGACY_STORAGE_KEYS
          .map((key) => sys.localStorage.getItem(key))
          .find((value) => !!value)
        || null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as RuntimeRunTrace;
      (window as typeof window & { __BRIDGE_GUARD_RUNTIME_TRACE__?: RuntimeRunTrace }).__BRIDGE_GUARD_RUNTIME_TRACE__ = parsed;
    } catch (err) {
      console.warn('[RunTelemetryManager] restore persisted trace failed:', err);
    }
  }

  private _emitDebugSummary(): void {
    if (!this._current) return;
    const events = Array.isArray(this._current.events) ? this._current.events : [];
    const baselineStarted = events.find((event) => event.type === 'baseline_calibration_started') as Record<string, unknown> | undefined;
    const firstRailContact = events.find((event) => event.type === 'enemy_reached_rail') as Record<string, unknown> | undefined;
    const firstPlayerDamaged = events.find((event) => event.type === 'player_damaged') as Record<string, unknown> | undefined;
    const summary = {
      baselineCalibrationMode: !!this._current.baselineCalibrationMode,
      result: this._current.result || null,
      startTier: this._current.startTier,
      forcedEvolution: this._current.forcedEvolution,
      totalEnemySpawned: this._current.totalEnemySpawned || 0,
      totalEnemyKilled: this._current.totalEnemyKilled || 0,
      totalPlayerDamage: this._current.totalPlayerDamage || 0,
      endedAtBattleTime: this._current.endedAtBattleTime ?? null,
      playerHpEnd: this._current.playerHpEnd ?? null,
      enemyType: baselineStarted?.enemyType ?? null,
      baselineMode: baselineStarted?.baselineMode ?? null,
      spawnInterval: baselineStarted?.spawnInterval ?? null,
      bonusSpreadCount: baselineStarted?.bonusSpreadCount ?? 0,
      bonusMultiShot: baselineStarted?.bonusMultiShot ?? 0,
      weaponProfile: baselineStarted?.weaponProfile ?? '',
      baseSpreadCount: baselineStarted?.baseSpreadCount ?? null,
      baseBurstCount: baselineStarted?.baseBurstCount ?? null,
      finalSpreadCount: baselineStarted?.finalSpreadCount ?? null,
      finalBurstCount: baselineStarted?.finalBurstCount ?? null,
      firstRailContactTime: firstRailContact?.battleTime ?? null,
      firstDamageTime: firstPlayerDamaged?.battleTime ?? null,
    };
    console.log('[BaselineTraceSummary]', JSON.stringify(summary));
  }
}
