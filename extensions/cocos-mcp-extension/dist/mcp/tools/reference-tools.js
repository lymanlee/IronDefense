"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReferenceTools = createReferenceTools;
const shared_1 = require("@cocos-mcp/shared");
const target_resolution_1 = require("./target-resolution");
const v2_shared_1 = require("./v2-shared");
function createReferenceTools(assetFacade, sceneFacade) {
    return [
        {
            name: "component_bind_reference",
            title: "Component Bind Reference",
            description: "Bind, clear, or remove one or more script/component reference fields using node, component, or asset targets. Supports single reference fields and array reference fields via index, append, and remove. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or component-dump polling.",
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
                    field: { type: "string" },
                    valueTarget: {
                        type: "object",
                        properties: {
                            uuid: { type: "string" },
                            path: { type: "string" },
                            name: { type: "string" },
                        },
                        additionalProperties: false,
                    },
                    valueComponentType: { type: "string" },
                    assetUrl: { type: "string" },
                    assetUuid: { type: "string" },
                    clear: { type: "boolean" },
                    remove: { type: "boolean" },
                    index: { type: "number" },
                    append: { type: "boolean" },
                    bindings: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                field: { type: "string" },
                                valueTarget: {
                                    type: "object",
                                    properties: {
                                        uuid: { type: "string" },
                                        path: { type: "string" },
                                        name: { type: "string" },
                                    },
                                    additionalProperties: false,
                                },
                                valueComponentType: { type: "string" },
                                assetUrl: { type: "string" },
                                assetUuid: { type: "string" },
                                clear: { type: "boolean" },
                                remove: { type: "boolean" },
                                index: { type: "number" },
                                append: { type: "boolean" },
                            },
                            required: ["field"],
                            additionalProperties: false,
                        },
                    },
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
                const preview = typeof args.preview === "boolean" ? args.preview : true;
                const idempotencyKey = typeof args.idempotencyKey === "string"
                    ? args.idempotencyKey
                    : undefined;
                const specs = parseReferenceSpecs(args);
                const componentDump = await sceneFacade.getRawComponentDump({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    componentType,
                });
                const arrayLengthState = new Map();
                const results = [];
                const resolvedBindings = [];
                let expectedRevision = typeof args.expectedRevision === "number"
                    ? args.expectedRevision
                    : undefined;
                for (const [index, spec] of specs.entries()) {
                    const fieldPlan = resolveBindingFieldPath(componentDump, spec, arrayLengthState);
                    const resolved = fieldPlan.operation === "remove"
                        ? null
                        : spec.clear
                            ? {
                                referenceKind: inferClearKind(spec),
                                uuid: "",
                                type: inferExpectedType(spec),
                                path: undefined,
                                url: undefined,
                            }
                            : await resolveReferenceBinding(spec, assetFacade, sceneFacade);
                    const opIdempotencyKey = specs.length === 1
                        ? idempotencyKey
                        : appendBatchSuffix(idempotencyKey, index);
                    const result = fieldPlan.operation === "remove"
                        ? await sceneFacade.removeComponentArrayElement({
                            nodeUuid: targetIdentifier.uuid,
                            nodePath: targetIdentifier.path,
                            componentType,
                            property: fieldPlan.property,
                            index: fieldPlan.index ?? -1,
                            preview,
                            expectedRevision,
                            idempotencyKey: opIdempotencyKey,
                        })
                        : preview
                            ? await sceneFacade.setComponentProperty({
                                nodeUuid: targetIdentifier.uuid,
                                nodePath: targetIdentifier.path,
                                componentType,
                                property: fieldPlan.property,
                                value: {
                                    uuid: resolved?.uuid ?? "",
                                },
                                preview: true,
                                expectedRevision,
                                idempotencyKey: opIdempotencyKey,
                            })
                            : await sceneFacade.bindComponentReference({
                                nodeUuid: targetIdentifier.uuid,
                                nodePath: targetIdentifier.path,
                                componentType,
                                property: fieldPlan.property,
                                referenceUuid: resolved?.uuid,
                                expectedType: resolved?.type,
                                clear: spec.clear,
                                preview: false,
                                expectedRevision,
                                idempotencyKey: opIdempotencyKey,
                            });
                    results.push(result);
                    resolvedBindings.push({
                        field: spec.field,
                        resolvedField: fieldPlan.resolvedField,
                        index: fieldPlan.index,
                        operation: fieldPlan.operation,
                        referenceKind: resolved?.referenceKind,
                        resolvedValue: resolved
                            ? {
                                uuid: resolved.uuid,
                                type: resolved.type,
                                path: resolved.path,
                                url: resolved.url,
                            }
                            : undefined,
                    });
                    if (!preview) {
                        expectedRevision = result.nextRevision;
                    }
                }
                const combined = combineMutationResults(results);
                const structuredContent = resolvedBindings.length === 1
                    ? {
                        ...combined,
                        componentType,
                        field: resolvedBindings[0].field,
                        operation: resolvedBindings[0].operation,
                        referenceKind: resolvedBindings[0].referenceKind,
                        resolvedValue: resolvedBindings[0].resolvedValue,
                        bindings: resolvedBindings,
                    }
                    : {
                        ...combined,
                        componentType,
                        bindings: resolvedBindings,
                    };
                return {
                    content: [
                        {
                            type: "text",
                            text: combined.preview
                                ? (0, v2_shared_1.mutationText)(combined)
                                : (0, v2_shared_1.withVerificationHint)((0, v2_shared_1.mutationText)(combined), combined),
                        },
                    ],
                    structuredContent,
                };
            },
        },
    ];
}
function parseReferenceSpecs(args) {
    const bindings = args.bindings;
    const hasBatch = Array.isArray(bindings);
    const hasSingle = typeof args.field === "string" && args.field.trim().length > 0;
    if (hasBatch === hasSingle) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "component_bind_reference requires exactly one input mode: single field inputs or bindings[]");
    }
    if (hasSingle) {
        return [
            {
                field: args.field,
                valueTarget: args.valueTarget,
                valueComponentType: args.valueComponentType,
                assetUrl: args.assetUrl,
                assetUuid: args.assetUuid,
                clear: typeof args.clear === "boolean" ? args.clear : false,
                remove: typeof args.remove === "boolean" ? args.remove : false,
                index: readOptionalInteger(args.index, "index"),
                append: typeof args.append === "boolean" ? args.append : false,
            },
        ];
    }
    if (!Array.isArray(bindings) || bindings.length === 0) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "bindings[] must contain at least one binding");
    }
    return bindings.map((binding, index) => {
        if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `bindings[${index}] must be an object`);
        }
        const record = binding;
        const field = typeof record.field === "string" ? record.field.trim() : "";
        if (!field) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `bindings[${index}].field is required`);
        }
        return {
            field,
            valueTarget: record.valueTarget,
            valueComponentType: record.valueComponentType,
            assetUrl: record.assetUrl,
            assetUuid: record.assetUuid,
            clear: typeof record.clear === "boolean" ? record.clear : false,
            remove: typeof record.remove === "boolean" ? record.remove : false,
            index: readOptionalInteger(record.index, `bindings[${index}].index`),
            append: typeof record.append === "boolean" ? record.append : false,
        };
    });
}
function readOptionalInteger(value, fieldName) {
    if (value === undefined) {
        return undefined;
    }
    if (!Number.isInteger(value) || value < 0) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `${fieldName} must be a non-negative integer`);
    }
    return value;
}
function resolveBindingFieldPath(componentDump, spec, arrayLengthState) {
    const hasIndex = Number.isInteger(spec.index);
    const append = spec.append === true;
    const operation = spec.remove ? "remove" : spec.clear ? "clear" : "bind";
    if (spec.remove && spec.clear) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Field "${spec.field}" cannot define both clear and remove`);
    }
    if (hasIndex && append) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Field "${spec.field}" cannot define both index and append`);
    }
    if (spec.remove) {
        if (append) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Field "${spec.field}" cannot use remove together with append`);
        }
        if (!hasIndex) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Field "${spec.field}" remove requires index`);
        }
        ensureNoReferenceSource(spec);
        const fieldDump = readComponentFieldDump(componentDump, spec.field);
        const currentLength = readArrayLength(fieldDump, spec.field);
        const trackedLength = arrayLengthState.get(spec.field) ?? currentLength;
        const resolvedIndex = spec.index;
        if (resolvedIndex >= trackedLength) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Field "${spec.field}" remove index ${resolvedIndex} is out of range`);
        }
        arrayLengthState.set(spec.field, trackedLength - 1);
        return {
            property: spec.field,
            resolvedField: `${spec.field}.${resolvedIndex}`,
            index: resolvedIndex,
            operation,
        };
    }
    if (!hasIndex && !append) {
        return {
            property: spec.field,
            resolvedField: spec.field,
            operation,
        };
    }
    if (append && spec.clear) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Field "${spec.field}" cannot use append together with clear`);
    }
    const fieldDump = readComponentFieldDump(componentDump, spec.field);
    const currentLength = readArrayLength(fieldDump, spec.field);
    const trackedLength = arrayLengthState.get(spec.field) ?? currentLength;
    const resolvedIndex = hasIndex ? spec.index : trackedLength;
    const nextLength = Math.max(trackedLength, resolvedIndex + 1);
    arrayLengthState.set(spec.field, nextLength);
    spec.index = resolvedIndex;
    return {
        property: `${spec.field}.${resolvedIndex}`,
        resolvedField: `${spec.field}.${resolvedIndex}`,
        index: resolvedIndex,
        operation,
    };
}
function ensureNoReferenceSource(spec) {
    const hasSource = !!spec.valueTarget ||
        (typeof spec.valueComponentType === "string" &&
            spec.valueComponentType.trim().length > 0) ||
        (typeof spec.assetUrl === "string" && spec.assetUrl.trim().length > 0) ||
        (typeof spec.assetUuid === "string" && spec.assetUuid.trim().length > 0);
    if (hasSource) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Field "${spec.field}" remove does not accept valueTarget, valueComponentType, assetUrl, or assetUuid`);
    }
}
function readComponentFieldDump(componentDump, field) {
    const segments = field
        .split(".")
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (segments.length === 0) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "component_bind_reference field must not be empty");
    }
    let cursor = componentDump;
    for (const segment of ["value", ...segments]) {
        if (Array.isArray(cursor)) {
            const index = Number(segment);
            if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
                throw new shared_1.AppError("INVALID_ARGUMENT", `Invalid array index "${segment}" while resolving field "${field}"`);
            }
            cursor = cursor[index];
            continue;
        }
        if (!cursor || typeof cursor !== "object") {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Field "${field}" was not found on the component dump`);
        }
        cursor = cursor[segment];
    }
    if (!cursor || typeof cursor !== "object") {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Field "${field}" was not found on the component dump`);
    }
    return cursor;
}
function readArrayLength(fieldDump, field) {
    const rawValue = fieldDump.value;
    if (!Array.isArray(rawValue) && fieldDump.isArray !== true) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Field "${field}" is not an array reference field`);
    }
    return Array.isArray(rawValue) ? rawValue.length : 0;
}
async function resolveReferenceBinding(args, assetFacade, sceneFacade) {
    const valueComponentType = typeof args.valueComponentType === "string"
        ? args.valueComponentType.trim()
        : "";
    const assetUrl = typeof args.assetUrl === "string" ? args.assetUrl : undefined;
    const assetUuid = typeof args.assetUuid === "string" ? args.assetUuid : undefined;
    const hasAsset = !!assetUrl?.trim() || !!assetUuid?.trim();
    const hasValueTarget = !!args.valueTarget;
    if (hasAsset === hasValueTarget) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "Provide exactly one reference source: valueTarget or assetUrl/assetUuid");
    }
    if (hasAsset) {
        const asset = await assetFacade.resolveAsset({
            url: assetUrl,
            uuid: assetUuid,
        });
        return {
            referenceKind: "asset",
            uuid: asset.uuid,
            type: asset.type,
            url: asset.url,
            path: asset.path,
        };
    }
    const valueTarget = (0, v2_shared_1.parseTargetSelector)(args.valueTarget, "valueTarget");
    const valueIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, valueTarget, "valueTarget");
    if (valueComponentType) {
        const componentDump = await sceneFacade.getRawComponentDump({
            nodeUuid: valueIdentifier.uuid,
            nodePath: valueIdentifier.path,
            componentType: valueComponentType,
        });
        const resolvedUuid = readNestedString(componentDump, ["value", "uuid", "value"]);
        if (!resolvedUuid) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Component "${valueComponentType}" uuid is unavailable for reference binding`);
        }
        return {
            referenceKind: "component",
            uuid: resolvedUuid,
            type: valueComponentType,
            path: valueIdentifier.path,
        };
    }
    const node = await sceneFacade.getNode(valueIdentifier);
    return {
        referenceKind: "node",
        uuid: node.uuid,
        type: "cc.Node",
        path: node.path,
    };
}
function inferClearKind(args) {
    if (typeof args.assetUrl === "string" ||
        typeof args.assetUuid === "string") {
        return "asset";
    }
    if (typeof args.valueComponentType === "string" && args.valueComponentType.trim()) {
        return "component";
    }
    return "node";
}
function inferExpectedType(args) {
    if (typeof args.valueComponentType === "string" && args.valueComponentType.trim()) {
        return args.valueComponentType.trim();
    }
    return undefined;
}
function readNestedString(root, path) {
    let cursor = root;
    for (const key of path) {
        if (!cursor || typeof cursor !== "object") {
            return undefined;
        }
        cursor = cursor[key];
    }
    return typeof cursor === "string" && cursor.trim() ? cursor : undefined;
}
function appendBatchSuffix(idempotencyKey, index) {
    return idempotencyKey ? `${idempotencyKey}:${index}` : undefined;
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
                    "component_bind_reference currently applies multi-field writes as sequential verified mutations.",
                ]
                : []),
        ],
        node: results[results.length - 1].node,
    };
}
//# sourceMappingURL=reference-tools.js.map