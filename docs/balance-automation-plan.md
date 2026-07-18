# 数值调优自动化方案

更新时间：2026-06-25

## 一、目标

这份方案用于给当前项目建立一套可持续复用的数值调优流程，重点解决以下问题：

- 数值系统来源较多：战车基础档位、敌人模板、关卡倍率、宝箱血量、补给卡成长、武器分支
- 体验目标容易冲突：前期不能劝退，中期要有取舍，后期不能无脑滚穿
- 仅靠手动试玩调参成本高，且难以定位“到底是哪一层参数出了问题”

目标不是完全用脚本替代试玩，而是建立：

- 可批量筛掉明显失衡配置的离线模拟
- 可回归对比的统一指标
- 可在当前仓库持续演进的工具结构

## 二、适配当前项目的原则

结合当前项目代码结构，数值调优方案遵守以下原则：

- `GameConfig.ts` 仍然是唯一数值源
- 不直接驱动 Cocos 场景，不依赖渲染和节点
- 使用离线模拟器复现关键战斗决策，而不是 1:1 复刻所有表现细节
- 先覆盖最关键的数值闭环，再逐步细化

当前项目最重要的数值闭环是：

1. 基础火力档位决定开局模板
2. 波次配置决定敌人构成和基础压力
3. 关卡倍率决定每波敌人强度曲线
4. 宝箱规则决定局内成长机会
5. 补给卡和武器分支决定中后期火力膨胀速度
6. 最终输出为通关率、失败波次、宝箱取舍和构筑结果

## 三、建议的调优目标

自动化前必须先定义目标体验，否则工具只能算数，不能判断好坏。

### 3.1 前期目标

- 新玩家即使第一时间没理解“打宝箱”也不应高概率死在第 1 波
- 第 1 到第 3 波要建立基础爽感，而不是立即进入数值惩罚
- 第一个宝箱应该能形成“值得打”的认知，但不能轻易白拿

建议目标：

- 第 1 波通过率：85% 到 95%
- 第 3 波通过率：65% 到 80%
- 第一个宝箱击毁率：40% 到 70%

### 3.2 中期目标

- 玩家开始在清怪和抢宝箱之间做取舍
- 武器分支和补给成长应开始明显影响体感
- 宝箱不能全部顺手打掉，否则成长会失控

建议目标：

- 第 6 波通过率：45% 到 65%
- 第 2 到第 4 个宝箱平均击毁数：1.5 到 2.5
- 首次分支出现波次：第 4 到第 7 波

### 3.3 后期目标

- 成型构筑可以明显更强，但不能无脑压平全部波次
- 稀有/传奇宝箱必须“高收益 + 高投入”
- 不应出现“前期拿满宝箱后，后面完全不需要决策”的滚雪球失衡

建议目标：

- 通关率：20% 到 40%
- 第 9 到第 12 波平均车体剩余血量占比：15% 到 45%
- 稀有/传奇宝箱击毁率：20% 到 50%

## 四、建议监控的核心指标

自动化不需要一开始就覆盖所有维度，先监控最关键的 12 项。

### 4.1 生存指标

- `wave_1_pass_rate`
- `wave_3_pass_rate`
- `wave_6_pass_rate`
- `clear_rate`
- `avg_failure_wave`

### 4.2 战斗压力指标

- `avg_player_hp_pct_end_wave_n`
- `avg_damage_taken_per_wave`
- `avg_enemies_leaked_to_rail`

### 4.3 宝箱指标

- `avg_chests_spawned`
- `avg_chests_destroyed`
- `destroy_rate_by_quality.normal`
- `destroy_rate_by_quality.elite`
- `destroy_rate_by_quality.rare`
- `destroy_rate_by_quality.legendary`
- `avg_chest_ttk_by_quality`

### 4.4 成长指标

- `avg_supply_cards_picked`
- `avg_supply_star`
- `first_evolution_wave_avg`
- `final_damage_multiplier_avg`
- `final_fire_rate_multiplier_avg`
- `final_multishot_avg`
- `final_spread_count_avg`

### 4.5 失衡指标

- `snowball_index`
- `dominant_card_pick_rate`
- `dominant_strategy_gap`

其中：

- `snowball_index`
  - 可定义为“后 3 波平均清怪速度 / 前 3 波平均清怪速度”
  - 值过高说明局内成长过度膨胀

- `dominant_card_pick_rate`
  - 某张补给卡被 AI 选择的占比
  - 如果长期显著高于其他卡，通常说明卡池失衡

- `dominant_strategy_gap`
  - 不同策略 AI 的通关率差距
  - 如果某一种策略远超其他策略，说明系统存在单一路线最优

## 五、需要纳入自动搜索的参数

首轮不要把所有参数都纳入搜索，否则维度太高，结果难解释。

建议优先搜索以下参数：

### 5.1 敌人强度曲线

- `stages[].enemyHpScaleByWave`
- `stages[].enemyAtkScaleByWave`
- `stages[].enemySpeedScaleByWave`

### 5.2 宝箱曲线

- `stages[].chestHpMultiplierByWave`
- `gameplay.supply.chest.baseHpFactor`
- `gameplay.supply.chest.qualityHpMultiplier`
- `gameplay.supply.chest.serialGrowth`
- `gameplay.supply.chest.baseSpawnDelay`
- `gameplay.supply.chest.maxSelectionsPerRun`

### 5.3 分支与成长门槛

- `gameplay.weaponEvolution.unlockLevel`
- `gameplay.weaponEvolution.minChestSerialToOffer`
- `gameplay.supply.starRules`
- `gameplay.supply.choiceCount`

### 5.4 暂不建议首轮自动搜索的参数

- `waveDefs.entries.count`
- `enemyTypes` 下每个敌种的全部倍率
- 单张补给卡具体强度

这些参数先保持手调，因为它们直接改变玩法语义，不适合在第一阶段交给自动搜索。

## 六、离线模拟器的推荐结构

建议模拟器采用“时间步进 + 决策简化”的方式，而不是纯公式估算。

### 6.1 模拟精度

建议使用固定步长：

- `dt = 0.1s`

这已经足够观察：

- 敌人推进压力
- 宝箱出现与击破
- 玩家切目标损失
- 补给卡成长后的曲线变化

无需模拟：

- 实际子弹飞行轨迹
- 命中特效
- 画面播放节奏
- 节点动画

### 6.2 每次模拟保留的状态

- 当前波次
- 当前时间
- 玩家血量
- 当前基础火力档位
- 当前武器分支
- 当前局内补给增益
- 场上敌人列表
- 场上宝箱列表
- 已获得补给历史

### 6.3 敌人简化模型

每个敌人保留：

- `hp`
- `speed`
- `atk`
- `timeToRail`
- `enemyType`
- `reward`

敌人不需要精确坐标，只需要知道：

- 距离护栏还有多久
- 是否已经到攻击区
- 是否应被玩家优先锁定

### 6.4 宝箱简化模型

每个宝箱保留：

- `quality`
- `hp`
- `serial`
- `spawnTime`
- `timeToStop`
- `ttk_if_targeted`

重点不是空间位置，而是：

- 玩家是否愿意切去打它
- 切去打它要损失多少清怪时间

### 6.5 玩家火力简化模型

玩家当前 DPS 不直接写死为一个数，而是按当前构筑推导：

- 基础伤害来自 `weaponTierSystem`
- 基础射速来自 `weaponTierSystem`
- 连发/并发来自 `weaponTierSystem.firePattern + 补给加成`
- 分支收益通过行为修正系数近似

建议先做一版近似 DPS：

```ts
effectiveDps =
  baseDamage
  * damageMultiplier
  * effectiveShotsPerSecond
  * branchDpsFactor
```

其中：

- `effectiveShotsPerSecond`
  - 综合基础射速、连发、并发和局内射速加成

- `branchDpsFactor`
  - 用经验系数近似分支收益
  - 首版不追求精确，只求相对正确

## 七、玩家策略模型

自动化价值的关键在于：不要只模拟一种“完美玩家”。

建议首版至少实现 4 种策略：

### 7.1 保守型

- 优先清怪
- 只有当场上压力低于阈值时才打宝箱
- 补给优先选稳定增伤和射速

适合模拟新手或风险厌恶玩家。

### 7.2 贪箱型

- 宝箱出现后优先转火
- 即使前排有压力，也会尝试抢宝箱
- 补给偏向高星和成长型卡

适合检验滚雪球上限是否过高。

### 7.3 平衡型

- 根据敌人压力和宝箱品质动态切换目标
- 稀有/传奇宝箱更容易触发抢箱行为
- 补给偏向当前流派协同

这是最接近主设计目标的基准策略。

### 7.4 高手型

- 会更积极利用控制卡窗口
- 会优先争取高价值宝箱
- 对分支卡和协同卡有明确偏好

适合评估系统上限。

## 八、补给卡选择逻辑

当前项目的补给卡效果较多，但离线模拟不需要还原全部细节。

建议分三类处理：

### 8.1 可精确累加的火力卡

- `damageMultiplier`
- `fireRateMultiplier`
- `projectileSpeedMultiplier`
- `multiShotAdd`
- `spreadCountAdd`
- `explodeRadiusMultiplier`
- `pierceAdd`
- `chainAdd`
- `chainRangeMultiplier`

这类直接进入构筑状态。

### 8.2 战术型即时卡

- `freezeAll`
- `shockwave`
- `airstrike`
- `shield`

这类不必 1:1 模拟视觉，只要用“减少一段时间内的场压”来近似。

例如：

- `freezeAll`
  - 视作在 `seconds` 内敌人推进和攻击暂停
- `shockwave`
  - 视作全场敌人后退一段等效时间并承受一次伤害
- `airstrike`
  - 视作对随机若干敌人或全场敌人造成一次范围伤害

### 8.3 分支卡

- `weaponEvolution`

这类只负责切换流派状态，不直接给数值。

## 九、搜索与优化方法

### 9.1 第一阶段：基线回放

先固定当前配置，跑多组不同玩家策略，输出基线报告。

目标：

- 明确当前真实问题是“前期劝退”还是“中后期滚穿”
- 避免无目标搜索

建议：

- 每种策略跑 `200~500` 局

### 9.2 第二阶段：随机搜索

对核心参数做随机采样。

原因：

- 比网格搜索更省
- 对当前这种参数维度较多的项目更实用

建议：

- 采样 `300~800` 组参数
- 每组参数跑 4 种策略，每种 `80~150` 局

### 9.3 第三阶段：局部细化

从随机搜索结果中选前 `10~20` 组，再围绕它们做小范围扰动。

用于：

- 微调前期通过率
- 压制后期滚雪球
- 调整宝箱收益/风险平衡

### 9.4 暂不建议首轮引入复杂算法

例如：

- 遗传算法
- 贝叶斯优化
- 强化学习搜索

这些不是不能做，而是当前项目还没到必须用它们的阶段。先用随机搜索和局部搜索就够了。

## 十、评分函数建议

自动搜索要有统一评分函数，否则只能得到大量原始结果。

建议使用“目标偏差 + 惩罚项”的形式：

```ts
score =
  a1 * abs(wave1PassRate - target.wave1PassRate)
  + a2 * abs(wave3PassRate - target.wave3PassRate)
  + a3 * abs(clearRate - target.clearRate)
  + a4 * abs(avgChestDestroyed - target.avgChestDestroyed)
  + a5 * abs(firstEvolutionWave - target.firstEvolutionWave)
  + a6 * snowballPenalty
  + a7 * dominantCardPenalty
  + a8 * strategyGapPenalty
```

建议惩罚项定义：

- `snowballPenalty`
  - 若后期清怪效率远高于前期过多，则加罚

- `dominantCardPenalty`
  - 若某张卡被选择的占比长期高于阈值，则加罚

- `strategyGapPenalty`
  - 若某一策略通关率显著高于其他策略，则加罚

## 十一、建议的脚本结构

结合当前项目现有工具目录，建议把自动化脚本放在 `tools/balance/` 下。

推荐结构：

```text
tools/
  balance/
    balance_types.js
    balance_config_loader.js
    balance_simulator.js
    balance_strategies.js
    balance_metrics.js
    balance_runner.js
    balance_sweep.js
    balance_report.js
outputs/
  balance/
    baseline/
    sweep/
    reports/
```

### 11.1 `balance_config_loader.js`

职责：

- 读取当前 `GameConfig` 的关键数值快照
- 接收参数覆盖项
- 生成一份用于模拟的纯数据对象

### 11.2 `balance_simulator.js`

职责：

- 执行单局离线模拟
- 输出单局结果

### 11.3 `balance_strategies.js`

职责：

- 定义不同 AI 决策策略
- 决定何时打宝箱、何时清怪、何时偏好控制卡

### 11.4 `balance_metrics.js`

职责：

- 聚合多局结果
- 计算通过率、宝箱击毁率、雪崩指数等指标

### 11.5 `balance_runner.js`

职责：

- 对一组参数跑完整批次
- 输出原始 JSON

### 11.6 `balance_sweep.js`

职责：

- 生成参数组合
- 批量调用 `balance_runner`
- 写入结果目录

### 11.7 `balance_report.js`

职责：

- 将结果整理成 Markdown / CSV 排行榜
- 输出最优参数集和关键指标

## 十二、建议的输出格式

每次批量调优至少产出 3 类文件：

### 12.1 原始结果 JSON

用于后续复盘和二次分析。

```json
{
  "seed": 42,
  "strategy": "balanced",
  "runs": 120,
  "params": { "...": "..." },
  "metrics": { "...": "..." }
}
```

### 12.2 排行榜 CSV

用于快速筛选前 20 组参数。

字段建议：

- `rank`
- `score`
- `wave1PassRate`
- `wave3PassRate`
- `clearRate`
- `avgChestDestroyed`
- `firstEvolutionWave`
- `snowballIndex`

### 12.3 Markdown 汇总

用于直接阅读和人工决策。

建议包含：

- 当前基线结果
- 最优参数前 10 名
- 与当前线上配置相比的差异
- 推荐人工试玩名单

## 十三、推荐落地顺序

### 第 1 步

先只做基线工具：

- `balance_config_loader`
- `balance_simulator`
- `balance_runner`

目标是回答：

- 当前配置到底卡在哪里

### 第 2 步

加入：

- `balance_metrics`
- `balance_report`

目标是形成稳定回归报告。

### 第 3 步

再加入：

- `balance_sweep`
- 参数随机采样

目标是开始半自动筛配置。

### 第 4 步

等第一轮调优完成后，再考虑：

- 单卡强度自动搜索
- 分支收益曲线搜索
- 多关卡联合平衡

## 十四、人工验收规则

自动化只能筛数值，不能代替手感判断。

建议每轮搜索后，人工只试玩前 `5~10` 组参数，并重点检查：

- 第一波是否仍有压迫感但不劝退
- 中期是否真的出现“打箱还是清怪”的取舍
- 高品质宝箱是否值得抢
- 分支首次出现时机是否自然
- 后期是否仍然存在临场风险

如果自动评分高，但人工试玩觉得无聊，仍然应判为不合格。

## 十五、对当前项目的直接建议

当前项目第一轮自动化最值得优先观察的几个问题：

- 第 1 波到第 3 波是否过于依赖“理解宝箱机制”
- 第 3 到第 5 个宝箱是否导致成长失控
- `fireRate`、`multiShot`、`spreadCount` 哪一项对雪球影响最大
- `unlockLevel` 和 `minChestSerialToOffer` 是否让分支出现得过早或过晚
- 稀有/传奇宝箱的投入产出比是否足够明显

因此，建议第一轮搜索只围绕这 8 类参数：

- `enemyHpScaleByWave`
- `enemyAtkScaleByWave`
- `chestHpMultiplierByWave`
- `baseHpFactor`
- `qualityHpMultiplier`
- `serialGrowth`
- `unlockLevel`
- `minChestSerialToOffer`

## 十六、结论

这套自动化方案的核心不是“让机器帮你直接调出最佳数值”，而是：

- 先把体验目标量化
- 再把当前配置批量回放
- 用脚本筛掉明显失衡配置
- 最后保留人工试玩做体验判断

对于当前项目，这是一条投入产出比最高的路径。

后续如果开始实现，建议第一步先完成：

- `tools/balance/balance_runner.js`
- `tools/balance/balance_simulator.js`
- `docs/balance-baseline-report.md`

先让项目具备“跑一组配置，输出统一指标”的能力，再做参数搜索。
