# UI 素材升级方案（第一期）

## 目标

为当前项目补齐一套风格统一的 UI 图片素材，优先提升两个核心界面：

- 首页 `StartScreen`
- 游戏页 `HUD + GameLayer`

本期目标不是一次性重做全部界面，而是用一批高收益素材快速统一视觉气质，让首页更有吸引力、HUD 更有品质感、按钮和卡片更像同一套产品。

---

## 视觉方向

主题方向：`废土机甲`

关键词：

- 废土公路
- 装甲钢板
- 警示黄 / 灼热橙
- 沙尘与工业废墟
- 轻街机、重冲击

建议色板：

- 主背景深色：`#1A1715`
- 次背景棕灰：`#332A24`
- 主强调橙黄：`#F7A531`
- 高亮金：`#FFD36A`
- 危险红：`#FF5A4F`
- 冷色辅助蓝灰：`#6C7A86`

风格约束：

- 避免过度写实，保持“游戏宣传图 + UI 商业插画”之间的质感。
- 避免太强的赛博紫蓝光效，防止和当前战车题材脱节。
- 战斗区背景保持中低对比，不要抢敌人、子弹、战车主体。

---

## 场景与节点对应

### 首页

对应场景节点：

- `Canvas/Overlay/StartScreen/Bg`
- `Canvas/Overlay/StartScreen/HeroBlock/HeroPanel/HeroBackdrop`
- `Canvas/Overlay/StartScreen/StageCard`
- `Canvas/Overlay/StartScreen/ActionBlock/StartButton`
- `Canvas/Overlay/StartScreen/ActionBlock/GarageButton`
- `Canvas/Overlay/StartScreen/UtilityBar/DebugButton`

对应脚本：

- [assets/scripts/ui/StartScreen.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/ui/StartScreen.ts)

### 游戏页

对应场景节点：

- `Canvas/GameLayer`
- `Canvas/HUD/HUDBack`
- `Canvas/HUD/HPBar`
- `Canvas/HUD/ExpBar`
- `Canvas/HUD/WaveLabel`
- `Canvas/HUD/WeaponLabel`
- `Canvas/HUD/StageLabel`
- `Canvas/HUD/NextWaveNode`

对应脚本：

- [assets/scripts/ui/HUDController.ts](/Users/lymanli/Cocos/cocos-first-game/FirstGame/assets/scripts/ui/HUDController.ts)

---

## 第一批素材清单

建议先做 12 张，足够完成首页和游戏页第一轮升级。

### A. 首页主视觉

1. `start-bg-wasteland-v1.png`
- 用途：首页全屏背景
- 建议尺寸：`1536 x 2730`
- 透明底：否
- 说明：纵版主视觉，中央偏上留标题安全区，下方留按钮空间。

2. `start-hero-panel-v1.png`
- 用途：首页 Hero 区装饰底板
- 建议尺寸：`1200 x 900`
- 透明底：是
- 说明：金属面板 + 柔和发光边缘，承接标题与副标题。

### B. 游戏战场

3. `battle-bg-road-v1.png`
- 用途：游戏战场底图
- 建议尺寸：`1536 x 2688`
- 透明底：否
- 说明：竖版道路/荒漠/工业残骸构图，中间干净，两侧更有细节。

### C. HUD 组件

4. `hud-panel-top-v1.png`
- 用途：HUD 顶部信息底板
- 建议尺寸：`1200 x 260`
- 透明底：是
- 说明：半透明深色金属板，可作为 `HUDBack`。

5. `hud-bar-frame-v1.png`
- 用途：血条/进度条外框
- 建议尺寸：`512 x 64`
- 透明底：是
- 说明：适合 `9-slice`。

6. `hud-bar-fill-hp-v1.png`
- 用途：血条填充
- 建议尺寸：`512 x 32`
- 透明底：是
- 说明：暖黄到橙红的能量感填充。

7. `hud-bar-fill-progress-v1.png`
- 用途：击杀进度填充
- 建议尺寸：`512 x 32`
- 透明底：是
- 说明：偏金色或冷黄，和血条有区分。

### D. HUD 图标

8. `icon-hp-v1.png`
- 用途：血量图标
- 建议尺寸：`128 x 128`
- 透明底：是

9. `icon-wave-v1.png`
- 用途：波次图标
- 建议尺寸：`128 x 128`
- 透明底：是

10. `icon-weapon-v1.png`
- 用途：武器模式图标
- 建议尺寸：`128 x 128`
- 透明底：是

11. `icon-stage-v1.png`
- 用途：关卡图标
- 建议尺寸：`128 x 128`
- 透明底：是

12. `icon-warning-v1.png`
- 用途：下一波 / 危险提示图标
- 建议尺寸：`128 x 128`
- 透明底：是

### E. 按钮与卡片

这一组建议和上面并行为第二小批，首页替换收益很高。

13. `btn-primary-v1.png`
- 用途：开始游戏主按钮
- 建议尺寸：`640 x 180`
- 透明底：是
- 说明：适合 `9-slice`，高亮橙黄。

14. `btn-secondary-v1.png`
- 用途：车库 / 次级操作按钮
- 建议尺寸：`520 x 150`
- 透明底：是
- 说明：深金属灰 + 橙色细边。

15. `btn-arrow-v1.png`
- 用途：选关左右箭头按钮
- 建议尺寸：`140 x 140`
- 透明底：是

16. `stage-card-v1.png`
- 用途：首页关卡卡片背景
- 建议尺寸：`980 x 420`
- 透明底：是
- 说明：半透明金属卡片，带轻微磨损边缘与内发光。

---

## 推荐资源目录

建议按用途放置，方便后续替换和版本迭代：

```text
assets/resources/ui/start/
assets/resources/ui/game/
assets/resources/ui/hud/
assets/resources/ui/common/
```

推荐归档：

- `assets/resources/ui/start/start-bg-wasteland-v1.png`
- `assets/resources/ui/start/start-hero-panel-v1.png`
- `assets/resources/ui/game/battle-bg-road-v1.png`
- `assets/resources/ui/hud/hud-panel-top-v1.png`
- `assets/resources/ui/hud/hud-bar-frame-v1.png`
- `assets/resources/ui/hud/hud-bar-fill-hp-v1.png`
- `assets/resources/ui/hud/hud-bar-fill-progress-v1.png`
- `assets/resources/ui/common/icon-hp-v1.png`
- `assets/resources/ui/common/icon-wave-v1.png`
- `assets/resources/ui/common/icon-weapon-v1.png`
- `assets/resources/ui/common/icon-stage-v1.png`
- `assets/resources/ui/common/icon-warning-v1.png`
- `assets/resources/ui/common/btn-primary-v1.png`
- `assets/resources/ui/common/btn-secondary-v1.png`
- `assets/resources/ui/common/btn-arrow-v1.png`
- `assets/resources/ui/start/stage-card-v1.png`

---

## 生成提示词

下面的提示词默认用于图片生成，风格已经统一到本项目的废土机甲主题。

### 1. 首页背景图

```text
Use case: stylized-concept
Asset type: mobile game start screen background
Primary request: Create a vertical key art background for a top-down survival car combat game.
Scene/backdrop: post-apocalyptic desert highway, ruined industrial structures, drifting dust, distant enemy silhouettes, dramatic sunset haze
Subject: a rugged armored battle car ready for combat
Composition: portrait layout, strong center focus, leave a clean title-safe area in the upper-middle, leave clear button-safe space in the lower third
Style: polished game promotional illustration, stylized realism, wasteland mech aesthetic
Lighting: warm orange sunset rim light, dusty atmosphere, subtle cinematic contrast
Color palette: dark brown, steel gray, amber orange, warning yellow, muted sand
Quality bar: premium mobile game key art
Avoid: text, logo, watermark, UI elements, excessive clutter in the center, purple cyberpunk lighting
Output: 1536x2730
```

### 2. 首页 Hero 底板

```text
Use case: stylized-concept
Asset type: UI hero panel background with transparency
Primary request: Create a decorative sci-fi wasteland metal panel for a mobile game home screen hero section.
Scene/backdrop: transparent background
Subject: layered armored panel, industrial metal frame, subtle glow strips, soft dust wear, inner plate for title and subtitle
Composition: wide rectangular panel, symmetrical, visually strong center, open readable middle area
Style: clean game UI illustration, wasteland industrial, premium mobile HUD art
Lighting: soft amber highlights, restrained metallic reflections
Color palette: burnt metal, dark steel, amber orange, worn brass
Quality bar: production-ready game UI
Avoid: text, logo, characters, busy center details
Output: 1200x900
```

### 3. 游戏战场底图

```text
Use case: stylized-concept
Asset type: mobile game battle background
Primary request: Create a vertical battlefield background for a top-down survival shooter car game.
Scene/backdrop: cracked wasteland road, sand, debris, warning paint marks, broken machine parts near the edges
Subject: environment only, no characters
Composition: center lane visually clean for gameplay, detail concentrated near left and right borders, top-to-bottom readable flow
Style: stylized game environment background, slightly painterly but clear
Lighting: sun-baked daylight with soft dust haze
Color palette: sand brown, dark asphalt, rust orange, faded yellow
Quality bar: gameplay-first background art
Avoid: high-contrast focal objects in the center, text, logos, large shadows that look like enemies
Output: 1536x2688
```

### 4. HUD 顶板

```text
Use case: stylized-concept
Asset type: HUD panel background with transparency
Primary request: Create a premium top HUD panel for a mobile wasteland combat game.
Scene/backdrop: transparent background
Subject: wide semi-transparent armored plate, beveled metal frame, subtle warning accents, readable center
Composition: horizontal strip, balanced left-right, suitable for wave, hp, weapon and stage info
Style: polished mobile game HUD, clean and readable
Lighting: controlled metallic highlights, light amber glow
Color palette: dark gunmetal, brass, amber accents
Quality bar: production-ready UI asset
Avoid: text, icons, excessive glow, noisy scratches
Output: 1200x260
```

### 5. 条框与填充

```text
Use case: stylized-concept
Asset type: HUD progress bar frame with transparency
Primary request: Create a metallic UI progress bar frame for a mobile wasteland combat game.
Scene/backdrop: transparent background
Subject: rounded rectangular bar frame, beveled industrial edges, subtle mechanical detail, center opening for fill
Composition: long horizontal frame, clean silhouette, supports 9-slice scaling
Style: premium readable game HUD asset
Lighting: restrained highlights
Color palette: dark steel, muted brass
Quality bar: production-ready UI asset
Avoid: text, icons, heavy weathering, asymmetry
Output: 512x64
```

HP 填充：

```text
Use case: stylized-concept
Asset type: HUD health bar fill with transparency
Primary request: Create an energy bar fill texture for player health in a wasteland combat game.
Scene/backdrop: transparent background
Subject: sleek horizontal energy fill, warm yellow to orange gradient, subtle internal glow, readable at small size
Composition: long clean strip
Style: arcade combat UI
Lighting: emissive but controlled
Color palette: golden yellow, orange, red-orange
Avoid: frame, text, icons
Output: 512x32
```

进度填充：

```text
Use case: stylized-concept
Asset type: HUD progress bar fill with transparency
Primary request: Create a stage progress bar fill texture for a wasteland combat game.
Scene/backdrop: transparent background
Subject: sleek horizontal fill, rich gold with subtle animated-energy feel, highly readable at small size
Composition: long clean strip
Style: premium arcade HUD
Lighting: soft internal glow
Color palette: gold, yellow, pale amber
Avoid: frame, text, icons
Output: 512x32
```

### 6. HUD 图标

统一提示词模板：

```text
Use case: stylized-concept
Asset type: game HUD icon with transparency
Primary request: Create a single premium HUD icon for a post-apocalyptic armored car combat game.
Scene/backdrop: transparent background
Subject: [replace with target icon]
Composition: centered icon, bold silhouette, readable at small size
Style: polished game UI icon, wasteland industrial, slightly embossed
Lighting: subtle amber highlight, controlled metallic edge light
Color palette: dark steel, brass, amber, warning orange
Quality bar: production-ready mobile game icon
Avoid: text, logo, multiple objects, cluttered silhouette
Output: 128x128
```

图标主题替换建议：

- `icon-hp`：armored heart core or reinforced medical battery
- `icon-wave`：radio pulse beacon or hazard radar ring
- `icon-weapon`：autocannon barrel cluster
- `icon-stage`：worn mission badge or plated checkpoint marker
- `icon-warning`：hazard triangle with industrial siren motif

### 7. 按钮

主按钮：

```text
Use case: stylized-concept
Asset type: primary game button with transparency
Primary request: Create a large primary action button for a mobile wasteland combat game.
Scene/backdrop: transparent background
Subject: wide industrial button plate, bold orange-yellow glow core, armored metallic shell, premium call-to-action shape
Composition: horizontal button, centered, readable silhouette, suitable for 9-slice
Style: polished mobile game UI
Lighting: warm glow center, metallic edge highlights
Color palette: amber, gold, dark steel
Quality bar: production-ready UI asset
Avoid: text, icon, overly realistic materials, tiny fragile details
Output: 640x180
```

次按钮：

```text
Use case: stylized-concept
Asset type: secondary game button with transparency
Primary request: Create a secondary action button for a mobile wasteland combat game.
Scene/backdrop: transparent background
Subject: metal button with restrained orange accent lines, darker body, sturdy industrial silhouette
Composition: horizontal button, centered, supports 9-slice
Style: polished mobile game UI
Lighting: restrained metallic highlights
Color palette: gunmetal, worn brass, dim amber accents
Quality bar: production-ready UI asset
Avoid: text, icon, excessive glow
Output: 520x150
```

箭头按钮：

```text
Use case: stylized-concept
Asset type: arrow navigation button with transparency
Primary request: Create a square arrow navigation button for stage selection in a mobile wasteland combat game.
Scene/backdrop: transparent background
Subject: armored square button with inset arrow motif, industrial warning accents
Composition: centered, compact, readable at small size
Style: premium game UI button
Lighting: controlled highlight and faint amber glow
Color palette: dark steel, amber, brass
Quality bar: production-ready UI asset
Avoid: text, extra symbols, over-detailing
Output: 140x140
```

### 8. 关卡卡片

```text
Use case: stylized-concept
Asset type: stage card background with transparency
Primary request: Create a premium stage selection card for a mobile post-apocalyptic car combat game.
Scene/backdrop: transparent background
Subject: wide industrial card plate, layered armor edges, soft amber inner glow, readable center panel for stage text and metadata
Composition: wide rectangular card, clean center, slightly richer detail on corners
Style: polished mobile game selection UI
Lighting: subtle warm highlights
Color palette: dark steel, rust brown, brass, amber
Quality bar: production-ready UI asset
Avoid: text, logos, emblem overload, clutter in the center
Output: 980x420
```

---

## Cocos 接入建议

### 首页

- `Bg` 直接替换为新的纵版背景图。
- `HeroBackdrop` 使用透明底装饰板图。
- `StageCard` 改为独立 spriteframe，并设置 `9-slice`。
- `StartButton`、`GarageButton`、`PrevStageButton`、`NextStageButton` 全部替换为独立按钮底图。

### 游戏页

- `HUDBack` 替换为顶部 HUD 板。
- `HPBarBg / HPBarFill / ExpBarBg / ExpBarFill` 换成统一风格条框。
- `WaveLabel`、`WeaponLabel`、`StageLabel`、`NextWaveNode` 前面可补一个图标节点，让 HUD 更完整。

### 导入规则

- 背景图保持普通 Sprite。
- 按钮、卡片、条框统一启用 `SpriteFrame + sliced`。
- 图标尽量使用透明底 PNG，统一边缘留白。

---

## 第一轮实施顺序

推荐按这个顺序做，收益最高：

1. 首页背景图
2. 游戏战场底图
3. 主按钮 / 次按钮 / 箭头按钮
4. HUD 顶板与条框
5. HUD 图标
6. StageCard

---

## 下一步

如果开始生成素材，建议直接分两轮：

### 第一轮

- `start-bg-wasteland-v1.png`
- `battle-bg-road-v1.png`
- `btn-primary-v1.png`
- `btn-secondary-v1.png`
- `btn-arrow-v1.png`

### 第二轮

- `hud-panel-top-v1.png`
- `hud-bar-frame-v1.png`
- `hud-bar-fill-hp-v1.png`
- `hud-bar-fill-progress-v1.png`
- `icon-hp-v1.png`
- `icon-wave-v1.png`
- `icon-weapon-v1.png`
- `icon-stage-v1.png`
- `icon-warning-v1.png`
- `stage-card-v1.png`

如果需要，我下一步可以直接开始生成第一轮素材，并把选中的成品放到项目资源目录。
