"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
const shared_1 = require("@cocos-mcp/shared");
let sceneRevision = 0;
function getSceneRoots() {
    const scene = globalThis.cc?.director?.getScene?.();
    if (!scene) {
        throw new shared_1.AppError("NO_ACTIVE_SCENE", "No active scene is loaded");
    }
    return Array.isArray(scene.children) ? scene.children : [];
}
function buildPath(node) {
    const names = [];
    let cursor = node;
    while (cursor) {
        if (cursor.name) {
            names.unshift(cursor.name);
        }
        cursor = cursor.parent;
    }
    return names.join("/");
}
function matchesNodePath(node, path) {
    const actualPath = buildPath(node);
    return actualPath === path || actualPath.endsWith(`/${path}`);
}
function toSummary(node) {
    const children = Array.isArray(node.children) ? node.children : [];
    return {
        uuid: node.uuid ?? "",
        name: node.name ?? "",
        path: buildPath(node),
        type: "cc.Node",
        childCount: children.length,
        active: Boolean(node.active),
        position: readVectorLike(node.position),
        rotation: readVectorLike(node.eulerAngles),
        scale: readVectorLike(node.scale),
        components: listComponents(node),
        children: children.map(toSummary),
    };
}
function listComponents(node) {
    const components = Array.isArray(node.components) ? node.components : [];
    return components.map((component) => ({
        type: component.constructor?.name ?? "UnknownComponent",
        enabled: typeof component.enabled === "boolean" ? component.enabled : undefined,
    }));
}
function readVectorLike(value) {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const candidate = value;
    if (typeof candidate.x !== "number" ||
        typeof candidate.y !== "number" ||
        typeof candidate.z !== "number") {
        return undefined;
    }
    return {
        x: candidate.x,
        y: candidate.y,
        z: candidate.z,
    };
}
function parsePropertyPath(property) {
    return property
        .split(".")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function setNestedPropertyValue(target, property, value) {
    const segments = parsePropertyPath(property);
    if (segments.length === 0) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "component property path must not be empty");
    }
    let cursor = target;
    for (const segment of segments.slice(0, -1)) {
        if (Array.isArray(cursor)) {
            const index = Number(segment);
            if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
                throw new shared_1.AppError("INVALID_ARGUMENT", `Invalid array index "${segment}" in property path "${property}"`);
            }
            cursor = cursor[index];
            continue;
        }
        if (!cursor || typeof cursor !== "object") {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Cannot resolve nested property path "${property}"`);
        }
        cursor = cursor[segment];
    }
    const lastSegment = segments[segments.length - 1];
    if (Array.isArray(cursor)) {
        const index = Number(lastSegment);
        if (!Number.isInteger(index) || index < 0) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Invalid array index "${lastSegment}" in property path "${property}"`);
        }
        cursor[index] = value;
        return;
    }
    if (!cursor || typeof cursor !== "object") {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Cannot assign nested property path "${property}"`);
    }
    cursor[lastSegment] = value;
}
function removeNestedArrayElement(target, property, index) {
    const segments = parsePropertyPath(property);
    if (segments.length === 0) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "component property path must not be empty");
    }
    let cursor = target;
    for (const segment of segments) {
        if (Array.isArray(cursor)) {
            const nextIndex = Number(segment);
            if (!Number.isInteger(nextIndex) ||
                nextIndex < 0 ||
                nextIndex >= cursor.length) {
                throw new shared_1.AppError("INVALID_ARGUMENT", `Invalid array index "${segment}" in property path "${property}"`);
            }
            cursor = cursor[nextIndex];
            continue;
        }
        if (!cursor || typeof cursor !== "object") {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Cannot resolve nested property path "${property}"`);
        }
        cursor = cursor[segment];
    }
    if (!Array.isArray(cursor)) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Property path "${property}" does not resolve to an array`);
    }
    if (index < 0 || index >= cursor.length) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Invalid array index "${index}" in property path "${property}"`);
    }
    cursor.splice(index, 1);
}
function findNode(roots, predicate) {
    const queue = [...roots];
    while (queue.length > 0) {
        const node = queue.shift();
        if (predicate(node)) {
            return node;
        }
        const children = Array.isArray(node.children) ? node.children : [];
        queue.push(...children);
    }
    return null;
}
function getSceneNodeRoot() {
    const scene = globalThis.cc?.director?.getScene?.();
    if (!scene) {
        throw new shared_1.AppError("NO_ACTIVE_SCENE", "No active scene is loaded");
    }
    return scene;
}
function resolveNode(payload) {
    const roots = getSceneRoots();
    const node = findNode(roots, (current) => {
        if (payload.uuid && current.uuid === payload.uuid) {
            return true;
        }
        if (payload.path && matchesNodePath(current, payload.path)) {
            return true;
        }
        return false;
    });
    if (!node) {
        throw new shared_1.AppError("NODE_NOT_FOUND", "Scene node was not found", payload);
    }
    return node;
}
function assertRevisionForApply(payload) {
    const preview = payload.preview ?? true;
    if (preview) {
        return;
    }
    if (typeof payload.expectedRevision !== "number") {
        throw new shared_1.AppError("INVALID_ARGUMENT", "expectedRevision is required when preview is false");
    }
    if (payload.expectedRevision !== sceneRevision) {
        throw new shared_1.AppError("REVISION_CONFLICT", `Expected revision ${payload.expectedRevision}, current revision is ${sceneRevision}`, {
            expectedRevision: payload.expectedRevision,
            currentRevision: sceneRevision,
        });
    }
}
function createMutationResult(options) {
    return {
        ok: true,
        preview: options.preview,
        currentRevision: options.currentRevision,
        nextRevision: options.nextRevision,
        appliedRevision: options.preview ? undefined : options.nextRevision,
        changeSummary: options.changeSummary,
        warnings: options.warnings ?? [],
        node: options.node ? toSummary(options.node) : undefined,
    };
}
function cloneNodeForPreview(node) {
    return {
        ...node,
        position: node.position ? { ...node.position } : undefined,
        eulerAngles: node.eulerAngles ? { ...node.eulerAngles } : undefined,
        scale: node.scale ? { ...node.scale } : undefined,
        components: Array.isArray(node.components)
            ? node.components.map((component) => ({
                ...component,
                constructor: component.constructor?.name
                    ? { name: component.constructor.name }
                    : undefined,
            }))
            : undefined,
    };
}
function detachNode(node) {
    const parent = node.parent;
    if (!parent) {
        return;
    }
    if (typeof node.removeFromParent === "function") {
        node.removeFromParent();
        return;
    }
    const siblings = Array.isArray(parent.children) ? parent.children : [];
    const index = siblings.indexOf(node);
    if (index >= 0) {
        siblings.splice(index, 1);
    }
    node.parent = null;
}
function attachNode(parent, node, siblingIndex) {
    const siblings = Array.isArray(parent.children) ? parent.children : [];
    if (typeof parent.addChild === "function" && siblingIndex === undefined) {
        parent.addChild(node);
        return;
    }
    node.parent = parent;
    const insertIndex = typeof siblingIndex === "number"
        ? Math.max(0, Math.min(siblingIndex, siblings.length))
        : siblings.length;
    siblings.splice(insertIndex, 0, node);
    parent.children = siblings;
}
function normalizeComponentTypeName(componentType) {
    const parts = componentType.split(".").filter(Boolean);
    return parts.at(-1) ?? componentType;
}
function matchesComponentType(component, componentType) {
    const normalized = normalizeComponentTypeName(componentType);
    const candidates = [
        component.constructor?.name,
        component.name,
        component.__classname__,
    ].filter((value) => typeof value === "string" && value.length > 0);
    return candidates.some((candidate) => {
        if (candidate === componentType || candidate === normalized) {
            return true;
        }
        return (candidate.endsWith(`.${normalized}`) ||
            candidate.endsWith(`/${normalized}`));
    });
}
function resolveComponentClass(componentType) {
    const ccNamespace = globalThis.cc;
    if (!ccNamespace || typeof ccNamespace !== "object") {
        throw new shared_1.AppError("INTERNAL_ERROR", "cc namespace is unavailable for component resolution");
    }
    const parts = componentType.split(".").filter(Boolean);
    let current = ccNamespace;
    if (parts[0] === "cc") {
        parts.shift();
    }
    for (const part of parts) {
        if (!current || typeof current !== "object" || !(part in current)) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Unsupported component type "${componentType}"`);
        }
        current = current[part];
    }
    if (typeof current !== "function") {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Resolved component type "${componentType}" is not constructible`);
    }
    return current;
}
function ensureComponentTypeSupportedForPreview(componentType) {
    try {
        resolveComponentClass(componentType);
        return;
    }
    catch (error) {
        if (error instanceof shared_1.AppError &&
            error.code === "INVALID_ARGUMENT" &&
            resolveCustomComponentClassName(componentType)) {
            return;
        }
        throw error;
    }
}
function resolveCustomComponentClassName(componentType) {
    const normalized = normalizeComponentTypeName(componentType).trim();
    if (!normalized) {
        return null;
    }
    const roots = getSceneRoots();
    const queue = [...roots];
    while (queue.length > 0) {
        const node = queue.shift();
        const components = Array.isArray(node.components) ? node.components : [];
        for (const component of components) {
            if (matchesComponentType(component, normalized)) {
                return component.constructor?.name ?? normalized;
            }
        }
        const children = Array.isArray(node.children) ? node.children : [];
        queue.push(...children);
    }
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized) ? normalized : null;
}
function resolveComponentOnNode(node, componentType) {
    const components = Array.isArray(node.components) ? node.components : [];
    const matched = components.find((component) => matchesComponentType(component, componentType));
    if (!matched) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Component "${componentType}" was not found on node ${buildPath(node)}`);
    }
    return matched;
}
function resolveNodeComponentReference(payload) {
    if (!payload.componentType?.trim()) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "componentType is required");
    }
    const node = resolveNode({
        uuid: payload.nodeUuid,
        path: payload.nodePath,
    });
    const component = resolveComponentOnNode(node, payload.componentType);
    return {
        uuid: component.uuid ?? "",
        type: component.constructor?.name ?? normalizeComponentTypeName(payload.componentType),
        enabled: typeof component.enabled === "boolean" ? component.enabled : undefined,
    };
}
function resolveSupportedEventSlot(componentType, eventName) {
    const normalizedComponent = normalizeComponentTypeName(componentType?.trim() || "cc.Button");
    const normalizedEvent = (eventName?.trim() || "click").toLowerCase();
    if (normalizedComponent === "Button") {
        if (normalizedEvent !== "click" && normalizedEvent !== "onclick") {
            throw new shared_1.AppError("NOT_IMPLEMENTED", `Unsupported event name "${eventName ?? "click"}" for ${componentType ?? "cc.Button"}`);
        }
        return {
            componentType: "cc.Button",
            eventName: "click",
            propertyName: "clickEvents",
        };
    }
    if (normalizedComponent === "Toggle") {
        if (normalizedEvent !== "toggle" &&
            normalizedEvent !== "check" &&
            normalizedEvent !== "oncheck") {
            throw new shared_1.AppError("NOT_IMPLEMENTED", `Unsupported event name "${eventName ?? "toggle"}" for ${componentType ?? "cc.Toggle"}`);
        }
        return {
            componentType: "cc.Toggle",
            eventName: "toggle",
            propertyName: "checkEvents",
        };
    }
    if (normalizedComponent === "ToggleContainer") {
        if (normalizedEvent !== "toggle" &&
            normalizedEvent !== "check" &&
            normalizedEvent !== "oncheck") {
            throw new shared_1.AppError("NOT_IMPLEMENTED", `Unsupported event name "${eventName ?? "toggle"}" for ${componentType ?? "cc.ToggleContainer"}`);
        }
        return {
            componentType: "cc.ToggleContainer",
            eventName: "toggle",
            propertyName: "checkEvents",
        };
    }
    if (normalizedComponent === "Slider") {
        if (normalizedEvent !== "slide" &&
            normalizedEvent !== "slider" &&
            normalizedEvent !== "onslide") {
            throw new shared_1.AppError("NOT_IMPLEMENTED", `Unsupported event name "${eventName ?? "slide"}" for ${componentType ?? "cc.Slider"}`);
        }
        return {
            componentType: "cc.Slider",
            eventName: "slide",
            propertyName: "slideEvents",
        };
    }
    if (normalizedComponent === "EditBox") {
        if (normalizedEvent === "begin" ||
            normalizedEvent === "began" ||
            normalizedEvent === "editingdidbegan" ||
            normalizedEvent === "oneditingdidbegan") {
            return {
                componentType: "cc.EditBox",
                eventName: "begin",
                propertyName: "editingDidBegan",
            };
        }
        if (normalizedEvent === "change" ||
            normalizedEvent === "changed" ||
            normalizedEvent === "input" ||
            normalizedEvent === "textchanged" ||
            normalizedEvent === "ontextchanged") {
            return {
                componentType: "cc.EditBox",
                eventName: "change",
                propertyName: "textChanged",
            };
        }
        if (normalizedEvent === "end" ||
            normalizedEvent === "ended" ||
            normalizedEvent === "editingdidended" ||
            normalizedEvent === "oneditingdidended") {
            return {
                componentType: "cc.EditBox",
                eventName: "end",
                propertyName: "editingDidEnded",
            };
        }
        if (normalizedEvent === "return" ||
            normalizedEvent === "submit" ||
            normalizedEvent === "editingreturn" ||
            normalizedEvent === "oneditingreturn") {
            return {
                componentType: "cc.EditBox",
                eventName: "return",
                propertyName: "editingReturn",
            };
        }
        throw new shared_1.AppError("NOT_IMPLEMENTED", `Unsupported event name "${eventName ?? "begin"}" for ${componentType ?? "cc.EditBox"}`);
    }
    throw new shared_1.AppError("NOT_IMPLEMENTED", `Unsupported component event source "${componentType ?? "cc.Button"}"`);
}
function resolveEventHandlerCtor() {
    const ccNamespace = globalThis.cc;
    const candidate = ccNamespace?.Component?.EventHandler ?? ccNamespace?.EventHandler;
    if (typeof candidate !== "function") {
        throw new shared_1.AppError("INTERNAL_ERROR", "EventHandler constructor is unavailable");
    }
    return candidate;
}
function toNodeRef(node) {
    if (!node) {
        return undefined;
    }
    return {
        uuid: node.uuid,
        name: node.name,
        path: buildPath(node),
    };
}
function toEventBindingSummary(value, index, eventName) {
    const record = value && typeof value === "object"
        ? value
        : {};
    const target = record.target && typeof record.target === "object"
        ? toNodeRef(record.target)
        : undefined;
    return {
        index,
        eventName,
        target,
        componentType: typeof record.component === "string" ? record.component : undefined,
        handlerMethod: typeof record.handler === "string" ? record.handler : undefined,
        customEventData: typeof record.customEventData === "string"
            ? record.customEventData
            : undefined,
    };
}
function readEventBindingSummaries(component, slot) {
    const values = Array.isArray(component[slot.propertyName])
        ? component[slot.propertyName]
        : [];
    return values.map((entry, index) => toEventBindingSummary(entry, index, slot.eventName));
}
function assertHandlerMethodExists(component, handlerMethod) {
    if (!handlerMethod.trim()) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "handlerMethod is required");
    }
    if (typeof component[handlerMethod] !== "function") {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Handler method "${handlerMethod}" was not found on component`);
    }
}
function createEventHandlerBinding(input) {
    const EventHandlerCtor = resolveEventHandlerCtor();
    const handler = new EventHandlerCtor();
    handler.target = input.target;
    handler.component = input.componentType;
    handler.handler = input.handlerMethod;
    handler.customEventData = input.customEventData ?? "";
    return handler;
}
function findMatchingEventBindingIndex(values, eventName, expected) {
    const expectedPath = buildPath(expected.target);
    return values.findIndex((entry, index) => {
        const summary = toEventBindingSummary(entry, index, eventName);
        const componentTypeMatches = !summary.componentType ||
            summary.componentType === expected.componentType;
        return (summary.target?.path === expectedPath &&
            componentTypeMatches &&
            summary.handlerMethod === expected.handlerMethod &&
            (summary.customEventData ?? "") === (expected.customEventData ?? ""));
    });
}
function resolveEventBindingIndexToRemove(payload, eventName, currentValues) {
    const hasIndex = Number.isInteger(payload.index);
    const hasHandlerMatch = (!!payload.handlerNodeUuid || !!payload.handlerNodePath) &&
        !!payload.handlerComponentType?.trim() &&
        !!payload.handlerMethod?.trim();
    if (hasIndex === hasHandlerMatch) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "Provide exactly one unbind selector: index or handler target + component + method");
    }
    if (hasIndex) {
        return payload.index;
    }
    const handlerNode = resolveNode({
        uuid: payload.handlerNodeUuid,
        path: payload.handlerNodePath,
    });
    const handlerComponent = resolveComponentOnNode(handlerNode, payload.handlerComponentType.trim());
    const handlerComponentName = handlerComponent.constructor?.name ??
        normalizeComponentTypeName(payload.handlerComponentType.trim());
    const resolvedIndex = findMatchingEventBindingIndex(currentValues, eventName, {
        target: handlerNode,
        componentType: handlerComponentName,
        handlerMethod: payload.handlerMethod.trim(),
        customEventData: payload.customEventData,
    });
    if (resolvedIndex >= 0) {
        return resolvedIndex;
    }
    throw new shared_1.AppError("INVALID_ARGUMENT", "Matching event binding was not found", {
        reason: "No existing event binding matched the provided handler selector",
        context: {
            eventName,
            handlerNodePath: buildPath(handlerNode),
            handlerComponentType: handlerComponentName,
            handlerMethod: payload.handlerMethod?.trim(),
            customEventData: payload.customEventData ?? "",
        },
        candidates: currentValues.map((entry, index) => toEventBindingSummary(entry, index, eventName)),
        suggestion: "Use component_event_list first or switch to index-based unbind.",
    });
}
function buildEventListResult(node, slot, component) {
    return {
        componentType: slot.componentType,
        eventName: slot.eventName,
        target: toNodeRef(node) ?? {},
        bindings: readEventBindingSummaries(component, slot),
    };
}
function createEventMutationResult(options) {
    return {
        ...createMutationResult({
            preview: options.preview,
            currentRevision: options.currentRevision,
            nextRevision: options.nextRevision,
            node: options.node,
            changeSummary: options.changeSummary,
            warnings: options.warnings,
        }),
        componentType: options.componentType,
        eventName: options.eventName,
        bindings: readEventBindingSummaries(options.component, {
            propertyName: options.propertyName,
            eventName: options.eventName,
        }),
        changedIndex: options.changedIndex,
        removedIndex: options.removedIndex,
        noop: options.noop,
    };
}
function parseVector3Value(value, property) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `value must be an object with x, y, z for property "${property}"`);
    }
    const candidate = value;
    if (typeof candidate.x !== "number" ||
        typeof candidate.y !== "number" ||
        typeof candidate.z !== "number") {
        throw new shared_1.AppError("INVALID_ARGUMENT", `value.x, value.y and value.z must be numbers for property "${property}"`);
    }
    return {
        x: candidate.x,
        y: candidate.y,
        z: candidate.z,
    };
}
function applyVector3Property(node, property, value) {
    if (property === "position") {
        if (typeof node.setPosition === "function") {
            node.setPosition(value.x, value.y, value.z);
            return;
        }
        node.position = { ...value };
        return;
    }
    if (property === "rotation") {
        if (typeof node.setRotationFromEuler === "function") {
            node.setRotationFromEuler(value.x, value.y, value.z);
            return;
        }
        node.eulerAngles = { ...value };
        return;
    }
    if (typeof node.setScale === "function") {
        node.setScale(value.x, value.y, value.z);
        return;
    }
    node.scale = { ...value };
}
function loadAssetByUuid(uuid) {
    const assetManager = globalThis.cc?.assetManager;
    if (!assetManager?.loadAny) {
        throw new shared_1.AppError("EDITOR_NOT_READY", "cc.assetManager.loadAny is unavailable");
    }
    return new Promise((resolve, reject) => {
        assetManager.loadAny(uuid, (error, asset) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(asset);
        });
    });
}
function cloneNodeSummaryWithoutChildren(node) {
    const summary = toSummary(node);
    return {
        ...summary,
        children: [],
    };
}
function load() { }
function unload() { }
function getSceneRevision() {
    return sceneRevision;
}
function getSceneInfo() {
    const scene = getSceneNodeRoot();
    return {
        sceneName: scene.name ?? "active-scene",
        sceneUuid: scene.uuid,
        sceneInternalId: scene.uuid,
    };
}
function advanceSceneRevision() {
    sceneRevision += 1;
    return sceneRevision;
}
function getSceneTreeData() {
    return getSceneRoots().map(toSummary);
}
function getNodeDetails(payload) {
    return toSummary(resolveNode(payload));
}
function createNode(payload) {
    if (!payload.parentUuid && !payload.parentPath) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "parentUuid or parentPath is required");
    }
    if (!payload.name?.trim()) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "name is required");
    }
    const parent = resolveNode({
        uuid: payload.parentUuid,
        path: payload.parentPath,
    });
    const preview = payload.preview ?? true;
    const currentRevision = sceneRevision;
    const nextRevision = currentRevision + 1;
    const previewNode = {
        uuid: preview ? "__preview__" : undefined,
        name: payload.name.trim(),
        active: true,
        children: [],
        parent,
    };
    assertRevisionForApply(payload);
    if (preview) {
        return createMutationResult({
            preview: true,
            currentRevision,
            nextRevision,
            node: previewNode,
            changeSummary: [`Create child node "${payload.name.trim()}" under ${buildPath(parent)}`],
        });
    }
    const NodeCtor = globalThis.cc?.Node;
    if (typeof NodeCtor !== "function") {
        throw new shared_1.AppError("INTERNAL_ERROR", "cc.Node constructor is unavailable");
    }
    const node = new NodeCtor(payload.name.trim());
    if (typeof parent.addChild === "function") {
        parent.addChild(node);
    }
    else {
        const children = Array.isArray(parent.children) ? parent.children : [];
        children.push(node);
        parent.children = children;
        node.parent = parent;
    }
    sceneRevision = nextRevision;
    return createMutationResult({
        preview: false,
        currentRevision,
        nextRevision,
        node,
        changeSummary: [`Created child node "${payload.name.trim()}" under ${buildPath(parent)}`],
    });
}
async function instantiatePrefab(payload) {
    if (!payload.prefabUuid?.trim()) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "prefabUuid is required");
    }
    if (!payload.parentUuid && !payload.parentPath) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "parentUuid or parentPath is required");
    }
    const parent = resolveNode({
        uuid: payload.parentUuid,
        path: payload.parentPath,
    });
    const preview = payload.preview ?? true;
    const currentRevision = sceneRevision;
    const nextRevision = currentRevision + 1;
    assertRevisionForApply(payload);
    const prefabAsset = (await loadAssetByUuid(payload.prefabUuid.trim()));
    const prefabName = typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim()
        : typeof prefabAsset?.name === "string" && prefabAsset.name.trim()
            ? prefabAsset.name.trim()
            : "PrefabInstance";
    if (preview) {
        const previewNode = {
            uuid: "__preview__",
            name: prefabName,
            active: true,
            children: [],
            parent,
        };
        if (payload.position) {
            previewNode.position = { ...payload.position };
        }
        return {
            ...createMutationResult({
                preview: true,
                currentRevision,
                nextRevision,
                node: previewNode,
                changeSummary: [
                    `Instantiate prefab "${prefabName}" under ${buildPath(parent)}`,
                ],
            }),
            prefab: {
                uuid: payload.prefabUuid.trim(),
                name: prefabName,
                url: "",
                type: "cc.Prefab",
            },
        };
    }
    const instantiateFn = globalThis.cc?.instantiate;
    if (typeof instantiateFn !== "function") {
        throw new shared_1.AppError("EDITOR_NOT_READY", "cc.instantiate is unavailable");
    }
    const node = instantiateFn(prefabAsset);
    if (!node || typeof node !== "object") {
        throw new shared_1.AppError("INTERNAL_ERROR", "Failed to instantiate prefab asset");
    }
    if (payload.name?.trim()) {
        node.name = payload.name.trim();
    }
    if (payload.position) {
        applyVector3Property(node, "position", payload.position);
    }
    attachNode(parent, node);
    sceneRevision = nextRevision;
    return {
        ...createMutationResult({
            preview: false,
            currentRevision,
            nextRevision,
            node,
            changeSummary: [
                `Instantiated prefab "${node.name ?? prefabName}" under ${buildPath(parent)}`,
            ],
        }),
        prefab: {
            uuid: payload.prefabUuid.trim(),
            name: typeof prefabAsset?.name === "string" && prefabAsset.name.trim()
                ? prefabAsset.name.trim()
                : prefabName,
            url: "",
            type: "cc.Prefab",
        },
        node: cloneNodeSummaryWithoutChildren(node),
    };
}
function updateNodeProperty(payload) {
    const node = resolveNode({
        uuid: payload.nodeUuid,
        path: payload.nodePath,
    });
    const preview = payload.preview ?? true;
    const currentRevision = sceneRevision;
    const nextRevision = currentRevision + 1;
    assertRevisionForApply(payload);
    if (payload.property === "name") {
        if (typeof payload.value !== "string" || !payload.value.trim()) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "value must be a non-empty string for property 'name'");
        }
        if (preview) {
            const previewNode = cloneNodeForPreview(node);
            previewNode.name = payload.value.trim();
            return createMutationResult({
                preview: true,
                currentRevision,
                nextRevision,
                node: previewNode,
                changeSummary: [`Rename node ${buildPath(node)} to "${payload.value.trim()}"`],
            });
        }
        node.name = payload.value.trim();
    }
    else if (payload.property === "active") {
        if (typeof payload.value !== "boolean") {
            throw new shared_1.AppError("INVALID_ARGUMENT", "value must be boolean for property 'active'");
        }
        if (preview) {
            const previewNode = cloneNodeForPreview(node);
            previewNode.active = payload.value;
            return createMutationResult({
                preview: true,
                currentRevision,
                nextRevision,
                node: previewNode,
                changeSummary: [`Set node ${buildPath(node)} active=${String(payload.value)}`],
            });
        }
        node.active = payload.value;
    }
    else if (payload.property === "position" ||
        payload.property === "rotation" ||
        payload.property === "scale") {
        const vector = parseVector3Value(payload.value, payload.property);
        if (preview) {
            const previewNode = cloneNodeForPreview(node);
            applyVector3Property(previewNode, payload.property, vector);
            return createMutationResult({
                preview: true,
                currentRevision,
                nextRevision,
                node: previewNode,
                changeSummary: [
                    `Set node ${buildPath(node)} ${payload.property}=(${vector.x}, ${vector.y}, ${vector.z})`,
                ],
            });
        }
        applyVector3Property(node, payload.property, vector);
    }
    else {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Unsupported property "${payload.property}"`);
    }
    sceneRevision = nextRevision;
    return createMutationResult({
        preview: false,
        currentRevision,
        nextRevision,
        node,
        changeSummary: [`Updated ${payload.property} on ${buildPath(node)}`],
    });
}
function addComponent(payload) {
    if (!payload.componentType?.trim()) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "componentType is required");
    }
    const node = resolveNode({
        uuid: payload.nodeUuid,
        path: payload.nodePath,
    });
    const preview = payload.preview ?? true;
    const currentRevision = sceneRevision;
    const nextRevision = currentRevision + 1;
    assertRevisionForApply(payload);
    if (preview) {
        ensureComponentTypeSupportedForPreview(payload.componentType);
        const previewNode = cloneNodeForPreview(node);
        const previewComponents = Array.isArray(previewNode.components)
            ? [...previewNode.components]
            : [];
        previewComponents.push({
            enabled: true,
            constructor: {
                name: normalizeComponentTypeName(payload.componentType),
            },
        });
        previewNode.components = previewComponents;
        return createMutationResult({
            preview: true,
            currentRevision,
            nextRevision,
            node: previewNode,
            changeSummary: [
                `Add component "${payload.componentType}" to ${buildPath(node)}`,
            ],
        });
    }
    const ctor = resolveComponentClass(payload.componentType);
    if (typeof node.addComponent === "function") {
        node.addComponent(ctor);
    }
    else {
        const components = Array.isArray(node.components) ? node.components : [];
        components.push({
            enabled: true,
            node,
            constructor: {
                name: normalizeComponentTypeName(payload.componentType),
            },
        });
        node.components = components;
    }
    sceneRevision = nextRevision;
    return createMutationResult({
        preview: false,
        currentRevision,
        nextRevision,
        node,
        changeSummary: [`Added component "${payload.componentType}" to ${buildPath(node)}`],
    });
}
function moveNode(payload) {
    const node = resolveNode({
        uuid: payload.nodeUuid,
        path: payload.nodePath,
    });
    const newParent = resolveNode({
        uuid: payload.newParentUuid,
        path: payload.newParentPath,
    });
    const preview = payload.preview ?? true;
    const currentRevision = sceneRevision;
    const nextRevision = currentRevision + 1;
    assertRevisionForApply(payload);
    if (preview) {
        return createMutationResult({
            preview: true,
            currentRevision,
            nextRevision,
            node: cloneNodeForPreview(node),
            changeSummary: [`Move node ${buildPath(node)} under ${buildPath(newParent)}`],
            warnings: payload.keepWorldTransform
                ? ["keepWorldTransform is accepted but not simulated in preview."]
                : [],
        });
    }
    detachNode(node);
    attachNode(newParent, node, payload.siblingIndex);
    sceneRevision = nextRevision;
    return createMutationResult({
        preview: false,
        currentRevision,
        nextRevision,
        node,
        changeSummary: [`Moved node ${node.name ?? node.uuid ?? "unknown"} under ${buildPath(newParent)}`],
        warnings: payload.keepWorldTransform
            ? ["keepWorldTransform was requested but no transform compensation was applied."]
            : [],
    });
}
function deleteNode(payload) {
    const node = resolveNode({
        uuid: payload.nodeUuid,
        path: payload.nodePath,
    });
    if (!node.parent) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "Root-level scene nodes cannot be deleted by deleteNode");
    }
    const preview = payload.preview ?? true;
    const currentRevision = sceneRevision;
    const nextRevision = currentRevision + 1;
    assertRevisionForApply(payload);
    if (preview) {
        return createMutationResult({
            preview: true,
            currentRevision,
            nextRevision,
            node: cloneNodeForPreview(node),
            changeSummary: [`Delete node ${buildPath(node)}`],
        });
    }
    detachNode(node);
    sceneRevision = nextRevision;
    return createMutationResult({
        preview: false,
        currentRevision,
        nextRevision,
        changeSummary: [`Deleted node ${node.name ?? node.uuid ?? "unknown"}`],
    });
}
function updateComponentProperty(payload) {
    if (!payload.componentType?.trim() || !payload.property?.trim()) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "componentType and property are required");
    }
    const node = resolveNode({
        uuid: payload.nodeUuid,
        path: payload.nodePath,
    });
    const preview = payload.preview ?? true;
    const currentRevision = sceneRevision;
    const nextRevision = currentRevision + 1;
    assertRevisionForApply(payload);
    const component = resolveComponentOnNode(node, payload.componentType);
    if (preview) {
        const previewNode = cloneNodeForPreview(node);
        const previewComponent = resolveComponentOnNode(previewNode, payload.componentType);
        setNestedPropertyValue(previewComponent, payload.property, payload.value);
        return createMutationResult({
            preview: true,
            currentRevision,
            nextRevision,
            node: previewNode,
            changeSummary: [
                `Set component "${payload.componentType}" property "${payload.property}" on ${buildPath(node)}`,
            ],
        });
    }
    setNestedPropertyValue(component, payload.property, payload.value);
    sceneRevision = nextRevision;
    return createMutationResult({
        preview: false,
        currentRevision,
        nextRevision,
        node,
        changeSummary: [
            `Updated component "${payload.componentType}" property "${payload.property}" on ${buildPath(node)}`,
        ],
    });
}
function removeComponentArrayElement(payload) {
    if (!payload.componentType?.trim() || !payload.property?.trim()) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "componentType and property are required");
    }
    if (!Number.isInteger(payload.index) || payload.index < 0) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "index must be a non-negative integer");
    }
    const node = resolveNode({
        uuid: payload.nodeUuid,
        path: payload.nodePath,
    });
    const preview = payload.preview ?? true;
    const currentRevision = sceneRevision;
    const nextRevision = currentRevision + 1;
    assertRevisionForApply(payload);
    const component = resolveComponentOnNode(node, payload.componentType);
    if (preview) {
        const previewNode = cloneNodeForPreview(node);
        const previewComponent = resolveComponentOnNode(previewNode, payload.componentType);
        removeNestedArrayElement(previewComponent, payload.property, payload.index);
        return createMutationResult({
            preview: true,
            currentRevision,
            nextRevision,
            node: previewNode,
            changeSummary: [
                `Remove component "${payload.componentType}" array element "${payload.property}.${payload.index}" on ${buildPath(node)}`,
            ],
        });
    }
    removeNestedArrayElement(component, payload.property, payload.index);
    sceneRevision = nextRevision;
    return createMutationResult({
        preview: false,
        currentRevision,
        nextRevision,
        node,
        changeSummary: [
            `Removed component "${payload.componentType}" array element "${payload.property}.${payload.index}" on ${buildPath(node)}`,
        ],
    });
}
function listComponentEvents(payload) {
    const slot = resolveSupportedEventSlot(payload.componentType, payload.eventName);
    const node = resolveNode({
        uuid: payload.nodeUuid,
        path: payload.nodePath,
    });
    const component = resolveComponentOnNode(node, slot.componentType);
    return buildEventListResult(node, slot, component);
}
function bindComponentEvent(payload) {
    if (!payload.handlerComponentType?.trim()) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "handlerComponentType is required");
    }
    if (!payload.handlerMethod?.trim()) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "handlerMethod is required");
    }
    if (!payload.handlerNodeUuid && !payload.handlerNodePath) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "handlerNodeUuid or handlerNodePath is required");
    }
    const slot = resolveSupportedEventSlot(payload.componentType, payload.eventName);
    const node = resolveNode({
        uuid: payload.nodeUuid,
        path: payload.nodePath,
    });
    const handlerNode = resolveNode({
        uuid: payload.handlerNodeUuid,
        path: payload.handlerNodePath,
    });
    const preview = payload.preview ?? true;
    const currentRevision = sceneRevision;
    const nextRevision = currentRevision + 1;
    assertRevisionForApply(payload);
    const sourceComponent = resolveComponentOnNode(node, slot.componentType);
    const handlerComponent = resolveComponentOnNode(handlerNode, payload.handlerComponentType);
    assertHandlerMethodExists(handlerComponent, payload.handlerMethod);
    const handlerComponentName = handlerComponent.constructor?.name ??
        normalizeComponentTypeName(payload.handlerComponentType);
    const currentValues = Array.isArray(sourceComponent[slot.propertyName])
        ? [...sourceComponent[slot.propertyName]]
        : [];
    const dedupe = payload.dedupe ?? true;
    const existingIndex = findMatchingEventBindingIndex(currentValues, slot.eventName, {
        target: handlerNode,
        componentType: handlerComponentName,
        handlerMethod: payload.handlerMethod,
        customEventData: payload.customEventData,
    });
    if (dedupe && existingIndex >= 0) {
        return createEventMutationResult({
            preview,
            currentRevision,
            nextRevision: currentRevision,
            node,
            componentType: slot.componentType,
            eventName: slot.eventName,
            component: sourceComponent,
            propertyName: slot.propertyName,
            changeSummary: [
                `Event binding already exists on ${buildPath(node)} and was not duplicated`,
            ],
            warnings: ["Equivalent event binding already exists."],
            changedIndex: existingIndex,
            noop: true,
        });
    }
    const newBinding = createEventHandlerBinding({
        target: handlerNode,
        componentType: handlerComponentName,
        handlerMethod: payload.handlerMethod,
        customEventData: payload.customEventData,
    });
    if (preview) {
        const previewNode = cloneNodeForPreview(node);
        const previewComponent = resolveComponentOnNode(previewNode, slot.componentType);
        const previewValues = Array.isArray(previewComponent[slot.propertyName])
            ? [...previewComponent[slot.propertyName]]
            : [];
        previewValues.push(newBinding);
        previewComponent[slot.propertyName] = previewValues;
        return createEventMutationResult({
            preview: true,
            currentRevision,
            nextRevision,
            node,
            componentType: slot.componentType,
            eventName: slot.eventName,
            component: previewComponent,
            propertyName: slot.propertyName,
            changeSummary: [
                `Bind ${slot.eventName} event on ${buildPath(node)} to ${buildPath(handlerNode)}.${payload.handlerMethod}`,
            ],
            changedIndex: previewValues.length - 1,
        });
    }
    const nextValues = [...currentValues, newBinding];
    sourceComponent[slot.propertyName] = nextValues;
    sceneRevision = nextRevision;
    return createEventMutationResult({
        preview: false,
        currentRevision,
        nextRevision,
        node,
        componentType: slot.componentType,
        eventName: slot.eventName,
        component: sourceComponent,
        propertyName: slot.propertyName,
        changeSummary: [
            `Bound ${slot.eventName} event on ${buildPath(node)} to ${buildPath(handlerNode)}.${payload.handlerMethod}`,
        ],
        changedIndex: nextValues.length - 1,
    });
}
function unbindComponentEvent(payload) {
    const slot = resolveSupportedEventSlot(payload.componentType, payload.eventName);
    const node = resolveNode({
        uuid: payload.nodeUuid,
        path: payload.nodePath,
    });
    const preview = payload.preview ?? true;
    const currentRevision = sceneRevision;
    const nextRevision = currentRevision + 1;
    assertRevisionForApply(payload);
    const sourceComponent = resolveComponentOnNode(node, slot.componentType);
    const currentValues = Array.isArray(sourceComponent[slot.propertyName])
        ? [...sourceComponent[slot.propertyName]]
        : [];
    const removeIndex = resolveEventBindingIndexToRemove(payload, slot.eventName, currentValues);
    if (removeIndex < 0 || removeIndex >= currentValues.length) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Event binding index ${removeIndex} is out of range`);
    }
    if (preview) {
        const previewNode = cloneNodeForPreview(node);
        const previewComponent = resolveComponentOnNode(previewNode, slot.componentType);
        const previewValues = Array.isArray(previewComponent[slot.propertyName])
            ? [...previewComponent[slot.propertyName]]
            : [];
        previewValues.splice(removeIndex, 1);
        previewComponent[slot.propertyName] = previewValues;
        return createEventMutationResult({
            preview: true,
            currentRevision,
            nextRevision,
            node,
            componentType: slot.componentType,
            eventName: slot.eventName,
            component: previewComponent,
            propertyName: slot.propertyName,
            changeSummary: [
                `Remove ${slot.eventName} event binding #${removeIndex} from ${buildPath(node)}`,
            ],
            removedIndex: removeIndex,
        });
    }
    currentValues.splice(removeIndex, 1);
    sourceComponent[slot.propertyName] = currentValues;
    sceneRevision = nextRevision;
    return createEventMutationResult({
        preview: false,
        currentRevision,
        nextRevision,
        node,
        componentType: slot.componentType,
        eventName: slot.eventName,
        component: sourceComponent,
        propertyName: slot.propertyName,
        changeSummary: [
            `Removed ${slot.eventName} event binding #${removeIndex} from ${buildPath(node)}`,
        ],
        removedIndex: removeIndex,
    });
}
function removeComponent(payload) {
    if (!payload.componentType?.trim()) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "componentType is required");
    }
    const node = resolveNode({
        uuid: payload.nodeUuid,
        path: payload.nodePath,
    });
    const preview = payload.preview ?? true;
    const currentRevision = sceneRevision;
    const nextRevision = currentRevision + 1;
    assertRevisionForApply(payload);
    resolveComponentOnNode(node, payload.componentType);
    if (preview) {
        return createMutationResult({
            preview: true,
            currentRevision,
            nextRevision,
            node: cloneNodeForPreview(node),
            changeSummary: [
                `Remove component "${payload.componentType}" from ${buildPath(node)}`,
            ],
        });
    }
    const components = Array.isArray(node.components) ? node.components : [];
    const index = components.findIndex((component) => matchesComponentType(component, payload.componentType));
    if (index < 0) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `Component "${payload.componentType}" was not found on node ${buildPath(node)}`);
    }
    components.splice(index, 1);
    node.components = components;
    sceneRevision = nextRevision;
    return createMutationResult({
        preview: false,
        currentRevision,
        nextRevision,
        node,
        changeSummary: [
            `Removed component "${payload.componentType}" from ${buildPath(node)}`,
        ],
    });
}
exports.methods = {
    getSceneInfo,
    getSceneRevision,
    advanceSceneRevision,
    getSceneTreeData,
    getNodeDetails,
    resolveNodeComponentReference,
    createNode,
    instantiatePrefab,
    updateNodeProperty,
    addComponent,
    updateComponentProperty,
    removeComponentArrayElement,
    listComponentEvents,
    bindComponentEvent,
    unbindComponentEvent,
    moveNode,
    deleteNode,
    removeComponent,
};
//# sourceMappingURL=scene.js.map