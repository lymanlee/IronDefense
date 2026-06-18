# Cocos MCP Feedback

## Usage Agreement

- When using the latest `cocos-mcp`, record any tool call problems, missing capabilities, awkward workflows, or unmet scene/node operation needs after the task is completed.
- Keep each note actionable: include the attempted operation, actual result, expected capability, and impact on the workflow.
- Prefer this file for accumulated feedback so MCP improvements can be reviewed and prioritized later.

## Notes

- 2026-06-12: `cocos_scene action=hierarchy` from older workflows is no longer available in the latest MCP tool list. Current equivalent workflow uses `cocos_scene_tree`, `cocos_node_find`, and `cocos_node_get`. This is usable, but a compatibility alias or clearer migration hint could reduce friction.
- 2026-06-17: Older local helper examples used port `3000`, a hard-coded `Mcp-Session-Id`, and old action-style tool names such as `cocos_editor` with `{ action: ... }`. The current packaged extension in this project listens on `127.0.0.1:3603`, requires `initialize` to create a session, then calls namespaced tools through `tools/call` such as `cocos_scene_status`, `cocos_node_find`, `cocos_node_create`, `cocos_component_add`, `cocos_asset_bind_sprite`, and `cocos_scene_save`. The old helper misled the first check into looking at the wrong port and stale tool shape.
- 2026-06-17: `cocos_scene_status` now returns both scene asset identity fields and editor scene identity fields. This is important because `assets/scenes/MainScene.scene` is only the loading scene in this project, while the playable UI scene is `assets/bundles/game/scenes/MainScene.scene`. MCP edits succeeded on the active bundle scene, but build and preview config still point at the loading scene. Always check `requestedSceneUrl`, `resolvedAssetUrl`, `sceneUrl`, and `assetUuid` before applying scene edits.
- 2026-06-17: Creating visual UI nodes through MCP worked reliably with the new workflow: `node_create` -> `component_add` for `cc.UITransform` and `cc.Sprite` -> `component_update` for size/color -> `asset_bind_sprite` -> `scene_save`. However, `node_get` detail view only lists component names, so exact UITransform size still required `cocos_debug_component_dump`, whose output is very verbose.

## Old vs Latest Tooling

### Old `cocos_scene action=hierarchy`

- Better for quick confirmation tasks where the user explicitly asks to "check hierarchy" or "verify the scene tree".
- One compact call was easy to remember and matched common user wording.
- Lower cognitive overhead when only a broad scene snapshot was needed.
- Weakness: action-style arguments were less discoverable and harder to compose with more specific node/component operations.

### Latest `cocos_scene_tree` / `cocos_node_find` / `cocos_node_get`

- Better for precise inspection because hierarchy reads, node lookup, and detailed node reads are separated.
- Easier to avoid over-fetching once the target node or component is known.
- Tool schemas are clearer and more structured for automation.
- Weakness: replacing one old hierarchy call often takes two or three calls, and users may still refer to the old `cocos_scene action=hierarchy` pattern.

### Optimization Suggestions

- Add a compatibility alias for `cocos_scene action=hierarchy`, internally mapped to `cocos_scene_tree`.
- When an unknown old-style tool/action is called, return a migration hint such as: "Use `cocos_scene_tree` for hierarchy, `cocos_node_find` for lookup, `cocos_node_get` for details."
- Provide a compact "common recipes" tool or doc response for frequent workflows: hierarchy check, node snapshot, component lookup, reference validation.
- Consider a `cocos_scene_hierarchy` shortcut that returns a bounded tree with default depth and components off, optimized for quick validation.
- Expose a stable project-local MCP helper or generated client snippet that reads the actual extension port and always performs `initialize` before `tools/call`. This would avoid stale hard-coded port/session examples.
- Include `sceneUrl` and `assetUuid` in every mutation result, not just `scene_status`, so saved edits are easier to attribute to the correct scene asset.
- Add a compact component property read tool for common UI fields such as `UITransform.contentSize`, `UITransform.anchorPoint`, `Sprite.spriteFrame`, `Sprite.sizeMode`, and `Label.string`. This would avoid parsing the large debug dump for routine UI edits.
