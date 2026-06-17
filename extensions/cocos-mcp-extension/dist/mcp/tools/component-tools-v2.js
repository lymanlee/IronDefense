"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComponentToolsV2 = createComponentToolsV2;
const shared_1 = require("@cocos-mcp/shared");
const v2_shared_1 = require("./v2-shared");
const target_resolution_1 = require("./target-resolution");
function createComponentToolsV2(sceneFacade) {
    return [
        {
            name: "component_add",
            title: "Component Add",
            description: "Add a built-in Cocos component to a node. Defaults to preview mode and requires revision for apply. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or component-dump polling.",
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
                    componentType: { type: "string" },
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["target", "componentType"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target);
                const result = await sceneFacade.addComponent({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    componentType: typeof args.componentType === "string" ? args.componentType : "",
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
            name: "component_update",
            title: "Component Update",
            description: "Apply multiple component property changes in one call. The current runtime batches verified single-property writes. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or component-dump polling.",
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
                    componentType: { type: "string" },
                    propsJson: {
                        type: "string",
                        description: "JSON object string containing component properties to update.",
                    },
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["target", "componentType", "propsJson"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target);
                const componentType = typeof args.componentType === "string" ? args.componentType : "";
                const props = parsePropsInput(args);
                const preview = typeof args.preview === "boolean" ? args.preview : true;
                const idempotencyKey = typeof args.idempotencyKey === "string"
                    ? args.idempotencyKey
                    : undefined;
                const results = [];
                let expectedRevision = typeof args.expectedRevision === "number"
                    ? args.expectedRevision
                    : undefined;
                for (const [property, value] of Object.entries(props)) {
                    const result = await sceneFacade.setComponentProperty({
                        nodeUuid: targetIdentifier.uuid,
                        nodePath: targetIdentifier.path,
                        componentType,
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
            name: "component_remove",
            title: "Component Remove",
            description: "Remove a component from a node. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or component-dump polling.",
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
                    componentType: { type: "string" },
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["target", "componentType"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target);
                const componentType = typeof args.componentType === "string" ? args.componentType : "";
                const result = await sceneFacade.removeComponent({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    componentType,
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
function parsePropsInput(args) {
    if (typeof args.propsJson === "string") {
        try {
            return parseProps(JSON.parse(args.propsJson));
        }
        catch {
            throw new shared_1.AppError("INVALID_ARGUMENT", "propsJson must be a valid JSON object string");
        }
    }
    return parseProps(args.props);
}
function parseProps(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "props must be an object for component_update");
    }
    const props = Object.entries(value).filter(([key]) => key.trim().length > 0);
    if (props.length === 0) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "component_update requires at least one property in props");
    }
    return Object.fromEntries(props);
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
                    "component_update currently applies multi-property writes as sequential verified mutations.",
                ]
                : []),
        ],
        node: results[results.length - 1].node,
    };
}
//# sourceMappingURL=component-tools-v2.js.map