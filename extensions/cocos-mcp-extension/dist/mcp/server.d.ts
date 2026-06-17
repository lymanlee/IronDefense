import { type JsonRpcRequest, type JsonRpcResponse } from "@cocos-mcp/shared";
import type { ToolRegistry } from "../services/tool-registry";
import type { TelemetryService } from "../telemetry/telemetry-service";
export declare class EmbeddedMcpServer {
    private readonly registry;
    private readonly serverInfo;
    private readonly telemetry?;
    constructor(registry: ToolRegistry, serverInfo: {
        name: string;
        version: string;
    }, telemetry?: TelemetryService | undefined);
    handle(request: JsonRpcRequest): Promise<JsonRpcResponse | null>;
    private asRecord;
    private readProtocolVersion;
    private toPublicToolName;
    private toInternalToolName;
    private success;
    private failure;
}
