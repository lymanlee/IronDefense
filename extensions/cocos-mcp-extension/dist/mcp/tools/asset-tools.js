"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssetTools = createAssetTools;
const shared_1 = require("@cocos-mcp/shared");
const target_resolution_1 = require("./target-resolution");
const v2_shared_1 = require("./v2-shared");
function createAssetTools(assetFacade, sceneFacade) {
    return [
        {
            name: "asset_find",
            title: "Asset Find",
            description: "Find project assets by name or path pattern and return a short candidate list.",
            feature: "project.read",
            inputSchema: {
                type: "object",
                properties: {
                    pattern: { type: "string" },
                    importer: { type: "string" },
                    assetType: { type: "string" },
                    exact: { type: "boolean" },
                    maxResults: { type: "number" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const result = await assetFacade.findAssets({
                    pattern: typeof args.pattern === "string" ? args.pattern : undefined,
                    importer: typeof args.importer === "string" ? args.importer : undefined,
                    assetType: typeof args.assetType === "string" ? args.assetType : undefined,
                    exact: typeof args.exact === "boolean" ? args.exact : undefined,
                    maxResults: typeof args.maxResults === "number" ? args.maxResults : undefined,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Found ${result.matches.length} asset match(es).`,
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
        {
            name: "asset_open",
            title: "Asset Open",
            description: "Open an asset in the editor by db url or asset uuid.",
            feature: "project.write",
            inputSchema: {
                type: "object",
                properties: {
                    url: { type: "string" },
                    uuid: { type: "string" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const url = typeof args.url === "string" ? args.url : undefined;
                const uuid = typeof args.uuid === "string" ? args.uuid : undefined;
                if (!url?.trim() && !uuid?.trim()) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "url or uuid is required");
                }
                const result = await assetFacade.openAsset({
                    url,
                    uuid,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Opened asset ${result.url}.`,
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
        {
            name: "asset_import",
            title: "Asset Import",
            description: "Import one external file into db://assets and return the imported project asset summary.",
            feature: "project.write",
            inputSchema: {
                type: "object",
                properties: {
                    sourcePath: { type: "string" },
                    targetUrl: { type: "string" },
                    targetFolder: { type: "string" },
                    overwrite: { type: "boolean" },
                },
                required: ["sourcePath"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const result = await assetFacade.importAsset({
                    sourcePath: typeof args.sourcePath === "string" ? args.sourcePath : "",
                    targetUrl: typeof args.targetUrl === "string" ? args.targetUrl : undefined,
                    targetFolder: typeof args.targetFolder === "string"
                        ? args.targetFolder
                        : undefined,
                    overwrite: typeof args.overwrite === "boolean" ? args.overwrite : undefined,
                });
                const structuredContent = result;
                return {
                    content: [
                        {
                            type: "text",
                            text: `Imported asset to ${result.asset.url}.`,
                        },
                    ],
                    structuredContent,
                };
            },
        },
        {
            name: "asset_create_placeholder",
            title: "Asset Create Placeholder",
            description: "Create a deterministic placeholder SpriteFrame asset as a solid-color PNG under db://assets and return the generated spriteFrame sub-asset.",
            feature: "project.write",
            inputSchema: {
                type: "object",
                properties: {
                    kind: {
                        type: "string",
                        enum: ["sprite-frame"],
                    },
                    targetUrl: { type: "string" },
                    targetFolder: { type: "string" },
                    name: { type: "string" },
                    width: { type: "number" },
                    height: { type: "number" },
                    color: { type: "string" },
                    overwrite: { type: "boolean" },
                    openAfterCreate: { type: "boolean" },
                },
                required: ["kind"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const kind = args.kind === "sprite-frame" ? "sprite-frame" : undefined;
                if (!kind) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "kind must be \"sprite-frame\"");
                }
                const result = await assetFacade.createPlaceholderAsset({
                    kind,
                    targetUrl: typeof args.targetUrl === "string" ? args.targetUrl : undefined,
                    targetFolder: typeof args.targetFolder === "string"
                        ? args.targetFolder
                        : undefined,
                    name: typeof args.name === "string" ? args.name : undefined,
                    width: typeof args.width === "number" ? args.width : undefined,
                    height: typeof args.height === "number" ? args.height : undefined,
                    color: typeof args.color === "string" ? args.color : undefined,
                    overwrite: typeof args.overwrite === "boolean" ? args.overwrite : undefined,
                    openAfterCreate: typeof args.openAfterCreate === "boolean"
                        ? args.openAfterCreate
                        : undefined,
                });
                const structuredContent = result;
                return {
                    content: [
                        {
                            type: "text",
                            text: `Created placeholder asset ${result.asset.url}.`,
                        },
                    ],
                    structuredContent,
                };
            },
        },
        {
            name: "asset_delete",
            title: "Asset Delete",
            description: "Delete one project asset by db url or asset uuid using the editor asset database.",
            feature: "project.write",
            inputSchema: {
                type: "object",
                properties: {
                    url: { type: "string" },
                    uuid: { type: "string" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const url = typeof args.url === "string" ? args.url : undefined;
                const uuid = typeof args.uuid === "string" ? args.uuid : undefined;
                if (!url?.trim() && !uuid?.trim()) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "url or uuid is required");
                }
                const result = await assetFacade.deleteAsset({
                    url,
                    uuid,
                });
                const structuredContent = result;
                return {
                    content: [
                        {
                            type: "text",
                            text: `Deleted asset ${result.url}.`,
                        },
                    ],
                    structuredContent,
                };
            },
        },
        {
            name: "asset_bind_sprite",
            title: "Asset Bind Sprite",
            description: "Bind a SpriteFrame or image asset to cc.Sprite.spriteFrame on a target node. Image assets are resolved to their SpriteFrame sub-asset when possible. Defaults to preview mode; pass preview=false with expectedRevision to apply. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or dump polling.",
            feature: "component.write",
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
                    assetUrl: { type: "string" },
                    assetUuid: { type: "string" },
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["target"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target);
                const assetUrl = typeof args.assetUrl === "string" ? args.assetUrl : undefined;
                const assetUuid = typeof args.assetUuid === "string" ? args.assetUuid : undefined;
                if (!assetUrl?.trim() && !assetUuid?.trim()) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "assetUrl or assetUuid is required");
                }
                const asset = await assetFacade.resolveSpriteFrameAsset({
                    url: assetUrl,
                    uuid: assetUuid,
                });
                assertSpriteFrameAsset(asset);
                const result = await sceneFacade.setComponentProperty({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    componentType: "cc.Sprite",
                    property: "spriteFrame",
                    value: {
                        uuid: asset.uuid,
                    },
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
                    componentType: "cc.Sprite",
                    property: "spriteFrame",
                    asset,
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: result.preview
                                ? (0, v2_shared_1.withPreviewApplyHint)((0, v2_shared_1.mutationText)(result), result)
                                : (0, v2_shared_1.withVerificationHint)((0, v2_shared_1.mutationText)(result), result),
                        },
                    ],
                    structuredContent,
                };
            },
        },
    ];
}
function assertSpriteFrameAsset(asset) {
    const importer = asset.importer?.toLowerCase();
    const type = asset.type?.toLowerCase();
    const isSpriteFrame = importer === "sprite-frame" ||
        type === "cc.spriteframe" ||
        asset.url.endsWith("/spriteFrame");
    if (!isSpriteFrame) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "asset_bind_sprite requires a SpriteFrame asset", {
            reason: `Resolved asset "${asset.url}" is not a SpriteFrame sub-asset.`,
            context: {
                uuid: asset.uuid,
                url: asset.url,
                importer: asset.importer,
                type: asset.type,
            },
            suggestion: "Pass a sprite-frame asset uuid/url such as db://.../spriteFrame or use asset_open/asset_find to confirm the target asset first.",
        });
    }
}
//# sourceMappingURL=asset-tools.js.map