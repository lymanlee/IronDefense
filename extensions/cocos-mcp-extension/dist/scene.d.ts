import { type ComponentEventListResult, type ComponentEventMutationResult, type NodeSummary, type PrefabInstantiateResult, type SceneMutationResult, type Vector3Like } from "@cocos-mcp/shared";
declare function resolveNodeComponentReference(payload: {
    nodeUuid?: string;
    nodePath?: string;
    componentType: string;
}): {
    uuid: string;
    type: string;
    enabled?: boolean;
};
export declare function load(): void;
export declare function unload(): void;
declare function getSceneRevision(): number;
declare function getSceneInfo(): {
    sceneName: string;
    sceneUuid?: string;
    sceneInternalId?: string;
};
declare function advanceSceneRevision(): number;
declare function getSceneTreeData(): NodeSummary[];
declare function getNodeDetails(payload: {
    uuid?: string;
    path?: string;
}): NodeSummary;
declare function createNode(payload: {
    parentUuid?: string;
    parentPath?: string;
    name: string;
    preview?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
}): SceneMutationResult;
declare function instantiatePrefab(payload: {
    prefabUuid: string;
    parentUuid?: string;
    parentPath?: string;
    name?: string;
    position?: Vector3Like;
    preview?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
}): Promise<PrefabInstantiateResult>;
declare function updateNodeProperty(payload: {
    nodeUuid?: string;
    nodePath?: string;
    property: "name" | "active" | "position" | "rotation" | "scale";
    value: unknown;
    preview?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
}): SceneMutationResult;
declare function addComponent(payload: {
    nodeUuid?: string;
    nodePath?: string;
    componentType: string;
    preview?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
}): SceneMutationResult;
declare function moveNode(payload: {
    nodeUuid?: string;
    nodePath?: string;
    newParentUuid?: string;
    newParentPath?: string;
    siblingIndex?: number;
    keepWorldTransform?: boolean;
    preview?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
}): SceneMutationResult;
declare function deleteNode(payload: {
    nodeUuid?: string;
    nodePath?: string;
    preview?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
}): SceneMutationResult;
declare function updateComponentProperty(payload: {
    nodeUuid?: string;
    nodePath?: string;
    componentType: string;
    property: string;
    value: unknown;
    preview?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
}): SceneMutationResult;
declare function removeComponentArrayElement(payload: {
    nodeUuid?: string;
    nodePath?: string;
    componentType: string;
    property: string;
    index: number;
    preview?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
}): SceneMutationResult;
declare function listComponentEvents(payload: {
    nodeUuid?: string;
    nodePath?: string;
    componentType?: string;
    eventName?: string;
}): ComponentEventListResult;
declare function bindComponentEvent(payload: {
    nodeUuid?: string;
    nodePath?: string;
    componentType?: string;
    eventName?: string;
    handlerNodeUuid?: string;
    handlerNodePath?: string;
    handlerComponentType: string;
    handlerMethod: string;
    customEventData?: string;
    dedupe?: boolean;
    preview?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
}): ComponentEventMutationResult;
declare function unbindComponentEvent(payload: {
    nodeUuid?: string;
    nodePath?: string;
    componentType?: string;
    eventName?: string;
    index?: number;
    handlerNodeUuid?: string;
    handlerNodePath?: string;
    handlerComponentType?: string;
    handlerMethod?: string;
    customEventData?: string;
    preview?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
}): ComponentEventMutationResult;
declare function removeComponent(payload: {
    nodeUuid?: string;
    nodePath?: string;
    componentType: string;
    preview?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
}): SceneMutationResult;
export declare const methods: {
    getSceneInfo: typeof getSceneInfo;
    getSceneRevision: typeof getSceneRevision;
    advanceSceneRevision: typeof advanceSceneRevision;
    getSceneTreeData: typeof getSceneTreeData;
    getNodeDetails: typeof getNodeDetails;
    resolveNodeComponentReference: typeof resolveNodeComponentReference;
    createNode: typeof createNode;
    instantiatePrefab: typeof instantiatePrefab;
    updateNodeProperty: typeof updateNodeProperty;
    addComponent: typeof addComponent;
    updateComponentProperty: typeof updateComponentProperty;
    removeComponentArrayElement: typeof removeComponentArrayElement;
    listComponentEvents: typeof listComponentEvents;
    bindComponentEvent: typeof bindComponentEvent;
    unbindComponentEvent: typeof unbindComponentEvent;
    moveNode: typeof moveNode;
    deleteNode: typeof deleteNode;
    removeComponent: typeof removeComponent;
};
export {};
