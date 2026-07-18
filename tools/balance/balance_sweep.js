const { runBatch } = require('./balance_runner');
const { renderMarkdownReport } = require('./balance_report');

function sweep() {
  const result = runBatch({
    seeds: [1, 2, 3, 4, 5],
    strategies: ['conservative', 'balanced', 'expert'],
  });
  return {
    result,
    report: renderMarkdownReport(result),
  };
}

module.exports = {
  sweep,
};

if (require.main === module) {
  const out = sweep();
  process.stdout.write(`${out.report}\n`);
}
