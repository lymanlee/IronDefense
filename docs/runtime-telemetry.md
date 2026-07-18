# Runtime Telemetry

更新时间：2026-06-29

## 目的

这份说明用于验证真实游戏运行结果与 `tools/balance/` 模拟器结果是否接近。

当前已接入最小可用版 runtime trace，默认自动记录：

- 对局开始 / 结束
- 每波开始 / 结束
- 每波计划出怪数 / 实际出怪数 / 击杀数
- 玩家受伤总量 / 敌人受伤总量
- 宝箱生成 / 击毁
- 补给卡展示 / 刷新 / 选择

## 如何获取真实对局 trace

1. 启动 Cocos 预览并进入一局战斗
2. 打完一局后，在浏览器控制台执行：

```js
window.__BRIDGE_GUARD_RUNTIME_TRACE__
```

也可以直接取本地存储：

```js
JSON.parse(localStorage.getItem('bridge_guard_runtime_trace_latest_v1'))
```

## 当前 trace 结构

核心字段包括：

- `result`
- `failureWave`
- `currentWave`
- `kills`
- `totalEnemySpawned`
- `totalEnemyKilled`
- `totalEnemyDamage`
- `totalPlayerDamage`
- `waves`
- `chests`
- `supplyChoices`
- `events`

其中 `waves[]` 是后续和模拟器逐波对齐的主数据源。

## 当前已知限制

- 这版只做真实运行采集，还没有接 autoplay
- 这版还没有统一 `Math.random()` 到可注入 seed
- 因此目前适合做“趋势对比”和“逐波结果对比”，还不适合做严格的同 seed 逐局复现

## 下一步

下一步建议按这个顺序推进：

1. 统一真实运行时随机源
2. 增加 autoplay 策略执行
3. 输出 simulator trace 与 runtime trace 的 diff 报告
