"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSnapshotTools = createSnapshotTools;
const shared_1 = require("@cocos-mcp/shared");
const v2_shared_1 = require("./v2-shared");
const target_resolution_1 = require("./target-resolution");
function createSnapshotTools(sceneFacade) {
    return [
        {
            name: "scene_snapshot",
            title: "Scene Snapshot",
            description: "Return a scoped layout snapshot for deeper reasoning after lighter lookup tools are insufficient.",
            feature: "scene.read",
            inputSchema: {
                type: "object",
                properties: {
                    rootPath: { type: "string" },
                    view: {
                        type: "string",
                        enum: ["standard", "detail"],
                    },
                    maxDepth: { type: "number" },
                    includeComponents: { type: "boolean" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const [sceneInfo, revision, hierarchy] = await Promise.all([
                    sceneFacade.getSceneInfo(),
                    sceneFacade.getRevision(),
                    sceneFacade.getHierarchy(),
                ]);
                const rootPath = typeof args.rootPath === "string" ? args.rootPath.trim() : "";
                const view = parseSnapshotView(args.view);
                const maxDepth = resolveSnapshotDepth({
                    requested: args.maxDepth,
                    view,
                    fallback: 2,
                });
                const includeComponents = typeof args.includeComponents === "boolean"
                    ? args.includeComponents
                    : view === "detail";
                const roots = rootPath
                    ? [await sceneFacade.getNode({ path: rootPath })]
                    : hierarchy;
                return {
                    content: [
                        {
                            type: "text",
                            text: rootPath
                                ? `Captured ${view} snapshot for ${rootPath}.`
                                : `Captured ${view} snapshot for ${sceneInfo.sceneName}.`,
                        },
                    ],
                    structuredContent: {
                        scene: {
                            name: sceneInfo.sceneName,
                            uuid: sceneInfo.sceneInternalId ?? sceneInfo.sceneUuid,
                            sceneInternalId: sceneInfo.sceneInternalId ?? sceneInfo.sceneUuid,
                            revision,
                        },
                        scope: rootPath || null,
                        view,
                        maxDepth,
                        includeComponents,
                        roots: roots.map((node) => (0, v2_shared_1.filterNodeView)(node, {
                            view,
                            includeComponents,
                            depth: maxDepth,
                        })),
                    },
                };
            },
        },
        {
            name: "node_snapshot",
            title: "Node Snapshot",
            description: "Return a bounded subtree snapshot for one node when node_get is not enough.",
            feature: "scene.read",
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
                    view: {
                        type: "string",
                        enum: ["standard", "detail"],
                    },
                    maxDepth: { type: "number" },
                    includeComponents: { type: "boolean" },
                },
                required: ["target"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target);
                const node = await sceneFacade.getNode(targetIdentifier);
                const view = parseSnapshotView(args.view);
                const maxDepth = resolveSnapshotDepth({
                    requested: args.maxDepth,
                    view,
                    fallback: 2,
                });
                const includeComponents = typeof args.includeComponents === "boolean"
                    ? args.includeComponents
                    : view === "detail";
                return {
                    content: [
                        {
                            type: "text",
                            text: `Captured ${view} snapshot for ${node.path}.`,
                        },
                    ],
                    structuredContent: {
                        target: node.path,
                        view,
                        maxDepth,
                        includeComponents,
                        node: (0, v2_shared_1.filterNodeView)(node, {
                            view,
                            includeComponents,
                            depth: maxDepth,
                        }),
                    },
                };
            },
        },
    ];
}
function parseSnapshotView(value) {
    const view = (0, v2_shared_1.parseReadView)(value);
    if (view === "brief") {
        return "standard";
    }
    return view;
}
function resolveSnapshotDepth(input) {
    const fallback = input.view === "detail" ? Math.max(input.fallback, 4) : input.fallback;
    if (input.requested === undefined) {
        return fallback;
    }
    if (typeof input.requested !== "number" || !Number.isFinite(input.requested)) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "maxDepth must be a finite number when provided");
    }
    return Math.max(0, Math.min(6, Math.floor(input.requested)));
}
//# sourceMappingURL=snapshot-tools.js.map