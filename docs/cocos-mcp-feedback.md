# Cocos MCP Feedback

## Usage Agreement

- When using the latest `cocos-mcp`, record any tool call problems, missing capabilities, awkward workflows, or unmet scene/node operation needs after the task is completed.
- Keep each note actionable: include the attempted operation, actual result, expected capability, and impact on the workflow.
- Prefer this file for accumulated feedback so MCP improvements can be reviewed and prioritized later.

## Notes

- 2026-06-12: `cocos_scene action=hierarchy` from older workflows is no longer available in the latest MCP tool list. Current equivalent workflow uses `cocos_scene_tree`, `cocos_node_find`, and `cocos_node_get`. This is usable, but a compatibility alias or clearer migration hint could reduce friction.

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
