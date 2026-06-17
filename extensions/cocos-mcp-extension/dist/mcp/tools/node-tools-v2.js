"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNodeTools = createNodeTools;
const shared_1 = require("@cocos-mcp/shared");
const v2_shared_1 = require("./v2-shared");
const target_resolution_1 = require("./target-resolution");
function createNodeTools(sceneFacade) {
    return [
        {
            name: "node_create",
            title: "Node Create",
            description: "Create a child node under a parent. Defaults to preview mode and requires revision for apply. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or dump polling.",
            feature: "scene.write",
            inputSchema: {
                type: "object",
                properties: {
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
                    nodeType: { type: "string" },
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["parent", "name"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const parent = (0, v2_shared_1.parseTargetSelector)(args.parent, "parent");
                const parentIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, parent, "parent");
                const result = await sceneFacade.createNode({
                    parentUuid: parentIdentifier.uuid,
                    parentPath: parentIdentifier.path,
                    name: typeof args.name === "string" ? args.name : "",
                    preview: typeof args.preview === "boolean" ? args.preview : true,
                    expectedRevision: typeof args.expectedRevision === "number"
                        ? args.expectedRevision
                        : undefined,
                    idempotencyKey: typeof args.idempotencyKey === "string"
                        ? args.idempotencyKey
                        : undefined,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: result.preview
                                ? (0, v2_shared_1.mutationText)(result)
                                : (0, v2_shared_1.withVerificationHint)((0, v2_shared_1.mutationText)(result), result),
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
        {
            name: "node_update",
            title: "Node Update",
            description: "Apply multiple node property changes in one call. Current runtime supports name, active, position, rotation, and scale. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or dump polling.",
            feature: "scene.write",
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
                    props: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            active: { type: "boolean" },
                            position: (0, v2_shared_1.createVector3InputSchema)(),
                            rotation: (0, v2_shared_1.createVector3InputSchema)(),
                            scale: (0, v2_shared_1.createVector3InputSchema)(),
                            layer: { type: "number" },
                            siblingIndex: { type: "number" },
                        },
                        additionalProperties: false,
                    },
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["target", "props"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target);
                const props = parseNodeProps(args.props);
                const orderedEntries = Object.entries(props);
                if (orderedEntries.length === 0) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "node_update requires at least one supported property in props");
                }
                const preview = typeof args.preview === "boolean" ? args.preview : true;
                const idempotencyKey = typeof args.idempotencyKey === "string"
                    ? args.idempotencyKey
                    : undefined;
                const results = [];
                let expectedRevision = typeof args.expectedRevision === "number"
                    ? args.expectedRevision
                    : undefined;
                for (const [property, value] of orderedEntries) {
                    const result = await sceneFacade.setNodeProperty({
                        nodeUuid: targetIdentifier.uuid,
                        nodePath: targetIdentifier.path,
                        property,
                        value,
                        preview,
                        expectedRevision,
                        idempotencyKey,
                    });
                    results.push(result);
                    if (!preview) {
                        expectedRevision = result.nextRevision;
                    }
                }
                const combined = combineMutationResults(results);
                return {
                    content: [
                        {
                            type: "text",
                            text: combined.preview
                                ? (0, v2_shared_1.mutationText)(combined)
                                : (0, v2_shared_1.withVerificationHint)((0, v2_shared_1.mutationText)(combined), combined),
                        },
                    ],
                    structuredContent: combined,
                };
            },
        },
        {
            name: "node_move",
            title: "Node Move",
            description: "Move a node to another parent and optionally reorder it. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or dump polling.",
            feature: "scene.write",
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
                    newParent: {
                        type: "object",
                        properties: {
                            uuid: { type: "string" },
                            path: { type: "string" },
                            name: { type: "string" },
                        },
                        additionalProperties: false,
                    },
                    siblingIndex: { type: "number" },
                    keepWorldTransform: { type: "boolean" },
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["target", "newParent"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const newParent = (0, v2_shared_1.parseTargetSelector)(args.newParent, "newParent");
                const [targetIdentifier, parentIdentifier] = await Promise.all([
                    (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target),
                    (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, newParent, "newParent"),
                ]);
                const result = await sceneFacade.moveNode({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    newParentUuid: parentIdentifier.uuid,
                    newParentPath: parentIdentifier.path,
                    siblingIndex: typeof args.siblingIndex === "number" ? args.siblingIndex : undefined,
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
                return {
                    content: [
                        {
                            type: "text",
                            text: result.preview
                                ? (0, v2_shared_1.mutationText)(result)
                                : (0, v2_shared_1.withVerificationHint)((0, v2_shared_1.mutationText)(result), result),
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
        {
            name: "node_delete",
            title: "Node Delete",
            description: "Delete a node from the active scene. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or dump polling.",
            feature: "scene.write",
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
                const result = await sceneFacade.deleteNode({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    preview: typeof args.preview === "boolean" ? args.preview : true,
                    expectedRevision: typeof args.expectedRevision === "number"
                        ? args.expectedRevision
                        : undefined,
                    idempotencyKey: typeof args.idempotencyKey === "string"
                        ? args.idempotencyKey
                        : undefined,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: result.preview
                                ? (0, v2_shared_1.mutationText)(result)
                                : (0, v2_shared_1.withVerificationHint)((0, v2_shared_1.mutationText)(result), result),
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
    ];
}
function parseNodeProps(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "props must be an object for node_update");
    }
    const record = value;
    if ("layer" in record || "siblingIndex" in record) {
        throw new shared_1.AppError("NOT_IMPLEMENTED", "node_update currently supports name, active, position, rotation, and scale only");
    }
    const props = {};
    if (typeof record.name === "string") {
        props.name = record.name;
    }
    if (typeof record.active === "boolean") {
        props.active = record.active;
    }
    if ("position" in record) {
        props.position = (0, v2_shared_1.parseVector3)(record.position, "position");
    }
    if ("rotation" in record) {
        props.rotation = (0, v2_shared_1.parseVector3)(record.rotation, "rotation");
    }
    if ("scale" in record) {
        props.scale = (0, v2_shared_1.parseVector3)(record.scale, "scale");
    }
    return props;
}
function combineMutationResults(results) {
    if (results.length === 0) {
        throw new shared_1.AppError("INTERNAL_ERROR", "combineMutationResults requires at least one result");
    }
    return {
        ok: true,
        preview: results.every((result) => result.preview),
        currentRevision: results[0].currentRevision,
        nextRevision: results[results.length - 1].nextRevision,
        appliedRevision: results[results.length - 1].appliedRevision,
        changeSummary: results.flatMap((result) => result.changeSummary),
        warnings: [
            ...results.flatMap((result) => result.warnings),
            ...(results.length > 1 && !results.every((result) => result.preview)
                ? [
                    "node_update currently applies multi-property writes as sequential verified mutations.",
                ]
                : []),
        ],
        node: results[results.length - 1].node,
    };
}
//# sourceMappingURL=node-tools-v2.js.map