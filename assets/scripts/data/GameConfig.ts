/**
 * GameConfig.ts - 桥防守卫所有数值配置
 * 统一管理游戏数值，便于平衡调整
 */

export const GameConfig = {
  // ============================================
  // 画布设置
  // ============================================
  canvas: {
    width: 720,
    height: 1280,
  },

  // ============================================
  // 桥面布局（相对于 Canvas 中心 (0, 0)）
  // ============================================
  bridge: {
    left: -280,       // 桥左边界 x（原 80 - 360）
    right: 300,       // 桥右边界 x（原 640 - 360）
    top: 430,         // 桥顶端 y（下移出生区，避免压住 HUD）
    laneCount: 5,     // 桥面列数
    railY: -480,      // 护栏 y 坐标（上移，给战车更多活动空间）
    carY: -540,       // 武装车 y 坐标（与护栏保持间隔，整体上移）
  },

  // ============================================
  // 玩家武装车与基础武器
  // ============================================
  car: {
    width: 106,        // 实际显示宽度（保持纵横比，统一画布）
    height: 112,      // 实际显示高度（含火焰特效）
    movePadding: 5,  // 左右移动边界留白，独立于显示宽度，避免手感过窄
    speed: 440,       // 键盘移动速度 px/s
    hp: 200,          // 血量
  },

  // ============================================
  // 基础武器成长档案
  // 说明：
  // - baseSpreadCount: 基础并发数（补给会继续叠加并发）
  // - baseBurstCount: 基础连发数（补给会继续叠加连发）
  // - spreadAngle: 并发子弹之间的基础夹角
  // - burstSpeedScales: 连发每段的速度差，用于形成视觉层次
  // - speed / damage / fireRate: 仍保留按档位成长，但档位职责更接近“基础火力台阶”
  // ============================================
  weaponBase: {
    profileNames: ['单发高速', '双发快射', '三发齐射', '三发双连', '四发三连', '五发四连'],
    baseSpreadCount: [1, 2, 3, 3, 4, 5],
    baseBurstCount: [1, 1, 1, 2, 3, 4],
    spreadAngle: [0, 9, 9, 9, 9, 9],
    burstSpeedScales: [
      [1.0],
      [1.0],
      [1.0],
      [1.0, 0.95],
      [1.0, 0.95, 0.90],
      [1.0, 0.95, 0.90, 0.85],
    ],
    speed: [4000, 4500, 5000, 5500, 6000, 6500],
    damage: [10, 12, 14, 16, 19, 23],
    fireRate: [9.0, 9.2, 9.4, 9.6, 9.8, 10.0],
  },

  // ============================================
  // 子弹表现与碰撞
  // ============================================
  bullet: {
    radius: 8,                                  // 碰撞半径
  },

  // ============================================
  // 敌人
  // ============================================
  enemy: {
    width: 64,        // 宽度（匹配帧动画素材）
    height: 85,      // 高度（匹配帧动画素材）
    railContactOffset: 60, // 敌人推进到护栏附近后停下并开始攻击的中心点偏移
    attackRange: 40,  // 进入护栏范围内开始攻击（原版20 * 2）
    attackRate: 1.0,  // 攻击频率 次/s
  },

  // ============================================
  // 敌人原型
  // 基础数值来自 waves / waveScaling，再乘以下方倍率
  // ============================================
  enemyTypes: {
    normal: {
      hpMult: 1.0,
      speedMult: 1.0,
      atkMult: 1.0,
      expMult: 1.0,
      scale: 1.0,
      damageReduce: 0,
      openingArmorSeconds: 0,
      openingArmorReduce: 0,
      rewardCoins: 0,
      rewardParts: 0,
      attackRateMult: 1.0,
    },
    runner: {
      hpMult: 0.65,
      speedMult: 1.9,
      atkMult: 0.8,
      expMult: 0.95,
      scale: 0.92,
      damageReduce: 0,
      openingArmorSeconds: 0,
      openingArmorReduce: 0,
      rewardCoins: 1,
      rewardParts: 0,
      attackRateMult: 1.15,
      tint: '#80d8ff',
    },
    shield: {
      hpMult: 2.6,
      speedMult: 0.74,
      atkMult: 1.1,
      expMult: 1.25,
      scale: 1.1,
      damageReduce: 0.35,
      openingArmorSeconds: 0,
      openingArmorReduce: 0,
      rewardCoins: 2,
      rewardParts: 0,
      attackRateMult: 0.9,
      tint: '#ffe082',
    },
    suicide: {
      hpMult: 0.75,
      speedMult: 1.25,
      atkMult: 2.4,
      expMult: 1.1,
      scale: 0.96,
      damageReduce: 0,
      openingArmorSeconds: 0,
      openingArmorReduce: 0,
      rewardCoins: 2,
      rewardParts: 0,
      attackRateMult: 1.0,
      explodeDelay: 0.8,
      tint: '#ff8a80',
    },
    healer: {
      hpMult: 0.9,
      speedMult: 0.82,
      atkMult: 0.55,
      expMult: 1.35,
      scale: 0.98,
      damageReduce: 0,
      openingArmorSeconds: 0,
      openingArmorReduce: 0,
      rewardCoins: 3,
      rewardParts: 0,
      attackRateMult: 0.7,
      healPercent: 0.08,
      healInterval: 3,
      healRange: 170,
      tint: '#a5d6a7',
    },
    boss_bulldozer: {
      hpMult: 6.2,
      speedMult: 0.55,
      atkMult: 2.2,
      expMult: 3.2,
      scale: 1.8,
      damageReduce: 0.1,
      openingArmorSeconds: 4,
      openingArmorReduce: 0.4,
      rewardCoins: 80,
      rewardParts: 1,
      attackRateMult: 0.8,
      tint: '#ffcc80',
    },
    boss_commander: {
      hpMult: 8.4,
      speedMult: 0.62,
      atkMult: 2.8,
      expMult: 4.2,
      scale: 2.0,
      damageReduce: 0.15,
      openingArmorSeconds: 3,
      openingArmorReduce: 0.3,
      rewardCoins: 140,
      rewardParts: 2,
      attackRateMult: 0.95,
      tint: '#ce93d8',
    },
  },

  // ============================================
  // 基础波次模板（index=波次-1）
  // 说明：
  // - 当前主玩法优先使用 waveDefs + stages 做关卡编排
  // - 这里保留为 fallback/debug 预览模板，避免调试界面和超出配置范围的波次失效
  // ============================================
  waves: [
    { count: 30,  hp: 20,  speed: 20, atk: 4,  spawnInterval: 1.0 },
    { count: 44,  hp: 30,  speed: 25, atk: 6,  spawnInterval: 1.0 },
    { count: 60,  hp: 60,  speed: 25, atk: 8,  spawnInterval: 1.0 },
    { count: 80,  hp: 120, speed: 30, atk: 11, spawnInterval: 1.0 },
    { count: 100, hp: 120, speed: 30, atk: 15, spawnInterval: 1.0 },
  ],

  // 超出基础波次模板后的外推规则（fallback/debug 用）
  waveScaling: {
    countAdd: 12,     // 敌人数量增量
    hpMult: 1.20,     // HP倍率
    speedAdd: 0,      // 速度增量
    atkMult: 1.0,     // 攻击力倍率
    intervalMin: 0.1, // 最小生成间隔
  },

  // ============================================
  // 波次编排（前 10 波）
  // kind 先用于内容编排和后续 UI 展示；超出配置后回落到默认 normal 波
  // ============================================
  waveDefs: [
    {
      kind: 'normal',
      title: '桥头试探',
      spawnInterval: 0.5,
      entries: [
        { type: 'normal', count: 400 },
      ],
    },
    {
      kind: 'mixed',
      title: '快速接敌',
      spawnInterval: 0.38,
      entries: [
        { type: 'normal', count: 55 },
        { type: 'runner', count: 8 },
      ],
    },
    {
      kind: 'mixed',
      title: '护栏试压',
      spawnInterval: 0.34,
      entries: [
        { type: 'normal', count: 70 },
        { type: 'runner', count: 16 },
        { type: 'shield', count: 12 },
      ],
    },
    {
      kind: 'pressure',
      title: '装甲前压',
      spawnInterval: 0.31,
      entries: [
        { type: 'normal', count: 85 },
        { type: 'runner', count: 22 },
        { type: 'shield', count: 18 },
      ],
    },
    {
      kind: 'pressure',
      title: '爆破试探',
      spawnInterval: 0.28,
      entries: [
        { type: 'normal', count: 90 },
        { type: 'runner', count: 24 },
        { type: 'shield', count: 22 },
        { type: 'suicide', count: 10 },
      ],
    },
    {
      kind: 'crisis',
      title: '连环突击',
      spawnInterval: 0.25,
      entries: [
        { type: 'normal', count: 100 },
        { type: 'runner', count: 28 },
        { type: 'shield', count: 28 },
        { type: 'suicide', count: 14 },
      ],
    },
    {
      kind: 'support',
      title: '后排医护',
      spawnInterval: 0.23,
      entries: [
        { type: 'normal', count: 110 },
        { type: 'runner', count: 30 },
        { type: 'shield', count: 34 },
        { type: 'suicide', count: 14 },
        { type: 'healer', count: 8 },
      ],
    },
    {
      kind: 'crisis',
      title: '交错冲锋',
      spawnInterval: 0.21,
      entries: [
        { type: 'normal', count: 120 },
        { type: 'runner', count: 34 },
        { type: 'shield', count: 40 },
        { type: 'suicide', count: 18 },
        { type: 'healer', count: 10 },
      ],
    },
    {
      kind: 'crisis',
      title: '极限突破',
      spawnInterval: 0.19,
      entries: [
        { type: 'normal', count: 130 },
        { type: 'runner', count: 36 },
        { type: 'shield', count: 48 },
        { type: 'suicide', count: 20 },
        { type: 'healer', count: 12 },
      ],
    },
    {
      kind: 'crisis',
      title: '高压推进',
      spawnInterval: 0.18,
      entries: [
        { type: 'normal', count: 140 },
        { type: 'runner', count: 40 },
        { type: 'shield', count: 58 },
        { type: 'suicide', count: 24 },
        { type: 'healer', count: 14 },
      ],
    },
    {
      kind: 'crisis',
      title: '火力封锁',
      spawnInterval: 0.16,
      entries: [
        { type: 'normal', count: 150 },
        { type: 'runner', count: 44 },
        { type: 'shield', count: 70 },
        { type: 'suicide', count: 28 },
        { type: 'healer', count: 16 },
      ],
    },
    {
      kind: 'boss',
      title: '指挥官战车',
      spawnInterval: 0.18,
      pauseTime: 8.0,
      entries: [
        { type: 'boss_commander', count: 1 },
        { type: 'normal', count: 80 },
        { type: 'runner', count: 20 },
        { type: 'shield', count: 40 },
        { type: 'suicide', count: 16 },
        { type: 'healer', count: 10 },
      ],
    },
  ],

  // ============================================
  // 关卡配置（最小版）
  // 使用现有 waveDefs 切分成多个可通关关卡
  // startWave 为 1-based 波次编号
  // ============================================
  stages: [
    {
      id: 'stage_1_1',
      label: '1-1',
      name: '桥头防线',
      startWave: 1,
      waveCount: 12,
      rewardBonus: { coins: 120, parts: 3 },
      enemyDensityByWave: [1.7, 1.95, 2.2, 2.5, 2.8, 3.1, 3.45, 3.8, 4.15, 4.5, 4.9, 4.2],
      chestHpMultiplierByWave: [9, 12, 14, 16, 18, 21, 24, 27, 31, 36, 42, 48],
    },
  ],

  // ============================================
  // 波次间隔
  // ============================================
  wavePauseTime: 3.0,  // 两波之间的休息秒数，兼容补给选择与广告入口

  // ============================================
  // 广告占位配置
  // provider: simulated=本地3秒模拟观看；wechat=后续接入微信广告
  // 所有插入点通过 placement 语义调用，方便后续调整位置
  // ============================================
  ads: {
    provider: 'simulated',
    simulateSeconds: 3,
    rewarded: {
      revive: {
        enabled: true,
        adUnitId: '',
        title: '观看广告复活',
      },
      supply: {
        enabled: true,
        adUnitId: '',
        title: '观看广告领取额外补给',
      },
      doubleReward: {
        enabled: true,
        adUnitId: '',
        title: '观看广告双倍结算',
      },
    },
    interstitial: {
      enabled: true,
      adUnitId: '',
      cooldownSec: 120,
      minRunTimeSec: 60,
    },
    banner: {
      enabled: true,
      adUnitId: '',
    },
  },

  // ============================================
  // 可玩性升级配置：补给、复活、结算、素材占位
  // assetBrief 用于后续素材制作排期，当前用文字占位
  // ============================================
  gameplay: {
    revive: {
      hpRatio: 0.4,
      invulnerableSeconds: 3,
      clearRailRange: 120,
    },
    settlement: {
      coinsPerKill: 2,
      coinsPerWave: 20,
      partsPerThreeWaves: 1,
    },
    supply: {
      mode: 'chest_trigger',
      offerEveryWaves: 2,
      bossWaveEvery: 5,
      choiceCount: 3,
      maxAdExtrasPerRun: 5,
      qualityBonusPerTier: 0.08,
      chest: {
        minWave: 1,
        maxActiveCount: 5,
        maxSelectionsPerRun: 9,
        baseSpawnDelay: 3.2,
        delayVariance: 0,
        radius: 42,
        lowerY: 0,
        upperY: 0,
        speedMultiplier: 130,
        attackMultiplier: 0,
        attackRateMultiplier: 0,
        hpMultiplier: {
          normal: 1,
          elite: 1,
          rare: 1,
          legendary: 1,
        },
        laneIndex: 0,
        enemyStartLaneIndex: 1,
        capacity: 5,
        slotGap: 100,
        topOffset: 24,
        stopRatio: 0.82,
        refillDelay: 0.45,
        baseHpFactor: 9.5,
        waveGrowth: 0.16,
        serialGrowth: 0.28,
      },
      options: [
        {
          id: 'damage_tuning',
          title: '弹头校准',
          desc: '本关子弹伤害提升12%，可叠加',
          cardType: 'firepower',
          star: 1,
          triggerMode: 'passive',
          assetKey: 'icon_supply_damage_tuning',
          assetBrief: '小型暖色弹头、校准准星与微光火花，可做64x64图标',
          effect: { type: 'damageMultiplier', value: 1.12 },
        },
        {
          id: 'damage_boost',
          title: '高爆弹药',
          desc: '本关子弹伤害提升25%，火力压制更强，可叠加',
          cardType: 'firepower',
          star: 2,
          triggerMode: 'passive',
          assetKey: 'icon_supply_damage',
          assetBrief: '橙色炮弹与爆炸火花，可做64x64图标',
          effect: { type: 'damageMultiplier', value: 1.25 },
        },
        {
          id: 'fire_rate_boost',
          title: '快装弹链',
          desc: '本关射速提升12%，可叠加',
          cardType: 'firepower',
          star: 1,
          triggerMode: 'passive',
          assetKey: 'icon_supply_fire_rate',
          assetBrief: '金属弹链、速度线，可做64x64图标',
          effect: { type: 'fireRateMultiplier', value: 1.12 },
        },
        {
          id: 'fire_rate_boost_big',
          title: '过载供弹',
          desc: '本关射速提升35%，火线压制显著增强，可叠加',
          cardType: 'firepower',
          star: 3,
          triggerMode: 'passive',
          assetKey: 'icon_supply_fire_rate_big',
          assetBrief: '加速供弹链轮、火花与速度线，可做64x64图标',
          effect: { type: 'fireRateMultiplier', value: 1.35 },
        },
        {
          id: 'projectile_speed_up',
          title: '曳光增压',
          desc: '本关弹药飞行速度提升18%，弹道推进更强，可叠加',
          cardType: 'firepower',
          star: 2,
          triggerMode: 'passive',
          assetKey: 'icon_supply_projectile_speed',
          assetBrief: '暖色弹芯、推进尾迹与速度光束，可做64x64图标',
          effect: { type: 'projectileSpeedMultiplier', value: 1.18 },
        },
        {
          id: 'projectile_speed_trim',
          title: '弹道校正',
          desc: '本关弹药飞行速度提升10%，可叠加',
          cardType: 'firepower',
          star: 1,
          triggerMode: 'passive',
          assetKey: 'icon_supply_projectile_trim',
          assetBrief: '轻量曳光弹芯、短尾迹与校准刻线，可做64x64图标',
          effect: { type: 'projectileSpeedMultiplier', value: 1.1 },
        },
        {
          id: 'stability_burst',
          title: '轻量供弹',
          desc: '本关射速提升20%，供弹节奏更顺畅，可叠加',
          cardType: 'firepower',
          star: 2,
          triggerMode: 'passive',
          assetKey: 'icon_supply_stability_burst',
          assetBrief: '紧凑弹链、稳定供弹轮与暖色速度线，可做64x64图标',
          effect: { type: 'fireRateMultiplier', value: 1.2 },
        },
        {
          id: 'multishot_up',
          title: '追击连发',
          desc: '本关每轮额外连发1次，可叠加',
          cardType: 'firepower',
          star: 3,
          triggerMode: 'passive',
          assetKey: 'icon_supply_multishot',
          assetBrief: '双层弹链、连续曳光轨迹，可做64x64图标',
          effect: { type: 'multiShotAdd', value: 1 },
        },
        {
          id: 'spread_count_up',
          title: '并列弹幕',
          desc: '本关并发弹道+1，可叠加',
          cardType: 'firepower',
          star: 3,
          triggerMode: 'passive',
          assetKey: 'icon_supply_spread_count',
          assetBrief: '多重并列炮口、扇形火线，可做64x64图标',
          effect: { type: 'spreadCountAdd', value: 1 },
        },
        {
          id: 'shield_pulse',
          title: '护盾脉冲',
          desc: '立即获得2.5秒无敌护盾',
          cardType: 'control',
          star: 2,
          triggerMode: 'instant',
          assetKey: 'icon_supply_shield_pulse',
          assetBrief: '蓝白护盾脉冲、环形电弧与短促爆闪，可做64x64图标',
          effect: { type: 'shield', seconds: 2.5 },
        },
        {
          id: 'intercept_pulse',
          title: '拦截脉冲',
          desc: '立即震退全场敌人并造成轻量伤害',
          cardType: 'control',
          star: 2,
          triggerMode: 'instant',
          assetKey: 'icon_supply_intercept_pulse',
          assetBrief: '青蓝脉冲波、短程冲击环与拦截电弧，可做64x64图标',
          effect: { type: 'shockwave', value: 110, damage: 20 },
        },
        {
          id: 'freeze_field_small',
          title: '迟滞力场',
          desc: '立即冻结全场敌人1.6秒',
          cardType: 'control',
          star: 2,
          triggerMode: 'instant',
          assetKey: 'icon_supply_freeze_small',
          assetBrief: '轻量冰蓝力场、短程冻结波纹与冷光边界，可做64x64图标',
          effect: { type: 'freezeAll', seconds: 1.6 },
        },
        {
          id: 'freeze_field',
          title: '冻结力场',
          desc: '立即冻结全场敌人2.8秒',
          cardType: 'control',
          star: 3,
          triggerMode: 'instant',
          assetKey: 'icon_supply_slow',
          assetBrief: '低温力场、冰蓝脉冲与封锁边界，可做64x64图标',
          effect: { type: 'freezeAll', seconds: 2.8 },
        },
        {
          id: 'shockwave_blast',
          title: '震荡清场',
          desc: '立即震退全场敌人并造成中量伤害',
          cardType: 'control',
          star: 4,
          triggerMode: 'instant',
          assetKey: 'icon_supply_knockback',
          assetBrief: '橙白冲击波、破片与外扩气浪，可做64x64图标',
          effect: { type: 'shockwave', value: 170, damage: 55 },
        },
        {
          id: 'heavy_barrage',
          title: '重装穿燃',
          desc: '本关子弹伤害提升42%，重火力持续压制，可叠加',
          cardType: 'firepower',
          star: 4,
          triggerMode: 'passive',
          assetKey: 'icon_supply_heavy_barrage',
          assetBrief: '重型燃烧弹头、破甲火流与高热冲击纹，可做64x64图标',
          effect: { type: 'damageMultiplier', value: 1.42 },
        },
        {
          id: 'explode_radius_up',
          title: '震爆扩散',
          desc: '本关爆裂范围提升18%，偏向爆裂流派',
          cardType: 'firepower',
          star: 4,
          triggerMode: 'passive',
          assetKey: 'icon_supply_explode_radius',
          assetBrief: '橙色爆圈、外扩碎片，可做64x64图标',
          effect: { type: 'explodeRadiusMultiplier', value: 1.18 },
        },
        {
          id: 'pierce_up',
          title: '穿甲串列',
          desc: '本关穿透次数+1，偏向穿透流派',
          cardType: 'firepower',
          star: 4,
          triggerMode: 'passive',
          assetKey: 'icon_supply_pierce_up',
          assetBrief: '蓝色贯穿弹道、残影，可做64x64图标',
          effect: { type: 'pierceAdd', value: 1 },
        },
        {
          id: 'chain_up',
          title: '电弧增幅',
          desc: '本关电弧链数+1，偏向电弧流派',
          cardType: 'firepower',
          star: 4,
          triggerMode: 'passive',
          assetKey: 'icon_supply_chain_up',
          assetBrief: '紫色闪电链、能量线圈，可做64x64图标',
          effect: { type: 'chainAdd', value: 1 },
        },
        {
          id: 'chain_range_up',
          title: '电容外放',
          desc: '本关电弧链距提升18%，偏向电弧流派',
          cardType: 'firepower',
          star: 4,
          triggerMode: 'passive',
          assetKey: 'icon_supply_chain_range',
          assetBrief: '放电半径、紫蓝脉冲圈，可做64x64图标',
          effect: { type: 'chainRangeMultiplier', value: 1.18 },
        },
        {
          id: 'overdrive_fire_control',
          title: '超载火控',
          desc: '本关每轮额外连发2次，形成持续压制火网',
          cardType: 'firepower',
          star: 5,
          triggerMode: 'passive',
          assetKey: 'icon_supply_overdrive_fire_control',
          assetBrief: '高能火控核心、双重连发轨迹与炽热火网，可做64x64图标',
          effect: { type: 'multiShotAdd', value: 2 },
        },
        {
          id: 'airstrike_beacon',
          title: '空袭信标',
          desc: '立即呼叫空袭，对全场敌人造成重创',
          cardType: 'control',
          star: 5,
          triggerMode: 'instant',
          assetKey: 'icon_supply_airstrike',
          assetBrief: '信标投射、俯冲弹轨与轰炸火海，可做64x64图标',
          effect: { type: 'airstrike', damage: 180, radius: 96 },
        },
      ],
    },
    weaponEvolution: {
      unlockLevel: 4,
      defs: {
        mg_explode: {
          id: 'mg_explode',
          title: '爆裂机炮',
          shortName: '爆裂',
          desc: '命中后小范围爆炸，适合清理密集敌群',
          behavior: 'explode',
          damageMultiplier: 0.92,
          explodeRadius: 68,
          splashMultiplier: 0.65,
          tint: '#ffb74d',
        },
        mg_pierce: {
          id: 'mg_pierce',
          title: '穿透机炮',
          shortName: '穿透',
          desc: '子弹连续穿透敌人，适合长列推进',
          behavior: 'pierce',
          damageMultiplier: 0.9,
          pierceCount: 3,
          tint: '#81d4fa',
        },
        mg_arc: {
          id: 'mg_arc',
          title: '电弧机炮',
          shortName: '电弧',
          desc: '命中后释放链状电弧，压制高速与治疗单位',
          behavior: 'chain',
          damageMultiplier: 0.84,
          chainCount: 2,
          chainRange: 170,
          chainMultiplier: 0.6,
          tint: '#ce93d8',
        },
      },
      options: [
        {
          id: 'weapon_evo_explode',
          title: '进化: 爆裂机炮',
          desc: '命中小范围爆炸，清群更强',
          cardType: 'firepower',
          star: 5,
          triggerMode: 'passive',
          assetKey: 'icon_weapon_evo_explode',
          assetBrief: '橙黄爆裂弹芯、火焰冲击环，可做64x64图标',
          effect: { type: 'weaponEvolution', evolutionId: 'mg_explode' },
        },
        {
          id: 'weapon_evo_pierce',
          title: '进化: 穿透机炮',
          desc: '子弹可穿透多个目标',
          cardType: 'firepower',
          star: 5,
          triggerMode: 'passive',
          assetKey: 'icon_weapon_evo_pierce',
          assetBrief: '蓝色穿甲弹头、前冲残影，可做64x64图标',
          effect: { type: 'weaponEvolution', evolutionId: 'mg_pierce' },
        },
        {
          id: 'weapon_evo_arc',
          title: '进化: 电弧机炮',
          desc: '命中后链向附近敌人',
          cardType: 'firepower',
          star: 5,
          triggerMode: 'passive',
          assetKey: 'icon_weapon_evo_arc',
          assetBrief: '紫蓝电弧线圈、链式闪电，可做64x64图标',
          effect: { type: 'weaponEvolution', evolutionId: 'mg_arc' },
        },
      ],
    },
  },

  // ============================================
  // 局外成长：车库永久升级
  // upgrades:
  // valueBase + level * valueStep -> 当前等级加成值
  // next level 消耗由 costBase + level * costStep 决定
  // ============================================
  progression: {
    upgrades: [
      {
        id: 'car_hp',
        title: '复合装甲',
        desc: '永久提升武装车最大耐久',
        currency: 'coins',
        maxLevel: 8,
        costBase: 80,
        costStep: 70,
        valueBase: 0,
        valueStep: 18,
        valueSuffix: '生命',
      },
      {
        id: 'car_attack',
        title: '穿甲弹芯',
        desc: '永久提升基础子弹伤害',
        currency: 'coins',
        maxLevel: 8,
        costBase: 120,
        costStep: 90,
        valueBase: 0,
        valueStep: 0.08,
        valueSuffix: '%伤害',
      },
      {
        id: 'weapon_tier',
        title: '火控核心',
        desc: '永久提升开局基础武器档位',
        currency: 'parts',
        maxLevel: 5,
        costBase: 3,
        costStep: 3,
        valueBase: 1,
        valueStep: 1,
        valueSuffix: '档位',
      },
      {
        id: 'starting_coins',
        title: '战备基金',
        desc: '每局结算时额外获得金币',
        currency: 'coins',
        maxLevel: 6,
        costBase: 100,
        costStep: 100,
        valueBase: 0,
        valueStep: 15,
        valueSuffix: '开局金币',
      },
      {
        id: 'revive_bonus',
        title: '应急护盾',
        desc: '复活时额外恢复耐久，并延长护盾时间',
        currency: 'parts',
        maxLevel: 5,
        costBase: 2,
        costStep: 2,
        valueBase: 0,
        valueStep: 0.08,
        extraValueBase: 0,
        extraValueStep: 0.4,
        valueSuffix: '%复活血量',
      },
      {
        id: 'supply_quality',
        title: '军需协定',
        desc: '提高高品质补给出现概率',
        currency: 'parts',
        maxLevel: 5,
        costBase: 2,
        costStep: 2,
        valueBase: 0,
        valueStep: 1,
        valueSuffix: '补给品质',
      },
      {
        id: 'parts_bonus',
        title: '回收机械臂',
        desc: '每局结算额外获得零件',
        currency: 'parts',
        maxLevel: 6,
        costBase: 1,
        costStep: 2,
        valueBase: 0,
        valueStep: 1,
        valueSuffix: '额外零件',
      },
    ],
  },

  // ============================================
  // 敌人颜色方案（按波次循环）
  // ============================================
  enemyColors: [
    { body: '#c44a1a', armor: '#8b2500', helm: '#d4691e', acc: '#ff8c00' },   // 红色
    { body: '#5b2ea6', armor: '#3a1870', helm: '#7b4ec8', acc: '#c084fc' }, // 紫色
    { body: '#1a6b4a', armor: '#0d3d28', helm: '#2d9e6b', acc: '#5ddf9e' }, // 绿色
    { body: '#c4a21a', armor: '#8b6e00', helm: '#e8c428', acc: '#fff176' },  // 黄色
    { body: '#c41a4a', armor: '#8b0028', helm: '#e83068', acc: '#ff80ab' },  // 粉色
  ],

  // ============================================
  // 子弹默认颜色（按基础武器档位）
  // 若已获得武器分支，则优先使用分支 tint 覆盖
  // ============================================
  bulletColors: ['#ffb11a', '#ff8a1f', '#ff6b2e', '#ff5a36', '#ff7a3a', '#ff6a52'],

  // ============================================
  // 爆炸粒子颜色
  // ============================================
  explosionColors: ['#ff6b00', '#ffab00', '#fff176', '#ff4444', '#fff', '#ff9800'],
};

// 导出类型定义
export interface WaveData {
  count: number;
  hp: number;
  speed: number;
  atk: number;
  spawnInterval: number;
}

export type EnemyTypeId =
  | 'normal'
  | 'runner'
  | 'shield'
  | 'suicide'
  | 'healer'
  | 'boss_bulldozer'
  | 'boss_commander';

export type WaveKind = 'normal' | 'mixed' | 'pressure' | 'resource' | 'crisis' | 'support' | 'boss';

export interface EnemyTypeData {
  hpMult: number;
  speedMult: number;
  atkMult: number;
  expMult: number;
  scale: number;
  damageReduce: number;
  openingArmorSeconds: number;
  openingArmorReduce: number;
  rewardCoins: number;
  rewardParts: number;
  attackRateMult: number;
  explodeDelay?: number;
  healPercent?: number;
  healInterval?: number;
  healRange?: number;
  tint?: string;
}

export interface WaveSpawnEntryData {
  type: EnemyTypeId;
  count: number;
}

export interface WaveDefinitionData {
  kind: WaveKind;
  title: string;
  entries: WaveSpawnEntryData[];
  spawnInterval?: number;
  pauseTime?: number;
}

export interface EnemyColorScheme {
  body: string;
  armor: string;
  helm: string;
  acc: string;
}

export interface SupplyOptionData {
  id: string;
  title: string;
  desc: string;
  cardType: SupplyCardType;
  star: SupplyCardStar;
  triggerMode: SupplyTriggerMode;
  assetKey: string;
  assetBrief: string;
  effect: {
    type:
      | 'heal'
      | 'damageMultiplier'
      | 'fireRateMultiplier'
      | 'projectileSpeedMultiplier'
      | 'multiShotAdd'
      | 'spreadCountAdd'
      | 'shield'
      | 'knockback'
      | 'slow'
      | 'bonusCoins'
      | 'bonusParts'
      | 'extraSupplyChoices'
      | 'extraAdSupply'
      | 'explodeRadiusMultiplier'
      | 'pierceAdd'
      | 'chainAdd'
      | 'chainRangeMultiplier'
      | 'freezeAll'
      | 'shockwave'
      | 'airstrike'
      | 'weaponEvolution';
    value?: number;
    waves?: number;
    seconds?: number;
    damage?: number;
    radius?: number;
    evolutionId?: WeaponEvolutionId;
  };
}

export type SupplyMode = 'wave_break' | 'chest_trigger';

export type SupplyCardType = 'firepower' | 'control';

export type SupplyCardStar = 1 | 2 | 3 | 4 | 5;

export type SupplyTriggerMode = 'passive' | 'instant';

export type SupplyChestQuality = 'normal' | 'elite' | 'rare' | 'legendary';

export interface SupplyChestConfigData {
  minWave: number;
  maxActiveCount: number;
  maxSelectionsPerRun: number;
  baseSpawnDelay: number;
  delayVariance: number;
  radius: number;
  lowerY: number;
  upperY: number;
  speedMultiplier: number;
  attackMultiplier: number;
  attackRateMultiplier: number;
  hpMultiplier: Record<SupplyChestQuality, number>;
  laneIndex?: number;
  enemyStartLaneIndex?: number;
  capacity?: number;
  slotGap?: number;
  topOffset?: number;
  stopRatio?: number;
  refillDelay?: number;
  baseHpFactor?: number;
  waveGrowth?: number;
  serialGrowth?: number;
}

export interface StageRewardBonusData {
  coins: number;
  parts: number;
}

export interface StageDefData {
  id: string;
  label: string;
  name: string;
  startWave: number;
  waveCount: number;
  rewardBonus: StageRewardBonusData;
  enemyDensityByWave?: number[];
  chestHpMultiplierByWave?: number[];
}

export type WeaponBehavior = 'normal' | 'explode' | 'pierce' | 'chain';

export type WeaponEvolutionId = 'mg_explode' | 'mg_pierce' | 'mg_arc';

export interface WeaponEvolutionData {
  id: WeaponEvolutionId;
  title: string;
  shortName: string;
  desc: string;
  behavior: WeaponBehavior;
  damageMultiplier: number;
  explodeRadius?: number;
  splashMultiplier?: number;
  pierceCount?: number;
  chainCount?: number;
  chainRange?: number;
  chainMultiplier?: number;
  tint?: string;
}

export type UpgradeCurrency = 'coins' | 'parts';

export type PermanentUpgradeId =
  | 'car_hp'
  | 'car_attack'
  | 'weapon_tier'
  | 'starting_coins'
  | 'revive_bonus'
  | 'supply_quality'
  | 'parts_bonus';

export interface PermanentUpgradeConfig {
  id: PermanentUpgradeId;
  title: string;
  desc: string;
  currency: UpgradeCurrency;
  maxLevel: number;
  costBase: number;
  costStep: number;
  valueBase: number;
  valueStep: number;
  extraValueBase?: number;
  extraValueStep?: number;
  valueSuffix: string;
}
