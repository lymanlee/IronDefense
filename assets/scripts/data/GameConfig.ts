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
  // 战斗区布局（相对于 Canvas 中心 (0, 0)）
  // ============================================
  bridge: {
    left: -280,       // 桥左边界 x（原 80 - 360）
    right: 300,       // 桥右边界 x（原 640 - 360）
    battleTop: 530,   // 战斗区上边界 / 敌人出生参考线（避免压住 HUD）
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
    touchSensitivity: 1.2, // 手指横向位移到战车横向位移的倍率，>1 时滑动更灵敏
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
    profileNames: ['单发高速', '双发快射', '三发齐射', '三发双连', '四发双连', '五发双连'],
    baseSpreadCount: [1, 2, 3, 3, 4, 5],
    baseBurstCount: [1, 1, 1, 2, 2, 2],
    spreadAngle: [0, 9, 9, 9, 9, 9],
    burstSpeedScales: [
      [1.0],
      [1.0],
      [1.0],
      [1.0, 0.95],
      [1.0, 0.95, 0.90],
      [1.0, 0.95, 0.90, 0.85],
    ],
    speed: [1000, 1500, 2000, 2500, 3000, 3500],
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
  // 职责：
  // - 基于波次基础属性底稿（waves / waveScaling）进行敌种差异化倍率修正
  // - 最终单体数值大致可理解为：
  //   hp = 波次基础HP * 关卡波次HP倍率 * hpMult
  //   speed = 波次基础速度 * 关卡波次速度倍率 * speedMult
  //   atk = 波次基础攻击 * 关卡波次攻击倍率 * atkMult
  // - 不负责决定本波出多少、按什么顺序出
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
  // 职责：
  // - hp / speed / atk: 作为敌人的基础属性底稿
  // - count / spawnInterval: 仅用于 fallback / debug 预览，不参与前 12 波手写编排
  // - 当前主玩法优先使用 waveDefs 决定敌人构成与出怪节奏
  // ============================================
  waves: [
    { count: 30,  hp: 20,  speed: 20, atk: 4,  spawnInterval: 1.0 },
    { count: 44,  hp: 30,  speed: 25, atk: 6,  spawnInterval: 1.0 },
    { count: 60,  hp: 60,  speed: 25, atk: 8,  spawnInterval: 1.0 },
    { count: 80,  hp: 90, speed: 30, atk: 11, spawnInterval: 1.0 },
    { count: 100, hp: 120, speed: 30, atk: 15, spawnInterval: 1.0 },
  ],

  // 超出基础波次模板后的外推规则（fallback/debug 用）
  // 职责：
  // - 仅服务于超出手写 waveDefs / waves 后的自动外推
  // - countAdd 仅用于 fallback 总兵力预算增长
  waveScaling: {
    countAdd: 12,     // 敌人数量增量
    hpMult: 1.20,     // HP倍率
    speedAdd: 0,      // 速度增量
    atkMult: 1.0,     // 攻击力倍率
    intervalMin: 0.1, // 最小生成间隔
  },

  // ============================================
  // 波次编排（前 12 波）
  // 职责：
  // - 直接定义前 12 波的最终敌人构成与出怪节奏
  // - entries.count 为最终生成数量，不再受 stage 数量倍率放大
  // - mixMode 决定多敌种波次是顺序出怪还是轮转混编
  // ============================================
  waveDefs: [
    {
      kind: 'normal',
      title: '桥头试探',
      spawnInterval: 0.58,
      entries: [
        { type: 'shield', count: 40 },
        { type: 'normal', count: 300 },
      ],
    },
    {
      kind: 'mixed',
      title: '快速接敌',
      spawnInterval: 0.42,
      entries: [
        { type: 'normal', count: 42 },
        { type: 'runner', count: 10 },
      ],
    },
    {
      kind: 'mixed',
      title: '护栏试压',
      spawnInterval: 0.4,
      entries: [
        { type: 'normal', count: 46 },
        { type: 'runner', count: 12 },
        { type: 'shield', count: 8 },
      ],
    },
    {
      kind: 'pressure',
      title: '装甲前压',
      spawnInterval: 0.38,
      entries: [
        { type: 'normal', count: 54 },
        { type: 'runner', count: 16 },
        { type: 'shield', count: 12 },
      ],
    },
    {
      kind: 'pressure',
      title: '爆破试探',
      spawnInterval: 0.38,
      entries: [
        { type: 'normal', count: 58 },
        { type: 'runner', count: 18 },
        { type: 'shield', count: 14 },
        { type: 'suicide', count: 6 },
      ],
    },
    {
      kind: 'crisis',
      title: '连环突击',
      spawnInterval: 0.36,
      entries: [
        { type: 'normal', count: 64 },
        { type: 'runner', count: 20 },
        { type: 'shield', count: 16 },
        { type: 'suicide', count: 8 },
      ],
    },
    {
      kind: 'support',
      title: '后排医护',
      spawnInterval: 0.36,
      entries: [
        { type: 'normal', count: 70 },
        { type: 'runner', count: 20 },
        { type: 'shield', count: 18 },
        { type: 'suicide', count: 8 },
        { type: 'healer', count: 4 },
      ],
    },
    {
      kind: 'crisis',
      title: '交错冲锋',
      spawnInterval: 0.34,
      entries: [
        { type: 'normal', count: 76 },
        { type: 'runner', count: 24 },
        { type: 'shield', count: 22 },
        { type: 'suicide', count: 10 },
        { type: 'healer', count: 5 },
      ],
    },
    {
      kind: 'crisis',
      title: '极限突破',
      spawnInterval: 0.33,
      entries: [
        { type: 'normal', count: 84 },
        { type: 'runner', count: 28 },
        { type: 'shield', count: 26 },
        { type: 'suicide', count: 12 },
        { type: 'healer', count: 6 },
      ],
    },
    {
      kind: 'crisis',
      title: '高压推进',
      spawnInterval: 0.32,
      entries: [
        { type: 'normal', count: 92 },
        { type: 'runner', count: 32 },
        { type: 'shield', count: 30 },
        { type: 'suicide', count: 14 },
        { type: 'healer', count: 7 },
      ],
    },
    {
      kind: 'crisis',
      title: '火力封锁',
      spawnInterval: 0.31,
      entries: [
        { type: 'normal', count: 100 },
        { type: 'runner', count: 36 },
        { type: 'shield', count: 34 },
        { type: 'suicide', count: 16 },
        { type: 'healer', count: 8 },
      ],
    },
    {
      kind: 'boss',
      title: '指挥官战车',
      spawnInterval: 0.34,
      pauseTime: 5.0,
      entries: [
        { type: 'boss_commander', count: 1 },
        { type: 'normal', count: 48 },
        { type: 'runner', count: 18 },
        { type: 'shield', count: 18 },
        { type: 'suicide', count: 8 },
        { type: 'healer', count: 4 },
      ],
    },
  ],

  // ============================================
  // 关卡配置（最小版）
  // 职责：
  // - 定义关卡包含哪些波次
  // - 只控制敌人基础属性倍率与宝箱曲线，不再直接放大前 12 波敌人数量
  // - startWave 为 1-based 波次编号
  // ============================================
  stages: [
    {
      id: 'stage_1_1',
      label: '1-1',
      name: '桥头防线',
      startWave: 1,
      waveCount: 12,
      rewardBonus: { coins: 120, parts: 3 },
      enemyHpScaleByWave: [1.0, 1.02, 1.06, 1.12, 1.18, 1.26, 1.34, 1.44, 1.56, 1.7, 1.86, 2.05],
      enemyAtkScaleByWave: [1.0, 1.0, 1.03, 1.08, 1.12, 1.17, 1.22, 1.28, 1.35, 1.43, 1.52, 1.62],
      enemySpeedScaleByWave: [1.0, 1.0, 1.01, 1.02, 1.03, 1.04, 1.05, 1.06, 1.07, 1.08, 1.09, 1.1],
      chestHpMultiplierByWave: [1, 10, 10, 16, 18, 21, 24, 27, 31, 36, 42, 48],
    },
  ],

  // ============================================
  // 波次间隔
  // ============================================
  wavePauseTime: 3.0,  // 两波之间的休息秒数，兼容补给选择与广告入口

  // ============================================
  // 广告配置
  // provider:
  // - free=生产过渡模式，不展示广告，直接发放奖励
  // - simulated=本地3秒模拟观看，仅用于开发调试
  // - wechat=微信广告真机上线
  // 切换微信广告步骤：1.申请流量主 → 2.创建广告位拿到 adUnitId → 3.改 provider 为 'wechat' 并填入 adUnitId
  // ============================================
  ads: {
    provider: 'free',
    simulateSeconds: 3,        // 调试用，上线后保留以便回退调试
    rewarded: {
      revive: {
        enabled: true,
        adUnitId: '',           // TODO 填入微信广告位 ID（格式 adunit-xxxxxxxxxx）
        title: '观看广告复活',    // simulated模式下显示的标题
      },
      supply: {
        enabled: true,
        adUnitId: '',           // TODO 填入微信广告位 ID
        title: '观看广告领取额外补给',    // simulated模式下显示的标题
      },
      doubleReward: {
        enabled: true,
        adUnitId: '',           // TODO 填入微信广告位 ID
        title: '观看广告双倍结算', // simulated模式下显示的标题
      },
    },
    interstitial: {
      enabled: true,
      adUnitId: '',             // TODO 填入微信广告位 ID
      cooldownSec: 120,
      minRunTimeSec: 60,
    },
    banner: {
      enabled: true,
      adUnitId: '',             // TODO 填入微信广告位 ID
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
      // 每次开箱默认展示几张补给卡；局内增益可在此基础上追加
      choiceCount: 3,
      // 单局内最多可通过广告刷新几次补给卡
      maxAdExtrasPerRun: 5,
      chest: {
        // 第几波开始允许出现宝箱（关内波次，从 1 开始）
        minWave: 2,
        // 单局最多能通过击毁宝箱获得几次补给选择
        maxSelectionsPerRun: 6,
        // 常规生成间隔基线，单位秒
        baseSpawnDelay: 5.2,
        // 常规生成间隔浮动范围，0 表示固定节奏
        delayVariance: 0,
        // 宝箱碰撞半径，同时影响宝箱轨道间距的最小安全值
        radius: 42,
        // 宝箱沿轨道下移的实际速度，单位 px/s
        moveSpeed: 130,
        // 宝箱轨道所在列；通常预留最左侧单独轨道
        laneIndex: 0,
        // 敌军从哪一列开始铺开，用于给宝箱轨道留出独立区域
        enemyStartLaneIndex: 1,
        // 轨道上最多同时容纳多少个宝箱
        capacity: 3,
        // 同轨道宝箱之间的最小间距
        slotGap: 100,
        // 宝箱在战场中停靠位置的纵向比例；越大越靠近护栏
        stopRatio: 0.82,
        // 击毁一个宝箱后，下一次允许补位的最短延迟
        refillDelay: 1.1,
        // 宝箱血量 = 当前波敌人基础 HP * baseHpFactor * 关卡波次倍率 * 品质倍率 * serial 递增倍率
        baseHpFactor: 9.5,
        // 不同品质宝箱的额外厚度倍率；只负责品质差异，不负责整关节奏
        qualityHpMultiplier: {
          normal: 1.0,
          elite: 1.16,
          rare: 1.34,
          legendary: 1.58,
        },
        // 同一局内第 N 个宝箱的额外血量成长系数，按指数叠加
        serialGrowth: 0.2,
        // 宝箱品质分布规则：
        // - serialMax 表示适用到第几个宝箱（含）
        // - weights 为该区间内四种品质的抽取权重
        qualityRules: [
          { serialMax: 0, weights: { normal: 1, elite: 0, rare: 0, legendary: 0 } },
          { serialMax: 1, weights: { normal: 0.73, elite: 0.27, rare: 0, legendary: 0 } },
          { serialMax: 4, weights: { normal: 0.28, elite: 0.5, rare: 0.18, legendary: 0.04 } },
          { serialMax: 999, weights: { normal: 0.14, elite: 0.48, rare: 0.26, legendary: 0.12 } },
        ],
      },
      // 宝箱品质与补给卡星级的映射规则：
      // - maxStar: 该品质宝箱最多能出现几星卡
      // - guaranteedStar: 该品质宝箱至少保底出现 1 张几星卡；normal 不保底
      starRules: {
        normal: { maxStar: 2 },
        elite: { maxStar: 3, guaranteedStar: 3 },
        rare: { maxStar: 4, guaranteedStar: 4 },
        legendary: { maxStar: 5, guaranteedStar: 5 },
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
          star: 4,
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
    // 武器分支系统
    // 职责：
    // - defs: 定义分支本体的战斗行为与基础参数
    // - options: 定义玩家在局内“获得某条分支”的入口卡，不负责分支强化细项
    // - unlockLevel: 按基础武器档位判断的分支系统开启门槛，档位从 1 开始计数
    // - minChestSerialToOffer: 单局内至少到第几个宝箱后，分支入口卡才允许进入候选池，宝箱序号从 0 开始计数
    weaponEvolution: {
      // 分支系统的基础档位门槛；当前基础档位达到该值后，才允许出现分支入口卡
      // 取值从 1 开始：1=基础档位1，4=基础档位4
      unlockLevel: 1,
      // 单局第几个宝箱开始允许投放分支入口卡
      // 取值从 0 开始：0=第1个宝箱，1=第2个宝箱，2=第3个宝箱
      minChestSerialToOffer: 2,
      // 分支本体定义：描述拿到该分支后，子弹行为如何变化
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
      // 分支入口卡池：本质是“转职卡”，用于把当前武器切换到对应分支
      // 不承担分支数值强化职责，强化卡仍归 supply.options 管理
      options: [
        {
          id: 'weapon_evo_explode',
          title: '进化: 爆裂机炮',
          desc: '命中小范围爆炸，清群更强',
          cardType: 'firepower',
          star: 3,
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
          star: 3,
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
          star: 3,
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
  // 敌人颜色方案（历史兼容配置，当前主逻辑按 enemyTypes.tint / 敌种固定主色识别）
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
  spawnInterval: number; // 仅表示本波基础模板/外推节奏，手写 waveDefs 可覆盖
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
  hpMult: number; // 相对当前波基础 HP 的倍率
  speedMult: number; // 相对当前波基础移动速度的倍率
  atkMult: number; // 相对当前波基础攻击力的倍率
  expMult: number; // 历史兼容字段；当前更接近“击毁价值权重”的保留槽位
  scale: number; // 敌人模型显示缩放，用于体型识别
  damageReduce: number; // 常驻减伤比例，0.35 表示减免 35% 伤害
  openingArmorSeconds: number; // 开场护甲持续时间；用于前几秒额外抗打
  openingArmorReduce: number; // 开场护甲减伤比例，仅在 openingArmorSeconds 内生效
  rewardCoins: number; // 击毁该敌人额外奖励的金币
  rewardParts: number; // 击毁该敌人额外奖励的零件
  attackRateMult: number; // 相对全局基础 attackRate 的攻速倍率
  explodeDelay?: number; // 自爆敌从贴近到爆炸的延迟
  healPercent?: number; // 治疗敌每次治疗目标最大血量的比例
  healInterval?: number; // 治疗敌的治疗间隔，单位秒
  healRange?: number; // 治疗敌的搜索/治疗半径
  tint?: string; // 敌种主色；用于视觉识别和相关特效配色
}

export interface WaveSpawnEntryData {
  type: EnemyTypeId;
  count: number;
}

export interface WaveDefinitionData {
  kind: WaveKind;
  title: string;
  entries: WaveSpawnEntryData[]; // 本波最终敌人构成
  mixMode?: 'sequential' | 'round_robin'; // 多敌种生成顺序
  spawnInterval?: number; // 本波最终出怪间隔
  pauseTime?: number; // 本波结束后的停顿时间
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

export type SupplyCardType = 'firepower' | 'control';

export type SupplyCardStar = 1 | 2 | 3 | 4 | 5;

export type SupplyTriggerMode = 'passive' | 'instant';

export type SupplyChestQuality = 'normal' | 'elite' | 'rare' | 'legendary';

export interface SupplyChestQualityWeights {
  normal: number;
  elite: number;
  rare: number;
  legendary: number;
}

export interface SupplyChestQualityRuleData {
  serialMax: number;
  weights: SupplyChestQualityWeights;
}

export interface SupplyStarRuleData {
  maxStar: SupplyCardStar;
  guaranteedStar?: SupplyCardStar;
}

export interface SupplyChestConfigData {
  minWave: number; // 第几波开始允许掉落宝箱
  maxSelectionsPerRun: number; // 单局最多可开启多少次补给
  baseSpawnDelay: number; // 常规出箱间隔基线
  delayVariance: number; // 出箱间隔波动范围
  radius: number; // 宝箱碰撞半径
  moveSpeed: number; // 宝箱沿轨道下移速度
  laneIndex?: number; // 宝箱轨道所在列
  enemyStartLaneIndex?: number; // 敌军从哪一列开始排布
  capacity?: number; // 轨道同时容纳的宝箱数量
  slotGap?: number; // 同轨道宝箱间距
  stopRatio?: number; // 宝箱停靠区域的纵向比例
  refillDelay?: number; // 击毁后下一箱允许补位的延迟
  baseHpFactor?: number; // 宝箱 HP 相对当前波敌人基础 HP 的换算系数
  qualityHpMultiplier?: SupplyChestQualityWeights; // 不同品质宝箱的额外血量倍率
  serialGrowth?: number; // 同局第 N 个宝箱的指数成长系数
  qualityRules?: SupplyChestQualityRuleData[]; // 宝箱品质抽取规则
}

export interface SupplyConfigData {
  choiceCount: number; // 每次展示多少张补给卡
  maxAdExtrasPerRun: number; // 单局最多广告刷新次数
  chest: SupplyChestConfigData; // 宝箱生成/轨道/血量规则
  starRules: Record<SupplyChestQuality, SupplyStarRuleData>; // 宝箱品质到补给卡星级的映射规则
  options: SupplyOptionData[]; // 常规补给卡池
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
  enemyHpScaleByWave?: number[]; // 关卡内按波次修正敌人 HP，不改敌人数量
  enemyAtkScaleByWave?: number[]; // 关卡内按波次修正敌人攻击，不改敌人数量
  enemySpeedScaleByWave?: number[]; // 关卡内按波次修正敌人移动速度，不改敌人数量
  chestHpMultiplierByWave?: number[]; // 关卡内按波次修正宝箱血量曲线
}

export type WeaponBehavior = 'normal' | 'explode' | 'pierce' | 'chain';

export type WeaponEvolutionId = 'mg_explode' | 'mg_pierce' | 'mg_arc';

export interface WeaponEvolutionData {
  id: WeaponEvolutionId; // 分支唯一标识；供补给卡与运行时状态引用
  title: string; // 分支全名；用于界面标题和完整描述
  shortName: string; // 分支短名；用于 HUD 或紧凑展示
  desc: string; // 分支说明；描述该分支的核心作战风格
  behavior: WeaponBehavior; // 分支对应的子弹行为类型
  damageMultiplier: number; // 分支挂载后的基础伤害系数；用于平衡特殊行为的收益
  explodeRadius?: number; // 爆裂分支的基础爆炸半径
  splashMultiplier?: number; // 爆裂分支的溅射伤害系数
  pierceCount?: number; // 穿透分支的基础穿透次数
  chainCount?: number; // 电弧分支的基础连锁数量
  chainRange?: number; // 电弧分支的基础连锁范围
  chainMultiplier?: number; // 电弧分支每跳伤害系数
  tint?: string; // 分支主题色；用于子弹/特效/HUD 的视觉识别
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
