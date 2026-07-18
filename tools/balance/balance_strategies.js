function createStrategies() {
  return {
    conservative: {
      name: 'conservative',
      pickChest: (state) => state.chestQuality === 'legendary' || state.activeChestCount >= 2 || state.enemyPressure < 0.3,
      pickCard: (cards, state) => cards[0] || null,
      shouldRefreshSupply: () => false,
    },
    greedy_chest: {
      name: 'greedy_chest',
      pickChest: (state) => state.chestQuality !== 'normal' || state.activeChestCount >= 2 || state.enemyPressure < 0.58,
      pickCard: (cards, state) => cards.reduce((best, card) => (card.star > (best?.star || 0) ? card : best), null),
      shouldRefreshSupply: ({ remainingRefreshes, currentCards, chestQuality }) =>
        remainingRefreshes > 0
        && chestQuality !== 'legendary'
        && !currentCards.some((card) => card.star >= 4),
    },
    balanced: {
      name: 'balanced',
      pickChest: (state) => state.chestQuality === 'legendary' || state.activeChestCount >= 2 || state.enemyPressure < 0.35,
      pickCard: (cards, state) => {
        const preferred = cards.find((card) => card.triggerMode === 'passive' && card.cardType === 'firepower');
        return preferred || cards.reduce((best, card) => (card.star > (best?.star || 0) ? card : best), null);
      },
      shouldRefreshSupply: ({ remainingRefreshes, currentCards, chestQuality, waveIndex }) =>
        remainingRefreshes > 0
        && waveIndex <= 6
        && chestQuality !== 'legendary'
        && !currentCards.some((card) => card.star >= 3 && card.cardType === 'firepower'),
    },
    expert: {
      name: 'expert',
      pickChest: (state) => state.chestQuality === 'legendary' || state.activeChestCount >= 2 || state.enemyPressure < 0.45,
      pickCard: (cards, state) => {
        const firepower = cards.filter((card) => card.cardType === 'firepower');
        const control = cards.filter((card) => card.cardType === 'control');
        const pool = state.enemyPressure > 0.7 ? control.concat(firepower) : firepower.concat(control);
        return pool.reduce((best, card) => (card.star > (best?.star || 0) ? card : best), null);
      },
      shouldRefreshSupply: ({ remainingRefreshes, currentCards, chestQuality, waveIndex }) =>
        remainingRefreshes > 0
        && waveIndex <= 7
        && chestQuality !== 'legendary'
        && !currentCards.some((card) => card.star >= 4 || (card.star >= 3 && card.cardType === 'firepower')),
    },
  };
}

module.exports = {
  createStrategies,
};
