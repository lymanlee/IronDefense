const fs = require('fs');
const path = require('path');

const { simulateRun } = require('./balance_simulator');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function round(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function summarizeRuntimeTrace(trace) {
  return {
    result: trace.result,
    failureWave: trace.failureWave || 0,
    currentWave: trace.currentWave || 0,
    kills: trace.kills || 0,
    totalEnemySpawned: trace.totalEnemySpawned || 0,
    totalEnemyKilled: trace.totalEnemyKilled || 0,
    totalEnemyDamage: trace.totalEnemyDamage || 0,
    totalPlayerDamage: trace.totalPlayerDamage || 0,
    totalSupplyRefreshes: (trace.supplyChoices || []).reduce((sum, item) => sum + (item.refreshCount || 0), 0),
    waves: (trace.waves || []).map((wave) => ({
      wave: wave.wave,
      plannedEnemies: wave.plannedEnemies,
      spawnedEnemies: wave.spawnedEnemies,
      killedEnemies: wave.killedEnemies,
      playerHpStart: wave.playerHpStart,
      playerHpEnd: wave.playerHpEnd ?? null,
      duration: round(wave.duration),
      chestsSpawned: wave.chestsSpawned,
      chestsDestroyed: wave.chestsDestroyed,
    })),
    chests: (trace.chests || []).map((chest) => ({
      serial: chest.serial,
      wave: chest.wave,
      quality: chest.quality,
      ttk: chest.destroyedAt != null ? round(chest.destroyedAt - chest.spawnedAt) : null,
    })),
    supplyChoices: (trace.supplyChoices || []).map((choice) => ({
      serial: choice.serial,
      wave: choice.wave,
      sourceQuality: choice.sourceQuality,
      refreshCount: choice.refreshCount || 0,
      pickedOptionId: choice.pickedOptionId || null,
    })),
  };
}

function summarizeSimRun(run) {
  return {
    result: run.metrics.clearRate ? 'victory' : 'gameover',
    failureWave: run.metrics.failureWave || 0,
    currentWave: run.metrics.waveResults.at(-1)?.wave || 0,
    kills: run.metrics.totalKills || 0,
    totalEnemySpawned: run.metrics.totalEnemySpawned || 0,
    totalEnemyKilled: run.metrics.totalKills || 0,
    totalEnemyDamage: run.metrics.waveResults.reduce((sum, wave) => sum + (wave.totalDamage || 0), 0),
    totalPlayerDamage: run.metrics.waveResults.reduce((sum, wave) => sum + (wave.totalPlayerDamage || 0), 0),
    totalSupplyRefreshes: run.metrics.totalSupplyRefreshes ?? run.metrics.waveResults.reduce((sum, wave) => sum + (wave.supplyRefreshesUsed || 0), 0),
    waves: run.metrics.waveResults.map((wave) => ({
      wave: wave.wave,
      plannedEnemies: wave.enemySpawnCount,
      spawnedEnemies: wave.enemySpawnCount,
      killedEnemies: wave.killCount,
      playerHpStart: null,
      playerHpEnd: round(wave.playerHp),
      duration: round(wave.waveTime),
      chestsSpawned: wave.chestSpawned,
      chestsDestroyed: wave.chestDestroyed,
    })),
    chests: (run.metrics.chests || []).map((chest) => ({
      serial: chest.serial,
      wave: chest.spawnWave,
      quality: chest.quality,
      ttk: chest.destroyed && chest.destroyTime != null ? round(chest.destroyTime - chest.spawnTime) : null,
    })),
    supplyChoices: (run.metrics.supplyChoices || []).map((choice) => ({
      serial: choice.serial,
      wave: choice.wave,
      sourceQuality: choice.sourceQuality,
      refreshCount: choice.refreshCount || 0,
      pickedOptionId: choice.pickedOptionId || null,
      replayed: !!choice.replayed,
    })),
  };
}

function compareByWave(runtimeSummary, simSummary) {
  const waves = [];
  const maxWave = Math.max(
    runtimeSummary.waves.at(-1)?.wave || 0,
    simSummary.waves.at(-1)?.wave || 0
  );
  for (let wave = 1; wave <= maxWave; wave++) {
    const runtimeWave = runtimeSummary.waves.find((item) => item.wave === wave) || null;
    const simWave = simSummary.waves.find((item) => item.wave === wave) || null;
    waves.push({
      wave,
      runtime: runtimeWave,
      simulator: simWave,
      delta: runtimeWave && simWave ? {
        duration: runtimeWave.duration != null && simWave.duration != null ? round(simWave.duration - runtimeWave.duration) : null,
        playerHpEnd: runtimeWave.playerHpEnd != null && simWave.playerHpEnd != null ? round(simWave.playerHpEnd - runtimeWave.playerHpEnd) : null,
        chestsSpawned: (simWave.chestsSpawned ?? 0) - (runtimeWave.chestsSpawned ?? 0),
        chestsDestroyed: (simWave.chestsDestroyed ?? 0) - (runtimeWave.chestsDestroyed ?? 0),
        killedEnemies: (simWave.killedEnemies ?? 0) - (runtimeWave.killedEnemies ?? 0),
      } : null,
    });
  }
  return waves;
}

function compare(runtimeTracePath, strategy = 'balanced', seed = 1, stageIndex = 0, startTier = 1) {
  const runtimeTrace = readJson(path.resolve(runtimeTracePath));
  const runtimeSummary = summarizeRuntimeTrace(runtimeTrace);
  const simOptions = {
    seed,
    strategy: strategy === 'trace_replay' ? 'balanced' : strategy,
    stageIndex,
    startTier,
  };
  if (strategy === 'trace_replay') {
    simOptions.traceReplay = runtimeTrace;
  }
  const simRun = simulateRun({}, simOptions);
  const simSummary = summarizeSimRun(simRun);
  return {
    runtime: runtimeSummary,
    simulator: simSummary,
    headline: {
      runtimeResult: runtimeSummary.result,
      simulatorResult: simSummary.result,
      runtimeFailureWave: runtimeSummary.failureWave,
      simulatorFailureWave: simSummary.failureWave,
      runtimeRefreshes: runtimeSummary.totalSupplyRefreshes,
      simulatorRefreshes: simSummary.totalSupplyRefreshes,
    },
    waves: compareByWave(runtimeSummary, simSummary),
  };
}

module.exports = {
  compare,
  summarizeRuntimeTrace,
  summarizeSimRun,
};

if (require.main === module) {
  const runtimeTracePath = process.argv[2];
  const strategy = process.argv[3] || 'balanced';
  const seed = Number(process.argv[4] || 1);
  if (!runtimeTracePath) {
    process.stderr.write('Usage: node tools/balance/runtime_trace_compare.js <runtime-trace.json> [strategy] [seed]\n');
    process.exit(1);
  }
  const result = compare(runtimeTracePath, strategy, seed);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
