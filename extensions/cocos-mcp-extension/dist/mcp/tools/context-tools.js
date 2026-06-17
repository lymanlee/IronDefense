"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContextTools = createContextTools;
const shared_1 = require("@cocos-mcp/shared");
const v2_shared_1 = require("./v2-shared");
function createContextTools(projectContext, sceneFacade, gate, getTransportStatus) {
    return [
        {
            name: "editor_status",
            title: "Editor Status",
            description: "Return editor, project, transport, and capability status for the current session.",
            feature: "editor.read",
            inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            handler: async () => {
                const info = projectContext.getProjectInfo();
                const snapshot = await gate.getSnapshot();
                const result = {
                    editorVersion: info.editorVersion,
                    projectName: info.projectName,
                    projectPath: info.projectPath,
                    transport: getTransportStatus(),
                    capabilities: [...snapshot.features],
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: `Editor ready for project ${info.projectName}.`,
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
        {
            name: "scene_status",
            title: "Scene Status",
            description: "Return the active scene identity, revision, dirty state, and root count. assetUuid identifies the .scene asset from AssetDB; sceneInternalId identifies the editor scene object and must not be used as asset identity. Use as a lightweight checkpoint or one-shot post-write verification read; do not poll it repeatedly when revision and dirty have not changed.",
            feature: "scene.read",
            inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            handler: async () => {
                const [sceneInfo, revision, dirty, hierarchy] = await Promise.all([
                    sceneFacade.getSceneInfo(),
                    sceneFacade.getRevision(),
                    sceneFacade.isDirty(),
                    sceneFacade.getHierarchy(),
                ]);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Scene ${sceneInfo.sceneName} at revision ${revision}.`,
                        },
                    ],
                    structuredContent: {
                        sceneName: sceneInfo.sceneName,
                        sceneUuid: sceneInfo.assetUuid,
                        requestedSceneUrl: sceneInfo.requestedSceneUrl,
                        resolvedAssetUrl: sceneInfo.resolvedAssetUrl,
                        sceneUrl: sceneInfo.sceneUrl,
                        assetUuid: sceneInfo.assetUuid,
                        sceneInternalId: sceneInfo.sceneInternalId ?? sceneInfo.sceneUuid,
                        revision,
                        dirty,
                        rootCount: hierarchy.length,
                    },
                };
            },
        },
        {
            name: "selection_get",
            title: "Selection Get",
            description: "Return the current editor selection as a compact node list for AI targeting.",
            feature: "scene.read",
            inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            handler: async () => {
                const nodes = await sceneFacade.getSelection();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Selection contains ${nodes.length} node(s).`,
                        },
                    ],
                    structuredContent: {
                        count: nodes.length,
                        nodes: nodes.map((node) => (0, v2_shared_1.filterNodeView)(node, {
                            view: "brief",
                            includeComponents: false,
                        })),
                    },
                };
            },
        },
        {
            name: "scene_save",
            title: "Scene Save",
            description: "Persist the current scene if it is dirty.",
            feature: "project.write",
            inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            handler: async () => {
                const result = await sceneFacade.saveScene();
                return {
                    content: [
                        {
                            type: "text",
                            text: result.saved
                                ? `Scene save completed via ${result.strategy}.`
                                : `Scene save attempted via ${result.strategy}, but scene is still dirty.`,
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
        {
            name: "scene_open",
            title: "Scene Open",
            description: "Open a scene asset by db url or asset uuid and make it the active editor scene. Returns requestedSceneUrl, resolvedAssetUrl, assetUuid, and sceneInternalId separately to avoid confusing AssetDB identity with editor scene object identity.",
            feature: "project.write",
            inputSchema: {
                type: "object",
                properties: {
                    sceneUrl: { type: "string" },
                    assetUuid: { type: "string" },
                    sceneUuid: { type: "string" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const result = await sceneFacade.openScene({
                    sceneUrl: typeof args.sceneUrl === "string" ? args.sceneUrl : undefined,
                    assetUuid: typeof args.assetUuid === "string" ? args.assetUuid : undefined,
                    sceneUuid: typeof args.sceneUuid === "string" ? args.sceneUuid : undefined,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Opened scene ${result.sceneName}.`,
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
        {
            name: "scene_set_entry",
            title: "Scene Set Entry",
            description: "Set the preview entry scene to a specific db url so later runs start from that scene instead of the current scene.",
            feature: "project.write",
            inputSchema: {
                type: "object",
                properties: {
                    sceneUrl: { type: "string" },
                },
                required: ["sceneUrl"],
                additionalProperties: false,
            },
            handler: async (args) => {
                if (typeof args.sceneUrl !== "string" || !args.sceneUrl.trim()) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "sceneUrl is required");
                }
                const result = await sceneFacade.setEntryScene({
                    sceneUrl: args.sceneUrl,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Set entry scene to ${result.sceneUrl}.`,
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
    ];
}
//# sourceMappingURL=context-tools.js.map