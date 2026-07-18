const { simulateRun } = require('./balance_simulator');
const { summarizeRuns } = require('./balance_metrics');

function runBatch(options = {}) {
  const runs = [];
  const seeds = options.seeds || [1];
  const strategies = options.strategies || ['balanced'];
  const configOverrides = options.configOverrides || {};
  const stageIndex = options.stageIndex || 0;
  const startTier = options.startTier || 1;

  for (const strategy of strategies) {
    for (const seed of seeds) {
      runs.push(
        simulateRun(configOverrides, {
          seed,
          strategy,
          stageIndex,
          startTier,
          progress: options.progress || {},
        })
      );
    }
  }

  return {
    runs,
    summary: summarizeRuns(runs),
  };
}

module.exports = {
  runBatch,
};

if (require.main === module) {
  const result = runBatch({
    seeds: [1, 2, 3, 4, 5],
    strategies: ['conservative', 'balanced', 'expert'],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
