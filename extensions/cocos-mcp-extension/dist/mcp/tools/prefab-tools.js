"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPrefabTools = createPrefabTools;
const shared_1 = require("@cocos-mcp/shared");
const target_resolution_1 = require("./target-resolution");
const v2_shared_1 = require("./v2-shared");
function createPrefabTools(assetFacade, sceneFacade) {
    return [
        {
            name: "prefab_create",
            title: "Prefab Create",
            description: "Create a prefab asset from an existing scene node and return the created prefab summary.",
            feature: "project.write",
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
                    prefabUrl: { type: "string" },
                    prefabPath: { type: "string" },
                    prefabName: { type: "string" },
                    overwrite: { type: "boolean" },
                    openAfterCreate: { type: "boolean" },
                },
                required: ["target"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target);
                const prefabUrl = typeof args.prefabUrl === "string" ? args.prefabUrl : undefined;
                const prefabPath = typeof args.prefabPath === "string" ? args.prefabPath : undefined;
                const prefabName = typeof args.prefabName === "string" ? args.prefabName : undefined;
                if (!prefabUrl?.trim() && !prefabPath?.trim() && !prefabName?.trim()) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "prefabUrl or prefabPath/prefabName is required");
                }
                const generated = await sceneFacade.createPrefabAsset({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    prefabName: prefabName?.trim() ||
                        targetIdentifier.path?.split("/").filter(Boolean).at(-1) ||
                        "NewPrefab",
                });
                const result = await assetFacade.createPrefab({
                    prefabUrl,
                    prefabPath,
                    prefabName,
                    prefabJson: generated.prefabJson,
                    sourceNode: generated.sourceNode,
                    overwrite: typeof args.overwrite === "boolean" ? args.overwrite : undefined,
                    openAfterCreate: typeof args.openAfterCreate === "boolean"
                        ? args.openAfterCreate
                        : undefined,
                });
                const structuredContent = {
                    ...result,
                    warnings: generated.warnings,
                    droppedReferences: generated.droppedReferences,
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: generated.warnings.length
                                ? `Created prefab ${result.prefab.url} from ${result.sourceNode.path} with ${generated.warnings.length} warning(s).`
                                : `Created prefab ${result.prefab.url} from ${result.sourceNode.path}.`,
                        },
                    ],
                    structuredContent,
                };
            },
        },
        {
            name: "prefab_instantiate",
            title: "Prefab Instantiate",
            description: "Instantiate one prefab asset into the current scene under a parent node and optionally set name and local position. Defaults to preview mode; pass preview=false with expectedRevision to apply. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or dump polling.",
            feature: "scene.write",
            inputSchema: {
                type: "object",
                properties: {
                    prefabUrl: { type: "string" },
                    prefabUuid: { type: "string" },
                    parent: {
                        type: "object",
                        properties: {
                            uuid: { type: "string" },
                            path: { type: "string" },
                            name: { type: "string" },
                        },
                        additionalProperties: false,
                    },
                    name: { type: "string" },
                    position: (0, v2_shared_1.createVector3InputSchema)(),
                    keepWorldTransform: { type: "boolean" },
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const prefabUrl = typeof args.prefabUrl === "string" ? args.prefabUrl : undefined;
                const prefabUuid = typeof args.prefabUuid === "string" ? args.prefabUuid : undefined;
                if (!prefabUrl?.trim() && !prefabUuid?.trim()) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "prefabUrl or prefabUuid is required");
                }
                const prefab = await assetFacade.resolveAsset({
                    url: prefabUrl,
                    uuid: prefabUuid,
                });
                if (!isPrefabAsset(prefab.type, prefab.url)) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", `${prefab.url} is not a prefab asset`);
                }
                const parentIdentifier = await resolvePrefabParent(sceneFacade, args.parent);
                const result = await sceneFacade.instantiatePrefab({
                    prefabUuid: prefab.uuid,
                    parentUuid: parentIdentifier.uuid,
                    parentPath: parentIdentifier.path,
                    name: typeof args.name === "string" ? args.name : undefined,
                    position: args.position === undefined
                        ? undefined
                        : (0, v2_shared_1.parseVector3)(args.position, "position"),
                    keepWorldTransform: typeof args.keepWorldTransform === "boolean"
                        ? args.keepWorldTransform
                        : undefined,
                    preview: typeof args.preview === "boolean" ? args.preview : true,
                    expectedRevision: typeof args.expectedRevision === "number"
                        ? args.expectedRevision
                        : undefined,
                    idempotencyKey: typeof args.idempotencyKey === "string"
                        ? args.idempotencyKey
                        : undefined,
                });
                const structuredContent = {
                    ...result,
                    prefab,
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: result.preview
                                ? (0, v2_shared_1.withPreviewApplyHint)(`Preview ready to instantiate ${prefab.url}.`, result)
                                : (0, v2_shared_1.withVerificationHint)(`Instantiated ${prefab.url} under ${result.node?.path ?? parentIdentifier.path ?? "scene"}.`, result),
                        },
                    ],
                    structuredContent,
                };
            },
        },
    ];
}
function isPrefabAsset(type, url) {
    return type === "cc.Prefab" || url.toLowerCase().endsWith(".prefab");
}
async function resolvePrefabParent(sceneFacade, rawParent) {
    if (rawParent !== undefined) {
        const parent = (0, v2_shared_1.parseTargetSelector)(rawParent, "parent");
        return (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, parent, "parent");
    }
    const hierarchy = await sceneFacade.getHierarchy();
    const flat = (0, v2_shared_1.flattenNodes)(hierarchy);
    const preferred = flat.find((node) => node.name === "Canvas");
    if (preferred?.uuid) {
        return {
            uuid: preferred.uuid,
            path: preferred.path,
        };
    }
    const firstRoot = hierarchy[0];
    if (firstRoot?.uuid) {
        return {
            uuid: firstRoot.uuid,
            path: firstRoot.path,
        };
    }
    throw new shared_1.AppError("NO_ACTIVE_SCENE", "No active scene root is available for prefab_instantiate");
}
//# sourceMappingURL=prefab-tools.js.map