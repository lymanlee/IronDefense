"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddedMcpServer = void 0;
const shared_1 = require("@cocos-mcp/shared");
const DEFAULT_PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
    "2025-03-26",
    "2025-06-18",
    "2025-11-25",
]);
const TOOL_NAMESPACE = "cocos";
const TOOL_SEPARATOR = "_";
class EmbeddedMcpServer {
    registry;
    serverInfo;
    telemetry;
    constructor(registry, serverInfo, telemetry) {
        this.registry = registry;
        this.serverInfo = serverInfo;
        this.telemetry = telemetry;
    }
    async handle(request) {
        try {
            switch (request.method) {
                case "initialize": {
                    this.telemetry?.startSession(request);
                    const requestedVersion = this.readProtocolVersion(request.params);
                    const protocolVersion = requestedVersion ?? DEFAULT_PROTOCOL_VERSION;
                    if (!SUPPORTED_PROTOCOL_VERSIONS.has(protocolVersion)) {
                        throw new shared_1.AppError("INVALID_ARGUMENT", `Unsupported MCP protocol version "${protocolVersion}"`, {
                            reason: "The client requested an MCP protocol version this server does not support.",
                            context: {
                                requestedVersion: protocolVersion,
                                supportedVersions: Array.from(SUPPORTED_PROTOCOL_VERSIONS),
                            },
                            suggestion: "Retry initialize with one of the supported MCP protocol versions.",
                        });
                    }
                    return this.success(request.id ?? null, {
                        protocolVersion,
                        capabilities: {
                            tools: {
                                listChanged: false,
                            },
                        },
                        serverInfo: this.serverInfo,
                    });
                }
                case "notifications/initialized":
                    return request.id === undefined
                        ? null
                        : this.success(request.id, {});
                case "tools/list":
                    this.telemetry?.ensureSession(request, {
                        hostName: "implicit-client",
                    });
                    return this.success(request.id ?? null, {
                        tools: (await this.registry.list()).map((tool) => ({
                            ...tool,
                            name: this.toPublicToolName(tool.name),
                        })),
                    });
                case "tools/call": {
                    this.telemetry?.ensureSession(request, {
                        hostName: "implicit-client",
                    });
                    const params = this.asRecord(request.params);
                    const name = this.toInternalToolName(String(params.name ?? ""));
                    const args = this.asRecord(params.arguments);
                    const result = await this.registry.invoke(name, args, request);
                    return this.success(request.id ?? null, result);
                }
                default:
                    throw new shared_1.AppError("INVALID_ARGUMENT", `Unsupported MCP method "${request.method}"`);
            }
        }
        catch (error) {
            return this.failure(request.id ?? null, error);
        }
    }
    asRecord(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {};
        }
        return value;
    }
    readProtocolVersion(params) {
        const record = this.asRecord(params);
        const protocolVersion = record.protocolVersion;
        return typeof protocolVersion === "string" && protocolVersion.trim()
            ? protocolVersion.trim()
            : undefined;
    }
    toPublicToolName(name) {
        return `${TOOL_NAMESPACE}${TOOL_SEPARATOR}${name}`;
    }
    toInternalToolName(name) {
        const prefix = `${TOOL_NAMESPACE}${TOOL_SEPARATOR}`;
        return name.startsWith(prefix) ? name.slice(prefix.length) : name;
    }
    success(id, result) {
        return {
            jsonrpc: "2.0",
            id,
            result,
        };
    }
    failure(id, error) {
        if (error instanceof shared_1.AppError) {
            return {
                jsonrpc: "2.0",
                id,
                error: {
                    code: -32001,
                    message: error.message,
                    data: {
                        appCode: error.code,
                        details: (0, shared_1.normalizeErrorDetails)(error.code, error.message, error.details),
                    },
                },
            };
        }
        return {
            jsonrpc: "2.0",
            id,
            error: {
                code: -32603,
                message: error instanceof Error ? error.message : "Internal error",
            },
        };
    }
}
exports.EmbeddedMcpServer = EmbeddedMcpServer;
//# sourceMappingURL=server.js.map