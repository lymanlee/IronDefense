import { type TargetSelector } from "@cocos-mcp/shared";
import type { SceneFacade } from "../../services/scene-facade";
export declare function resolveSelectorForSceneFacade(sceneFacade: SceneFacade, selector: TargetSelector, fieldName?: string): Promise<{
    uuid?: string;
    path?: string;
}>;
