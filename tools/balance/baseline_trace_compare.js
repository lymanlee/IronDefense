const fs = require('fs');
const path = require('path');

const { simulateBaselineCalibration } = require('./balance_simulator');

// Baseline compare uses two different semantics on purpose:
// - runtime trace: lab-style auto-sweep experiment from the actual game
// - simulator: player-proxy model used for balance tuning
// Therefore, a small optimistic delta is acceptable, especially for
// parallel-fire scenarios where a real player can prioritize frontline threats
// better than the deterministic sweep experiment.

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function round(value, digits = 3) {
  if (value == null || Number.isNaN(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function summarizeRuntimeBaseline(trace) {
  const events = Array.isArray(trace.events) ? trace.events : [];
  const firstPlayerDamaged = events.find((event) => event.type === 'player_damaged');
  const firstRailContact = events.find((event) => event.type === 'enemy_reached_rail');
  return {
    result: trace.result || null,
    survivalTime: round(trace.endedAtBattleTime ?? trace.startedAtBattleTime ?? 0),
    totalKills: trace.totalEnemyKilled || 0,
    totalEnemySpawned: trace.totalEnemySpawned || 0,
    totalPlayerDamage: trace.totalPlayerDamage || 0,
    playerHpEnd: trace.playerHpEnd ?? null,
    firstDamageTime: round(firstPlayerDamaged?.playerHpAfter != null ? firstPlayerDamaged.battleTime : null),
    firstRailContactTime: round(firstRailContact?.battleTime ?? null),
    baselineCalibrationMode: !!trace.baselineCalibrationMode,
  };
}

function summarizeSimulatorBaseline(run) {
  const metrics = run.metrics || {};
  return {
    result: metrics.result || null,
    survivalTime: round(metrics.survivalTime),
    totalKills: metrics.totalKills || 0,
    totalEnemySpawned: metrics.totalEnemySpawned || 0,
    totalPlayerDamage: metrics.totalPlayerDamage || 0,
    playerHpEnd: metrics.playerHpEnd ?? null,
    firstDamageTime: round(metrics.firstDamageTime),
    firstRailContactTime: round(metrics.firstRailContactTime),
  };
}

function compareBaseline(runtimeTracePath, options = {}) {
  const runtimeTrace = readJson(path.resolve(runtimeTracePath));
  const runtime = summarizeRuntimeBaseline(runtimeTrace);
  const baselineStarted = Array.isArray(runtimeTrace.events)
    ? runtimeTrace.events.find((event) => event.type === 'baseline_calibration_started')
    : null;
  const simulatorRun = simulateBaselineCalibration({}, {
    startTier: options.startTier || runtimeTrace.startTier || 1,
    forcedEvolution: options.forcedEvolution || (runtimeTrace.forcedEvolution && runtimeTrace.forcedEvolution !== 'none' ? runtimeTrace.forcedEvolution : null),
    bonusSpreadCount: options.bonusSpreadCount ?? baselineStarted?.bonusSpreadCount ?? 0,
    bonusMultiShot: options.bonusMultiShot ?? baselineStarted?.bonusMultiShot ?? 0,
  });
  const simulator = summarizeSimulatorBaseline(simulatorRun);
  return {
    scenario: {
      baselineMode: baselineStarted?.baselineMode || 'baseline_calibration',
      weaponProfile: baselineStarted?.weaponProfile || null,
      baseSpreadCount: baselineStarted?.baseSpreadCount ?? null,
      baseBurstCount: baselineStarted?.baseBurstCount ?? null,
      finalSpreadCount: baselineStarted?.finalSpreadCount ?? null,
      finalBurstCount: baselineStarted?.finalBurstCount ?? null,
      bonusSpreadCount: baselineStarted?.bonusSpreadCount ?? 0,
      bonusMultiShot: baselineStarted?.bonusMultiShot ?? 0,
      interpretation: 'runtime=lab_baseline, simulator=player_proxy',
    },
    runtime,
    simulator,
    delta: {
      survivalTime: round((simulator.survivalTime ?? 0) - (runtime.survivalTime ?? 0)),
      totalKills: (simulator.totalKills || 0) - (runtime.totalKills || 0),
      totalEnemySpawned: (simulator.totalEnemySpawned || 0) - (runtime.totalEnemySpawned || 0),
      totalPlayerDamage: (simulator.totalPlayerDamage || 0) - (runtime.totalPlayerDamage || 0),
      playerHpEnd: (simulator.playerHpEnd ?? 0) - (runtime.playerHpEnd ?? 0),
      firstDamageTime: round((simulator.firstDamageTime ?? 0) - (runtime.firstDamageTime ?? 0)),
      firstRailContactTime: round((simulator.firstRailContactTime ?? 0) - (runtime.firstRailContactTime ?? 0)),
    },
  };
}

module.exports = {
  compareBaseline,
  summarizeRuntimeBaseline,
  summarizeSimulatorBaseline,
};

if (require.main === module) {
  const runtimeTracePath = process.argv[2];
  if (!runtimeTracePath) {
    process.stderr.write('Usage: node tools/balance/baseline_trace_compare.js <runtime-trace.json>\n');
    process.exit(1);
  }
  const result = compareBaseline(runtimeTracePath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
