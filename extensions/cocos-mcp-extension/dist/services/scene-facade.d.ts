import { type ComponentEventListResult, type ComponentEventMutationResult, type NodeSummary, type PrefabInstantiateResult, type SceneEntryResult, type SceneOpenResult, type SaveSceneResult, type SceneMutationRequest, type SceneMutationResult } from "@cocos-mcp/shared";
type PrefabDroppedReference = {
    componentType: string;
    field: string;
    referenceKind: "node" | "component";
    targetUuid: string;
    reason: "outside_prefab_scope";
};
export interface SceneFacade {
    getSceneInfo(): Promise<{
        sceneName: string;
        sceneUuid?: string;
        requestedSceneUrl?: string;
        resolvedAssetUrl?: string;
        sceneUrl?: string;
        assetUuid?: string;
        sceneInternalId?: string;
    }>;
    getRevision(): Promise<number>;
    isDirty(): Promise<boolean>;
    getHierarchy(): Promise<NodeSummary[]>;
    getNode(identifier: {
        uuid?: string;
        path?: string;
    }): Promise<NodeSummary>;
    getSelection(): Promise<NodeSummary[]>;
    getRawNodeDump(identifier: {
        uuid?: string;
        path?: string;
    }): Promise<Record<string, unknown>>;
    getRawComponentDump(identifier: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
    }): Promise<Record<string, unknown>>;
    listComponentEvents(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType?: string;
        eventName?: string;
    }): Promise<ComponentEventListResult>;
    openScene(request: {
        sceneUrl?: string;
        assetUuid?: string;
        sceneUuid?: string;
    }): Promise<SceneOpenResult>;
    setEntryScene(request: {
        sceneUrl: string;
    }): Promise<SceneEntryResult>;
    saveScene(): Promise<SaveSceneResult>;
    createNode(request: {
        parentUuid?: string;
        parentPath?: string;
        name: string;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    setNodeProperty(request: {
        nodeUuid?: string;
        nodePath?: string;
        property: "name" | "active" | "position" | "rotation" | "scale";
        value: unknown;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    addComponent(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    moveNode(request: {
        nodeUuid?: string;
        nodePath?: string;
        newParentUuid?: string;
        newParentPath?: string;
        siblingIndex?: number;
        keepWorldTransform?: boolean;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    deleteNode(request: {
        nodeUuid?: string;
        nodePath?: string;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    setComponentProperty(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
        property: string;
        value: unknown;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    bindComponentReference(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
        property: string;
        referenceUuid?: string;
        expectedType?: string;
        clear?: boolean;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    removeComponentArrayElement(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
        property: string;
        index: number;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    bindComponentEvent(request: {
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
    } & SceneMutationRequest): Promise<ComponentEventMutationResult>;
    unbindComponentEvent(request: {
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
    } & SceneMutationRequest): Promise<ComponentEventMutationResult>;
    removeComponent(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    createPrefabAsset(request: {
        nodeUuid?: string;
        nodePath?: string;
        prefabName: string;
    }): Promise<{
        prefabJson: unknown;
        warnings: string[];
        droppedReferences: PrefabDroppedReference[];
        sourceNode: {
            uuid: string;
            path: string;
            name: string;
        };
    }>;
    instantiatePrefab(request: {
        prefabUuid: string;
        parentUuid?: string;
        parentPath?: string;
        name?: string;
        position?: {
            x: number;
            y: number;
            z: number;
        };
        keepWorldTransform?: boolean;
    } & SceneMutationRequest): Promise<PrefabInstantiateResult>;
}
export declare class CocosSceneFacade implements SceneFacade {
    private lastOpenedSceneAsset?;
    getSceneInfo(): Promise<{
        sceneName: string;
        sceneUuid?: string;
        requestedSceneUrl?: string;
        resolvedAssetUrl?: string;
        sceneUrl?: string;
        assetUuid?: string;
        sceneInternalId?: string;
    }>;
    getRevision(): Promise<number>;
    isDirty(): Promise<boolean>;
    getHierarchy(): Promise<NodeSummary[]>;
    getNode(identifier: {
        uuid?: string;
        path?: string;
    }): Promise<NodeSummary>;
    getSelection(): Promise<NodeSummary[]>;
    getRawNodeDump(identifier: {
        uuid?: string;
        path?: string;
    }): Promise<Record<string, unknown>>;
    getRawComponentDump(identifier: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
    }): Promise<Record<string, unknown>>;
    listComponentEvents(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType?: string;
        eventName?: string;
    }): Promise<ComponentEventListResult>;
    openScene(request: {
        sceneUrl?: string;
        assetUuid?: string;
        sceneUuid?: string;
    }): Promise<SceneOpenResult>;
    private readRawSceneInfo;
    private waitForSceneInfoAfterOpen;
    private sleep;
    setEntryScene(request: {
        sceneUrl: string;
    }): Promise<SceneEntryResult>;
    saveScene(): Promise<SaveSceneResult>;
    createNode(request: {
        parentUuid?: string;
        parentPath?: string;
        name: string;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    setNodeProperty(request: {
        nodeUuid?: string;
        nodePath?: string;
        property: "name" | "active" | "position" | "rotation" | "scale";
        value: unknown;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    addComponent(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    moveNode(request: {
        nodeUuid?: string;
        nodePath?: string;
        newParentUuid?: string;
        newParentPath?: string;
        siblingIndex?: number;
        keepWorldTransform?: boolean;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    deleteNode(request: {
        nodeUuid?: string;
        nodePath?: string;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    setComponentProperty(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
        property: string;
        value: unknown;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    bindComponentReference(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
        property: string;
        referenceUuid?: string;
        expectedType?: string;
        clear?: boolean;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    removeComponentArrayElement(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
        property: string;
        index: number;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    bindComponentEvent(request: {
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
    } & SceneMutationRequest): Promise<ComponentEventMutationResult>;
    unbindComponentEvent(request: {
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
    } & SceneMutationRequest): Promise<ComponentEventMutationResult>;
    removeComponent(request: {
        nodeUuid?: string;
        nodePath?: string;
        componentType: string;
    } & SceneMutationRequest): Promise<SceneMutationResult>;
    createPrefabAsset(request: {
        nodeUuid?: string;
        nodePath?: string;
        prefabName: string;
    }): Promise<{
        prefabJson: unknown;
        warnings: string[];
        droppedReferences: PrefabDroppedReference[];
        sourceNode: {
            uuid: string;
            path: string;
            name: string;
        };
    }>;
    instantiatePrefab(request: {
        prefabUuid: string;
        parentUuid?: string;
        parentPath?: string;
        name?: string;
        position?: {
            x: number;
            y: number;
            z: number;
        };
        keepWorldTransform?: boolean;
    } & SceneMutationRequest): Promise<PrefabInstantiateResult>;
    private executeSceneScript;
    private resolveNodeUuid;
    private queryNodeDump;
    private queryComponentDump;
    private loadPrefabSourceTree;
    private buildPrefabSourceNode;
    private serializePrefabTree;
    private serializePrefabComponent;
    private buildPrefabComponentRecord;
    private normalizePrefabComponentType;
    private resolvePrefabSerializedComponentType;
    private isCustomScriptComponent;
    private readStringField;
    private readNumberField;
    private readBooleanField;
    private readObjectField;
    private readArrayField;
    private readFieldRecord;
    private readFieldValue;
    private readAssetUuid;
    private toVec3;
    private toVec2;
    private toSize;
    private toColor;
    private toQuat;
    private toAssetRef;
    private toNodeValueRef;
    private serializeCustomScriptFields;
    private serializeCustomScriptFieldValue;
    private serializePlainCustomObject;
    private buildNestedFieldRecord;
    private normalizeCollectionElementType;
    private isFieldRecordLike;
    private toWidgetTargetRef;
    private serializeClickEvents;
    private resolveSceneUrl;
    private ensureSceneAssetExists;
    private resolveSceneAsset;
    private normalizeSceneAccessError;
    private getNodePropertyDump;
    private resolveComponentPropertyForNode;
    private resolveComponentPropertyTarget;
    private parsePropertyPath;
    private toMissingComponentPropertyError;
    private resolveNestedDumpSegment;
    private readCollectionElementTemplate;
    private resolveComponentIndex;
    private collectComponentTypeCandidates;
    private matchesComponentType;
    private readOptionalDumpValue;
    private readDumpAtPath;
    private cloneDump;
    private buildUpdatedPropertyDump;
    private encodeValueForDump;
    private buildCollectionElementDump;
    private isStructuredFieldRecordMap;
    private assertExpectedRevision;
    private advanceSceneRevision;
    private beginRecording;
    private finishRecording;
    private touchNode;
    private readSelectionUuids;
}
export {};
