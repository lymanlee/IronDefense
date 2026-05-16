/**
 * StageManager.ts - 关卡流程管理（最小版）
 */

import { GameConfig, StageDefData } from '../data/GameConfig';

export class StageManager {
  private _stageIndex: number = 0;
  private readonly _stages: StageDefData[] = (GameConfig.stages || []) as StageDefData[];

  reset(): void {
    this._stageIndex = 0;
  }

  get currentStage(): StageDefData {
    return this._stages[Math.max(0, Math.min(this._stageIndex, this._stages.length - 1))];
  }

  get currentStageIndex(): number {
    return this._stageIndex;
  }

  get totalStages(): number {
    return this._stages.length;
  }

  setStageIndex(index: number): void {
    this._stageIndex = Math.max(0, Math.min(index, this._stages.length - 1));
  }

  isStageComplete(currentWaveNum: number): boolean {
    const stage = this.currentStage;
    const lastWave = stage.startWave + stage.waveCount - 1;
    return currentWaveNum > lastWave;
  }

  getStageStartWave(): number {
    return this.currentStage.startWave;
  }

  getStageEndWave(): number {
    const stage = this.currentStage;
    return stage.startWave + stage.waveCount - 1;
  }

  getStageWaveNum(currentWaveNum: number): number {
    const stage = this.currentStage;
    const localWave = currentWaveNum - stage.startWave + 1;
    return Math.max(1, Math.min(stage.waveCount, localWave));
  }

  advanceToNextStage(): boolean {
    if (this._stageIndex >= this._stages.length - 1) return false;
    this._stageIndex++;
    return true;
  }
}
