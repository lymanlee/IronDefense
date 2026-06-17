import type { JsonRpcRequest, ToolResult } from "@cocos-mcp/shared";
import type { Logger } from "../core/logger";
import type { ProjectContextService } from "../services/project-context";
export type ToolCallRecord = {
    eventType: "tool_call";
    timestamp: string;
    sessionId?: string;
    requestId?: string;
    sequence: number;
    toolName: string;
    mode: "preview" | "apply" | "read";
    success: boolean;
    errorCode?: string;
    durationMs: number;
    resultBytes: number;
    sceneRevisionBefore?: number;
    sceneRevisionAfter?: number;
    argsSummary: Record<string, unknown>;
    resultSummary: Record<string, unknown>;
};
export declare class TelemetryService {
    private readonly projectContext;
    private readonly logger;
    private currentSessionId?;
    private sequence;
    constructor(projectContext: ProjectContextService, logger: Logger);
    startSession(request: JsonRpcRequest): string;
    getCurrentSessionId(): string | undefined;
    ensureSession(request?: JsonRpcRequest, defaults?: {
        hostName?: string;
        hostVersion?: string;
    }): string;
    getTelemetryDir(): string;
    getRecentToolCalls(input?: {
        limit?: number;
        toolName?: string;
        sessionId?: string;
        mode?: "preview" | "apply" | "read";
        success?: boolean;
    }): ToolCallRecord[];
    recordToolCall(input: {
        toolName: string;
        requestId?: string;
        args: Record<string, unknown>;
        result?: ToolResult;
        errorCode?: string;
        success: boolean;
        durationMs: number;
        sceneRevisionBefore?: number;
        sceneRevisionAfter?: number;
    }): void;
    private telemetryDir;
    private openSession;
    private writeJsonLine;
    private readJsonLines;
    private asRecord;
}
