# 12AI 图片生成工作流

## 目标

沉淀项目内已经验证成功的 12AI 生图调用方式，避免再次因为代理返回格式不一致而导致脚本失败。

## 结论

- 走 `12AI` 代理时，优先使用项目脚本 [scripts/generate_third_batch.py](/Users/lymanli/Cocos/cocos-first-game/FirstGame/scripts/generate_third_batch.py)。
- 请求体要显式带上 `response_format: "b64_json"`。
- 不要默认走外部 `image_gen.py generate-batch` 这条路径，因为不同代理可能返回 `url`、`b64_json` 或其他字段组合，容易和现有批处理假设不一致。

## 环境变量

将密钥放在项目根目录的 `.env.local`：

```bash
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://cdn.12ai.org/v1
```

## 推荐命令

```bash
python3 scripts/generate_third_batch.py \
  --input tmp/imagegen/hud-refresh-prompts.jsonl \
  --out-dir output/imagegen/hud-refresh
```

也可以继续使用 [scripts/run-imagegen-batch.sh](/Users/lymanli/Cocos/cocos-first-game/FirstGame/scripts/run-imagegen-batch.sh)。
当 `OPENAI_BASE_URL` 指向 `12ai.org` 时，该脚本现在会自动转发到项目本地生成脚本。

## 成功原因

[scripts/generate_third_batch.py](/Users/lymanli/Cocos/cocos-first-game/FirstGame/scripts/generate_third_batch.py) 已经做了两层兼容：

- 请求阶段强制 `response_format: "b64_json"`
- 解析阶段同时兼容 `b64_json`、`image_base64`、`base64`，并在必要时回退下载 `url`

## 后处理建议

- 生成完成后，不要直接把原始大图挂到 HUD 或按钮节点上。
- 先做裁切、去除外围底色、按目标节点比例压缩，再导入到 `assets/resources/ui/...`。
- HUD 刷新素材当前使用 [scripts/prepare_hud_refresh_assets.py](/Users/lymanli/Cocos/cocos-first-game/FirstGame/scripts/prepare_hud_refresh_assets.py) 进行后处理。
- 对于帧表图、特效合集图、角色多姿态 sheet，不要默认按规则网格硬切。必须先验证每格内容是否真的独立。
- 先检查每个格子的 alpha 包围盒。如果内容已经贴边，或者跨过分割线，继续按网格硬切通常会得到“不完整的一帧”。
- 一旦发现跨格，不要在 Cocos 里靠 `Trim` 兜底，也不要继续微调切图参数赌运气。优先改为：
  1. 从整张图里提取独立连通区域，导出成单帧。
  2. 如果连通区域仍不稳定，直接改成“单张单资产生成”，不要再坚持用合集图。
- 对于炮口火光、爆炸、粒子、能量波纹这类高亮特效，模型很容易让图形越过格子边界。这类素材优先考虑“独立单帧提取”或“单张单资产”。
- 当前项目的已验证经验：
  - `tank-muzzle-flash-sheet-v1.png` 和 `tank-muzzle-clean-sheet-v1.png` 都不适合按固定网格硬切。
  - 更稳的做法是从整张图中提取独立火光，再输出到单独目录，例如 `assets/resources/car_fx/muzzle_v2/`。
  - 如果以后还需要从类似合集图切多帧，先复用 [scripts/prepare_muzzle_clean_assets.py](/Users/lymanli/Cocos/cocos-first-game/FirstGame/scripts/prepare_muzzle_clean_assets.py) 这类“独立区域提取”方案，再决定是否需要改单张单资产生成。
