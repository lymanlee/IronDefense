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
