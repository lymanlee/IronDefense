# 微信小游戏远程资源包说明

## 目标

微信小游戏本地包体受首包和总包限制约束。当前方案改为：

- 主包只保留启动脚本、主场景、少量必要资源。
- `assets/bundles/battle` 和 `assets/bundles/audio` 构建为远程 Asset Bundle。
- 构建后的远程资源上传到 HTTPS CDN，由运行时按需下载并缓存。

这样不再需要维护 `assets/editor-preview` 缩略图，编辑器里可以直接引用高清资源。

## 当前目录定位

- `assets/resources`
  - 仅放必须通过 `resources.load()` 动态加载、且必须随首包存在的资源。
  - 当前项目应继续保持很小。
- `assets/bundles/battle`
  - 战斗背景、首页背景、HUD/UI、宝箱、敌人帧、战车帧、VFX 等高清资源。
  - 构建为远程 Bundle。
- `assets/bundles/audio`
  - BGM 和音效。
  - 构建为远程 Bundle。
- `assets/editor-preview`
  - 已废弃，不再维护。

## 构建配置

项目配置已设置：

- `battle`
  - `root`: `db://assets/bundles/battle`
  - `compressionType`: `zip`
  - `isRemote`: `true`
- `audio`
  - `root`: `db://assets/bundles/audio`
  - `compressionType`: `zip`
  - `isRemote`: `true`

构建微信小游戏前，还需要在构建面板填写真实的资源服务器地址：

```text
https://你的CDN域名/first-game/remote
```

不要填示例域名。该域名必须配置到微信公众平台的合法下载域名。

## 发布 SOP

1. 在 Cocos Creator 构建面板选择微信小游戏。
2. 确认 `battle`、`audio` 被包含在构建 Bundles 中。
3. 确认构建配置里的资源服务器地址是正式 HTTPS CDN 地址。
4. 删除旧的 `build/wechatgame` 后重新构建。
5. 上传整个 `build/wechatgame/remote` 目录到 CDN，保持目录结构不变。
6. 微信开发者工具打开 `build/wechatgame`。
7. 检查 `build/wechatgame/src/settings.json`：

```json
"remoteBundles": ["audio", "battle"]
```

8. 检查 `build/wechatgame/game.json` 不应再把 `audio`、`battle` 注册为 `subpackages`。

## 验证命令

```bash
rg -n '"remoteBundles"|"subpackages"' build/wechatgame/src/settings.json build/wechatgame/game.json
du -sh build/wechatgame build/wechatgame/* build/wechatgame/remote/* 2>/dev/null | sort -h
find build/wechatgame -maxdepth 3 -type d | sort | rg 'remote|subpackages|battle|audio'
```

预期：

- `remoteBundles` 包含 `audio` 和 `battle`。
- `remote/audio`、`remote/battle` 或对应 zip 资源存在。
- `game.json` 不再包含 `audio`、`battle` 分包。
- 微信工具本地包体只统计主包，不再统计远程资源目录。

## 开发规则

- 新高清图片、音频、VFX 默认放进 `assets/bundles/battle` 或 `assets/bundles/audio`。
- 不再新增 `assets/editor-preview` 缩略图。
- 不要把大资源放入 `assets/resources`。
- 主场景可以直接引用 `assets/bundles/battle` 内的高清 SpriteFrame，编辑器预览正常，构建后由远程 Bundle 承载。
- 运行时动态加载继续使用 `BundleLoader`。

## 风险点

- 未上传 `remote` 目录或 CDN 路径不匹配，会导致运行时远程 Bundle 加载失败。
- 微信体验版/正式版必须配置合法下载域名；开发者工具可临时关闭域名校验，但上线不能依赖该设置。
- 远程资源不是“无限免费”：首次进入仍要下载，必须设计加载进度和失败重试。
- 远程 Bundle 中的脚本会被 Cocos 移回本地包，小游戏平台不能远程加载脚本。
