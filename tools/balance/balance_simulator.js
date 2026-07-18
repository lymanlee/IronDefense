const { createConfigSnapshot } = require('./balance_config_loader');
const { createStrategies } = require('./balance_strategies');

const SIM_BURST_INTERVAL = 0.065;
const DEFAULT_BEHAVIOR_TUNING = Object.freeze({
  enterChestModeMinDangerScore: 0.92,
  enterChestModeFrontlineDistance: 185,
  exitChestModeDangerScore: 1.18,
  exitChestModeFrontlineDistance: 110,
  exitChestModeRailThreatCount: 1,
  chestModeCommitSecondsSingle: 1.05,
  chestModeCommitSecondsMulti: 2.2,
  chestModeCommitSecondsHighQuality: 1.4,
  enemyFocusCooldownSeconds: 0.9,
  severeEnemyFocusCooldownSeconds: 1.5,
  chestMovingDamageFactor: 0.86,
  chestStoppedDamageFactor: 0.94,
  chestSpreadBonusPerCoverage: 0.02,
  chestSpillDamageFactor: 0.22,
  chestMovingSpillPenalty: 0.7,
});

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand, entries, weightFn) {
  const weights = entries.map((entry) => Math.max(0, weightFn(entry)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return entries[0] || null;
  let roll = rand() * total;
  for (let i = 0; i < entries.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return entries[i];
  }
  return entries[entries.length - 1] || null;
}

function getStageWaveCount(config, stageIndex) {
  return config.stages?.[stageIndex]?.waveCount || 0;
}

function getWaveDef(config, waveIndex) {
  if (waveIndex < config.waveDefs.length) return config.waveDefs[waveIndex];
  const base = config.waves[Math.min(config.waves.length - 1, waveIndex)];
  const extra = Math.max(0, waveIndex - config.waves.length + 1);
  const count = base.count + config.waveScaling.countAdd * extra;
  return {
    kind: 'mixed',
    title: `fallback_${waveIndex + 1}`,
    spawnInterval: Math.max(0.18, base.spawnInterval - 0.05 * extra),
    entries: [
      { type: 'normal', count: Math.max(1, Math.floor(count * 0.6)) },
      { type: 'runner', count: Math.max(1, Math.floor(count * 0.4)) },
    ],
  };
}

function getStageWaveScale(config, stageIndex, waveIndex, key) {
  const stage = config.stages?.[stageIndex];
  const arr = stage?.[key];
  if (!arr || arr.length === 0) return 1;
  const localWave = Math.max(0, waveIndex - ((stage.startWave || 1) - 1));
  return arr[Math.min(localWave, arr.length - 1)] || 1;
}

function getEnemyTypeData(config, type) {
  return config.enemyTypes[type] || config.enemyTypes.normal;
}

function buildWaveEnemies(config, stageIndex, waveIndex, rand) {
  const waveDef = getWaveDef(config, waveIndex);
  const waveData = config.waves[Math.min(config.waves.length - 1, waveIndex)] || config.waves[0];
  const hpScale = getStageWaveScale(config, stageIndex, waveIndex, 'enemyHpScaleByWave');
  const atkScale = getStageWaveScale(config, stageIndex, waveIndex, 'enemyAtkScaleByWave');
  const speedScale = getStageWaveScale(config, stageIndex, waveIndex, 'enemySpeedScaleByWave');
  const result = [];
  const entries = waveDef.entries || [];
  const mixMode = waveDef.mixMode || (waveDef.kind === 'normal' || waveDef.kind === 'boss' ? 'sequential' : 'round_robin');

  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const typeQueue = [];
  if (mixMode === 'round_robin') {
    const remaining = entries.map((entry) => entry.count);
    const types = entries.map((entry) => entry.type);
    while (typeQueue.length < total) {
      let pushed = false;
      for (let i = 0; i < types.length; i++) {
        if (remaining[i] > 0) {
          remaining[i]--;
          typeQueue.push(types[i]);
          pushed = true;
        }
      }
      if (!pushed) break;
    }
  } else {
    for (const entry of entries) {
      for (let i = 0; i < entry.count; i++) typeQueue.push(entry.type);
    }
  }

  const laneCount = Math.max(1, config.bridge.laneCount || 5);
  const laneWidth = (config.bridge.right - config.bridge.left) / laneCount;
  const enemyStartLaneIndex = Math.max(
    0,
    Math.min(laneCount - 1, config.gameplay?.supply?.chest?.enemyStartLaneIndex ?? 1)
  );
  const enemyLaneCount = Math.max(1, laneCount - enemyStartLaneIndex);
  const totalCount = typeQueue.length;
  for (let i = 0; i < typeQueue.length; i++) {
    const type = typeQueue[i];
    const typeData = getEnemyTypeData(config, type);
    const laneIndex = enemyStartLaneIndex + (i % enemyLaneCount);
    const x = config.bridge.left + (laneIndex + 0.5) * laneWidth;
    const y = config.bridge.battleTop + 30 + waveIndex * 8 + (laneIndex - enemyStartLaneIndex) * 10 + i * 1.5;
    const maxHp = Math.max(
      1,
      Math.round(waveData.hp * hpScale * typeData.hpMult)
    );
    result.push({
      id: `${waveIndex}:${i}`,
      type,
      laneIndex,
      x,
      y,
      hp: maxHp,
      maxHp,
      speed: Math.max(1, waveData.speed * speedScale * typeData.speedMult),
      atk: Math.max(1, Math.round(waveData.atk * atkScale * typeData.atkMult)),
      rewardCoins: typeData.rewardCoins || 0,
      rewardParts: typeData.rewardParts || 0,
      damageReduce: typeData.damageReduce || 0,
      openingArmorSeconds: typeData.openingArmorSeconds || 0,
      openingArmorRemaining: typeData.openingArmorSeconds || 0,
      openingArmorReduce: typeData.openingArmorReduce || 0,
      attackRateMult: typeData.attackRateMult || 1,
      explodeDelay: typeData.explodeDelay || 0,
      freezeRemaining: 0,
      shieldRemaining: 0,
      attackTimer: 0,
      spawned: false,
      spawnAt: i * Math.max(0.01, waveDef.spawnInterval || waveData.spawnInterval || 1),
    });
  }

  return { waveDef, waveData, enemies: result };
}

function getSpawnedEnemies(enemies) {
  return enemies.filter((enemy) => enemy.spawned && !enemy.dead);
}

function getWavePauseDuration(config, waveDef) {
  return Math.max(0, waveDef?.pauseTime || config.wavePauseTime || 0);
}

function createChestTrack(config) {
  const chestCfg = config.gameplay.supply.chest;
  const bridgeHeight = config.bridge.battleTop - config.bridge.railY;
  const capacity = Math.max(1, chestCfg.capacity || 1);
  const laneCount = Math.max(1, config.bridge.laneCount || 1);
  const laneWidth = (config.bridge.right - config.bridge.left) / laneCount;
  const laneIndex = Math.max(0, Math.min(laneCount - 1, chestCfg.laneIndex || 0));
  const laneAnchor = laneIndex <= 0 ? 0.34 : laneIndex >= laneCount - 1 ? 0.66 : 0.5;
  const x = config.bridge.left + (laneIndex + laneAnchor) * laneWidth;
  const stopY = config.bridge.battleTop - bridgeHeight * Math.max(0.1, Math.min(0.9, chestCfg.stopRatio || 0.75));
  const gap = Math.max((chestCfg.radius || 58) * 1.35, chestCfg.slotGap || 18);
  const slots = [];
  for (let i = 0; i < capacity; i++) {
    slots.push({
      x,
      y: stopY + gap * (capacity - 1 - i),
    });
  }
  return {
    x,
    spawnY: config.bridge.battleTop + Math.max(40, (chestCfg.radius || 58) * 1.8),
    slots,
  };
}

function reflowActiveChests(activeChests, chestTrack) {
  const ordered = [...activeChests].filter((chest) => !chest.destroyed).sort((a, b) => b.serial - a.serial);
  const slotCount = chestTrack.slots.length;
  const startIndex = Math.max(0, slotCount - ordered.length);
  ordered.forEach((chest, index) => {
    const slot = chestTrack.slots[startIndex + index];
    if (!slot) return;
    chest.targetX = slot.x;
    chest.targetY = slot.y;
  });
}

function expandWaveChestPlan(waveDef) {
  if (!waveDef?.chests?.length) return [];
  const queue = [];
  for (const entry of waveDef.chests) {
    const count = Math.max(0, Math.floor(entry.count || 0));
    for (let i = 0; i < count; i++) {
      queue.push(entry.quality);
    }
  }
  return queue;
}

function getChestHp(config, waveHp, quality, serial, stageIndex, waveIndex) {
  const chest = config.gameplay.supply.chest;
  const stage = config.stages?.[stageIndex];
  const waveMult = stage?.chestHpMultiplierByWave?.[Math.min(Math.max(0, waveIndex - ((stage.startWave || 1) - 1)), (stage.chestHpMultiplierByWave || []).length - 1)] || 1;
  const qualityMult = chest.qualityHpMultiplier?.[quality] || 1;
  const serialGrowth = Math.max(0, chest.serialGrowth || 0);
  const serialFactor = Math.pow(1 + serialGrowth, serial);
  return Math.max(50, Math.round(waveHp * (chest.baseHpFactor || 1) * waveMult * qualityMult * serialFactor));
}

function getStarRule(config, quality) {
  return config.gameplay?.supply?.starRules?.[quality] || config.gameplay?.supply?.starRules?.normal;
}

function rollStar(rand, maxStar, chestSerial, supplyTier) {
  const weights = [];
  for (let star = 1; star <= maxStar; star++) {
    const distanceToTop = maxStar - star;
    const baseWeight = Math.max(0.45, 2.2 - distanceToTop * 0.55);
    const serialBonus = star === maxStar ? Math.min(1.25, chestSerial * 0.1) : Math.max(0, chestSerial - distanceToTop) * 0.04;
    const qualityBonus = star === maxStar ? supplyTier * 0.16 : supplyTier * 0.05;
    weights.push(baseWeight + serialBonus + qualityBonus);
  }
  const total = weights.reduce((sum, value) => sum + value, 0);
  let roll = rand() * Math.max(0.001, total);
  for (let star = 1; star <= maxStar; star++) {
    roll -= weights[star - 1];
    if (roll <= 0) return star;
  }
  return maxStar;
}

function pickSupplyCards(config, chestQuality, chestSerial, supplyTier, rand) {
  const supply = config.gameplay.supply;
  const maxAllowedStar = getStarRule(config, chestQuality)?.maxStar || 2;
  const desiredCount = Math.max(1, supply.choiceCount || 3);
  const pool = [...(supply.options || [])].filter((option) => option.star <= maxAllowedStar);
  const evoPool = chestSerial >= Math.max(0, config.gameplay.weaponEvolution.minChestSerialToOffer || 0)
    ? [...(config.gameplay.weaponEvolution.options || [])].filter((option) => option.star <= maxAllowedStar)
    : [];
  pool.push(...evoPool);
  const guaranteedStar = getStarRule(config, chestQuality)?.guaranteedStar || null;
  const starPlan = [];
  if (guaranteedStar) starPlan.push(guaranteedStar);
  while (starPlan.length < desiredCount) {
    starPlan.push(rollStar(rand, maxAllowedStar, chestSerial, supplyTier));
  }

  const pickedIds = new Set();
  const result = [];
  for (const star of starPlan) {
    const candidates = pool.filter((option) => option.star === star && !pickedIds.has(option.id));
    if (candidates.length === 0) continue;
    const chosen = pickWeighted(rand, candidates, (option) => 1 + option.star * 0.2);
    if (!chosen) continue;
    pickedIds.add(chosen.id);
    result.push(chosen);
    if (result.length >= desiredCount) return result;
  }
  const remaining = pool.filter((option) => !pickedIds.has(option.id));
  while (result.length < desiredCount && remaining.length > 0) {
    const chosen = pickWeighted(rand, remaining, (option) => 1 + option.star * 0.2);
    if (!chosen) break;
    result.push(chosen);
    pickedIds.add(chosen.id);
    const idx = remaining.findIndex((option) => option.id === chosen.id);
    if (idx >= 0) remaining.splice(idx, 1);
  }
  return result;
}

function getUpgradedChestQuality(quality) {
  switch (quality) {
    case 'normal':
      return 'elite';
    case 'elite':
      return 'rare';
    case 'rare':
      return 'legendary';
    default:
      return quality;
  }
}

function getPlannedWaveChestDelay(config, spawnedCount) {
  const chestCfg = config.gameplay.supply.chest;
  if (spawnedCount <= 0) {
    return Math.max(0.15, chestCfg.plannedWaveStartDelay ?? 4);
  }
  return Math.max(0.15, chestCfg.plannedSpawnGap ?? 6);
}

function normalizeTraceReplayChoiceMap(traceReplay) {
  const map = new Map();
  const supplyChoices = traceReplay?.supplyChoices || [];
  for (const choice of supplyChoices) {
    const serial = Number(choice?.serial);
    if (!Number.isFinite(serial)) continue;
    map.set(serial, choice);
  }
  return map;
}

function resolveTraceReplayCards(config, replayChoice) {
  if (!replayChoice || !Array.isArray(replayChoice.options)) return [];
  const supplyOptions = [
    ...(config.gameplay?.supply?.options || []),
    ...(config.gameplay?.weaponEvolution?.options || []),
  ];
  return replayChoice.options
    .map((item) => supplyOptions.find((option) => option.id === item.id) || null)
    .filter(Boolean);
}

function buildPlayerState(config, options = {}) {
  const progress = options.progress || {};
  const weaponTier = Math.max(1, options.startTier || progress.baseWeaponTier || 1);
  const tierIndex = weaponTier - 1;
  return {
    weaponTier,
    tierIndex,
    baseDamage: config.weaponBase.damage[Math.min(tierIndex, config.weaponBase.damage.length - 1)],
    fireRate: config.weaponBase.fireRate[Math.min(tierIndex, config.weaponBase.fireRate.length - 1)],
    bulletSpeed: config.weaponBase.speed[Math.min(tierIndex, config.weaponBase.speed.length - 1)],
    firePattern: {
      count: config.weaponBase.baseSpreadCount[Math.min(tierIndex, config.weaponBase.baseSpreadCount.length - 1)],
      spread: config.weaponBase.spreadAngle[Math.min(tierIndex, config.weaponBase.spreadAngle.length - 1)],
      multiShot: config.weaponBase.baseBurstCount[Math.min(tierIndex, config.weaponBase.baseBurstCount.length - 1)],
      speedMults: config.weaponBase.burstSpeedScales[Math.min(tierIndex, config.weaponBase.burstSpeedScales.length - 1)],
    },
    damageMultiplier: 1 + (progress.carDamageMultiplier ? (progress.carDamageMultiplier - 1) : 0),
    fireRateMultiplier: 1,
    projectileSpeedMultiplier: 1,
    bonusMultiShot: 0,
    bonusSpreadCount: 0,
    shieldSeconds: 0,
    freezeSeconds: 0,
    shockwaveDamage: 0,
    shockwaveDistance: 0,
    airstrikeDamage: 0,
    airstrikeRadius: 0,
    evolutionId: options.forcedEvolution || null,
    evolutionDefs: config.gameplay.weaponEvolution.defs,
  };
}

function createDamageModel(config, player) {
  const evo = player.evolutionId ? player.evolutionDefs[player.evolutionId] : null;
  const branchDamageMultiplier = evo?.damageMultiplier || 1;
  const tierIndex = Math.max(0, Math.min(config.weaponBase.speed.length - 1, player.tierIndex || 0));
  return {
    bulletDamage: Math.max(1, Math.round(player.baseDamage * player.damageMultiplier * branchDamageMultiplier)),
    shotsPerSecond: player.fireRate * player.fireRateMultiplier,
    bulletSpeed: Math.max(1, config.weaponBase.speed[tierIndex] * player.projectileSpeedMultiplier),
    spreadShotCount: Math.max(1, player.firePattern.count + player.bonusSpreadCount),
    parallelBurstCount: Math.max(1, player.firePattern.multiShot + player.bonusMultiShot),
    firePattern: player.firePattern,
    evolution: evo,
  };
}

function applyEnemyMitigation(enemy, rawDamage) {
  let actual = rawDamage;
  if ((enemy.openingArmorRemaining || 0) > 0) {
    actual *= 1 - enemy.openingArmorReduce;
  }
  if (enemy.damageReduce > 0) {
    actual *= 1 - enemy.damageReduce;
  }
  return Math.max(1, Math.round(actual));
}

function sortThreat(a, b) {
  if (a.y !== b.y) return a.y - b.y;
  if (a.hp !== b.hp) return a.hp - b.hp;
  if (a.laneIndex !== b.laneIndex) return a.laneIndex - b.laneIndex;
  return a.id.localeCompare(b.id);
}

function findClosestEnemy(origin, enemies, excluded, range = Infinity) {
  let closest = null;
  let best = range * range;
  for (const enemy of enemies) {
    if (enemy.dead || excluded.has(enemy) || !enemy.spawned) continue;
    const dx = enemy.x - origin.x;
    const dy = enemy.y - origin.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > best) continue;
    best = distSq;
    closest = enemy;
  }
  return closest;
}

function findNearestTargetToPlayer(enemies, playerX, playerY) {
  let closest = null;
  let bestDist = Infinity;
  for (const enemy of enemies) {
    if (enemy.dead || !enemy.spawned) continue;
    const dist = Math.abs(enemy.x - playerX) + Math.abs(enemy.y - playerY);
    if (dist < bestDist) {
      bestDist = dist;
      closest = enemy;
    }
  }
  return closest;
}

function findNearestAttackTarget(targets, playerX, playerY) {
  let closest = null;
  let bestDist = Infinity;
  for (const target of targets) {
    if (!target || target.dead) continue;
    const dist = Math.abs(target.x - playerX) + Math.abs(target.y - playerY);
    if (dist < bestDist) {
      bestDist = dist;
      closest = target;
    }
  }
  return closest;
}

function computeEnemyDanger(aliveEnemies, railY, enemyPressure) {
  if (aliveEnemies.length === 0) {
    return {
      frontlineDistance: Infinity,
      railThreatCount: 0,
      denseThreatCount: 0,
      dangerScore: 0,
    };
  }
  let frontlineDistance = Infinity;
  let railThreatCount = 0;
  let denseThreatCount = 0;
  for (const enemy of aliveEnemies) {
    const distance = enemy.y - railY;
    if (distance < frontlineDistance) frontlineDistance = distance;
    if (distance <= 120) railThreatCount++;
    if (distance <= 220) denseThreatCount++;
  }
  const dangerScore = enemyPressure
    + railThreatCount * 0.35
    + denseThreatCount * 0.06
    + (frontlineDistance <= 120 ? 0.65 : frontlineDistance <= 180 ? 0.4 : frontlineDistance <= 260 ? 0.18 : 0);
  return {
    frontlineDistance,
    railThreatCount,
    denseThreatCount,
    dangerScore,
  };
}

function getCoverageShotCount(damageModel) {
  return Math.max(1, damageModel.spreadShotCount);
}

function getBurstPhaseCount(damageModel) {
  return damageModel.parallelBurstCount >= 4 ? 2 : 1;
}

function resolveSpreadAngle(config, finalCount, fallbackSpread) {
  if (finalCount <= 1) return 0;
  const profileCounts = config.weaponBase.baseSpreadCount || [];
  const profileAngles = config.weaponBase.spreadAngle || [];

  const exactIdx = profileCounts.findIndex((count) => count === finalCount);
  if (exactIdx >= 0) {
    return Math.max(0, profileAngles[exactIdx] || fallbackSpread || 0);
  }

  const nextIdx = profileCounts.findIndex((count) => count > finalCount);
  if (nextIdx >= 0) {
    return Math.max(0, profileAngles[nextIdx] || fallbackSpread || 0);
  }

  const maxConfiguredCount = profileCounts[profileCounts.length - 1] || 1;
  const maxConfiguredAngle = profileAngles[profileAngles.length - 1] || fallbackSpread || 0;
  const overflowCount = Math.max(0, finalCount - maxConfiguredCount);
  return maxConfiguredAngle + overflowCount * 1.2;
}

function buildParallelOffsets(parallelCount, gap = 14) {
  if (parallelCount <= 1) return [0];
  const center = (parallelCount - 1) / 2;
  const offsets = [];
  for (let i = 0; i < parallelCount; i++) {
    offsets.push((i - center) * gap);
  }
  return offsets;
}

function buildPacketShots(config, damageModel) {
  const phaseCount = getBurstPhaseCount(damageModel);
  const totalBursts = Math.max(1, damageModel.parallelBurstCount);
  const finalCount = Math.max(1, damageModel.spreadShotCount);
  const fallbackSpread = damageModel.firePattern?.spread || 0;
  const spread = resolveSpreadAngle(config, finalCount, fallbackSpread);
  const totalSpread = (finalCount - 1) * spread;
  const startAngle = 90 - totalSpread / 2;
  const offsets = buildParallelOffsets(totalBursts);
  const speedMults = damageModel.firePattern?.speedMults || [1];
  const packets = Array.from({ length: phaseCount }, (_, phaseIndex) => ({
    phaseIndex,
    shots: [],
  }));

  for (let burstIndex = 0; burstIndex < totalBursts; burstIndex++) {
    const phaseIndex = phaseCount === 1 ? 0 : burstIndex % phaseCount;
    const phaseLayer = phaseCount === 1 ? 0 : Math.floor(burstIndex / phaseCount);
    const speedBase = speedMults[Math.min(burstIndex, speedMults.length - 1)] ?? 1;
    const speedMult = Math.max(0.86, speedBase - phaseLayer * 0.015);
    const offsetX = offsets[burstIndex] || 0;
    for (let spreadIndex = 0; spreadIndex < finalCount; spreadIndex++) {
      packets[phaseIndex].shots.push({
        phaseIndex,
        burstIndex,
        spreadIndex,
        angle: startAngle + spreadIndex * spread,
        offsetX,
        speedMult,
      });
    }
  }

  return packets.filter((packet) => packet.shots.length > 0);
}

function pickShotTarget({ shot, playerX, playerY, activeChests, aliveEnemies, chestRadius, enemyRadius }) {
  const startX = playerX + (shot.offsetX || 0);
  const startY = playerY;
  const rad = (shot.angle * Math.PI) / 180;
  const dirX = Math.cos(rad);
  const dirY = Math.sin(rad);
  if (dirY <= 0) return null;

  const projectHitDistance = (target, radius) => {
    if (!target || target.dead) return null;
    const dx = target.x - startX;
    const dy = target.y - startY;
    const forward = dx * dirX + dy * dirY;
    if (forward <= 0) return null;
    const closestX = startX + dirX * forward;
    const closestY = startY + dirY * forward;
    const offX = target.x - closestX;
    const offY = target.y - closestY;
    const distSq = offX * offX + offY * offY;
    if (distSq > radius * radius) return null;
    return {
      target,
      distance: forward,
      depth: target.y,
      isChest: target.serial != null,
    };
  };

  let bestChest = null;
  for (const chest of activeChests) {
    const hit = projectHitDistance(chest, chestRadius);
    if (!hit) continue;
    if (
      !bestChest
      || hit.distance < bestChest.distance - 0.001
      || (Math.abs(hit.distance - bestChest.distance) <= 0.001 && hit.depth < bestChest.depth)
    ) {
      bestChest = hit;
    }
  }
  if (bestChest) return bestChest;

  let bestEnemy = null;
  for (const enemy of aliveEnemies) {
    const hit = projectHitDistance(enemy, enemyRadius);
    if (!hit) continue;
    if (
      !bestEnemy
      || hit.depth < bestEnemy.depth - 0.001
      || (Math.abs(hit.depth - bestEnemy.depth) <= 0.001 && hit.distance < bestEnemy.distance)
    ) {
      bestEnemy = hit;
    }
  }
  return bestEnemy;
}

function estimateShotTravelTime(distance, bulletSpeed, speedMult) {
  const effectiveSpeed = Math.max(300, bulletSpeed * Math.max(0.55, speedMult || 1) * 1.85);
  const travel = Math.max(0, distance) / effectiveSpeed;
  return Math.max(0.01, travel);
}

function getBurstPackets(config, damageModel) {
  return buildPacketShots(config, damageModel);
}

function buildBaselineEnemy(config, index, type, waveData, laneIndex, xJitter = 0) {
  const typeData = getEnemyTypeData(config, type);
  const laneCount = Math.max(1, config.bridge.laneCount || 5);
  const laneWidth = (config.bridge.right - config.bridge.left) / laneCount;
  const x = config.bridge.left + (laneIndex + 0.5) * laneWidth + xJitter;
  const maxHp = Math.max(1, Math.round(waveData.hp * typeData.hpMult));
  return {
    id: `baseline:${index}`,
    type,
    laneIndex,
    x,
    y: config.bridge.battleTop + 30,
    hp: maxHp,
    maxHp,
    speed: Math.max(1, waveData.speed * typeData.speedMult),
    atk: Math.max(1, Math.round(waveData.atk * typeData.atkMult)),
    rewardCoins: typeData.rewardCoins || 0,
    rewardParts: typeData.rewardParts || 0,
    damageReduce: typeData.damageReduce || 0,
    openingArmorSeconds: typeData.openingArmorSeconds || 0,
    openingArmorRemaining: typeData.openingArmorSeconds || 0,
    openingArmorReduce: typeData.openingArmorReduce || 0,
    attackRateMult: typeData.attackRateMult || 1,
    explodeDelay: typeData.explodeDelay || 0,
    freezeRemaining: 0,
    shieldRemaining: 0,
    attackTimer: 0,
    spawned: true,
    dead: false,
    reachedRail: false,
  };
}

function simulateBaselineCalibration(configOverrides = {}, options = {}) {
  const config = createConfigSnapshot(configOverrides);
  const baseline = config.gameplay?.baselineCalibration || {};
  const rand = mulberry32(options.seed || 1);
  const waveTemplateIndex = Math.max(0, baseline.waveTemplateIndex || 0);
  const waveData = config.waves[Math.min(config.waves.length - 1, waveTemplateIndex)] || config.waves[0];
  const dt = 1 / 60;
  const player = buildPlayerState(config, {
    startTier: options.startTier || 1,
    progress: {
      baseWeaponTier: options.startTier || 1,
      damageMultiplier: options.damageMultiplier || 1,
      fireRateMultiplier: options.fireRateMultiplier || 1,
      projectileSpeedMultiplier: options.projectileSpeedMultiplier || 1,
      bonusMultiShot: options.bonusMultiShot || 0,
      bonusSpreadCount: options.bonusSpreadCount || 0,
      evolutionId: options.forcedEvolution || null,
      supplyQualityTier: 0,
      carHpFlat: 0,
    },
    forcedEvolution: options.forcedEvolution || null,
  });
  const bonusSpreadCount = options.bonusSpreadCount != null
    ? options.bonusSpreadCount
    : (baseline.bonusSpreadCount || 0);
  const bonusMultiShot = options.bonusMultiShot != null
    ? options.bonusMultiShot
    : (baseline.bonusMultiShot || 0);
  player.damageMultiplier = Math.max(0.1, options.damageMultiplier || 1);
  player.fireRateMultiplier = Math.max(0.1, options.fireRateMultiplier || 1);
  player.projectileSpeedMultiplier = Math.max(0.1, options.projectileSpeedMultiplier || 1);
  player.bonusMultiShot = Math.max(0, Math.round(bonusMultiShot || 0));
  player.bonusSpreadCount = Math.max(0, Math.round(bonusSpreadCount || 0));
  player.evolutionId = options.forcedEvolution || player.evolutionId;
  const damageModel = createDamageModel(config, player);
  let playerHp = config.car.hp;
  const laneCount = Math.max(1, config.bridge.laneCount || 5);
  const minLaneIndex = Math.max(0, Math.min(laneCount - 1, baseline.autoSweep?.minLaneIndex ?? 1));
  const maxLaneIndex = Math.max(minLaneIndex, Math.min(laneCount - 1, baseline.autoSweep?.maxLaneIndex ?? (laneCount - 1)));
  const maxActiveEnemies = Math.max(1, baseline.maxActiveEnemies || 200);
  const maxDuration = baseline.maxDuration > 0 ? baseline.maxDuration : Number.POSITIVE_INFINITY;
  const railY = config.bridge.railY + config.enemy.railContactOffset;
  const playerY = config.bridge.carY;
  const movePadding = Math.max(0, config.car.movePadding || 0);
  const laneWidth = (config.bridge.right - config.bridge.left) / laneCount;
  const sweepMinX = config.bridge.left + laneWidth * minLaneIndex + movePadding;
  const sweepMaxX = config.bridge.left + laneWidth * (maxLaneIndex + 1) - movePadding;
  let playerX = options.startX != null ? options.startX : (baseline.autoSweep?.initialDirection || 1) >= 0 ? sweepMinX : sweepMaxX;
  let sweepDirection = (baseline.autoSweep?.initialDirection || 1) >= 0 ? 1 : -1;
  let spawnTimer = 0;
  let fireTimer = 0;
  let burstTimer = 0;
  let pendingBurstPackets = [];
  let virtualBullets = [];
  let enemies = [];
  let spawnSerial = 0;
  let totalKills = 0;
  let totalEnemySpawned = 0;
  let totalPlayerDamage = 0;
  let battleTime = 0;
  let firstDamageTime = null;
  let firstRailContactTime = null;

  function spawnEnemy() {
    const aliveCount = enemies.filter((enemy) => !enemy.dead).length;
    if (aliveCount >= maxActiveEnemies) return;
    const span = maxLaneIndex - minLaneIndex + 1;
    const laneIndex = minLaneIndex + (aliveCount % span);
    const xJitter = (rand() - 0.5) * 60;
    enemies.push(buildBaselineEnemy(config, spawnSerial, baseline.enemyType || 'normal', waveData, laneIndex, xJitter));
    spawnSerial += 1;
    totalEnemySpawned += 1;
  }

  function damageEnemy(enemy, rawDamage) {
    if (enemy.dead) return;
    const actual = applyEnemyMitigation(enemy, rawDamage);
    enemy.hp = Math.max(0, enemy.hp - actual);
    if (enemy.hp <= 0) {
      enemy.dead = true;
      totalKills += 1;
    }
  }

  function pickBestBulletEnemy(bullet, snapshot, threshold, reachedRailOnly = false) {
    const thresholdSq = threshold * threshold;
    let bestEnemy = null;
    let bestDistSq = Infinity;
    let bestY = Infinity;
    for (const enemy of snapshot) {
      if (enemy.dead) continue;
      if (reachedRailOnly && !enemy.reachedRail) continue;
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= thresholdSq) continue;
      const isMoreFront = enemy.y < bestY - 0.001;
      const isSameDepthButCloser = Math.abs(enemy.y - bestY) <= 0.001 && distSq < bestDistSq;
      if (!bestEnemy || isMoreFront || isSameDepthButCloser) {
        bestEnemy = enemy;
        bestDistSq = distSq;
        bestY = enemy.y;
      }
    }
    return bestEnemy;
  }

  function createVirtualBullet(shot) {
    const angle = shot.angle || 90;
    const rad = (angle * Math.PI) / 180;
    const speed = Math.max(1, damageModel.bulletSpeed * Math.max(0.1, shot.speedMult || 1));
    return {
      x: playerX + (shot.offsetX || 0),
      y: playerY + Math.max(0, (config.car.height || 0) * 0.5),
      vx: speed * Math.cos(rad),
      vy: speed * Math.sin(rad),
      damage: damageModel.bulletDamage,
      behavior: damageModel.evolution?.behavior || 'normal',
      explodeRadius: damageModel.evolution?.explodeRadius || 0,
      splashMultiplier: damageModel.evolution?.splashMultiplier || 0,
      chainCount: damageModel.evolution?.chainCount || 0,
      chainRange: damageModel.evolution?.chainRange || 0,
      chainMultiplier: damageModel.evolution?.chainMultiplier || 0,
      remainingPierce: damageModel.evolution?.pierceCount || 0,
      dead: false,
    };
  }

  function consumeVirtualPierce(bullet) {
    if ((bullet.remainingPierce || 0) <= 0) return false;
    bullet.remainingPierce -= 1;
    return bullet.remainingPierce > 0;
  }

  function applyExplosionDamage(centerEnemy, radius, damage) {
    const radiusSq = radius * radius;
    for (const enemy of enemies) {
      if (enemy.dead || enemy === centerEnemy) continue;
      const dx = enemy.x - centerEnemy.x;
      const dy = enemy.y - centerEnemy.y;
      if (dx * dx + dy * dy > radiusSq) continue;
      damageEnemy(enemy, damage);
    }
  }

  function findClosestEnemy(sourceEnemy, pool, excluded, maxRange) {
    const maxRangeSq = maxRange * maxRange;
    let best = null;
    let bestDistSq = Infinity;
    for (const enemy of pool) {
      if (enemy.dead || excluded.has(enemy)) continue;
      const dx = enemy.x - sourceEnemy.x;
      const dy = enemy.y - sourceEnemy.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > maxRangeSq || distSq >= bestDistSq) continue;
      best = enemy;
      bestDistSq = distSq;
    }
    return best;
  }

  function applyChainDamage(sourceEnemy, chainCount, chainRange, damage) {
    const hit = new Set([sourceEnemy]);
    let current = sourceEnemy;
    for (let i = 0; i < chainCount; i++) {
      const next = findClosestEnemy(current, enemies, hit, chainRange);
      if (!next) break;
      hit.add(next);
      damageEnemy(next, damage);
      current = next;
    }
  }

  function handleVirtualBulletHitEnemy(bullet, enemy) {
    damageEnemy(enemy, bullet.damage);
    if (bullet.behavior === 'explode' && bullet.explodeRadius > 0) {
      applyExplosionDamage(
        enemy,
        bullet.explodeRadius,
        Math.max(1, Math.round(bullet.damage * Math.max(0.1, bullet.splashMultiplier || 1)))
      );
    }
    if (bullet.behavior === 'chain' && bullet.chainCount > 0 && bullet.chainRange > 0) {
      applyChainDamage(
        enemy,
        bullet.chainCount,
        bullet.chainRange,
        Math.max(1, Math.round(bullet.damage * Math.max(0.1, bullet.chainMultiplier || 1)))
      );
    }
    const canContinue = bullet.behavior === 'pierce' && consumeVirtualPierce(bullet);
    if (!canContinue) {
      bullet.dead = true;
    }
  }

  function checkVirtualBulletCollisions() {
    if (virtualBullets.length === 0) return;
    const enemyThreshold = Math.max(8, (config.enemy?.width || 64) / 2 + (config.bullet?.radius || 0));
    for (const bullet of virtualBullets) {
      if (bullet.dead) continue;
      const snapshot = enemies.filter((enemy) => !enemy.dead);
      const bestEnemy =
        pickBestBulletEnemy(bullet, snapshot, enemyThreshold, true)
        || pickBestBulletEnemy(bullet, snapshot, enemyThreshold, false);
      if (bestEnemy) {
        handleVirtualBulletHitEnemy(bullet, bestEnemy);
      }
    }
  }

  function moveVirtualBullets(stepDt) {
    if (virtualBullets.length === 0) return;
    const canvasW = config.canvas.width;
    const canvasH = config.canvas.height;
    const margin = 50;
    for (const bullet of virtualBullets) {
      if (bullet.dead) continue;
      bullet.x += bullet.vx * stepDt;
      bullet.y += bullet.vy * stepDt;
      if (
        bullet.y > canvasH / 2 + margin
        || bullet.y < -canvasH / 2 - margin
        || bullet.x > canvasW / 2 + margin
        || bullet.x < -canvasW / 2 - margin
      ) {
        bullet.dead = true;
      }
    }
  }

  function resolveBurstPacket(packet) {
    const shotList = packet?.shots || [];
    if (shotList.length === 0) return;
    for (const shot of shotList) {
      virtualBullets.push(createVirtualBullet(shot));
    }
  }

  function fireOnce() {
    const hasTargets = enemies.some((enemy) => !enemy.dead);
    if (!hasTargets) return;
    const packets = getBurstPackets(config, damageModel);
    if (packets.length === 0) return;
    resolveBurstPacket(packets[0]);
    if (packets.length > 1) {
      pendingBurstPackets.push(...packets.slice(1));
      if (burstTimer <= 0) {
        burstTimer = SIM_BURST_INTERVAL;
      }
    }
  }

  while (battleTime < maxDuration) {
    spawnTimer += dt;
    while (spawnTimer >= Math.max(0.01, baseline.spawnInterval || 0.5)) {
      spawnTimer -= Math.max(0.01, baseline.spawnInterval || 0.5);
      spawnEnemy();
    }

    if (playerX <= sweepMinX + 1) {
      sweepDirection = 1;
    } else if (playerX >= sweepMaxX - 1) {
      sweepDirection = -1;
    }
    playerX += sweepDirection * Math.max(1, config.car.speed || 0) * dt;
    playerX = Math.max(sweepMinX, Math.min(sweepMaxX, playerX));

    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if ((enemy.openingArmorRemaining || 0) > 0) {
        enemy.openingArmorRemaining = Math.max(0, enemy.openingArmorRemaining - dt);
      }
      enemy.y -= enemy.speed * dt;
      if (!enemy.reachedRail && enemy.y <= railY) {
        enemy.reachedRail = true;
        if (firstRailContactTime == null) {
          firstRailContactTime = battleTime;
        }
      }
      if (enemy.reachedRail) {
        enemy.attackTimer += dt;
        if (enemy.type === 'suicide') {
          if (enemy.attackTimer >= enemy.explodeDelay) {
            enemy.dead = true;
            const dmg = Math.max(1, Math.round(enemy.atk));
            playerHp -= dmg;
            totalPlayerDamage += dmg;
            if (firstDamageTime == null) {
              firstDamageTime = battleTime;
            }
          }
        } else {
          const attackRate = Math.max(0.1, config.enemy.attackRate * enemy.attackRateMult);
          const interval = 1 / attackRate;
          if (enemy.attackTimer >= interval) {
            enemy.attackTimer = 0;
            const dmg = Math.max(1, Math.round(enemy.atk));
            playerHp -= dmg;
            totalPlayerDamage += dmg;
            if (firstDamageTime == null) {
              firstDamageTime = battleTime;
            }
          }
        }
      }
    }

    if (playerHp <= 0) {
      playerHp = 0;
      break;
    }

    const hasTargetsToFire = enemies.some((enemy) => !enemy.dead);
    if (!hasTargetsToFire) {
      fireTimer = 0;
    } else {
      fireTimer += dt;
      const fireInterval = 1 / Math.max(0.1, damageModel.shotsPerSecond);
      while (fireTimer >= fireInterval) {
        fireTimer -= fireInterval;
        fireOnce();
      }
    }

    if (pendingBurstPackets.length > 0) {
      burstTimer -= dt;
      while (pendingBurstPackets.length > 0 && burstTimer <= 0) {
        const packet = pendingBurstPackets.shift();
        if (packet) {
          resolveBurstPacket(packet);
        }
        burstTimer += SIM_BURST_INTERVAL;
      }
      if (pendingBurstPackets.length === 0) {
        burstTimer = 0;
      }
    }

    checkVirtualBulletCollisions();
    moveVirtualBullets(dt);
    checkVirtualBulletCollisions();
    virtualBullets = virtualBullets.filter((bullet) => !bullet.dead);
    enemies = enemies.filter((enemy) => !enemy.dead || enemy.reachedRail);
    battleTime += dt;
  }

  return {
    scenario: 'baseline_calibration',
    metrics: {
      result: Number.isFinite(maxDuration) && playerHp > 0 ? 'timeout' : 'gameover',
      survivalTime: battleTime,
      totalKills,
      totalEnemySpawned,
      totalPlayerDamage,
      playerHpEnd: Math.max(0, playerHp),
      firstDamageTime,
      firstRailContactTime,
      activeEnemiesAtEnd: enemies.filter((enemy) => !enemy.dead).length,
      playerXEnd: playerX,
    },
  };
}

function simulateWaveCombat(config, ctx, strategy, rand) {
  const { enemies, waveDef, waveData } = buildWaveEnemies(config, ctx.stageIndex, ctx.waveIndex, rand);
  const chestCfg = config.gameplay.supply.chest;
  const runState = ctx.runState || {};
  const behaviorTuning = {
    ...DEFAULT_BEHAVIOR_TUNING,
    ...(ctx.behaviorTuning || {}),
  };
  const supplyTier = Math.max(0, Math.round((ctx.progress?.supplyQualityTier || 0)));
  const waveState = {
    time: 0,
    enemies,
    chests: [],
    damageEvents: 0,
    totalDamage: 0,
    totalPlayerDamage: 0,
    chestDestroyed: 0,
    supplyPicks: [],
    firstEvolutionWave: null,
    supplyRefreshesUsed: 0,
  };
  const player = buildPlayerState(config, ctx);
  player.damageMultiplier = Math.max(0.1, ctx.progress?.damageMultiplier || 1);
  player.fireRateMultiplier = Math.max(0.1, ctx.progress?.fireRateMultiplier || 1);
  player.projectileSpeedMultiplier = Math.max(0.1, ctx.progress?.projectileSpeedMultiplier || 1);
  player.bonusMultiShot = Math.max(0, ctx.progress?.bonusMultiShot || 0);
  player.bonusSpreadCount = Math.max(0, ctx.progress?.bonusSpreadCount || 0);
  player.evolutionId = ctx.progress?.evolutionId || player.evolutionId;
  let damageModel = createDamageModel(config, player);
  const enemySpawnCount = enemies.length;
  const dt = 1 / 60;
  if (!Array.isArray(runState.chestHistory)) runState.chestHistory = [];
  if (runState.chestSerial == null) runState.chestSerial = 0;
  if (runState.selectionsThisRun == null) runState.selectionsThisRun = 0;
  if (runState.adRefreshesUsed == null) runState.adRefreshesUsed = 0;
  if (runState.battleTime == null) runState.battleTime = 0;
  if (!Array.isArray(runState.activeChests)) runState.activeChests = [];
  if (!Array.isArray(runState.supplyChoiceHistory)) runState.supplyChoiceHistory = [];
  if (!runState.chestTrack) runState.chestTrack = createChestTrack(config);
  runState.activeChests = runState.activeChests.filter((chest) => chest && !chest.destroyed);
  let activeChests = runState.activeChests;
  const plannedWaveChestQueue = expandWaveChestPlan(waveDef);
  let plannedWaveChestSpawnTimer = 0;
  let plannedWaveChestSpawnedCount = 0;
  const traceReplayChoices = ctx.traceReplayChoices || null;
  let cleared = false;
  const playerMaxHp = config.car.hp + (ctx.progress?.carHpFlat || 0);
  let playerHp = Math.max(0, Math.min(playerMaxHp, ctx.startPlayerHp ?? playerMaxHp));
  let playerX = ctx.startPlayerX ?? runState.playerX ?? 0;
  const playerY = config.bridge.carY;
  const railY = config.bridge.railY + config.enemy.railContactOffset;
  const maxTime = 180;
  let fireTimer = 0;
  let freezeTimer = 0;
  let burstTimer = 0;
  let pendingBurstPackets = [];
  let virtualBullets = [];

  function spawnChest(chestQuality) {
    const chestSerial = runState.chestSerial;
    const chestHp = getChestHp(config, waveData.hp, chestQuality, chestSerial, ctx.stageIndex, ctx.waveIndex);
    const chest = {
      quality: chestQuality,
      hp: chestHp,
      maxHp: chestHp,
      serial: chestSerial,
      x: runState.chestTrack.x,
      y: runState.chestTrack.spawnY,
      targetX: runState.chestTrack.x,
      targetY: runState.chestTrack.spawnY,
      speed: Math.max(1, chestCfg.moveSpeed || 0),
      spawnTime: waveState.time,
      spawnBattleTime: runState.battleTime,
      spawnWave: ctx.waveIndex + 1,
      destroyed: false,
      cards: [],
      refreshCount: 0,
      destroyWave: null,
      destroyTime: null,
      destroyBattleTime: null,
    };
    runState.chestSerial++;
    activeChests.push(chest);
    runState.chestHistory.push(chest);
    waveState.chests.push(chest);
    reflowActiveChests(activeChests, runState.chestTrack);
    chest.cards = pickSupplyCards(config, chestQuality, chest.serial, supplyTier, rand);
  }

  function applyCard(card) {
    if (!card || !card.effect) return;
    const effect = card.effect;
    switch (effect.type) {
      case 'damageMultiplier':
        player.damageMultiplier *= effect.value || 1;
        break;
      case 'fireRateMultiplier':
        player.fireRateMultiplier *= effect.value || 1;
        break;
      case 'projectileSpeedMultiplier':
        player.projectileSpeedMultiplier *= effect.value || 1;
        break;
      case 'multiShotAdd':
        player.bonusMultiShot += Math.max(0, Math.round(effect.value || 0));
        break;
      case 'spreadCountAdd':
        player.bonusSpreadCount += Math.max(0, Math.round(effect.value || 0));
        break;
      case 'weaponEvolution':
        player.evolutionId = effect.evolutionId;
        damageModel.evolution = player.evolutionDefs[player.evolutionId];
        break;
      case 'shield':
        player.shieldSeconds = Math.max(player.shieldSeconds || 0, effect.seconds || 0);
        break;
      case 'freezeAll':
        player.freezeSeconds = Math.max(player.freezeSeconds || 0, effect.seconds || 0);
        break;
      case 'shockwave':
        player.shockwaveDamage = Math.max(player.shockwaveDamage || 0, effect.damage || 0);
        player.shockwaveDistance = Math.max(player.shockwaveDistance || 0, effect.value || 0);
        break;
      case 'airstrike':
        player.airstrikeDamage = Math.max(player.airstrikeDamage || 0, effect.damage || 0);
        player.airstrikeRadius = Math.max(player.airstrikeRadius || 0, effect.radius || 0);
        break;
      case 'explodeRadiusMultiplier':
        if (player.evolutionDefs?.mg_explode) {
          player.evolutionDefs.mg_explode = {
            ...player.evolutionDefs.mg_explode,
            explodeRadius: Math.round((player.evolutionDefs.mg_explode.explodeRadius || 0) * (effect.value || 1)),
          };
        }
        break;
      case 'pierceAdd':
        if (player.evolutionDefs?.mg_pierce) {
          player.evolutionDefs.mg_pierce = {
            ...player.evolutionDefs.mg_pierce,
            pierceCount: (player.evolutionDefs.mg_pierce.pierceCount || 0) + Math.max(0, Math.round(effect.value || 0)),
          };
        }
        break;
      case 'chainAdd':
        if (player.evolutionDefs?.mg_arc) {
          player.evolutionDefs.mg_arc = {
            ...player.evolutionDefs.mg_arc,
            chainCount: (player.evolutionDefs.mg_arc.chainCount || 0) + Math.max(0, Math.round(effect.value || 0)),
          };
        }
        break;
      case 'chainRangeMultiplier':
        if (player.evolutionDefs?.mg_arc) {
          player.evolutionDefs.mg_arc = {
            ...player.evolutionDefs.mg_arc,
            chainRange: Math.round((player.evolutionDefs.mg_arc.chainRange || 0) * (effect.value || 1)),
          };
        }
        break;
      default:
        break;
    }
    damageModel = createDamageModel(config, player);
  }

  function damageEnemy(enemy, rawDamage, source = 'normal') {
    if (enemy.dead || !enemy.spawned) return { killed: false, appliedDamage: 0 };
    const actual = applyEnemyMitigation(enemy, rawDamage);
    enemy.hp = Math.max(0, enemy.hp - actual);
    waveState.totalDamage += actual;
    waveState.damageEvents++;
    if (enemy.hp <= 0) {
      enemy.dead = true;
      return { killed: true, appliedDamage: actual };
    }
    return { killed: false, appliedDamage: actual };
  }

  function applyExplosionDamage(centerEnemy, radius, damage) {
    const radiusSq = radius * radius;
    for (const enemy of enemies) {
      if (enemy.dead || enemy === centerEnemy || !enemy.spawned) continue;
      const dx = enemy.x - centerEnemy.x;
      const dy = enemy.y - centerEnemy.y;
      if (dx * dx + dy * dy > radiusSq) continue;
      damageEnemy(enemy, damage, 'explode');
    }
  }

  function applyChainDamage(sourceEnemy, chainCount, chainRange, damage) {
    const hit = new Set([sourceEnemy]);
    let current = sourceEnemy;
    for (let i = 0; i < chainCount; i++) {
      const next = findClosestEnemy(current, enemies, hit, chainRange);
      if (!next) break;
      hit.add(next);
      damageEnemy(next, damage, 'chain');
      current = next;
    }
  }

  function damageChest(targetChest, rawDamage) {
    if (!targetChest || targetChest.destroyed) return false;
    targetChest.hp = Math.max(0, targetChest.hp - Math.max(1, Math.round(rawDamage)));
    if (targetChest.hp > 0) return false;

    const resolvedChest = targetChest;
    resolvedChest.destroyed = true;
    resolvedChest.destroyWave = ctx.waveIndex + 1;
    resolvedChest.destroyTime = waveState.time;
    resolvedChest.destroyBattleTime = runState.battleTime;
    waveState.chestDestroyed++;
    runState.selectionsThisRun++;
    activeChests = activeChests.filter((chest) => chest !== resolvedChest && !chest.destroyed);
    runState.activeChests = activeChests;
    reflowActiveChests(activeChests, runState.chestTrack);
    const targetPower = Math.max(1, damageModel.bulletDamage * damageModel.shotsPerSecond * (1 + damageModel.spreadShotCount * 0.12));
    const aliveEnemies = getSpawnedEnemies(enemies);
    const waveEnemyPower = aliveEnemies.reduce((sum, enemy) => sum + enemy.atk, 0);
    const enemyPressure = Math.min(1.5, waveEnemyPower / (targetPower * 2.5));
    const currentPressure = aliveEnemies.length > 0
      ? aliveEnemies.reduce((sum, enemy) => sum + Math.max(0.2, enemy.hp / Math.max(1, enemy.maxHp)), 0) / aliveEnemies.length
      : 0;
    const maxAdRefreshes = Math.max(0, (config.gameplay?.supply?.maxAdExtrasPerRun || 0) + (ctx.progress?.bonusAdSupplyCount || 0));
    const replayChoice = traceReplayChoices?.get(resolvedChest.serial) || null;
    let currentQuality = resolvedChest.quality;
    let currentSerial = resolvedChest.serial;
    let currentCards = resolvedChest.cards;
    if (replayChoice) {
      const desiredRefreshCount = Math.max(0, Math.min(maxAdRefreshes - runState.adRefreshesUsed, replayChoice.refreshCount || 0));
      if (desiredRefreshCount > 0) {
        runState.adRefreshesUsed += desiredRefreshCount;
        waveState.supplyRefreshesUsed += desiredRefreshCount;
        resolvedChest.refreshCount += desiredRefreshCount;
      }
      currentCards = resolveTraceReplayCards(config, replayChoice);
    } else {
      while (
        typeof strategy.shouldRefreshSupply === 'function'
        && runState.adRefreshesUsed < maxAdRefreshes
        && strategy.shouldRefreshSupply({
          chestQuality: currentQuality,
          chestSerial: resolvedChest.serial,
          currentCards,
          remainingRefreshes: maxAdRefreshes - runState.adRefreshesUsed,
          refreshCount: resolvedChest.refreshCount,
          waveIndex: ctx.waveIndex + 1,
          playerHpPct: playerHp / Math.max(1, playerMaxHp),
          enemyPressure,
          currentPressure,
        })
      ) {
        runState.adRefreshesUsed++;
        waveState.supplyRefreshesUsed++;
        resolvedChest.refreshCount++;
        currentQuality = getUpgradedChestQuality(currentQuality);
        currentSerial += 2;
        currentCards = pickSupplyCards(config, currentQuality, currentSerial + runState.adRefreshesUsed, supplyTier, rand);
      }
    }

    resolvedChest.cards = currentCards;
    resolvedChest.finalOfferQuality = currentQuality;
    const cards = currentCards;
    waveState.supplyPicks.push(...cards);
    if (!waveState.firstEvolutionWave && cards.some((card) => card.effect?.type === 'weaponEvolution')) {
      waveState.firstEvolutionWave = ctx.waveIndex + 1;
    }
    const picked = replayChoice?.pickedOptionId
      ? cards.find((card) => card.id === replayChoice.pickedOptionId) || null
      : (
        strategy.pickCard(cards, {
          chestQuality: currentQuality,
          enemyPressure,
          playerHpPct: playerHp / Math.max(1, playerMaxHp),
          waveIndex: ctx.waveIndex + 1,
          currentPressure,
        }) || cards[0] || null
      );
    runState.supplyChoiceHistory.push({
      serial: resolvedChest.serial,
      wave: ctx.waveIndex + 1,
      sourceQuality: resolvedChest.quality,
      refreshCount: resolvedChest.refreshCount,
      pickedOptionId: picked?.id || null,
      replayed: !!replayChoice,
    });
    applyCard(picked);
    freezeTimer = Math.max(freezeTimer, 0.32);
    return true;
  }

  function createVirtualBullet(shot) {
    const angle = shot.angle || 90;
    const rad = (angle * Math.PI) / 180;
    const speed = Math.max(1, damageModel.bulletSpeed * Math.max(0.1, shot.speedMult || 1));
    return {
      x: playerX + (shot.offsetX || 0),
      y: playerY + Math.max(0, (config.car.height || 0) * 0.5),
      vx: speed * Math.cos(rad),
      vy: speed * Math.sin(rad),
      damage: damageModel.bulletDamage,
      behavior: damageModel.evolution?.behavior || 'normal',
      explodeRadius: damageModel.evolution?.explodeRadius || 0,
      splashMultiplier: damageModel.evolution?.splashMultiplier || 0,
      chainCount: damageModel.evolution?.chainCount || 0,
      chainRange: damageModel.evolution?.chainRange || 0,
      chainMultiplier: damageModel.evolution?.chainMultiplier || 0,
      remainingPierce: damageModel.evolution?.pierceCount || 0,
      dead: false,
    };
  }

  function consumeVirtualPierce(bullet) {
    if ((bullet.remainingPierce || 0) <= 0) return false;
    bullet.remainingPierce -= 1;
    return bullet.remainingPierce > 0;
  }

  function pickBestBulletEnemy(bullet, snapshot, threshold, reachedRailOnly = false) {
    const thresholdSq = threshold * threshold;
    let bestEnemy = null;
    let bestDistSq = Infinity;
    let bestY = Infinity;
    for (const enemy of snapshot) {
      if (enemy.dead || !enemy.spawned) continue;
      if (reachedRailOnly && !enemy.reachedRail) continue;
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= thresholdSq) continue;
      const isMoreFront = enemy.y < bestY - 0.001;
      const isSameDepthButCloser = Math.abs(enemy.y - bestY) <= 0.001 && distSq < bestDistSq;
      if (!bestEnemy || isMoreFront || isSameDepthButCloser) {
        bestEnemy = enemy;
        bestDistSq = distSq;
        bestY = enemy.y;
      }
    }
    return bestEnemy;
  }

  function handleVirtualBulletHitChest(bullet, chest) {
    const chestHitFactor = chest.y > chest.targetY + 1
      ? behaviorTuning.chestMovingDamageFactor
      : behaviorTuning.chestStoppedDamageFactor;
    damageChest(chest, Math.max(1, Math.round(bullet.damage * chestHitFactor)));
    const canContinue = bullet.behavior === 'pierce' && consumeVirtualPierce(bullet);
    if (!canContinue) {
      bullet.dead = true;
    }
  }

  function handleVirtualBulletHitEnemy(bullet, enemy) {
    damageEnemy(enemy, bullet.damage, bullet.behavior === 'pierce' ? 'pierce' : 'normal');

    if (bullet.behavior === 'explode' && bullet.explodeRadius > 0) {
      applyExplosionDamage(
        enemy,
        bullet.explodeRadius,
        Math.max(1, Math.round(bullet.damage * Math.max(0.1, bullet.splashMultiplier || 1)))
      );
    }
    if (bullet.behavior === 'chain' && bullet.chainCount > 0 && bullet.chainRange > 0) {
      applyChainDamage(
        enemy,
        bullet.chainCount,
        bullet.chainRange,
        Math.max(1, Math.round(bullet.damage * Math.max(0.1, bullet.chainMultiplier || 1)))
      );
    }

    const canContinue = bullet.behavior === 'pierce' && consumeVirtualPierce(bullet);
    if (!canContinue) {
      bullet.dead = true;
    }
  }

  function checkVirtualBulletCollisions() {
    if (virtualBullets.length === 0) return;
    const chestThresholdBase = Math.max(8, chestCfg.radius || 58) + (config.bullet?.radius || 0);
    const enemyThreshold = Math.max(8, (config.enemy?.width || 64) / 2 + (config.bullet?.radius || 0));
    for (const bullet of virtualBullets) {
      if (bullet.dead) continue;
      const currentChests = activeChests.filter((chest) => !chest.destroyed);
      for (const chest of currentChests) {
        const threshold = (chest.radius || chestCfg.radius || 42) + (config.bullet?.radius || 0);
        const dx = bullet.x - chest.x;
        const dy = bullet.y - chest.y;
        if (dx * dx + dy * dy < threshold * threshold) {
          handleVirtualBulletHitChest(bullet, chest);
          break;
        }
      }
      if (bullet.dead) continue;

      const snapshot = enemies.filter((enemy) => enemy.spawned && !enemy.dead);
      const bestEnemy =
        pickBestBulletEnemy(bullet, snapshot, enemyThreshold, true)
        || pickBestBulletEnemy(bullet, snapshot, enemyThreshold, false);
      if (bestEnemy) {
        handleVirtualBulletHitEnemy(bullet, bestEnemy);
      }
    }
  }

  function moveVirtualBullets(stepDt) {
    if (virtualBullets.length === 0) return;
    const canvasW = config.canvas.width;
    const canvasH = config.canvas.height;
    const margin = 50;
    for (const bullet of virtualBullets) {
      if (bullet.dead) continue;
      bullet.x += bullet.vx * stepDt;
      bullet.y += bullet.vy * stepDt;
      if (
        bullet.y > canvasH / 2 + margin
        || bullet.y < -canvasH / 2 - margin
        || bullet.x > canvasW / 2 + margin
        || bullet.x < -canvasW / 2 - margin
      ) {
        bullet.dead = true;
      }
    }
  }

  function resolveBurstPacket(packet) {
    const alive = enemies.filter((enemy) => enemy.spawned && !enemy.dead).sort(sortThreat);
    const availableChests = activeChests.filter((chest) => !chest.destroyed);
    const currentPressure = alive.length > 0
      ? alive.reduce((sum, enemy) => sum + Math.max(0.2, enemy.hp / Math.max(1, enemy.maxHp)), 0) / alive.length
      : 0;
    const targetPower = Math.max(1, damageModel.bulletDamage * damageModel.shotsPerSecond * (1 + damageModel.spreadShotCount * 0.12));
    const waveEnemyPower = alive.reduce((sum, enemy) => sum + enemy.atk, 0);
    const enemyPressure = Math.min(1.5, waveEnemyPower / (targetPower * 2.5));
    const focusChest = availableChests
      .sort((a, b) => Math.abs(a.y - playerY) - Math.abs(b.y - playerY) || a.serial - b.serial)[0] || null;
    const nearestTarget = findNearestAttackTarget([...alive, ...availableChests], playerX, playerY);
    const preferChest = focusChest
      && typeof strategy.pickChest === 'function'
      && strategy.pickChest({
        chestQuality: focusChest.quality,
        activeChestCount: availableChests.length,
        enemyPressure,
        playerHpPct: playerHp / Math.max(1, playerMaxHp),
        waveIndex: ctx.waveIndex + 1,
        currentPressure,
      });
    const desiredX = (preferChest ? focusChest?.x : nearestTarget?.x) ?? playerX;
    const moveStep = Math.max(1, (config.car.speed || 0) * dt);
    if (Math.abs(desiredX - playerX) <= moveStep) {
      playerX = desiredX;
    } else {
      playerX += Math.sign(desiredX - playerX) * moveStep;
    }
    playerX = Math.max(config.bridge.left, Math.min(config.bridge.right, playerX));

    const shotList = packet?.shots || [];
    if (shotList.length === 0) return;

    for (const shot of shotList) {
      virtualBullets.push(createVirtualBullet(shot));
    }
  }

  function fireOnce() {
    const hasTargets =
      enemies.some((enemy) => enemy.spawned && !enemy.dead)
      || activeChests.some((chest) => !chest.destroyed);
    if (!hasTargets) return;
    const packets = getBurstPackets(config, damageModel);
    if (packets.length === 0) return;
    resolveBurstPacket(packets[0]);
    if (packets.length > 1) {
      pendingBurstPackets.push(...packets.slice(1));
      if (burstTimer <= 0) {
        burstTimer = SIM_BURST_INTERVAL;
      }
    }
  }

  while (waveState.time < maxTime) {
    if (freezeTimer > 0) {
      freezeTimer = Math.max(0, freezeTimer - dt);
      waveState.time += dt;
      runState.battleTime += dt;
      continue;
    }

    for (const enemy of enemies) {
      if (!enemy.spawned && enemy.spawnAt <= waveState.time) {
        enemy.spawned = true;
      }
    }

    const aliveEnemies = getSpawnedEnemies(enemies);
    const hasPendingSpawn = enemies.some((enemy) => !enemy.spawned);
    if (aliveEnemies.length === 0 && !hasPendingSpawn && activeChests.length === 0 && virtualBullets.length === 0) {
      cleared = true;
      break;
    }

    const currentPressure = aliveEnemies.reduce((sum, enemy) => sum + Math.max(0.2, enemy.hp / Math.max(1, enemy.maxHp)), 0) / Math.max(1, aliveEnemies.length);
    const canSpawnPlannedChest =
      ctx.waveIndex + 1 >= Math.max(1, chestCfg.minWave || 1) &&
      runState.selectionsThisRun < chestCfg.maxSelectionsPerRun &&
      plannedWaveChestQueue.length > 0 &&
      aliveEnemies.length > 0 &&
      activeChests.length < Math.max(1, chestCfg.capacity || 1);
    if (canSpawnPlannedChest) {
      plannedWaveChestSpawnTimer += dt;
    }
    const shouldSpawnChest =
      canSpawnPlannedChest &&
      plannedWaveChestSpawnTimer >= getPlannedWaveChestDelay(config, plannedWaveChestSpawnedCount);
    if (shouldSpawnChest) {
      const nextQuality = plannedWaveChestQueue.shift();
      if (nextQuality) {
        spawnChest(nextQuality);
        plannedWaveChestSpawnedCount++;
        plannedWaveChestSpawnTimer = 0;
      }
    }

    for (const chest of activeChests) {
      if (chest.destroyed) continue;
      if (chest.x !== chest.targetX) {
        chest.x = chest.targetX;
      }
      if (chest.y > chest.targetY) {
        chest.y = Math.max(chest.targetY, chest.y - chest.speed * dt);
      }
    }

    for (const enemy of aliveEnemies) {
      if ((enemy.openingArmorRemaining || 0) > 0) {
        enemy.openingArmorRemaining = Math.max(0, enemy.openingArmorRemaining - dt);
      }
      enemy.y -= enemy.speed * dt;
      if (enemy.y <= railY) {
        enemy.reachedRail = true;
      }
      if (enemy.reachedRail) {
        enemy.attackTimer += dt;
        if (enemy.type === 'suicide') {
          if (enemy.attackTimer >= enemy.explodeDelay) {
            enemy.dead = true;
            const dmg = Math.max(1, Math.round(enemy.atk));
            playerHp -= dmg;
            waveState.totalPlayerDamage += dmg;
          }
        } else {
          const attackRate = Math.max(0.1, config.enemy.attackRate * enemy.attackRateMult);
          const interval = 1 / attackRate;
          if (enemy.attackTimer >= interval) {
            enemy.attackTimer = 0;
            const dmg = Math.max(1, Math.round(enemy.atk));
            playerHp -= dmg;
            waveState.totalPlayerDamage += dmg;
          }
        }
      }
    }

    if (playerHp <= 0) {
      playerHp = Math.min(playerHp, 0);
      break;
    }

    const hasTargetsToFire =
      enemies.some((enemy) => enemy.spawned && !enemy.dead)
      || activeChests.some((chest) => !chest.destroyed);
    if (!hasTargetsToFire) {
      fireTimer = 0;
    } else {
      fireTimer += dt;
      const fireInterval = 1 / Math.max(0.1, damageModel.shotsPerSecond);
      while (fireTimer >= fireInterval) {
        fireTimer -= fireInterval;
        fireOnce();
      }
    }

    if (pendingBurstPackets.length > 0) {
      burstTimer -= dt;
      while (pendingBurstPackets.length > 0 && burstTimer <= 0) {
        const packet = pendingBurstPackets.shift();
        if (packet) {
          resolveBurstPacket(packet);
        }
        burstTimer += SIM_BURST_INTERVAL;
      }
      if (pendingBurstPackets.length === 0) {
        burstTimer = 0;
      }
    }

    checkVirtualBulletCollisions();
    moveVirtualBullets(dt);
    checkVirtualBulletCollisions();
    virtualBullets = virtualBullets.filter((bullet) => !bullet.dead);

    waveState.time += dt;
    runState.battleTime += dt;
  }

  const remainingEnemies = enemies.filter((enemy) => !enemy.dead).length;
  const killCount = enemySpawnCount - remainingEnemies;
  const avgChestTtk = waveState.chests.length > 0
    ? waveState.chests.reduce((sum, chest) => sum + (chest.destroyed ? Math.max(0.1, waveState.time - chest.spawnTime) : 0), 0) / Math.max(1, waveState.chests.filter((chest) => chest.destroyed).length || 1)
    : 0;

  return {
    cleared,
    waveTime: waveState.time,
    enemySpawnCount,
    remainingEnemies,
    killCount,
    playerHp,
    playerHpPct: playerHp / Math.max(1, playerMaxHp),
    chestSpawned: waveState.chests.length,
    chestDestroyed: waveState.chestDestroyed,
    chestDestroyRate: waveState.chests.length > 0 ? waveState.chestDestroyed / waveState.chests.length : 0,
    avgChestTtk,
    damageEvents: waveState.damageEvents,
    totalDamage: waveState.totalDamage,
    totalPlayerDamage: waveState.totalPlayerDamage,
    firstEvolutionWave: waveState.firstEvolutionWave,
    supplyRefreshesUsed: waveState.supplyRefreshesUsed,
    chestDetails: waveState.chests.map((chest) => ({
      serial: chest.serial,
      quality: chest.quality,
      spawnWave: chest.spawnWave,
      spawnTime: chest.spawnBattleTime,
      destroyed: chest.destroyed,
      destroyWave: chest.destroyWave,
      destroyTime: chest.destroyed ? chest.destroyBattleTime : null,
      refreshCount: chest.refreshCount,
    })),
    playerSnapshot: {
      playerX,
      damageMultiplier: player.damageMultiplier,
      fireRateMultiplier: player.fireRateMultiplier,
      projectileSpeedMultiplier: player.projectileSpeedMultiplier,
      bonusMultiShot: player.bonusMultiShot,
      bonusSpreadCount: player.bonusSpreadCount,
      evolutionId: player.evolutionId,
    },
  };
}

function simulateRun(configOverrides = {}, options = {}) {
  const config = createConfigSnapshot(configOverrides);
  const seed = options.seed || 1;
  const rand = mulberry32(seed);
  const strategyName = options.strategy || 'balanced';
  const strategies = createStrategies();
  const strategy = strategies[strategyName] || strategies.balanced;
  const stageIndex = Math.max(0, Math.min((config.stages || []).length - 1, options.stageIndex || 0));
  const stage = config.stages?.[stageIndex];
  const startWave = stage?.startWave || 1;
  const waveCount = stage?.waveCount || Math.min(12, config.waveDefs.length);
  const progress = options.progress || {};
  let playerHp = config.car.hp + (progress.carHpFlat || 0);
  let cumulativeDamageMultiplier = progress.damageMultiplier || 1;
  let cumulativeFireRateMultiplier = progress.fireRateMultiplier || 1;
  let cumulativeProjectileSpeedMultiplier = progress.projectileSpeedMultiplier || 1;
  let cumulativeBonusMultiShot = progress.bonusMultiShot || 0;
  let cumulativeBonusSpreadCount = progress.bonusSpreadCount || 0;
  let cumulativeEvolutionId = progress.evolutionId || null;
  let playerX = progress.playerX || 0;
  let totalKills = 0;
  let totalEnemySpawned = 0;
  let totalChestSpawned = 0;
  let totalChestDestroyed = 0;
  let totalWaveTime = 0;
  let failures = 0;
  let failureWave = 0;
  let firstEvolutionWave = null;
  const waveResults = [];
  const traceReplayChoices = normalizeTraceReplayChoiceMap(options.traceReplay || null);
  const runState = {
    battleTime: 0,
    chestSerial: 0,
    selectionsThisRun: 0,
    adRefreshesUsed: 0,
    activeChests: [],
    chestHistory: [],
    supplyChoiceHistory: [],
  };

  for (let waveIndex = startWave - 1; waveIndex < startWave - 1 + waveCount; waveIndex++) {
    const waveResult = simulateWaveCombat(config, {
      stageIndex,
      waveIndex,
      runState,
      behaviorTuning: options.behaviorTuning || null,
      startPlayerHp: playerHp,
      startPlayerX: playerX,
      progress: {
        carHpFlat: progress.carHpFlat || 0,
        damageMultiplier: cumulativeDamageMultiplier,
        fireRateMultiplier: cumulativeFireRateMultiplier,
        projectileSpeedMultiplier: cumulativeProjectileSpeedMultiplier,
        bonusMultiShot: cumulativeBonusMultiShot,
        bonusSpreadCount: cumulativeBonusSpreadCount,
        evolutionId: cumulativeEvolutionId,
        baseWeaponTier: options.startTier || progress.baseWeaponTier || 1,
        supplyQualityTier: progress.supplyQualityTier || 0,
      },
      startTier: options.startTier || progress.baseWeaponTier || 1,
      forcedEvolution: options.forcedEvolution || null,
      traceReplayChoices,
    }, strategy, rand);

    totalWaveTime += waveResult.waveTime;
    totalEnemySpawned += waveResult.enemySpawnCount;
    totalChestSpawned += waveResult.chestSpawned;
    totalChestDestroyed += waveResult.chestDestroyed;
    totalKills += waveResult.killCount;
    playerHp = waveResult.playerHp;
    cumulativeDamageMultiplier = waveResult.playerSnapshot?.damageMultiplier ?? cumulativeDamageMultiplier;
    cumulativeFireRateMultiplier = waveResult.playerSnapshot?.fireRateMultiplier ?? cumulativeFireRateMultiplier;
    cumulativeProjectileSpeedMultiplier = waveResult.playerSnapshot?.projectileSpeedMultiplier ?? cumulativeProjectileSpeedMultiplier;
    cumulativeBonusMultiShot = waveResult.playerSnapshot?.bonusMultiShot ?? cumulativeBonusMultiShot;
    cumulativeBonusSpreadCount = waveResult.playerSnapshot?.bonusSpreadCount ?? cumulativeBonusSpreadCount;
    cumulativeEvolutionId = waveResult.playerSnapshot?.evolutionId ?? cumulativeEvolutionId;
    playerX = waveResult.playerSnapshot?.playerX ?? playerX;

    if (waveResult.firstEvolutionWave && !firstEvolutionWave) {
      firstEvolutionWave = waveResult.firstEvolutionWave;
    }

    if (!waveResult.cleared || waveResult.playerHp <= 0) {
      failures++;
      failureWave = waveIndex + 1;
      waveResults.push({
        wave: waveIndex + 1,
        ...waveResult,
      });
      break;
    }

    waveResults.push({
      wave: waveIndex + 1,
      ...waveResult,
    });

    const wavePauseDuration = getWavePauseDuration(config, getWaveDef(config, waveIndex));
    totalWaveTime += wavePauseDuration;
    runState.battleTime += wavePauseDuration;
  }

  const clearRate = failures === 0 ? 1 : 0;
  const avgWaveTime = waveResults.length > 0 ? totalWaveTime / waveResults.length : 0;
  const avgPlayerHpPct = waveResults.length > 0
    ? waveResults.reduce((sum, item) => sum + item.playerHpPct, 0) / waveResults.length
    : 0;
  const avgChestDestroyed = waveResults.length > 0
    ? waveResults.reduce((sum, item) => sum + item.chestDestroyed, 0) / waveResults.length
    : 0;
  const destroyRate = totalChestSpawned > 0 ? totalChestDestroyed / totalChestSpawned : 0;
  const snowballIndex = waveResults.length >= 2
    ? (() => {
        const first = waveResults.slice(0, Math.ceil(waveResults.length / 3)).reduce((sum, item) => sum + item.killCount, 0) / Math.max(1, Math.ceil(waveResults.length / 3));
        const last = waveResults.slice(-Math.max(1, Math.ceil(waveResults.length / 3))).reduce((sum, item) => sum + item.killCount, 0) / Math.max(1, Math.ceil(waveResults.length / 3));
        return first > 0 ? last / first : 1;
      })()
    : 1;

  return {
    seed,
    strategy: strategyName,
    stageIndex,
    metrics: {
      clearRate,
      avgWaveTime,
      avgPlayerHpPct,
      avgChestDestroyed,
      chestSpawned: totalChestSpawned,
      chestDestroyed: totalChestDestroyed,
      chestDestroyRate: destroyRate,
      totalKills,
      totalEnemySpawned,
      totalSupplyRefreshes: runState.adRefreshesUsed,
      failureWave,
      firstEvolutionWave,
      snowballIndex,
      supplyChoices: runState.supplyChoiceHistory.map((choice) => ({ ...choice })),
      chests: runState.chestHistory.map((chest) => ({
        serial: chest.serial,
        quality: chest.quality,
        spawnWave: chest.spawnWave,
        spawnTime: chest.spawnBattleTime,
        destroyed: chest.destroyed,
        destroyWave: chest.destroyWave,
        destroyTime: chest.destroyBattleTime,
        refreshCount: chest.refreshCount,
      })),
      waveResults,
    },
  };
}

module.exports = {
  DEFAULT_BEHAVIOR_TUNING,
  simulateRun,
  simulateBaselineCalibration,
  simulateWaveCombat,
  pickSupplyCards,
  buildPlayerState,
  createDamageModel,
  applyEnemyMitigation,
  getChestHp,
};
