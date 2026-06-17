import { type ToolDefinition } from "@cocos-mcp/shared";
import type { EntitlementGate } from "../../security/entitlement-gate";
import type { ProjectContextService } from "../../services/project-context";
import type { SceneFacade } from "../../services/scene-facade";
type TransportStatus = {
    running: boolean;
    host: string;
    port: number;
};
export declare function createContextTools(projectContext: ProjectContextService, sceneFacade: SceneFacade, gate: EntitlementGate, getTransportStatus: () => TransportStatus): ToolDefinition[];
export {};
