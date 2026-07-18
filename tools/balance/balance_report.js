function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function renderMarkdownReport(batchResult) {
  const lines = [];
  lines.push('# Balance Report');
  lines.push('');
  lines.push(`- Runs: ${batchResult.summary.total}`);
  lines.push(`- Clear Rate: ${formatPct(batchResult.summary.clearRate)}`);
  lines.push(`- Avg Wave Time: ${batchResult.summary.avgWaveTime.toFixed(2)}s`);
  lines.push(`- Avg Player HP: ${formatPct(batchResult.summary.avgPlayerHpPct)}`);
  lines.push(`- Chest Destroy Rate: ${formatPct(batchResult.summary.chestDestroyRate)}`);
  lines.push(`- Snowball Index: ${batchResult.summary.snowballIndex.toFixed(2)}`);
  return lines.join('\n');
}

module.exports = {
  renderMarkdownReport,
};
