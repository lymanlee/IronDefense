"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUiTools = createUiTools;
const shared_1 = require("@cocos-mcp/shared");
const v2_shared_1 = require("./v2-shared");
const target_resolution_1 = require("./target-resolution");
function createUiTools(sceneFacade) {
    return [
        {
            name: "component_event_list",
            title: "Component Event List",
            description: "List semantic event bindings for supported UI components. Current scope covers Button, Toggle, ToggleContainer, Slider, and EditBox event slots.",
            feature: "component.read",
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
                    eventName: { type: "string" },
                    view: {
                        type: "string",
                        enum: ["brief", "standard", "detail"],
                    },
                },
                required: ["target"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target);
                const result = await sceneFacade.listComponentEvents({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    componentType: typeof args.componentType === "string" ? args.componentType : undefined,
                    eventName: typeof args.eventName === "string" ? args.eventName : undefined,
                });
                const view = (0, v2_shared_1.parseReadView)(args.view);
                const shaped = shapeEventListResult(result, view);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Loaded ${result.bindings.length} ${result.eventName} event binding(s).`,
                        },
                    ],
                    structuredContent: shaped,
                };
            },
        },
        {
            name: "component_event_bind",
            title: "Component Event Bind",
            description: "Bind one or more semantic UI event handlers. Current scope covers Button, Toggle, ToggleContainer, Slider, and EditBox event slots. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or event-list polling.",
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
                    eventName: { type: "string" },
                    handlerTarget: {
                        type: "object",
                        properties: {
                            uuid: { type: "string" },
                            path: { type: "string" },
                            name: { type: "string" },
                        },
                        additionalProperties: false,
                    },
                    handlerComponentType: { type: "string" },
                    handlerMethod: { type: "string" },
                    customEventData: { type: "string" },
                    dedupe: { type: "boolean" },
                    bindings: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                handlerTarget: {
                                    type: "object",
                                    properties: {
                                        uuid: { type: "string" },
                                        path: { type: "string" },
                                        name: { type: "string" },
                                    },
                                    additionalProperties: false,
                                },
                                handlerComponentType: { type: "string" },
                                handlerMethod: { type: "string" },
                                customEventData: { type: "string" },
                                dedupe: { type: "boolean" },
                            },
                            required: ["handlerTarget", "handlerComponentType", "handlerMethod"],
                            additionalProperties: false,
                        },
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
                const preview = typeof args.preview === "boolean" ? args.preview : true;
                const componentType = typeof args.componentType === "string" ? args.componentType : undefined;
                const eventName = typeof args.eventName === "string" ? args.eventName : undefined;
                const idempotencyKey = typeof args.idempotencyKey === "string"
                    ? args.idempotencyKey
                    : undefined;
                const bindingSpecs = parseBindSpecs(args);
                const results = [];
                const baseEventList = await sceneFacade.listComponentEvents({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    componentType,
                    eventName,
                });
                let previewBindings = cloneEventBindings(baseEventList.bindings);
                let expectedRevision = typeof args.expectedRevision === "number"
                    ? args.expectedRevision
                    : undefined;
                for (const [index, spec] of bindingSpecs.entries()) {
                    const handlerIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, spec.handlerTarget, "handlerTarget");
                    const result = await sceneFacade.bindComponentEvent({
                        nodeUuid: targetIdentifier.uuid,
                        nodePath: targetIdentifier.path,
                        componentType,
                        eventName,
                        handlerNodeUuid: handlerIdentifier.uuid,
                        handlerNodePath: handlerIdentifier.path,
                        handlerComponentType: spec.handlerComponentType,
                        handlerMethod: spec.handlerMethod,
                        customEventData: spec.customEventData,
                        dedupe: spec.dedupe,
                        preview,
                        expectedRevision,
                        idempotencyKey: bindingSpecs.length === 1
                            ? idempotencyKey
                            : appendBatchSuffix(idempotencyKey, index),
                    });
                    results.push(result);
                    if (preview) {
                        previewBindings = applyBindPreviewBinding(previewBindings, result, spec.dedupe ?? true);
                    }
                    if (!preview) {
                        expectedRevision = result.nextRevision;
                    }
                }
                const result = combineEventMutationResults(results, "bind", preview ? previewBindings : undefined);
                return {
                    content: [
                        {
                            type: "text",
                            text: eventMutationText(result),
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
        {
            name: "component_event_unbind",
            title: "Component Event Unbind",
            description: "Remove one or more semantic UI event bindings by index or by handler selector. Current scope covers Button, Toggle, ToggleContainer, Slider, and EditBox event slots. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or event-list polling.",
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
                    eventName: { type: "string" },
                    index: { type: "number" },
                    handlerTarget: {
                        type: "object",
                        properties: {
                            uuid: { type: "string" },
                            path: { type: "string" },
                            name: { type: "string" },
                        },
                        additionalProperties: false,
                    },
                    handlerComponentType: { type: "string" },
                    handlerMethod: { type: "string" },
                    customEventData: { type: "string" },
                    removals: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                index: { type: "number" },
                                handlerTarget: {
                                    type: "object",
                                    properties: {
                                        uuid: { type: "string" },
                                        path: { type: "string" },
                                        name: { type: "string" },
                                    },
                                    additionalProperties: false,
                                },
                                handlerComponentType: { type: "string" },
                                handlerMethod: { type: "string" },
                                customEventData: { type: "string" },
                            },
                            additionalProperties: false,
                        },
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
                const preview = typeof args.preview === "boolean" ? args.preview : true;
                const componentType = typeof args.componentType === "string" ? args.componentType : undefined;
                const eventName = typeof args.eventName === "string" ? args.eventName : undefined;
                const idempotencyKey = typeof args.idempotencyKey === "string"
                    ? args.idempotencyKey
                    : undefined;
                const removalSpecs = parseUnbindSpecs(args);
                const results = [];
                const baseEventList = await sceneFacade.listComponentEvents({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    componentType,
                    eventName,
                });
                let previewBindings = cloneEventBindings(baseEventList.bindings);
                let expectedRevision = typeof args.expectedRevision === "number"
                    ? args.expectedRevision
                    : undefined;
                for (const [index, spec] of removalSpecs.entries()) {
                    const handlerIdentifier = spec.mode === "handler"
                        ? await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, spec.handlerTarget, "handlerTarget")
                        : undefined;
                    const result = await sceneFacade.unbindComponentEvent({
                        nodeUuid: targetIdentifier.uuid,
                        nodePath: targetIdentifier.path,
                        componentType,
                        eventName,
                        index: spec.mode === "index" ? spec.index : undefined,
                        handlerNodeUuid: handlerIdentifier?.uuid,
                        handlerNodePath: handlerIdentifier?.path,
                        handlerComponentType: spec.mode === "handler" ? spec.handlerComponentType : undefined,
                        handlerMethod: spec.mode === "handler" ? spec.handlerMethod : undefined,
                        customEventData: spec.mode === "handler" ? spec.customEventData : undefined,
                        preview,
                        expectedRevision,
                        idempotencyKey: removalSpecs.length === 1
                            ? idempotencyKey
                            : appendBatchSuffix(idempotencyKey, index),
                    });
                    results.push(result);
                    if (preview) {
                        previewBindings = applyUnbindPreviewBinding(previewBindings, spec);
                    }
                    if (!preview) {
                        expectedRevision = result.nextRevision;
                    }
                }
                const result = combineEventMutationResults(results, "unbind", preview ? previewBindings : undefined);
                return {
                    content: [
                        {
                            type: "text",
                            text: eventMutationText(result),
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
    ];
}
function eventMutationText(result) {
    if (result.noop) {
        return `No changes were applied. ${result.warnings[0] ?? ""}`.trim();
    }
    return result.preview
        ? (0, v2_shared_1.mutationText)(result)
        : (0, v2_shared_1.withVerificationHint)((0, v2_shared_1.mutationText)(result), result);
}
function readRequiredString(value, fieldName) {
    if (typeof value !== "string" || !value.trim()) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `${fieldName} is required`);
    }
    return value.trim();
}
function readOptionalInteger(value) {
    return Number.isInteger(value) ? value : undefined;
}
function parseBindSpecs(args) {
    const bindings = args.bindings;
    const hasBatch = Array.isArray(bindings);
    const hasSingle = !!args.handlerTarget &&
        typeof args.handlerComponentType === "string" &&
        args.handlerComponentType.trim().length > 0 &&
        typeof args.handlerMethod === "string" &&
        args.handlerMethod.trim().length > 0;
    if (hasBatch === hasSingle) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "component_event_bind requires exactly one input mode: single handler fields or bindings[]");
    }
    if (hasSingle) {
        return [
            {
                handlerTarget: (0, v2_shared_1.parseTargetSelector)(args.handlerTarget, "handlerTarget"),
                handlerComponentType: readRequiredString(args.handlerComponentType, "handlerComponentType"),
                handlerMethod: readRequiredString(args.handlerMethod, "handlerMethod"),
                customEventData: typeof args.customEventData === "string"
                    ? args.customEventData
                    : undefined,
                dedupe: typeof args.dedupe === "boolean" ? args.dedupe : undefined,
            },
        ];
    }
    if (!Array.isArray(bindings) || bindings.length === 0) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "bindings[] must contain at least one binding");
    }
    return bindings.map((entry, index) => parseBindSpecEntry(entry, index));
}
function parseBindSpecEntry(value, index) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `bindings[${index}] must be an object`);
    }
    const record = value;
    return {
        handlerTarget: (0, v2_shared_1.parseTargetSelector)(record.handlerTarget, `bindings[${index}].handlerTarget`),
        handlerComponentType: readRequiredString(record.handlerComponentType, `bindings[${index}].handlerComponentType`),
        handlerMethod: readRequiredString(record.handlerMethod, `bindings[${index}].handlerMethod`),
        customEventData: typeof record.customEventData === "string"
            ? record.customEventData
            : undefined,
        dedupe: typeof record.dedupe === "boolean" ? record.dedupe : undefined,
    };
}
function parseUnbindSpecs(args) {
    const removals = args.removals;
    const hasBatch = Array.isArray(removals);
    const singleSpec = parseSingleUnbindSpec(args, "top-level");
    const hasSingle = singleSpec !== null;
    if (hasBatch === hasSingle) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "component_event_unbind requires exactly one input mode: single selector fields or removals[]");
    }
    if (singleSpec) {
        return [singleSpec];
    }
    if (!Array.isArray(removals) || removals.length === 0) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "removals[] must contain at least one removal selector");
    }
    return removals.map((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `removals[${index}] must be an object`);
        }
        const spec = parseSingleUnbindSpec(entry, `removals[${index}]`);
        if (!spec) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `removals[${index}] must define index or handlerTarget + handlerComponentType + handlerMethod`);
        }
        return spec;
    });
}
function parseSingleUnbindSpec(args, scope) {
    const index = readOptionalInteger(args.index);
    const handlerTarget = args.handlerTarget
        ? (0, v2_shared_1.parseTargetSelector)(args.handlerTarget, `${scope}.handlerTarget`)
        : undefined;
    const hasHandlerMatch = !!handlerTarget &&
        typeof args.handlerComponentType === "string" &&
        args.handlerComponentType.trim().length > 0 &&
        typeof args.handlerMethod === "string" &&
        args.handlerMethod.trim().length > 0;
    if ((typeof index === "number") === hasHandlerMatch) {
        if (index === undefined && !hasHandlerMatch) {
            return null;
        }
        throw new shared_1.AppError("INVALID_ARGUMENT", `${scope} requires exactly one selector mode: index or handlerTarget + component + method`);
    }
    if (typeof index === "number") {
        return {
            mode: "index",
            index,
        };
    }
    return {
        mode: "handler",
        handlerTarget: handlerTarget,
        handlerComponentType: readRequiredString(args.handlerComponentType, `${scope}.handlerComponentType`),
        handlerMethod: readRequiredString(args.handlerMethod, `${scope}.handlerMethod`),
        customEventData: typeof args.customEventData === "string"
            ? args.customEventData
            : undefined,
    };
}
function appendBatchSuffix(idempotencyKey, index) {
    return idempotencyKey ? `${idempotencyKey}#${index}` : undefined;
}
function combineEventMutationResults(results, mode, previewBindings) {
    if (results.length === 0) {
        throw new shared_1.AppError("INTERNAL_ERROR", "combineEventMutationResults requires at least one result");
    }
    const final = results[results.length - 1];
    return {
        ...final,
        preview: results.every((result) => result.preview),
        currentRevision: results[0].currentRevision,
        nextRevision: final.nextRevision,
        appliedRevision: final.appliedRevision,
        changeSummary: results.flatMap((result) => result.changeSummary),
        warnings: [
            ...results.flatMap((result) => result.warnings),
            ...(results.length > 1 && !results.every((result) => result.preview)
                ? [
                    `component_event_${mode} currently applies multi-item writes as sequential verified mutations.`,
                ]
                : []),
        ],
        bindings: results.length > 1 && results.every((result) => result.preview)
            ? previewBindings ?? final.bindings
            : final.bindings,
        noop: results.every((result) => result.noop === true),
        changedIndex: undefined,
        removedIndex: undefined,
    };
}
function cloneEventBindings(bindings) {
    return bindings.map((binding) => ({
        ...binding,
        target: binding.target ? { ...binding.target } : undefined,
    }));
}
function applyBindPreviewBinding(currentBindings, result, dedupe) {
    const nextBindings = cloneEventBindings(currentBindings);
    const addedBinding = typeof result.changedIndex === "number"
        ? result.bindings[result.changedIndex]
        : undefined;
    if (!addedBinding) {
        return reindexEventBindings(nextBindings);
    }
    if (dedupe &&
        findEquivalentBindingIndex(nextBindings, addedBinding) >= 0) {
        return reindexEventBindings(nextBindings);
    }
    nextBindings.push({
        ...addedBinding,
        target: addedBinding.target ? { ...addedBinding.target } : undefined,
    });
    return reindexEventBindings(nextBindings);
}
function applyUnbindPreviewBinding(currentBindings, spec) {
    const nextBindings = cloneEventBindings(currentBindings);
    if (spec.mode === "index") {
        if (spec.index >= 0 && spec.index < nextBindings.length) {
            nextBindings.splice(spec.index, 1);
        }
        return reindexEventBindings(nextBindings);
    }
    const index = nextBindings.findIndex((binding) => matchesHandlerSelector(binding, spec));
    if (index >= 0) {
        nextBindings.splice(index, 1);
    }
    return reindexEventBindings(nextBindings);
}
function findEquivalentBindingIndex(bindings, candidate) {
    return bindings.findIndex((binding) => bindingsEquivalent(binding, candidate));
}
function bindingsEquivalent(left, right) {
    const leftComponentType = left.componentType?.trim() ?? "";
    const rightComponentType = right.componentType?.trim() ?? "";
    const componentTypeMatches = !leftComponentType ||
        !rightComponentType ||
        leftComponentType === rightComponentType;
    return ((left.target?.path ?? "") === (right.target?.path ?? "") &&
        componentTypeMatches &&
        (left.handlerMethod ?? "") === (right.handlerMethod ?? "") &&
        (left.customEventData ?? "") === (right.customEventData ?? ""));
}
function matchesHandlerSelector(binding, spec) {
    const bindingComponentType = binding.componentType?.trim() ?? "";
    const handlerComponentType = spec.handlerComponentType.trim();
    const componentTypeMatches = !bindingComponentType || bindingComponentType === handlerComponentType;
    return ((binding.target?.path ?? "") === (spec.handlerTarget.path ?? "") &&
        componentTypeMatches &&
        (binding.handlerMethod ?? "") === spec.handlerMethod &&
        (binding.customEventData ?? "") === (spec.customEventData ?? ""));
}
function reindexEventBindings(bindings) {
    return bindings.map((binding, index) => ({
        ...binding,
        index,
    }));
}
function shapeEventListResult(input, view) {
    if (view === "brief") {
        return {
            componentType: input.componentType,
            eventName: input.eventName,
            view,
            count: input.bindings.length,
            target: {
                path: input.target.path,
                name: input.target.name,
            },
            bindings: input.bindings.map((binding) => ({
                index: binding.index,
                handlerMethod: binding.handlerMethod,
                targetPath: binding.target?.path,
                componentType: binding.componentType,
            })),
        };
    }
    return {
        ...input,
        view,
        count: input.bindings.length,
    };
}
//# sourceMappingURL=ui-tools.js.map