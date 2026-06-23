# Cocos MCP HTTP Workflow

## Purpose

- When `cocos-mcp` is not auto-loaded into the Codex thread, call the MCP server directly over HTTP.
- This project has verified that direct HTTP calls can modify the live Cocos Editor scene and save the result.

## Endpoint

- Config source: `~/.codex/config.toml`
- Active server name: `cocos-mcp`
- Verified endpoint in this project: `http://127.0.0.1:3603/mcp`

## Minimal Flow

1. Check available tools:

```bash
curl -s http://127.0.0.1:3603/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

2. Read current scene revision before any write:

```bash
curl -s http://127.0.0.1:3603/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"cocos_scene_status","arguments":{}}}'
```

3. For write tools, always pass:

- `preview: false`
- `expectedRevision: <current revision>`
- `idempotencyKey: <unique string>`

4. After each mutation, read the returned `nextRevision` or `revisionAfter`, then use that revision for the next write.

5. After all edits, save the scene:

```bash
curl -s http://127.0.0.1:3603/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"cocos_scene_save","arguments":{}}}'
```

## Verified Write Sequence

- Read structure:
  - `cocos_scene_status`
  - `cocos_node_snapshot`
  - `cocos_scene_snapshot`
  - `cocos_debug_component_dump`
- Modify scene:
  - `cocos_node_create`
  - `cocos_node_update`
  - `cocos_component_add`
  - `cocos_component_update`
  - `cocos_asset_bind_sprite`
  - `cocos_component_event_bind`
  - `cocos_scene_save`

## Event Binding Rules

- For `cc.Button`, the event name is `click`, not `clickEvents`.
- `cocos_component_event_bind` requires exactly one mode:
  - single handler fields, or
  - `bindings[]`
- If using single handler fields, all of these must be present:
  - `handlerTarget`
  - `handlerComponentType`
  - `handlerMethod`
- `handlerComponentType` cannot be empty.

Example:

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "cocos_component_event_bind",
    "arguments": {
      "target": {
        "path": "MainScene/Canvas/Overlay/GameOverScreen/Bg/GarageBtn"
      },
      "componentType": "cc.Button",
      "eventName": "click",
      "handlerTarget": {
        "path": "MainScene/Canvas/Overlay/GameOverScreen"
      },
      "handlerComponentType": "GameOverScreen",
      "handlerMethod": "onGarageClicked",
      "dedupe": true,
      "preview": false,
      "expectedRevision": 41,
      "idempotencyKey": "codex-bind-garage-001"
    }
  }
}
```

## Script Refresh Rule

- If a new component method or property exists in TypeScript, but MCP says the method is missing, refresh the script before binding or writing component references.
- Verified tool:
  - `cocos_script_refresh`

Typical use:

```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "tools/call",
  "params": {
    "name": "cocos_script_refresh",
    "arguments": {
      "scriptUrl": "db://assets/scripts/ui/GameOverScreen.ts",
      "target": {
        "path": "MainScene/Canvas/Overlay/GameOverScreen"
      },
      "componentType": "GameOverScreen",
      "expectedFields": ["garageButton"],
      "timeoutMs": 15000,
      "pollIntervalMs": 500
    }
  }
}
```

## Practical Rules

- If `cocos-mcp` does not appear in thread tools, try direct HTTP first.
- Prefer MCP scene/node/component tools over manual `.scene` file edits.
- When exact UI properties are needed and `node_get` is too shallow, use `cocos_debug_component_dump`.
- After scene writes, avoid repeated polling. Use one targeted verification read, then save.

## Verified In This Project

- Date: `2026-06-23`
- Verified against editor endpoint: `http://127.0.0.1:3603/mcp`
- Confirmed successful:
  - create `GarageBtn`
  - add `Sprite` / `Button` / `Label`
  - bind sprite asset
  - bind button click handler
  - update sibling button positions
  - save active scene successfully
