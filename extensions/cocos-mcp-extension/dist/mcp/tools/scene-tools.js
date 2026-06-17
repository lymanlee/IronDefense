"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSceneTools = createSceneTools;
const shared_1 = require("@cocos-mcp/shared");
function mutationText(result) {
    if (result.preview) {
        return `Preview ready at revision ${result.currentRevision}, next revision ${result.nextRevision}.`;
    }
    return `Applied mutation at revision ${result.appliedRevision}.`;
}
function parseVector3(value, property) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `value must be an object with x, y, z for property "${property}"`);
    }
    const candidate = value;
    const x = candidate.x;
    const y = candidate.y;
    const z = candidate.z;
    if (typeof x !== "number" ||
        typeof y !== "number" ||
        typeof z !== "number") {
        throw new shared_1.AppError("INVALID_ARGUMENT", `value.x, value.y and value.z must be numbers for property "${property}"`);
    }
    return { x, y, z };
}
function createSceneTools(sceneFacade) {
    return [
        {
            name: "scene_get_hierarchy",
            title: "Scene Hierarchy",
            description: "Return the active scene hierarchy as a node tree.",
            feature: "scene.read",
            inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            handler: async () => {
                const hierarchy = await sceneFacade.getHierarchy();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Returned ${hierarchy.length} root node(s).`,
                        },
                    ],
                    structuredContent: {
                        roots: hierarchy,
                    },
                };
            },
        },
        {
            name: "scene_get_node",
            title: "Scene Node",
            description: "Lookup a node by uuid or path in the active scene.",
            feature: "scene.read",
            inputSchema: {
                type: "object",
                properties: {
                    uuid: { type: "string" },
                    path: { type: "string" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const node = await sceneFacade.getNode({
                    uuid: typeof args.uuid === "string" ? args.uuid : undefined,
                    path: typeof args.path === "string" ? args.path : undefined,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Found node ${node.path}.`,
                        },
                    ],
                    structuredContent: node,
                };
            },
        },
        {
            name: "scene_debug_get_node_dump",
            title: "Scene Node Dump",
            description: "Return the raw editor node dump from `scene.query-node` for debugging editor property paths.",
            feature: "debug.read",
            inputSchema: {
                type: "object",
                properties: {
                    uuid: { type: "string" },
                    path: { type: "string" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const dump = await sceneFacade.getRawNodeDump({
                    uuid: typeof args.uuid === "string" ? args.uuid : undefined,
                    path: typeof args.path === "string" ? args.path : undefined,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: "Returned raw node dump.",
                        },
                    ],
                    structuredContent: dump,
                };
            },
        },
        {
            name: "scene_create_node",
            title: "Create Scene Node",
            description: "Create a child node under a parent. Defaults to preview mode and requires revision for apply.",
            feature: "scene.write",
            inputSchema: {
                type: "object",
                properties: {
                    parentUuid: { type: "string" },
                    parentPath: { type: "string" },
                    name: { type: "string" },
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["name"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const result = await sceneFacade.createNode({
                    parentUuid: typeof args.parentUuid === "string" ? args.parentUuid : undefined,
                    parentPath: typeof args.parentPath === "string" ? args.parentPath : undefined,
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
                            text: mutationText(result),
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
        {
            name: "scene_set_node_property",
            title: "Set Scene Node Property",
            description: "Update a node property. Current V1 supports `name`, `active`, `position`, `rotation`, and `scale`.",
            feature: "scene.write",
            inputSchema: {
                type: "object",
                properties: {
                    nodeUuid: { type: "string" },
                    nodePath: { type: "string" },
                    property: {
                        type: "string",
                        enum: ["name", "active", "position", "rotation", "scale"],
                    },
                    value: {},
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["property", "value"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const property = args.property === "name" ||
                    args.property === "active" ||
                    args.property === "position" ||
                    args.property === "rotation" ||
                    args.property === "scale"
                    ? args.property
                    : "name";
                const normalizedValue = property === "position" ||
                    property === "rotation" ||
                    property === "scale"
                    ? parseVector3(args.value, property)
                    : args.value;
                const result = await sceneFacade.setNodeProperty({
                    nodeUuid: typeof args.nodeUuid === "string" ? args.nodeUuid : undefined,
                    nodePath: typeof args.nodePath === "string" ? args.nodePath : undefined,
                    property,
                    value: normalizedValue,
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
                            text: mutationText(result),
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
    ];
}
//# sourceMappingURL=scene-tools.js.map