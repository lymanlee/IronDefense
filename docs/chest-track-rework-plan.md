# 宝箱与战场分区改造方案

## 当前问题

- 当前宝箱不是场景物件，而是 [SupplyChest.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/components/SupplyChest.ts) 里用 `Graphics` 绘制的圆角卡片。
- 宝箱的红蓝卡片式外观更像悬浮 UI，不像废土公路上的补给实体。
- 地图视觉上没有明确告诉玩家“左侧是补给轨道，右侧是敌军推进轨道”，但逻辑上已经有这层含义。

## 现有逻辑基础

- 宝箱轨道已经预留为 `laneIndex: 0`，见 [GameConfig.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/data/GameConfig.ts:434)。
- 敌人生成已经从 `enemyStartLaneIndex: 1` 开始，见 [GameConfig.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/data/GameConfig.ts:451)。
- 刷怪逻辑已避开左侧保留道，见 [WaveManager.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/managers/WaveManager.ts:259)。
- 宝箱轨道位置和停靠槽位也已经单独计算，见 [GameManager.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/managers/GameManager.ts:2467)。

## 推荐方案

### 1. 宝箱先改成废土机械补给箱

方向：

- 深灰金属箱体
- 橙黄警示条
- 小面积冷蓝能量锁芯
- 包角、铆钉、磨损漆面、尘土覆盖
- 正面不再展示大段文字

类型区分：

- 火力补给：橙红点缀
- 控制补给：青蓝点缀
- 稀有补给：紫金点缀

显示建议：

- 箱体本身用 `SpriteFrame`
- 上方保留小型标题标签
- HP 显示改成箱体上方短血条，不在箱体正面显示大数字

### 2. 地图改成“左侧补给服务道 + 右侧敌人主战道”

不要做成左右对半的两个大区域，推荐：

- 左侧 `20% - 25%`：补给服务道
- 右侧 `75% - 80%`：敌军主战区

视觉表达：

- 左侧补给道更窄，更规整，带维修/输送属性
- 右侧主战道更宽，更破碎，更脏
- 中间用磨损黄线、低矮隔离桩、路肩分色做弱分隔

这样能保留当前玩法节奏，又让玩家一眼理解宝箱为何总从左侧进场并停靠。

## 第一批建议素材

### 宝箱素材

1. `supply-chest-sheet-v2.png`
- 用途：一张图合并常规/精英/稀有/破损四个状态
- 建议尺寸：`1536 x 1024`
- 透明底：是
- 布局：横向四格或 2x2

2. `supply-chest-shadow-v1.png`
- 用途：箱体投影或落地阴影
- 建议尺寸：`512 x 256`
- 透明底：是

3. `supply-chest-badge-sheet-v1.png`
- 用途：火力/控制/稀有小徽记
- 建议尺寸：`768 x 256`
- 透明底：是

### 地图素材

4. `battle-bg-road-supply-lane-v2.png`
- 用途：战场背景主图
- 建议尺寸：`1536 x 2688`
- 透明底：否
- 构图：左侧补给服务道，右侧敌军主战区，中间弱分隔

5. `battle-divider-lane-v1.png`
- 用途：中间轨道分隔装饰，可选
- 建议尺寸：`512 x 2048`
- 透明底：是

## 推荐实现顺序

### 第一阶段：只改视觉，不改玩法

- 替换宝箱为 spriteframe / prefab 方案
- 保持左 1 列宝箱、右 4 列敌人的现有逻辑
- 替换战场背景为分区明确的新地图

收益最高，风险最低。

### 第二阶段：再补地面辅助元素

- 给左侧补给道增加停靠标记、导流箭头、编号
- 给中间分隔区增加隔离墩/路肩/警示线
- 让宝箱轨道“解释成立”

### 第三阶段：必要时再强化玩法边界

- 敌人永不进入左侧补给道
- 宝箱只在左侧纵向停靠
- 补给道加入专属掉落/特效

## 实现落点

### 宝箱

- 主要重构文件：[SupplyChest.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/components/SupplyChest.ts)
- 目标：从 `Graphics` 绘制切换到 `Sprite + 小血条 + 标签` 结构

### 背景

- 当前背景是程序绘制：[BackgroundRenderer.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/components/BackgroundRenderer.ts)
- 建议路径：
  - 方案 A：继续保留 `BackgroundRenderer`，但重画桥面结构，明确左侧补给服务道
  - 方案 B：改为战场底图 `SpriteFrame`，视觉上限更高

优先建议 `方案 B`，因为当前首页和 HUD 已经在走素材化路线，战场背景继续程序绘制会拖住整体质感。

## 下一步建议

1. 先生成 `supply-chest-sheet-v2.png`
2. 再生成 `battle-bg-road-supply-lane-v2.png`
3. 落地 `SupplyChest` 的 prefab / sprite 结构
4. 最后根据新地图微调 `laneIndex` 视觉定位
