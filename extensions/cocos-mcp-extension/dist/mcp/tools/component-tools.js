"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComponentTools = createComponentTools;
function mutationText(result) {
    if (result.preview) {
        return `Preview ready at revision ${result.currentRevision}, next revision ${result.nextRevision}.`;
    }
    return `Applied mutation at revision ${result.appliedRevision}.`;
}
function createComponentTools(sceneFacade) {
    return [
        {
            name: "component_list_on_node",
            title: "List Components On Node",
            description: "Return component summaries for a node by uuid or path.",
            feature: "component.read",
            inputSchema: {
                type: "object",
                properties: {
                    nodeUuid: { type: "string" },
                    nodePath: { type: "string" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const components = await sceneFacade.listNodeComponents({
                    nodeUuid: typeof args.nodeUuid === "string" ? args.nodeUuid : undefined,
                    nodePath: typeof args.nodePath === "string" ? args.nodePath : undefined,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Found ${components.length} component(s).`,
                        },
                    ],
                    structuredContent: {
                        components,
                    },
                };
            },
        },
        {
            name: "component_debug_get_dump",
            title: "Component Dump",
            description: "Return the raw editor component dump from `scene.query-component` for debugging property paths.",
            feature: "debug.read",
            inputSchema: {
                type: "object",
                properties: {
                    nodeUuid: { type: "string" },
                    nodePath: { type: "string" },
                    componentType: { type: "string" },
                },
                required: ["componentType"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const dump = await sceneFacade.getRawComponentDump({
                    nodeUuid: typeof args.nodeUuid === "string" ? args.nodeUuid : undefined,
                    nodePath: typeof args.nodePath === "string" ? args.nodePath : undefined,
                    componentType: typeof args.componentType === "string" ? args.componentType : "",
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: "Returned raw component dump.",
                        },
                    ],
                    structuredContent: dump,
                };
            },
        },
        {
            name: "component_add",
            title: "Add Component",
            description: "Add a built-in Cocos component to a node. Defaults to preview mode and requires revision for apply.",
            feature: "component.write",
            inputSchema: {
                type: "object",
                properties: {
                    nodeUuid: { type: "string" },
                    nodePath: { type: "string" },
                    componentType: { type: "string" },
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["componentType"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const result = await sceneFacade.addComponent({
                    nodeUuid: typeof args.nodeUuid === "string" ? args.nodeUuid : undefined,
                    nodePath: typeof args.nodePath === "string" ? args.nodePath : undefined,
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
                            text: mutationText(result),
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
        {
            name: "component_set_property",
            title: "Set Component Property",
            description: "Set a direct component property on a node component. Current V1 supports primitive values and plain objects.",
            feature: "component.write",
            inputSchema: {
                type: "object",
                properties: {
                    nodeUuid: { type: "string" },
                    nodePath: { type: "string" },
                    componentType: { type: "string" },
                    property: { type: "string" },
                    value: {},
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["componentType", "property", "value"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const result = await sceneFacade.setComponentProperty({
                    nodeUuid: typeof args.nodeUuid === "string" ? args.nodeUuid : undefined,
                    nodePath: typeof args.nodePath === "string" ? args.nodePath : undefined,
                    componentType: typeof args.componentType === "string" ? args.componentType : "",
                    property: typeof args.property === "string" ? args.property : "",
                    value: args.value,
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
//# sourceMappingURL=component-tools.js.map