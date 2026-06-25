# Cocos MCP Rules

## Default Rule

- Scene, node, component, prefab, and button-event edits must use Cocos MCP first.
- If thread-local MCP tools are not exposed, use the verified HTTP fallback at `http://127.0.0.1:3603/mcp`.
- Manual `.scene` / `.prefab` JSON edits are last resort only.

## Required Workflow

1. Verify MCP availability:
   - Prefer thread-local MCP tools when present.
   - Otherwise use the project helper: `node tools/cocos_mcp_client.js status`

2. Before any write:
   - Read scene state with `cocos_scene_status`
   - Confirm the active playable scene identity
   - Use the returned `revision`

3. Every write tool call must include:
   - `preview: false`
   - `expectedRevision`
   - `idempotencyKey`

4. After each write:
   - Read `nextRevision` or `revisionAfter`
   - Use that revision for the next write

5. After all edits:
   - Call `cocos_scene_save`

## Active Scene Rule

- In this project, the playable UI scene is not the loading scene.
- Do not assume `assets/scenes/MainScene.scene` is the target.
- Always verify `requestedSceneUrl`, `resolvedAssetUrl`, `sceneUrl`, and `assetUuid`.
- Expected playable scene is usually:
  - `assets/bundles/game/scenes/MainScene.scene`

## Script Refresh Rule

- If a just-added method or property is missing from MCP-visible component metadata:
  - call `cocos_script_refresh`
  - then retry component field writes or event binding

## Button Binding Rule

- For `cc.Button`, event name is `click`
- Not `clickEvents`
- `handlerComponentType` must be non-empty

## Last Resort Rule

- Direct `.scene` or `.prefab` edits are allowed only if:
  - thread-local MCP is unavailable
  - HTTP fallback also fails
  - and the failure reason is recorded

## Required Follow-up

- Any MCP tool gap, workflow problem, or forced manual scene edit must be recorded in:
  - `docs/cocos-mcp-feedback.md`

## Recommended Helper

- Use the project helper instead of ad hoc curl:
  - `node tools/cocos_mcp_client.js status`

- Extend that helper for future write flows rather than duplicating MCP request code in one-off scripts.
