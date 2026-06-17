import { type NodeMatchSummary, type NodeSummary, type ReadView, type SceneMutationResult, type TargetSelector, type Vector3Like } from "@cocos-mcp/shared";
export declare function mutationText(result: SceneMutationResult): string;
export declare function withVerificationHint(text: string, result: SceneMutationResult): string;
export declare function withPreviewApplyHint(text: string, result: SceneMutationResult): string;
export declare function parseTargetSelector(value: unknown, fieldName?: string): TargetSelector;
export declare function parseReadView(value: unknown): ReadView;
export declare function createVector3InputSchema(): Record<string, unknown>;
export declare function parseVector3(value: unknown, property: string): Vector3Like;
export declare function flattenNodes(nodes: NodeSummary[]): NodeSummary[];
export declare function toNodeMatch(node: NodeSummary): NodeMatchSummary;
export declare function filterNodeView(node: NodeSummary, options: {
    view: ReadView;
    includeComponents: boolean;
    depth?: number;
}): NodeSummary;
export declare function normalizeComponentType(componentType: string): string;
