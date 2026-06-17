"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDebugTools = createDebugTools;
const target_resolution_1 = require("./target-resolution");
const v2_shared_1 = require("./v2-shared");
function createDebugTools(telemetry, sceneFacade) {
    return [
        {
            name: "debug_recent_operations",
            title: "Debug Recent Operations",
            description: "Debug-only telemetry view of recent MCP tool calls, with compact args and result summaries.",
            feature: "debug.read",
            inputSchema: {
                type: "object",
                properties: {
                    limit: { type: "number" },
                    toolName: { type: "string" },
                    sessionId: { type: "string" },
                    mode: {
                        type: "string",
                        enum: ["read", "preview", "apply"],
                    },
                    success: { type: "boolean" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const events = telemetry.getRecentToolCalls({
                    limit: typeof args.limit === "number" ? args.limit : undefined,
                    toolName: typeof args.toolName === "string" ? args.toolName.trim() : undefined,
                    sessionId: typeof args.sessionId === "string" ? args.sessionId.trim() : undefined,
                    mode: parseMode(args.mode),
                    success: typeof args.success === "boolean" ? args.success : undefined,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Loaded ${events.length} recent telemetry event(s).`,
                        },
                    ],
                    structuredContent: {
                        count: events.length,
                        telemetryDir: telemetry.getTelemetryDir(),
                        events,
                    },
                };
            },
        },
        {
            name: "debug_component_dump",
            title: "Debug Component Dump",
            description: "Debug-only raw component dump for inspecting exact editor property payload shapes.",
            feature: "debug.read",
            inputSchema: {
                type: "object",
                properties: {
                    target: {
                        type: "object",
                        properties: {
                            uuid: { type: "string" },
                            path: { type: "string" },
                            name: { type: "string" },
                        },
                        additionalProperties: false,
                    },
                    componentType: { type: "string" },
                },
                required: ["target", "componentType"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target);
                const componentType = typeof args.componentType === "string" ? args.componentType : "";
                const dump = await sceneFacade.getRawComponentDump({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    componentType,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Loaded raw dump for ${componentType}.`,
                        },
                    ],
                    structuredContent: dump,
                };
            },
        },
        {
            name: "debug_prefab_payload",
            title: "Debug Prefab Payload",
            description: "Debug-only in-memory prefab payload generated from a scene node before asset-db write/import.",
            feature: "debug.read",
            inputSchema: {
                type: "object",
                properties: {
                    target: {
                        type: "object",
                        properties: {
                            uuid: { type: "string" },
                            path: { type: "string" },
                            name: { type: "string" },
                        },
                        additionalProperties: false,
                    },
                    prefabName: { type: "string" },
                },
                required: ["target"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target);
                const prefabName = typeof args.prefabName === "string" && args.prefabName.trim()
                    ? args.prefabName.trim()
                    : targetIdentifier.path?.split("/").filter(Boolean).at(-1) ??
                        "NewPrefab";
                const payload = await sceneFacade.createPrefabAsset({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    prefabName,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Generated in-memory prefab payload for ${payload.sourceNode.path}.`,
                        },
                    ],
                    structuredContent: payload,
                };
            },
        },
    ];
}
function parseMode(value) {
    if (value === "read" || value === "preview" || value === "apply") {
        return value;
    }
    return undefined;
}
//# sourceMappingURL=debug-tools.js.map