import type { ToolDefinition } from "@cocos-mcp/shared";
import type { SceneFacade } from "../../services/scene-facade";
import type { TelemetryService } from "../../telemetry/telemetry-service";
export declare function createDebugTools(telemetry: TelemetryService, sceneFacade: SceneFacade): ToolDefinition[];
