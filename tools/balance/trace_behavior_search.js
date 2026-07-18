const fs = require('fs');
const path = require('path');

const { simulateRun, DEFAULT_BEHAVIOR_TUNING } = require('./balance_simulator');
const { summarizeRuntimeTrace } = require('./runtime_trace_compare');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function buildWaveMap(waves) {
  const map = new Map();
  for (const wave of waves || []) {
    map.set(wave.wave, wave);
  }
  return map;
}

function scoreRun(runtimeSummary, simRun) {
  const runtimeWaveMap = buildWaveMap(runtimeSummary.waves);
  const simWaveMap = buildWaveMap(
    simRun.metrics.waveResults.map((wave) => ({
      wave: wave.wave,
      chestsSpawned: wave.chestSpawned,
      chestsDestroyed: wave.chestDestroyed,
      killedEnemies: wave.killCount,
      playerHpEnd: wave.playerHp,
      duration: wave.waveTime,
    }))
  );

  let score = 0;
  const simFailureWave = simRun.metrics.failureWave || 0;
  const runtimeFailureWave = runtimeSummary.failureWave || 0;
  const simVictory = simRun.metrics.clearRate >= 1;
  const runtimeVictory = runtimeSummary.result === 'victory';
  if (simVictory !== runtimeVictory) {
    score += 1200;
  }
  const failureWaveDelta = Math.abs(simFailureWave - runtimeFailureWave);
  score += failureWaveDelta * 220;

  const refreshDelta = Math.abs((simRun.metrics.totalSupplyRefreshes || 0) - (runtimeSummary.totalSupplyRefreshes || 0));
  score += refreshDelta * 80;

  for (const waveNo of [3, 4, 5, 6, 7, 8, 9]) {
    const runtimeWave = runtimeWaveMap.get(waveNo);
    const simWave = simWaveMap.get(waveNo);
    if (!runtimeWave && !simWave) continue;
    if (!runtimeWave || !simWave) {
      score += 120;
      continue;
    }
    score += Math.abs((simWave.chestsSpawned || 0) - (runtimeWave.chestsSpawned || 0)) * (waveNo <= 5 ? 120 : 30);
    score += Math.abs((simWave.chestsDestroyed || 0) - (runtimeWave.chestsDestroyed || 0)) * (waveNo <= 5 ? 150 : 36);
    score += Math.abs((simWave.killedEnemies || 0) - (runtimeWave.killedEnemies || 0)) * (waveNo >= 8 ? 2.2 : 0.8);
    if (runtimeWave.playerHpEnd != null) {
      score += Math.abs((simWave.playerHpEnd || 0) - runtimeWave.playerHpEnd) * (waveNo >= 8 ? 1.2 : 0.6);
    }
    if (runtimeWave.duration != null && simWave.duration != null) {
      score += Math.abs(simWave.duration - runtimeWave.duration) * (waveNo <= 5 ? 2.4 : 0.5);
    }
  }

  const simChests = simRun.metrics.chests || [];
  const runtimeChests = runtimeSummary.chests || [];
  for (let i = 0; i < Math.max(simChests.length, runtimeChests.length); i++) {
    const simChest = simChests[i];
    const runtimeChest = runtimeChests[i];
    if (!simChest || !runtimeChest) {
      score += 180;
      continue;
    }
    score += Math.abs((simChest.spawnWave || 0) - (runtimeChest.wave || 0)) * 60;
    score += Math.abs((simChest.refreshCount || 0) - (runtimeSummary.supplyChoices?.[i]?.refreshCount || 0)) * 40;
    if (simChest.destroyTime != null && runtimeChest.ttk != null && simChest.spawnTime != null) {
      const simTtk = simChest.destroyTime - simChest.spawnTime;
      score += Math.abs(simTtk - runtimeChest.ttk) * 2.6;
    }
  }

  return round(score, 3);
}

function mutateTuning(base, rand) {
  const next = { ...base };
  const scale = (value, ratio = 0.18, min = 0.01) => Math.max(min, value * (1 + (rand() * 2 - 1) * ratio));
  const shift = (value, amount, min = 0) => Math.max(min, value + (rand() * 2 - 1) * amount);

  next.enterChestModeMinDangerScore = shift(base.enterChestModeMinDangerScore, 0.18, 0.2);
  next.enterChestModeFrontlineDistance = shift(base.enterChestModeFrontlineDistance, 42, 60);
  next.exitChestModeDangerScore = shift(base.exitChestModeDangerScore, 0.22, 0.4);
  next.exitChestModeFrontlineDistance = shift(base.exitChestModeFrontlineDistance, 36, 40);
  next.chestModeCommitSecondsSingle = scale(base.chestModeCommitSecondsSingle, 0.45, 0.15);
  next.chestModeCommitSecondsMulti = scale(base.chestModeCommitSecondsMulti, 0.45, 0.3);
  next.chestModeCommitSecondsHighQuality = scale(base.chestModeCommitSecondsHighQuality, 0.45, 0.2);
  next.enemyFocusCooldownSeconds = scale(base.enemyFocusCooldownSeconds, 0.45, 0.05);
  next.severeEnemyFocusCooldownSeconds = scale(base.severeEnemyFocusCooldownSeconds, 0.35, 0.2);
  next.chestMovingDamageFactor = shift(base.chestMovingDamageFactor, 0.12, 0.45);
  next.chestStoppedDamageFactor = shift(base.chestStoppedDamageFactor, 0.1, 0.55);
  next.chestSpreadBonusPerCoverage = shift(base.chestSpreadBonusPerCoverage, 0.04, 0);
  next.chestSpillDamageFactor = shift(base.chestSpillDamageFactor, 0.14, 0);
  next.chestMovingSpillPenalty = shift(base.chestMovingSpillPenalty, 0.18, 0.1);
  next.exitChestModeRailThreatCount = Math.max(1, Math.min(4, Math.round(shift(base.exitChestModeRailThreatCount, 1.2, 1))));
  return next;
}

function createRand(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function search(runtimeTracePath, options = {}) {
  const runtimeTrace = readJson(path.resolve(runtimeTracePath));
  const runtimeSummary = summarizeRuntimeTrace(runtimeTrace);
  const strategy = options.strategy || 'balanced';
  const seed = Number(options.seed || 1);
  const iterations = Math.max(1, Number(options.iterations || 180));
  const rand = createRand(seed * 9973 + 17);

  let bestTuning = { ...DEFAULT_BEHAVIOR_TUNING, ...(options.startTuning || {}) };
  let bestRun = simulateRun({}, { seed, strategy, stageIndex: 0, startTier: 1, behaviorTuning: bestTuning });
  let bestScore = scoreRun(runtimeSummary, bestRun);

  for (let i = 0; i < iterations; i++) {
    const candidateTuning = mutateTuning(bestTuning, rand);
    const candidateRun = simulateRun({}, { seed, strategy, stageIndex: 0, startTier: 1, behaviorTuning: candidateTuning });
    const candidateScore = scoreRun(runtimeSummary, candidateRun);
    if (candidateScore < bestScore) {
      bestScore = candidateScore;
      bestTuning = candidateTuning;
      bestRun = candidateRun;
    }
  }

  return {
    score: bestScore,
    tuning: bestTuning,
    summary: {
      failureWave: bestRun.metrics.failureWave,
      totalSupplyRefreshes: bestRun.metrics.totalSupplyRefreshes,
      waveResults: bestRun.metrics.waveResults.map((wave) => ({
        wave: wave.wave,
        chestSpawned: wave.chestSpawned,
        chestDestroyed: wave.chestDestroyed,
        killCount: wave.killCount,
        playerHp: wave.playerHp,
        waveTime: round(wave.waveTime, 2),
      })),
    },
  };
}

module.exports = {
  scoreRun,
  search,
};

if (require.main === module) {
  const runtimeTracePath = process.argv[2];
  const strategy = process.argv[3] || 'balanced';
  const seed = Number(process.argv[4] || 1);
  const iterations = Number(process.argv[5] || 180);
  if (!runtimeTracePath) {
    process.stderr.write('Usage: node tools/balance/trace_behavior_search.js <runtime-trace.json> [strategy] [seed] [iterations]\\n');
    process.exit(1);
  }
  const result = search(runtimeTracePath, { strategy, seed, iterations });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\\n`);
}
