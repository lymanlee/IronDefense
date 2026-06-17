"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
const logger_1 = require("./core/logger");
const server_1 = require("./mcp/server");
const asset_tools_1 = require("./mcp/tools/asset-tools");
const component_tools_v2_1 = require("./mcp/tools/component-tools-v2");
const context_tools_1 = require("./mcp/tools/context-tools");
const debug_tools_1 = require("./mcp/tools/debug-tools");
const node_tools_v2_1 = require("./mcp/tools/node-tools-v2");
const prefab_tools_1 = require("./mcp/tools/prefab-tools");
const query_tools_1 = require("./mcp/tools/query-tools");
const reference_tools_1 = require("./mcp/tools/reference-tools");
const script_tools_1 = require("./mcp/tools/script-tools");
const snapshot_tools_1 = require("./mcp/tools/snapshot-tools");
const ui_tools_1 = require("./mcp/tools/ui-tools");
const validation_tools_1 = require("./mcp/tools/validation-tools");
const http_transport_1 = require("./mcp/transports/http-transport");
const entitlement_gate_1 = require("./security/entitlement-gate");
const asset_facade_1 = require("./services/asset-facade");
const project_context_1 = require("./services/project-context");
const scene_facade_1 = require("./services/scene-facade");
const tool_registry_1 = require("./services/tool-registry");
const telemetry_service_1 = require("./telemetry/telemetry-service");
const logger = new logger_1.ConsoleLogger("cocos-mcp-extension");
const gate = new entitlement_gate_1.DevelopmentEntitlementGate();
const projectContext = new project_context_1.ProjectContextService();
const sceneFacade = new scene_facade_1.CocosSceneFacade();
const assetFacade = new asset_facade_1.CocosAssetFacade();
const telemetry = new telemetry_service_1.TelemetryService(projectContext, logger);
const registry = new tool_registry_1.ToolRegistry(gate, {
    telemetry,
    getSceneRevision: () => sceneFacade.getRevision(),
});
const mcpServer = new server_1.EmbeddedMcpServer(registry, {
    name: "cocos-mcp",
    version: "0.1.0",
}, telemetry);
const transport = new http_transport_1.EmbeddedHttpTransport(mcpServer, logger, {
    host: "127.0.0.1",
    port: 3603,
});
registry.registerMany((0, context_tools_1.createContextTools)(projectContext, sceneFacade, gate, () => transport.getStatus()));
registry.registerMany((0, asset_tools_1.createAssetTools)(assetFacade, sceneFacade));
registry.registerMany((0, prefab_tools_1.createPrefabTools)(assetFacade, sceneFacade));
registry.registerMany((0, script_tools_1.createScriptTools)(assetFacade, sceneFacade));
registry.registerMany((0, reference_tools_1.createReferenceTools)(assetFacade, sceneFacade));
registry.registerMany((0, query_tools_1.createQueryTools)(sceneFacade));
registry.registerMany((0, node_tools_v2_1.createNodeTools)(sceneFacade));
registry.registerMany((0, component_tools_v2_1.createComponentToolsV2)(sceneFacade));
registry.registerMany((0, ui_tools_1.createUiTools)(sceneFacade));
registry.registerMany((0, snapshot_tools_1.createSnapshotTools)(sceneFacade));
registry.registerMany((0, validation_tools_1.createValidationTools)(sceneFacade));
registry.registerMany((0, debug_tools_1.createDebugTools)(telemetry, sceneFacade));
function load() {
    transport.start().catch((error) => {
        logger.error("Failed to start embedded MCP server", error);
    });
}
function unload() {
    transport.stop().catch((error) => {
        logger.error("Failed to stop embedded MCP server", error);
    });
}
exports.methods = {
    async startServer() {
        await gate.assertFeature("server.start");
        await transport.start();
        return transport.getStatus();
    },
    async stopServer() {
        await transport.stop();
        return transport.getStatus();
    },
    async getServerStatus() {
        const snapshot = await gate.getSnapshot();
        const revision = await sceneFacade.getRevision();
        const dirty = await sceneFacade.isDirty();
        const toolDetails = await registry.list();
        const tools = toolDetails.map((tool) => tool.name);
        return {
            transport: transport.getStatus(),
            entitlement: snapshot,
            scene: {
                revision,
                dirty,
            },
            tools,
            toolDetails: toolDetails.map((tool) => ({
                name: tool.name,
                title: tool.title,
                description: tool.description,
            })),
        };
    },
    async openStatusPanel() {
        if (Editor?.Panel?.open) {
            Editor.Panel.open("cocos-mcp-extension.status");
        }
        return true;
    },
};
//# sourceMappingURL=main.js.map