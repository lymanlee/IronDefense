function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeRuns(runs) {
  const total = runs.length;
  const clearRate = average(runs.map((run) => run.metrics.clearRate));
  const avgWaveTime = average(runs.map((run) => run.metrics.avgWaveTime));
  const avgPlayerHpPct = average(runs.map((run) => run.metrics.avgPlayerHpPct));
  const chestDestroyRate = average(runs.map((run) => run.metrics.chestDestroyRate));
  const firstEvolutionWave = average(runs.map((run) => run.metrics.firstEvolutionWave || 0));
  const snowballIndex = average(runs.map((run) => run.metrics.snowballIndex || 1));
  return {
    total,
    clearRate,
    avgWaveTime,
    avgPlayerHpPct,
    chestDestroyRate,
    firstEvolutionWave,
    snowballIndex,
  };
}

module.exports = {
  average,
  summarizeRuns,
};
