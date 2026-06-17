"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQueryTools = createQueryTools;
const shared_1 = require("@cocos-mcp/shared");
const v2_shared_1 = require("./v2-shared");
const target_resolution_1 = require("./target-resolution");
const COMPONENT_SCHEMA_CATALOG = {
    Widget: {
        fields: [
            { name: "enabled", type: "boolean", writable: true },
            { name: "isAlignTop", type: "boolean", writable: true },
            { name: "isAlignBottom", type: "boolean", writable: true },
            { name: "isAlignLeft", type: "boolean", writable: true },
            { name: "isAlignRight", type: "boolean", writable: true },
            { name: "top", type: "number", writable: true },
            { name: "bottom", type: "number", writable: true },
            { name: "left", type: "number", writable: true },
            { name: "right", type: "number", writable: true },
            { name: "horizontalCenter", type: "number", writable: true },
            { name: "verticalCenter", type: "number", writable: true },
        ],
        examples: [
            { field: "enabled", value: false },
            { field: "top", value: 20 },
        ],
    },
    Label: {
        fields: [
            { name: "string", type: "string", writable: true },
            { name: "fontSize", type: "number", writable: true },
            { name: "lineHeight", type: "number", writable: true },
            { name: "enableWrapText", type: "boolean", writable: true },
            {
                name: "overflow",
                type: "string",
                writable: true,
                enumValues: ["NONE", "CLAMP", "SHRINK", "RESIZE_HEIGHT"],
            },
        ],
        examples: [
            { field: "string", value: "Hello" },
            { field: "fontSize", value: 32 },
        ],
    },
    Button: {
        fields: [
            { name: "interactable", type: "boolean", writable: true },
            { name: "duration", type: "number", writable: true },
            { name: "zoomScale", type: "number", writable: true },
            { name: "clickEvents", type: "EventHandler[]", writable: false },
        ],
        examples: [{ field: "interactable", value: true }],
    },
    Toggle: {
        fields: [
            { name: "interactable", type: "boolean", writable: true },
            { name: "isChecked", type: "boolean", writable: true },
            { name: "checkEvents", type: "EventHandler[]", writable: false },
        ],
        examples: [
            { field: "isChecked", value: true },
            { field: "interactable", value: true },
        ],
    },
    ToggleContainer: {
        fields: [
            { name: "allowSwitchOff", type: "boolean", writable: true },
            { name: "checkEvents", type: "EventHandler[]", writable: false },
        ],
        examples: [
            { field: "allowSwitchOff", value: false },
        ],
    },
};
function createQueryTools(sceneFacade) {
    return [
        {
            name: "node_find",
            title: "Node Find",
            description: "Find nodes by uuid, path, name, or component type and return a short candidate list.",
            feature: "scene.read",
            inputSchema: {
                type: "object",
                properties: {
                    uuid: { type: "string" },
                    path: { type: "string" },
                    name: { type: "string" },
                    parentPath: { type: "string" },
                    componentType: { type: "string" },
                    exact: { type: "boolean" },
                    maxResults: { type: "number" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const hierarchy = await sceneFacade.getHierarchy();
                const matches = findMatchingNodes(hierarchy, {
                    uuid: typeof args.uuid === "string" ? args.uuid : undefined,
                    path: typeof args.path === "string" ? args.path : undefined,
                    name: typeof args.name === "string" ? args.name : undefined,
                    parentPath: typeof args.parentPath === "string" ? args.parentPath : undefined,
                    componentType: typeof args.componentType === "string"
                        ? args.componentType
                        : undefined,
                    exact: typeof args.exact === "boolean" ? args.exact : false,
                    maxResults: typeof args.maxResults === "number" ? args.maxResults : 10,
                }).map(v2_shared_1.toNodeMatch);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Found ${matches.length} node match(es).`,
                        },
                    ],
                    structuredContent: {
                        matches,
                    },
                };
            },
        },
        {
            name: "node_get",
            title: "Node Get",
            description: "Read one node by target selector with controllable detail level.",
            feature: "scene.read",
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
                    view: {
                        type: "string",
                        enum: ["brief", "standard", "detail"],
                    },
                    includeComponents: { type: "boolean" },
                },
                required: ["target"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const selector = (0, v2_shared_1.parseTargetSelector)(args.target);
                const identifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, selector);
                const node = await sceneFacade.getNode(identifier);
                const view = (0, v2_shared_1.parseReadView)(args.view);
                const includeComponents = typeof args.includeComponents === "boolean"
                    ? args.includeComponents
                    : view !== "brief";
                return {
                    content: [
                        {
                            type: "text",
                            text: `Loaded node ${node.path}.`,
                        },
                    ],
                    structuredContent: (0, v2_shared_1.filterNodeView)(node, {
                        view,
                        includeComponents,
                    }),
                };
            },
        },
        {
            name: "scene_tree",
            title: "Scene Tree",
            description: "Return a bounded scene hierarchy tree with optional component summaries.",
            feature: "scene.read",
            inputSchema: {
                type: "object",
                properties: {
                    rootPath: { type: "string" },
                    depth: { type: "number" },
                    includeComponents: { type: "boolean" },
                    view: {
                        type: "string",
                        enum: ["brief", "standard", "detail"],
                    },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const hierarchy = await sceneFacade.getHierarchy();
                const rootPath = typeof args.rootPath === "string" ? args.rootPath : undefined;
                const includeComponents = typeof args.includeComponents === "boolean"
                    ? args.includeComponents
                    : false;
                const view = (0, v2_shared_1.parseReadView)(args.view);
                const resolvedDepth = typeof args.depth === "number"
                    ? args.depth
                    : view === "brief"
                        ? 1
                        : 2;
                const roots = rootPath
                    ? findMatchingNodes(hierarchy, {
                        path: rootPath,
                        exact: true,
                        maxResults: 1,
                    })
                    : hierarchy;
                return {
                    content: [
                        {
                            type: "text",
                            text: `Returned ${roots.length} root node(s).`,
                        },
                    ],
                    structuredContent: {
                        roots: roots.map((node) => (0, v2_shared_1.filterNodeView)(node, {
                            view,
                            includeComponents,
                            depth: resolvedDepth,
                        })),
                    },
                };
            },
        },
        {
            name: "component_schema",
            title: "Component Schema",
            description: "Return writable field metadata and examples for a known component type.",
            feature: "component.read",
            inputSchema: {
                type: "object",
                properties: {
                    componentType: { type: "string" },
                },
                required: ["componentType"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const componentType = typeof args.componentType === "string" ? args.componentType.trim() : "";
                if (!componentType) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "componentType is required for component_schema");
                }
                const key = (0, v2_shared_1.normalizeComponentType)(componentType);
                const catalogEntry = COMPONENT_SCHEMA_CATALOG[key] ?? {
                    fields: [],
                    examples: [],
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: catalogEntry.fields.length
                                ? `Returned schema for ${componentType}.`
                                : `No curated schema is available yet for ${componentType}.`,
                        },
                    ],
                    structuredContent: {
                        componentType,
                        fields: catalogEntry.fields,
                        examples: catalogEntry.examples,
                    },
                };
            },
        },
    ];
}
function findMatchingNodes(hierarchy, query) {
    const maxResults = Math.max(1, Math.floor(query.maxResults || 10));
    const lowerName = typeof query.name === "string" ? query.name.trim().toLowerCase() : "";
    const lowerPath = typeof query.path === "string" ? query.path.trim().toLowerCase() : "";
    const lowerParent = typeof query.parentPath === "string"
        ? query.parentPath.trim().toLowerCase()
        : "";
    const normalizedComponentType = typeof query.componentType === "string" && query.componentType.trim()
        ? (0, v2_shared_1.normalizeComponentType)(query.componentType)
        : "";
    return (0, v2_shared_1.flattenNodes)(hierarchy)
        .filter((node) => {
        if (query.uuid && node.uuid === query.uuid) {
            return componentTypeMatches(node, normalizedComponentType);
        }
        if (lowerPath) {
            const nodePath = node.path.toLowerCase();
            const pathMatched = query.exact
                ? nodePath === lowerPath || nodePath.endsWith(`/${lowerPath}`)
                : nodePath.includes(lowerPath);
            if (pathMatched) {
                return (parentPathMatches(node, lowerParent) &&
                    componentTypeMatches(node, normalizedComponentType));
            }
            return false;
        }
        if (lowerName) {
            const nodeName = node.name.toLowerCase();
            const nameMatched = query.exact
                ? nodeName === lowerName
                : nodeName.includes(lowerName);
            return (nameMatched &&
                parentPathMatches(node, lowerParent) &&
                componentTypeMatches(node, normalizedComponentType));
        }
        if (lowerParent) {
            return (parentPathMatches(node, lowerParent) &&
                componentTypeMatches(node, normalizedComponentType));
        }
        return normalizedComponentType
            ? componentTypeMatches(node, normalizedComponentType)
            : false;
    })
        .slice(0, maxResults);
}
function parentPathMatches(node, lowerParentPath) {
    if (!lowerParentPath) {
        return true;
    }
    const parentPath = node.path.toLowerCase();
    return (parentPath === lowerParentPath ||
        parentPath.startsWith(`${lowerParentPath}/`) ||
        parentPath.endsWith(`/${lowerParentPath}`) ||
        parentPath.includes(`/${lowerParentPath}/`));
}
function componentTypeMatches(node, normalizedComponentType) {
    if (!normalizedComponentType) {
        return true;
    }
    return (node.components ?? []).some((component) => {
        const normalizedCandidate = (0, v2_shared_1.normalizeComponentType)(component.type);
        return (normalizedCandidate === normalizedComponentType ||
            normalizedCandidate.endsWith(`.${normalizedComponentType}`) ||
            normalizedCandidate.endsWith(`/${normalizedComponentType}`));
    });
}
//# sourceMappingURL=query-tools.js.map