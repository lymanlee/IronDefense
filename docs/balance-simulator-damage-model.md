# 基线模拟器伤害模型规则

更新时间：2026-06-25

## 一、目标

这份文档用于约束 `tools/balance/balance_simulator` 的战斗伤害模型，确保离线模拟器对当前项目的火力体系做“足够接近真实逻辑”的简化，而不是拍脑袋近似。

重点覆盖：

- 基础武器档位
- 射速与并发
- 连发/分批开火
- 普通命中
- 穿透
- 爆裂
- 电弧
- 敌人减伤

这份规则的目标不是 1:1 复刻渲染和碰撞，而是让离线模拟在“伤害曲线、清怪节奏、成长膨胀速度”上保持可信。

## 二、真实运行时链路概览

当前项目里，真实战斗伤害链路主要分布在以下文件：

- [WeaponTierSystem.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/components/WeaponTierSystem.ts)
- [PlayerCar.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/components/PlayerCar.ts)
- [Bullet.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/components/Bullet.ts)
- [Enemy.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/components/Enemy.ts)
- [GameManager.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/managers/GameManager.ts)

真实逻辑大致为：

1. `WeaponTierSystem` 提供基础模板
2. `PlayerCar.tryFire()` 决定一轮开火发多少颗子弹、分几批发
3. `Bullet.init()` 决定单颗子弹基础伤害、速度、分支行为
4. `GameManager._handleBulletHit()` 根据子弹行为做普通 / 穿透 / 爆裂 / 电弧结算
5. `Enemy.takeDamage()` 再应用敌人减伤与开场护甲

离线模拟器必须保留这个结构顺序，不能把所有系数简单乘成一个大 DPS 然后直接灌到全场敌人。

## 三、模拟器的抽象原则

### 3.1 要保留的真实逻辑

- 基础档位决定基础伤害、射速、并发、连发
- 局内增益改变伤害倍率、射速倍率、并发、连发
- 分支会改变伤害传播方式
- 敌人减伤会降低实际伤害
- 多目标覆盖能力会显著影响清怪效率

### 3.2 可以简化的真实逻辑

- 不模拟精确子弹轨迹
- 不模拟真实碰撞盒
- 不模拟抖动、视觉停顿、特效延迟
- 不模拟像素级目标遮挡

### 3.3 模拟器里的核心单位

建议模拟器把“开火”抽象成：

- 每次触发开火事件
- 生成若干个 `shot packet`
- 每个 `shot packet` 表示一颗或一批有效命中子弹

对于当前项目，关键不是每颗子弹飞了多远，而是：

- 同一时刻可以打中几个目标
- 同一轮射击对主目标和周边目标造成多少伤害

## 四、基础火力的计算规则

### 4.1 基础伤害

真实逻辑来源：

- `weaponBase.damage[tier]`
- `damageMultiplier`
- `evolution.damageMultiplier`

模拟器规则：

```ts
baseBulletDamage =
  weaponBase.damage[tierIndex]
  * runDamageMultiplier
  * permanentDamageMultiplier
  * evolution.damageMultiplier
```

最终再取：

```ts
bulletDamage = max(1, round(baseBulletDamage))
```

### 4.2 基础射速

真实逻辑来源：

- `weaponBase.fireRate[tier]`
- `playerCar.fireRateMultiplier`

模拟器规则：

```ts
shotsPerSecond =
  weaponBase.fireRate[tierIndex]
  * runFireRateMultiplier
```

其中：

- `runFireRateMultiplier` 已包含局内补给影响

### 4.3 扇面数

真实逻辑来源：

- `pattern.count`
- `bonusSpreadCount`

模拟器规则：

```ts
spreadShotCount = pattern.count + bonusSpreadCount
```

含义：

- 一次开火中，有多少个不同角度的弹道

### 4.4 连发/并发数

真实逻辑来源：

- `pattern.multiShot`
- `bonusMultiShot`

代码里变量名虽然叫 `parallelCount`，但当前语义更接近“同一轮额外打出几组并列子弹批次”。

模拟器规则：

```ts
parallelBurstCount = pattern.multiShot + bonusMultiShot
```

### 4.5 总发射子弹数

一轮开火的理论子弹总数：

```ts
bulletsPerFire = spreadShotCount * parallelBurstCount
```

但模拟器不建议直接把 `bulletsPerFire * bulletDamage` 全部压到一个目标身上，而应拆成“目标覆盖模型”。

## 五、目标覆盖模型

### 5.1 为什么不能直接线性相乘

当前项目中：

- 并发越多，不代表都打在同一个敌人身上
- 扇面越大，更多时候意味着覆盖更多敌人
- 电弧和爆裂的价值恰恰来自“把伤害扩散到多个目标”

所以模拟器要区分：

- `singleTargetDamage`
- `multiTargetCoverage`

### 5.2 推荐做法

模拟器对每次开火分两层结算：

1. 选择主目标
- 通常选最前、最危险、最接近护栏的敌人

2. 根据当前火力覆盖能力，把额外弹道映射到附近次目标

建议近似规则：

- `spreadShotCount = 1`
  - 全部视作单目标
- `spreadShotCount = 2~3`
  - 1 个主目标 + 1 个次目标
- `spreadShotCount = 4~5`
  - 1 个主目标 + 2 个次目标
- 更高时
  - 按覆盖上限继续增加

`parallelBurstCount` 的作用建议近似为：

- 对主目标的累计命中更稳定
- 同时提升次目标覆盖密度

可以通过一个“主目标命中系数 + 次目标覆盖系数”来处理。

例如：

```ts
mainHitPackets = ceil(parallelBurstCount * 0.6)
sideHitPackets = bulletsPerFire - mainHitPackets
```

这个系数不是物理真值，而是用于让模拟器更接近真实战斗体感。

## 六、普通命中规则

普通子弹规则最简单：

```ts
actualDamage = applyEnemyMitigation(target, bulletDamage)
target.hp -= actualDamage
```

其中 `applyEnemyMitigation(...)` 必须按真实逻辑处理。

## 七、敌人减伤规则

真实逻辑在 [Enemy.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/components/Enemy.ts)：

1. 如果开场护甲还在：
   - 先乘 `1 - openingArmorReduce`
2. 再乘常驻减伤：
   - `1 - damageReduce`
3. 最后：
   - `max(1, round(actualDamage))`

模拟器规则必须保持相同顺序：

```ts
function applyEnemyMitigation(enemy, rawDamage) {
  let actual = rawDamage;
  if (enemy.openingArmorRemaining > 0) {
    actual *= 1 - enemyType.openingArmorReduce;
  }
  if (enemyType.damageReduce > 0) {
    actual *= 1 - enemyType.damageReduce;
  }
  return max(1, round(actual));
}
```

## 八、穿透规则

真实逻辑：

- 命中一个敌人后先造成一次完整 `bullet.damage`
- 如果 `remainingPierce > 0`
  - 消耗一次穿透次数
  - 子弹继续存在

模拟器规则：

- 每个穿透包优先命中主路径上的前排目标
- 设定一个“同列最近敌人队列”
- 最多命中：

```ts
1 + pierceCount
```

个敌人

每个被穿透的敌人都吃一次完整基础伤害，不衰减。

```ts
for target in firstNTargetsAlongLane(1 + pierceCount):
  deal bulletDamage
```

## 九、爆裂规则

真实逻辑：

- 主目标先吃一次完整基础伤害
- 再对半径内其他敌人造成：

```ts
round(bulletDamage * max(0.1, splashMultiplier))
```

模拟器规则：

1. 先命中主目标
2. 在主目标附近一定范围内，选出若干邻近敌人
3. 所有邻近敌人吃相同溅射伤害

爆裂伤害定义：

```ts
explodeDamage = max(1, round(bulletDamage * max(0.1, splashMultiplier)))
```

模拟器不需要精确圆形碰撞，可以按“邻近敌人数近似”：

- 敌人密度低：命中 0~1 个额外目标
- 敌人密度中：命中 1~3 个额外目标
- 敌人密度高：命中 2~5 个额外目标

这个“邻近目标数”可以由当前波敌群密度估算。

## 十、电弧规则

真实逻辑：

- 主目标先吃一次完整基础伤害
- 再从当前目标开始，寻找最近敌人
- 最多链 `chainCount` 次
- 每跳伤害：

```ts
round(bulletDamage * max(0.1, chainMultiplier))
```

模拟器规则：

1. 主目标命中后，构造一个“可链目标池”
2. 每次从当前目标找最近且未命中过的目标
3. 最多跳 `chainCount` 次
4. 每个链中目标都吃相同链伤

```ts
chainDamage = max(1, round(bulletDamage * max(0.1, chainMultiplier)))
```

为了贴近真实逻辑，电弧应优先链：

- 距离近的目标
- 尚未命中过的目标
- 当前威胁更高的目标

## 十一、分支收益在模拟器中的处理方式

### 11.1 普通

- 单目标伤害直接结算

### 11.2 穿透

- 强项：长列清怪
- 模拟器中主要提高“单次开火覆盖的纵深目标数”

### 11.3 爆裂

- 强项：密集敌群
- 模拟器中主要提高“主目标附近额外伤害数”

### 11.4 电弧

- 强项：跳链收割和处理中高密度群体
- 模拟器中主要提高“跨目标稳定扩散能力”

因此不建议再额外给一个模糊的 `branchDpsFactor` 直接乘总 DPS。

更合理的方式是：

- 分支的收益主要通过伤害传播结构体现
- 只有在首版实现成本过高时，才允许用小幅行为系数做补偿

## 十二、一次开火的推荐模拟流程

建议 `simulateFireEvent(...)` 按如下顺序执行：

1. 读取当前基础武器档位
2. 计算：
   - `bulletDamage`
   - `shotsPerSecond`
   - `spreadShotCount`
   - `parallelBurstCount`
3. 选择主目标
4. 生成命中包：
   - 主目标包
   - 次目标覆盖包
5. 对每个命中包根据分支类型结算：
   - `normal`
   - `pierce`
   - `explode`
   - `chain`
6. 记录：
   - 本次总伤害
   - 杀敌数
   - 是否触发群体扩散收益

## 十三、宝箱伤害在模拟器中的处理

宝箱不吃爆裂和电弧扩散。

按当前真实逻辑：

- 子弹打宝箱只吃基础伤害
- 只有穿透会影响子弹是否继续飞

因此模拟器里：

- `normal / explode / chain` 打宝箱
  - 都按单次基础伤害计算
- `pierce`
  - 打中宝箱后仍可继续保留穿透逻辑

## 十四、首版实现建议

第一版模拟器不要一步做到完美，建议按以下顺序：

### 第 1 版

- 普通命中
- 敌人减伤
- 扇面覆盖
- 穿透纵深

### 第 2 版

- 爆裂邻域伤害
- 电弧跳链

### 第 3 版

- 根据敌群密度动态修正爆裂收益
- 根据目标分布动态修正电弧收益

## 十五、验收标准

模拟器的伤害模型是否合格，不看“每一颗子弹的轨迹是否完全一致”，而看以下结果是否与实际试玩趋势一致：

- 基础档位提升后，清怪速度是否同步提升
- 并发/连发增加后，中后期清怪和打箱能力是否同步变强
- 爆裂在密集波次下是否明显优于单体
- 电弧在中高密度波次下是否稳定收割
- 穿透在长列推进波次下是否价值更高
- 敌人减伤和开场护甲是否真实拉低有效输出

如果这些趋势一致，说明伤害模型已经足够支撑基线调优和参数搜索。
