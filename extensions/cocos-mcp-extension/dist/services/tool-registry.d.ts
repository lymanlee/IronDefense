import { type JsonRpcRequest, type ToolDefinition, type ToolResult } from "@cocos-mcp/shared";
import type { EntitlementGate } from "../security/entitlement-gate";
import type { TelemetryService } from "../telemetry/telemetry-service";
export declare class ToolRegistry {
    private readonly gate;
    private readonly options;
    private readonly tools;
    private readonly idempotencyRecords;
    private static readonly IDEMPOTENCY_RETENTION_MS;
    private static readonly IDEMPOTENCY_MAX_ENTRIES;
    constructor(gate: EntitlementGate, options?: {
        telemetry?: TelemetryService;
        getSceneRevision?: () => Promise<number>;
    });
    register(definition: ToolDefinition): void;
    registerMany(definitions: ToolDefinition[]): void;
    list(): Promise<Array<Pick<ToolDefinition, "name" | "title" | "description" | "inputSchema">>>;
    listToolNames(): Promise<string[]>;
    invoke(toolName: string, args: Record<string, unknown>, request: JsonRpcRequest): Promise<ToolResult>;
    private executeWithIdempotency;
    private getIdempotencyKeyInfo;
    private pruneIdempotencyRecords;
    private safeSceneRevision;
}
