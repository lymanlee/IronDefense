"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mutationText = mutationText;
exports.withVerificationHint = withVerificationHint;
exports.withPreviewApplyHint = withPreviewApplyHint;
exports.parseTargetSelector = parseTargetSelector;
exports.parseReadView = parseReadView;
exports.createVector3InputSchema = createVector3InputSchema;
exports.parseVector3 = parseVector3;
exports.flattenNodes = flattenNodes;
exports.toNodeMatch = toNodeMatch;
exports.filterNodeView = filterNodeView;
exports.normalizeComponentType = normalizeComponentType;
const shared_1 = require("@cocos-mcp/shared");
function mutationText(result) {
    if (result.preview) {
        return `Preview ready at revision ${result.currentRevision}, next revision ${result.nextRevision}.`;
    }
    return `Applied mutation at revision ${result.appliedRevision}.`;
}
function withVerificationHint(text, result) {
    if (result.preview) {
        return text;
    }
    return `${text} If verification is needed, do one serialized state read after this write, not repeated or parallel polling.`;
}
function withPreviewApplyHint(text, result) {
    return `${text} No scene changes were applied. Re-run with preview=false and expectedRevision=${result.currentRevision} to execute.`;
}
function parseTargetSelector(value, fieldName = "target") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `${fieldName} must be an object with uuid, path, or name`);
    }
    const record = value;
    const selector = {
        uuid: typeof record.uuid === "string" ? record.uuid : undefined,
        path: typeof record.path === "string" ? record.path : undefined,
        name: typeof record.name === "string" ? record.name : undefined,
    };
    if (!selector.uuid && !selector.path && !selector.name) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `${fieldName} must include at least one of uuid, path, or name`);
    }
    return selector;
}
function parseReadView(value) {
    return value === "detail" || value === "standard" ? value : "brief";
}
function createVector3InputSchema() {
    return {
        type: "object",
        properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" },
        },
        required: ["x", "y", "z"],
        additionalProperties: false,
    };
}
function parseVector3(value, property) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `props.${property} must be an object with x, y, z`);
    }
    const candidate = value;
    if (typeof candidate.x !== "number" ||
        typeof candidate.y !== "number" ||
        typeof candidate.z !== "number") {
        throw new shared_1.AppError("INVALID_ARGUMENT", `props.${property}.x, y, z must be numbers`);
    }
    return {
        x: candidate.x,
        y: candidate.y,
        z: candidate.z,
    };
}
function flattenNodes(nodes) {
    const flattened = [];
    const queue = [...nodes];
    while (queue.length > 0) {
        const node = queue.shift();
        flattened.push(node);
        queue.push(...node.children);
    }
    return flattened;
}
function toNodeMatch(node) {
    return {
        uuid: node.uuid,
        name: node.name,
        path: node.path,
        type: node.type,
        childCount: node.childCount ?? node.children.length,
        active: node.active,
    };
}
function filterNodeView(node, options) {
    if (options.view === "brief") {
        const depth = typeof options.depth === "number" ? Math.max(0, options.depth) : 0;
        return cloneNodeBrief(node, depth);
    }
    const depth = typeof options.depth === "number"
        ? Math.max(0, options.depth)
        : options.view === "detail"
            ? Number.POSITIVE_INFINITY
            : 0;
    return cloneNode(node, depth, options.includeComponents);
}
function cloneNodeBrief(node, depth) {
    return {
        uuid: node.uuid,
        name: node.name,
        path: node.path,
        type: node.type ?? "cc.Node",
        childCount: node.childCount ?? node.children.length,
        children: depth > 0
            ? node.children.map((child) => cloneNodeBrief(child, depth - 1))
            : [],
    };
}
function cloneNode(node, depth, includeComponents) {
    return {
        uuid: node.uuid,
        name: node.name,
        path: node.path,
        active: node.active,
        position: node.position,
        rotation: node.rotation,
        scale: node.scale,
        components: includeComponents ? node.components : undefined,
        children: depth > 0
            ? node.children.map((child) => cloneNode(child, depth - 1, includeComponents))
            : [],
    };
}
function normalizeComponentType(componentType) {
    const trimmed = componentType.trim();
    if (!trimmed) {
        return trimmed;
    }
    const parts = trimmed.split(".").filter(Boolean);
    return parts.at(-1) ?? trimmed;
}
//# sourceMappingURL=v2-shared.js.map