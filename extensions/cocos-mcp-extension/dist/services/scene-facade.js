"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CocosSceneFacade = void 0;
const shared_1 = require("@cocos-mcp/shared");
const EXTENSION_NAME = "cocos-mcp-extension";
class CocosSceneFacade {
    lastOpenedSceneAsset;
    async getSceneInfo() {
        const sceneInfo = await this.readRawSceneInfo();
        const sceneInternalId = sceneInfo.sceneInternalId ?? sceneInfo.sceneUuid;
        const rememberedAsset = this.lastOpenedSceneAsset;
        return {
            ...sceneInfo,
            requestedSceneUrl: rememberedAsset?.requestedSceneUrl,
            resolvedAssetUrl: rememberedAsset?.resolvedAssetUrl,
            sceneUrl: rememberedAsset?.resolvedAssetUrl,
            assetUuid: rememberedAsset?.assetUuid,
            sceneInternalId,
            sceneUuid: rememberedAsset?.assetUuid,
        };
    }
    async getRevision() {
        return this.executeSceneScript("getSceneRevision");
    }
    async isDirty() {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        return Boolean(await Editor.Message.request("scene", "query-dirty"));
    }
    async getHierarchy() {
        return this.executeSceneScript("getSceneTreeData");
    }
    async getNode(identifier) {
        if (!identifier.uuid && !identifier.path) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "uuid or path is required for node_get");
        }
        return this.executeSceneScript("getNodeDetails", identifier);
    }
    async getSelection() {
        const selectionApi = Editor?.Selection;
        if (!selectionApi) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Selection is unavailable");
        }
        const selected = this.readSelectionUuids(selectionApi.getSelected?.("node")) ??
            this.readSelectionUuids(selectionApi.curSelection?.("node")) ??
            this.readSelectionUuids(selectionApi.getLastSelected?.("node"));
        if (!selected || selected.length === 0) {
            return [];
        }
        const unique = [...new Set(selected.filter((uuid) => typeof uuid === "string" && uuid.trim()))];
        const resolved = await Promise.allSettled(unique.map((uuid) => this.getNode({ uuid })));
        return resolved.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    }
    async getRawNodeDump(identifier) {
        const uuid = await this.resolveNodeUuid(identifier);
        return this.queryNodeDump(uuid);
    }
    async getRawComponentDump(identifier) {
        const componentRef = await this.executeSceneScript("resolveNodeComponentReference", identifier);
        return this.queryComponentDump(componentRef.uuid);
    }
    async listComponentEvents(request) {
        if (!request.nodeUuid && !request.nodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath is required for component_event_list");
        }
        return this.executeSceneScript("listComponentEvents", request);
    }
    async openScene(request) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        const requestedSceneUrl = request.sceneUrl?.trim();
        const sceneUrl = await this.resolveSceneUrl(request);
        try {
            const asset = await this.resolveSceneAsset(sceneUrl);
            const resolvedAssetUrl = asset.url;
            const previousSceneInfo = await this.readRawSceneInfo().catch(() => undefined);
            const previousSceneInternalId = previousSceneInfo?.sceneInternalId ?? previousSceneInfo?.sceneUuid;
            await Editor.Message.request("asset-db", "open-asset", resolvedAssetUrl);
            const sceneInfo = await this.waitForSceneInfoAfterOpen(previousSceneInternalId);
            const sceneInternalId = sceneInfo.sceneInternalId ?? sceneInfo.sceneUuid;
            this.lastOpenedSceneAsset = {
                requestedSceneUrl: requestedSceneUrl ?? resolvedAssetUrl,
                resolvedAssetUrl,
                assetUuid: asset.uuid,
            };
            return {
                sceneName: sceneInfo.sceneName,
                sceneUuid: asset.uuid,
                requestedSceneUrl: requestedSceneUrl ?? resolvedAssetUrl,
                resolvedAssetUrl,
                sceneUrl: resolvedAssetUrl,
                assetUuid: asset.uuid,
                sceneInternalId,
                opened: true,
            };
        }
        catch (error) {
            throw this.normalizeSceneAccessError(error);
        }
    }
    async readRawSceneInfo() {
        return this.executeSceneScript("getSceneInfo");
    }
    async waitForSceneInfoAfterOpen(previousSceneInternalId) {
        let latest;
        for (const delayMs of [80, 160, 300, 500]) {
            await this.sleep(delayMs);
            latest = await this.readRawSceneInfo();
            const sceneInternalId = latest.sceneInternalId ?? latest.sceneUuid;
            if (!previousSceneInternalId || sceneInternalId !== previousSceneInternalId) {
                return latest;
            }
        }
        return latest ?? this.readRawSceneInfo();
    }
    sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
    async setEntryScene(request) {
        if (!request.sceneUrl?.trim()) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "sceneUrl is required");
        }
        const sceneUrl = request.sceneUrl.trim();
        if (!sceneUrl.endsWith(".scene")) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `sceneUrl must point to a .scene asset`);
        }
        if (!Editor?.Profile?.setProject) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Profile.setProject is unavailable");
        }
        await this.ensureSceneAssetExists(sceneUrl);
        try {
            await Editor.Profile.setProject("preview", "general.start_scene", sceneUrl);
            return {
                sceneUrl,
                strategy: "profile:preview.general.start_scene",
                updated: true,
            };
        }
        catch (error) {
            throw this.normalizeSceneAccessError(error);
        }
    }
    async saveScene() {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        const dirtyBefore = await this.isDirty();
        const revision = await this.getRevision();
        if (!dirtyBefore) {
            return {
                saved: true,
                dirtyBefore: false,
                dirtyAfter: false,
                revision,
                strategy: "noop:not-dirty",
            };
        }
        await Editor.Message.request("scene", "save-scene");
        const dirtyAfter = await this.isDirty();
        return {
            saved: !dirtyAfter,
            dirtyBefore: true,
            dirtyAfter,
            revision,
            strategy: "save-scene",
        };
    }
    async createNode(request) {
        if (!request.parentUuid && !request.parentPath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "parentUuid or parentPath is required for node_create");
        }
        if (!request.name.trim()) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "name is required for node_create");
        }
        if (request.preview ?? true) {
            return this.executeSceneScript("createNode", request);
        }
        const parentUuid = await this.resolveNodeUuid({
            uuid: request.parentUuid,
            path: request.parentPath,
        });
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const undoId = await this.beginRecording(parentUuid);
        let cancel = true;
        try {
            const createdUuid = await Editor.Message.request("scene", "create-node", {
                parent: parentUuid,
                name: request.name.trim(),
                snapshot: true,
            });
            cancel = false;
            const nextRevision = await this.advanceSceneRevision();
            const node = await this.getNode({ uuid: createdUuid });
            return {
                ok: true,
                preview: false,
                currentRevision,
                nextRevision,
                appliedRevision: nextRevision,
                changeSummary: [
                    `Created child node "${request.name.trim()}" under ${node.path.substring(0, node.path.lastIndexOf("/"))}`,
                ],
                warnings: [],
                node,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async setNodeProperty(request) {
        if (!request.nodeUuid && !request.nodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath is required for node_update");
        }
        if (request.preview ?? true) {
            return this.executeSceneScript("updateNodeProperty", request);
        }
        const nodeUuid = await this.resolveNodeUuid({
            uuid: request.nodeUuid,
            path: request.nodePath,
        });
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const nodeDump = await this.queryNodeDump(nodeUuid);
        const propertyDump = this.getNodePropertyDump(nodeDump, request.property);
        const nextDump = this.cloneDump(propertyDump);
        nextDump.value = request.value;
        const undoId = await this.beginRecording(nodeUuid);
        let cancel = true;
        try {
            await Editor.Message.request("scene", "set-property", {
                uuid: nodeUuid,
                path: propertyDump.path ?? request.property,
                dump: nextDump,
            });
            cancel = false;
            const nextRevision = await this.advanceSceneRevision();
            const node = await this.getNode({ uuid: nodeUuid });
            return {
                ok: true,
                preview: false,
                currentRevision,
                nextRevision,
                appliedRevision: nextRevision,
                changeSummary: [`Updated ${request.property} on ${node.path}`],
                warnings: [],
                node,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async addComponent(request) {
        if (!request.nodeUuid && !request.nodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath is required for component_add");
        }
        if (!request.componentType.trim()) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "componentType is required for component_add");
        }
        if (request.preview ?? true) {
            return this.executeSceneScript("addComponent", request);
        }
        const nodeUuid = await this.resolveNodeUuid({
            uuid: request.nodeUuid,
            path: request.nodePath,
        });
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const undoId = await this.beginRecording(nodeUuid);
        let cancel = true;
        try {
            await Editor.Message.request("scene", "create-component", {
                uuid: nodeUuid,
                component: request.componentType,
            });
            cancel = false;
            const nextRevision = await this.advanceSceneRevision();
            const node = await this.getNode({ uuid: nodeUuid });
            return {
                ok: true,
                preview: false,
                currentRevision,
                nextRevision,
                appliedRevision: nextRevision,
                changeSummary: [
                    `Added component "${request.componentType}" to ${node.path}`,
                ],
                warnings: [],
                node,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async moveNode(request) {
        if ((!request.nodeUuid && !request.nodePath) || (!request.newParentUuid && !request.newParentPath)) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath and newParentUuid or newParentPath are required for node_move");
        }
        if (request.preview ?? true) {
            return this.executeSceneScript("moveNode", request);
        }
        const nodeUuid = await this.resolveNodeUuid({
            uuid: request.nodeUuid,
            path: request.nodePath,
        });
        const newParentUuid = await this.resolveNodeUuid({
            uuid: request.newParentUuid,
            path: request.newParentPath,
        });
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const undoId = await this.beginRecording([nodeUuid, newParentUuid]);
        let cancel = true;
        try {
            const result = await this.executeSceneScript("moveNode", {
                ...request,
                nodeUuid,
                nodePath: undefined,
                newParentUuid,
                newParentPath: undefined,
            });
            await this.touchNode(newParentUuid);
            cancel = false;
            const nextRevision = result.nextRevision;
            const node = await this.getNode({ uuid: nodeUuid });
            return {
                ok: true,
                preview: false,
                currentRevision,
                nextRevision,
                appliedRevision: nextRevision,
                changeSummary: result.changeSummary,
                warnings: result.warnings,
                node,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async deleteNode(request) {
        if (!request.nodeUuid && !request.nodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath are required for node_delete");
        }
        if (request.preview ?? true) {
            return this.executeSceneScript("deleteNode", request);
        }
        const node = await this.getNode({
            uuid: request.nodeUuid,
            path: request.nodePath,
        });
        const nodeUuid = node.uuid;
        const parentPath = node.path.includes("/")
            ? node.path.slice(0, node.path.lastIndexOf("/"))
            : "";
        if (!parentPath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "node_delete requires a non-root node with a resolvable parent path");
        }
        const parentUuid = await this.resolveNodeUuid({
            path: parentPath,
        });
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const undoId = await this.beginRecording([nodeUuid, parentUuid]);
        let cancel = true;
        try {
            const result = await this.executeSceneScript("deleteNode", {
                ...request,
                nodeUuid,
                nodePath: undefined,
            });
            await this.touchNode(parentUuid);
            cancel = false;
            const nextRevision = result.nextRevision;
            return {
                ok: true,
                preview: false,
                currentRevision,
                nextRevision,
                appliedRevision: nextRevision,
                changeSummary: result.changeSummary,
                warnings: result.warnings,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async setComponentProperty(request) {
        if (!request.nodeUuid && !request.nodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath is required for component_update");
        }
        if (!request.componentType.trim() || !request.property.trim()) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "componentType and property are required for component_update");
        }
        const nodeUuid = await this.resolveNodeUuid({
            uuid: request.nodeUuid,
            path: request.nodePath,
        });
        if (request.preview ?? true) {
            const target = await this.resolveComponentPropertyForNode({
                nodeUuid,
                nodePath: request.nodePath,
                componentType: request.componentType,
                property: request.property,
            });
            this.buildUpdatedPropertyDump(target.propertyDump, request.value);
            return this.executeSceneScript("updateComponentProperty", request);
        }
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const { propertyPath, propertyDump } = await this.resolveComponentPropertyForNode({
            nodeUuid,
            nodePath: request.nodePath,
            componentType: request.componentType,
            property: request.property,
        });
        const nextDump = this.buildUpdatedPropertyDump(propertyDump, request.value);
        nextDump.path = propertyPath;
        const undoId = await this.beginRecording(nodeUuid);
        let cancel = true;
        try {
            await Editor.Message.request("scene", "set-property", {
                uuid: nodeUuid,
                path: propertyPath,
                dump: nextDump,
            });
            cancel = false;
            const nextRevision = await this.advanceSceneRevision();
            const node = await this.getNode({ uuid: nodeUuid });
            return {
                ok: true,
                preview: false,
                currentRevision,
                nextRevision,
                appliedRevision: nextRevision,
                changeSummary: [
                    `Updated component "${request.componentType}" property "${request.property}" on ${node.path}`,
                ],
                warnings: [],
                node,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async bindComponentReference(request) {
        if (!request.nodeUuid && !request.nodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath is required for component_bind_reference");
        }
        if (!request.componentType.trim() || !request.property.trim()) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "componentType and property are required for component_bind_reference");
        }
        const nodeUuid = await this.resolveNodeUuid({
            uuid: request.nodeUuid,
            path: request.nodePath,
        });
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const { propertyPath, propertyDump } = await this.resolveComponentPropertyForNode({
            nodeUuid,
            nodePath: request.nodePath,
            componentType: request.componentType,
            property: request.property,
        });
        const nextDump = this.cloneDump(propertyDump);
        nextDump.path = propertyPath;
        nextDump.value = {
            uuid: request.clear ? "" : request.referenceUuid ?? "",
        };
        if (request.expectedType && typeof nextDump.type !== "string") {
            nextDump.type = request.expectedType;
        }
        const undoId = await this.beginRecording(nodeUuid);
        let cancel = true;
        try {
            await Editor.Message.request("scene", "set-property", {
                uuid: nodeUuid,
                path: propertyPath,
                dump: nextDump,
            });
            cancel = false;
            const nextRevision = await this.advanceSceneRevision();
            const node = await this.getNode({ uuid: nodeUuid });
            return {
                ok: true,
                preview: false,
                currentRevision,
                nextRevision,
                appliedRevision: nextRevision,
                changeSummary: [
                    request.clear
                        ? `Cleared component "${request.componentType}" reference "${request.property}" on ${node.path}`
                        : `Bound component "${request.componentType}" reference "${request.property}" on ${node.path}`,
                ],
                warnings: [],
                node,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async removeComponentArrayElement(request) {
        if (!request.nodeUuid && !request.nodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath is required for component_bind_reference");
        }
        if (!request.componentType.trim() || !request.property.trim()) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "componentType and property are required for component_bind_reference");
        }
        if (!Number.isInteger(request.index) || request.index < 0) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "index must be a non-negative integer for component_bind_reference remove");
        }
        if (request.preview ?? true) {
            return this.executeSceneScript("removeComponentArrayElement", request);
        }
        const nodeUuid = await this.resolveNodeUuid({
            uuid: request.nodeUuid,
            path: request.nodePath,
        });
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const nodeDump = await this.queryNodeDump(nodeUuid);
        const componentRef = await this.executeSceneScript("resolveNodeComponentReference", {
            nodeUuid: request.nodeUuid,
            nodePath: request.nodePath,
            componentType: request.componentType,
        });
        if (!componentRef.uuid) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Component "${request.componentType}" uuid is unavailable`);
        }
        const { path: propertyPath, dump: propertyDump } = this.resolveComponentPropertyTarget(nodeDump, componentRef.uuid, request.componentType, request.property);
        const entries = Array.isArray(propertyDump.value) ? propertyDump.value : null;
        if (!entries && propertyDump.isArray !== true) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Property "${request.property}" is not an array field`);
        }
        const entryCount = entries?.length ?? 0;
        if (request.index >= entryCount) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Array index ${request.index} is out of range for property "${request.property}"`);
        }
        const undoId = await this.beginRecording(nodeUuid);
        let cancel = true;
        try {
            await Editor.Message.request("scene", "remove-array-element", {
                uuid: nodeUuid,
                path: propertyPath,
                index: request.index,
            });
            cancel = false;
            const nextRevision = await this.advanceSceneRevision();
            const node = await this.getNode({ uuid: nodeUuid });
            return {
                ok: true,
                preview: false,
                currentRevision,
                nextRevision,
                appliedRevision: nextRevision,
                changeSummary: [
                    `Removed component "${request.componentType}" reference "${request.property}.${request.index}" on ${node.path}`,
                ],
                warnings: [],
                node,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async bindComponentEvent(request) {
        if (!request.nodeUuid && !request.nodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath is required for component_event_bind");
        }
        if (!request.handlerNodeUuid && !request.handlerNodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "handlerNodeUuid or handlerNodePath is required for component_event_bind");
        }
        if (!request.handlerComponentType.trim() || !request.handlerMethod.trim()) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "handlerComponentType and handlerMethod are required for component_event_bind");
        }
        if (request.preview ?? true) {
            return this.executeSceneScript("bindComponentEvent", request);
        }
        const nodeUuid = await this.resolveNodeUuid({
            uuid: request.nodeUuid,
            path: request.nodePath,
        });
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const undoId = await this.beginRecording(nodeUuid);
        let cancel = true;
        try {
            const result = await this.executeSceneScript("bindComponentEvent", {
                ...request,
                nodeUuid,
                nodePath: undefined,
            });
            if (!result.noop) {
                await this.touchNode(nodeUuid);
                cancel = false;
            }
            return {
                ...result,
                currentRevision,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async unbindComponentEvent(request) {
        if (!request.nodeUuid && !request.nodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath is required for component_event_unbind");
        }
        const hasIndex = Number.isInteger(request.index);
        const hasHandlerMatch = (!!request.handlerNodeUuid || !!request.handlerNodePath) &&
            !!request.handlerComponentType?.trim() &&
            !!request.handlerMethod?.trim();
        if (hasIndex === hasHandlerMatch) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "component_event_unbind requires exactly one selector mode: index or handler target + component + method");
        }
        if (request.preview ?? true) {
            return this.executeSceneScript("unbindComponentEvent", request);
        }
        const nodeUuid = await this.resolveNodeUuid({
            uuid: request.nodeUuid,
            path: request.nodePath,
        });
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const undoId = await this.beginRecording(nodeUuid);
        let cancel = true;
        try {
            const result = await this.executeSceneScript("unbindComponentEvent", {
                ...request,
                nodeUuid,
                nodePath: undefined,
            });
            await this.touchNode(nodeUuid);
            cancel = false;
            return {
                ...result,
                currentRevision,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async removeComponent(request) {
        if (!request.nodeUuid && !request.nodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath is required for component_remove");
        }
        if (!request.componentType.trim()) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "componentType is required for component_remove");
        }
        if (request.preview ?? true) {
            return this.executeSceneScript("removeComponent", request);
        }
        const nodeUuid = await this.resolveNodeUuid({
            uuid: request.nodeUuid,
            path: request.nodePath,
        });
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const nodeDump = await this.queryNodeDump(nodeUuid);
        const componentRef = await this.executeSceneScript("resolveNodeComponentReference", {
            nodeUuid: request.nodeUuid,
            nodePath: request.nodePath,
            componentType: request.componentType,
        });
        const componentIndex = this.resolveComponentIndex(nodeDump, componentRef.uuid, request.componentType);
        const undoId = await this.beginRecording(nodeUuid);
        let cancel = true;
        try {
            await Editor.Message.request("scene", "remove-array-element", {
                uuid: nodeUuid,
                path: "__comps__",
                index: componentIndex,
            });
            cancel = false;
            const nextRevision = await this.advanceSceneRevision();
            const node = await this.getNode({ uuid: nodeUuid });
            return {
                ok: true,
                preview: false,
                currentRevision,
                nextRevision,
                appliedRevision: nextRevision,
                changeSummary: [
                    `Removed component "${request.componentType}" from ${node.path}`,
                ],
                warnings: [],
                node,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async createPrefabAsset(request) {
        if (!request.nodeUuid && !request.nodePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "nodeUuid or nodePath is required for prefab_create");
        }
        if (!request.prefabName.trim()) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "prefabName is required for prefab_create");
        }
        const sourceTree = await this.loadPrefabSourceTree({
            uuid: request.nodeUuid,
            path: request.nodePath,
        });
        sourceTree.name = request.prefabName.trim();
        return {
            ...this.serializePrefabTree(sourceTree),
            sourceNode: {
                uuid: sourceTree.uuid,
                path: sourceTree.path,
                name: sourceTree.name,
            },
        };
    }
    async instantiatePrefab(request) {
        if (!request.prefabUuid?.trim()) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "prefabUuid is required for prefab_instantiate");
        }
        if (!request.parentUuid && !request.parentPath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "parentUuid or parentPath is required for prefab_instantiate");
        }
        if (request.preview ?? true) {
            return this.executeSceneScript("instantiatePrefab", request);
        }
        const parentUuid = await this.resolveNodeUuid({
            uuid: request.parentUuid,
            path: request.parentPath,
        });
        const currentRevision = await this.assertExpectedRevision(request.expectedRevision);
        const undoId = await this.beginRecording(parentUuid);
        let cancel = true;
        try {
            const result = await this.executeSceneScript("instantiatePrefab", {
                ...request,
                prefabUuid: request.prefabUuid.trim(),
                parentUuid,
                parentPath: undefined,
            });
            await this.touchNode(parentUuid);
            cancel = false;
            if (result.node?.uuid) {
                const node = await this.getNode({ uuid: result.node.uuid });
                return {
                    ...result,
                    currentRevision,
                    node,
                };
            }
            return {
                ...result,
                currentRevision,
            };
        }
        finally {
            await this.finishRecording(undoId, cancel);
        }
    }
    async executeSceneScript(method, payload) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        try {
            return await Editor.Message.request("scene", "execute-scene-script", {
                name: EXTENSION_NAME,
                method,
                args: [payload ?? {}],
            });
        }
        catch (error) {
            throw this.normalizeSceneAccessError(error);
        }
    }
    async resolveNodeUuid(identifier) {
        const node = await this.getNode(identifier);
        if (!node.uuid) {
            throw new shared_1.AppError("INTERNAL_ERROR", "Resolved node uuid is unavailable", identifier);
        }
        return node.uuid;
    }
    async queryNodeDump(uuid) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        try {
            return await Editor.Message.request("scene", "query-node", uuid);
        }
        catch (error) {
            throw this.normalizeSceneAccessError(error);
        }
    }
    async queryComponentDump(uuid) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        try {
            return await Editor.Message.request("scene", "query-component", uuid);
        }
        catch (error) {
            throw this.normalizeSceneAccessError(error);
        }
    }
    async loadPrefabSourceTree(identifier) {
        const node = await this.getNode(identifier);
        return this.buildPrefabSourceNode(node);
    }
    async buildPrefabSourceNode(node) {
        const components = await Promise.all((node.components ?? []).map(async (component) => ({
            type: component.type,
            dump: await this.getRawComponentDump({
                nodeUuid: node.uuid,
                componentType: component.type,
            }),
        })));
        const children = await Promise.all(node.children.map((child) => this.buildPrefabSourceNode(child)));
        return {
            uuid: node.uuid,
            name: node.name,
            path: node.path,
            active: node.active ?? true,
            position: node.position ?? { x: 0, y: 0, z: 0 },
            rotation: node.rotation ?? { x: 0, y: 0, z: 0 },
            scale: node.scale ?? { x: 1, y: 1, z: 1 },
            components,
            children,
        };
    }
    serializePrefabTree(root) {
        const records = [];
        const nodeRecordIds = new Map();
        const componentRecordIds = new Map();
        const pendingCustomScriptSerializations = [];
        const droppedReferences = [];
        const appendRecord = (record) => {
            const id = records.length;
            records.push(record);
            return id;
        };
        const makeRef = (id) => ({ __id__: id });
        const nextFileId = (() => {
            let counter = 0;
            return () => `mcp_${counter++}`;
        })();
        const prefabId = appendRecord({
            __type__: "cc.Prefab",
            _name: root.name,
            _objFlags: 0,
            __editorExtras__: {},
            _native: "",
            data: { __id__: 1 },
            optimizationPolicy: 0,
            persistent: false,
        });
        const serializeNode = (node, parentId) => {
            const nodeRecord = {
                __type__: "cc.Node",
                _name: node.name,
                _objFlags: 0,
                __editorExtras__: {},
                _parent: parentId === null ? null : makeRef(parentId),
                _children: [],
                _active: node.active,
                _components: [],
                _prefab: null,
                _lpos: this.toVec3(node.position),
                _lrot: this.toQuat(node.rotation),
                _lscale: this.toVec3(node.scale),
                _mobility: 0,
                _layer: 1073741824,
                _euler: this.toVec3(node.rotation),
                _id: "",
            };
            const nodeId = appendRecord(nodeRecord);
            nodeRecordIds.set(node.uuid, nodeId);
            const childIds = node.children.map((child) => serializeNode(child, nodeId));
            nodeRecord._children = childIds.map((id) => makeRef(id));
            const componentIds = node.components
                .map((component) => this.serializePrefabComponent(component, nodeId, appendRecord, makeRef, nextFileId, nodeRecordIds, componentRecordIds, pendingCustomScriptSerializations))
                .flatMap((entry) => entry);
            nodeRecord._components = componentIds
                .filter((entry) => entry.kind === "component")
                .map((entry) => makeRef(entry.id));
            const prefabInfoId = appendRecord({
                __type__: "cc.PrefabInfo",
                root: makeRef(nodeId),
                asset: makeRef(prefabId),
                fileId: nextFileId(),
                instance: null,
                targetOverrides: null,
                nestedPrefabInstanceRoots: null,
            });
            nodeRecord._prefab = makeRef(prefabInfoId);
            return nodeId;
        };
        serializeNode(root, null);
        for (const pending of pendingCustomScriptSerializations) {
            this.serializeCustomScriptFields(pending.record, pending.value, pending.componentType, nodeRecordIds, componentRecordIds, droppedReferences);
        }
        const warnings = droppedReferences.length
            ? [
                `Dropped ${droppedReferences.length} script reference(s) that point outside the exported prefab subtree.`,
            ]
            : [];
        return {
            prefabJson: records,
            warnings,
            droppedReferences,
        };
    }
    serializePrefabComponent(component, nodeId, appendRecord, makeRef, nextFileId, nodeRecordIds, componentRecordIds, pendingCustomScriptSerializations) {
        const value = component.dump && typeof component.dump === "object"
            ? component.dump.value
            : undefined;
        const normalizedType = this.normalizePrefabComponentType(component.type);
        if (!value || !normalizedType) {
            return [];
        }
        const componentRecord = this.buildPrefabComponentRecord(normalizedType, value, nodeId, appendRecord, makeRef, component.dump, nodeRecordIds, componentRecordIds, pendingCustomScriptSerializations);
        if (!componentRecord) {
            return [];
        }
        const componentId = appendRecord(componentRecord);
        const sourceComponentUuid = this.readStringField(value, "uuid", "");
        if (sourceComponentUuid) {
            componentRecordIds.set(sourceComponentUuid, componentId);
        }
        const compPrefabInfoId = appendRecord({
            __type__: "cc.CompPrefabInfo",
            fileId: nextFileId(),
        });
        componentRecord.__prefab = makeRef(compPrefabInfoId);
        return [
            { kind: "component", id: componentId },
            { kind: "prefab", id: compPrefabInfoId },
        ];
    }
    buildPrefabComponentRecord(normalizedType, value, nodeId, appendRecord, makeRef, sourceDump, nodeRecordIds, componentRecordIds, pendingCustomScriptSerializations) {
        const serializedType = this.resolvePrefabSerializedComponentType(normalizedType, sourceDump);
        const base = {
            __type__: serializedType,
            _name: this.readStringField(value, "_name", ""),
            _objFlags: 0,
            __editorExtras__: {},
            node: { __id__: nodeId },
            _enabled: this.readBooleanField(value, "_enabled", true),
            _id: "",
        };
        if (normalizedType === "cc.UITransform") {
            base._contentSize = this.toSize(this.readObjectField(value, "_contentSize") ??
                this.readObjectField(value, "contentSize") ?? { width: 100, height: 100 });
            base._anchorPoint = this.toVec2(this.readObjectField(value, "_anchorPoint") ??
                this.readObjectField(value, "anchorPoint") ?? { x: 0.5, y: 0.5 });
            return base;
        }
        if (normalizedType === "cc.Sprite") {
            base._customMaterial = this.toAssetRef(this.readObjectField(value, "_customMaterial") ??
                this.readObjectField(value, "customMaterial"));
            base._srcBlendFactor = this.readNumberField(value, "_srcBlendFactor", 2);
            base._dstBlendFactor = this.readNumberField(value, "_dstBlendFactor", 4);
            base._color = this.toColor(this.readObjectField(value, "_color") ??
                this.readObjectField(value, "color") ?? { r: 255, g: 255, b: 255, a: 255 });
            base._spriteFrame = this.toAssetRef(this.readObjectField(value, "_spriteFrame") ??
                this.readObjectField(value, "spriteFrame"));
            base._type = this.readNumberField(value, "_type", this.readNumberField(value, "type", 0));
            base._fillType = this.readNumberField(value, "_fillType", this.readNumberField(value, "fillType", 0));
            base._sizeMode = this.readNumberField(value, "_sizeMode", this.readNumberField(value, "sizeMode", 0));
            base._fillCenter = this.toVec2(this.readObjectField(value, "_fillCenter") ??
                this.readObjectField(value, "fillCenter") ?? { x: 0, y: 0 });
            base._fillStart = this.readNumberField(value, "_fillStart", this.readNumberField(value, "fillStart", 0));
            base._fillRange = this.readNumberField(value, "_fillRange", this.readNumberField(value, "fillRange", 0));
            base._isTrimmedMode = this.readBooleanField(value, "_isTrimmedMode", this.readBooleanField(value, "trim", true));
            base._useGrayscale = this.readBooleanField(value, "_useGrayscale", this.readBooleanField(value, "grayscale", false));
            base._atlas = this.toAssetRef(this.readObjectField(value, "_atlas"));
            return base;
        }
        if (normalizedType === "cc.Label") {
            base._customMaterial = this.toAssetRef(this.readObjectField(value, "_customMaterial") ??
                this.readObjectField(value, "customMaterial"));
            base._srcBlendFactor = this.readNumberField(value, "_srcBlendFactor", 2);
            base._dstBlendFactor = this.readNumberField(value, "_dstBlendFactor", 4);
            base._color = this.toColor(this.readObjectField(value, "_color") ??
                this.readObjectField(value, "color") ?? { r: 255, g: 255, b: 255, a: 255 });
            base._string = this.readStringField(value, "_string", this.readStringField(value, "string", ""));
            base._horizontalAlign = this.readNumberField(value, "_horizontalAlign", this.readNumberField(value, "horizontalAlign", 0));
            base._verticalAlign = this.readNumberField(value, "_verticalAlign", this.readNumberField(value, "verticalAlign", 0));
            base._actualFontSize = this.readNumberField(value, "_actualFontSize", this.readNumberField(value, "fontSize", 20));
            base._fontSize = this.readNumberField(value, "_fontSize", this.readNumberField(value, "fontSize", 20));
            base._fontFamily = this.readStringField(value, "_fontFamily", this.readStringField(value, "fontFamily", "Arial"));
            base._lineHeight = this.readNumberField(value, "_lineHeight", this.readNumberField(value, "lineHeight", 20));
            base._overflow = this.readNumberField(value, "_overflow", this.readNumberField(value, "overflow", 0));
            base._enableWrapText = this.readBooleanField(value, "_enableWrapText", this.readBooleanField(value, "enableWrapText", true));
            base._font = this.toAssetRef(this.readObjectField(value, "_font") ?? this.readObjectField(value, "font"));
            base._isSystemFontUsed = this.readBooleanField(value, "_isSystemFontUsed", this.readBooleanField(value, "useSystemFont", true));
            base._spacingX = this.readNumberField(value, "_spacingX", this.readNumberField(value, "spacingX", 0));
            base._isItalic = this.readBooleanField(value, "_isItalic", this.readBooleanField(value, "isItalic", false));
            base._isBold = this.readBooleanField(value, "_isBold", this.readBooleanField(value, "isBold", false));
            base._isUnderline = this.readBooleanField(value, "_isUnderline", this.readBooleanField(value, "isUnderline", false));
            base._underlineHeight = this.readNumberField(value, "_underlineHeight", this.readNumberField(value, "underlineHeight", 2));
            base._cacheMode = this.readNumberField(value, "_cacheMode", this.readNumberField(value, "cacheMode", 0));
            base._enableOutline = this.readBooleanField(value, "_enableOutline", this.readBooleanField(value, "enableOutline", false));
            base._outlineColor = this.toColor(this.readObjectField(value, "_outlineColor") ??
                this.readObjectField(value, "outlineColor") ?? { r: 0, g: 0, b: 0, a: 255 });
            base._outlineWidth = this.readNumberField(value, "_outlineWidth", this.readNumberField(value, "outlineWidth", 2));
            base._enableShadow = this.readBooleanField(value, "_enableShadow", this.readBooleanField(value, "enableShadow", false));
            base._shadowColor = this.toColor(this.readObjectField(value, "_shadowColor") ??
                this.readObjectField(value, "shadowColor") ?? { r: 0, g: 0, b: 0, a: 255 });
            base._shadowOffset = this.toVec2(this.readObjectField(value, "_shadowOffset") ??
                this.readObjectField(value, "shadowOffset") ?? { x: 2, y: 2 });
            base._shadowBlur = this.readNumberField(value, "_shadowBlur", this.readNumberField(value, "shadowBlur", 2));
            return base;
        }
        if (normalizedType === "cc.UIOpacity") {
            base._opacity = this.readNumberField(value, "_opacity", 255);
            return base;
        }
        if (normalizedType === "cc.Button") {
            base.clickEvents = this.serializeClickEvents(this.readArrayField(value, "clickEvents"), appendRecord, makeRef);
            base._interactable = this.readBooleanField(value, "_interactable", this.readBooleanField(value, "interactable", true));
            base._transition = this.readNumberField(value, "_transition", this.readNumberField(value, "transition", 0));
            base._normalColor = this.toColor(this.readObjectField(value, "_normalColor") ??
                this.readObjectField(value, "normalColor") ?? {
                r: 255,
                g: 255,
                b: 255,
                a: 255,
            });
            base._hoverColor = this.toColor(this.readObjectField(value, "_hoverColor") ??
                this.readObjectField(value, "hoverColor") ?? {
                r: 211,
                g: 211,
                b: 211,
                a: 255,
            });
            base._pressedColor = this.toColor(this.readObjectField(value, "_pressedColor") ??
                this.readObjectField(value, "pressedColor") ?? {
                r: 255,
                g: 255,
                b: 255,
                a: 255,
            });
            base._disabledColor = this.toColor(this.readObjectField(value, "_disabledColor") ??
                this.readObjectField(value, "disabledColor") ?? {
                r: 124,
                g: 124,
                b: 124,
                a: 255,
            });
            base._normalSprite = this.toAssetRef(this.readObjectField(value, "_normalSprite") ??
                this.readObjectField(value, "normalSprite"));
            base._hoverSprite = this.toAssetRef(this.readObjectField(value, "_hoverSprite") ??
                this.readObjectField(value, "hoverSprite"));
            base._pressedSprite = this.toAssetRef(this.readObjectField(value, "_pressedSprite") ??
                this.readObjectField(value, "pressedSprite"));
            base._disabledSprite = this.toAssetRef(this.readObjectField(value, "_disabledSprite") ??
                this.readObjectField(value, "disabledSprite"));
            base._duration = this.readNumberField(value, "_duration", this.readNumberField(value, "duration", 0.1));
            base._zoomScale = this.readNumberField(value, "_zoomScale", this.readNumberField(value, "zoomScale", 1.2));
            base._target = this.toNodeValueRef(this.readObjectField(value, "_target") ??
                this.readObjectField(value, "target"), nodeId);
            return base;
        }
        if (normalizedType === "cc.Widget") {
            base._alignFlags = this.readNumberField(value, "_alignFlags", this.readNumberField(value, "alignFlags", 0));
            base._target = this.toWidgetTargetRef(this.readObjectField(value, "_target") ??
                this.readObjectField(value, "target"));
            base._left = this.readNumberField(value, "_left", this.readNumberField(value, "left", 0));
            base._right = this.readNumberField(value, "_right", this.readNumberField(value, "right", 0));
            base._top = this.readNumberField(value, "_top", this.readNumberField(value, "top", 0));
            base._bottom = this.readNumberField(value, "_bottom", this.readNumberField(value, "bottom", 0));
            base._horizontalCenter = this.readNumberField(value, "_horizontalCenter", this.readNumberField(value, "horizontalCenter", 0));
            base._verticalCenter = this.readNumberField(value, "_verticalCenter", this.readNumberField(value, "verticalCenter", 0));
            base._isAbsLeft = this.readBooleanField(value, "_isAbsLeft", this.readBooleanField(value, "isAbsoluteLeft", true));
            base._isAbsRight = this.readBooleanField(value, "_isAbsRight", this.readBooleanField(value, "isAbsoluteRight", true));
            base._isAbsTop = this.readBooleanField(value, "_isAbsTop", this.readBooleanField(value, "isAbsoluteTop", true));
            base._isAbsBottom = this.readBooleanField(value, "_isAbsBottom", this.readBooleanField(value, "isAbsoluteBottom", true));
            base._isAbsHorizontalCenter = this.readBooleanField(value, "_isAbsHorizontalCenter", this.readBooleanField(value, "isAbsoluteHorizontalCenter", true));
            base._isAbsVerticalCenter = this.readBooleanField(value, "_isAbsVerticalCenter", this.readBooleanField(value, "isAbsoluteVerticalCenter", true));
            base._originalWidth = this.readNumberField(value, "_originalWidth", 0);
            base._originalHeight = this.readNumberField(value, "_originalHeight", 0);
            base._alignMode = this.readNumberField(value, "_alignMode", this.readNumberField(value, "alignMode", 2));
            base._lockFlags = this.readNumberField(value, "_lockFlags", 0);
            return base;
        }
        if (this.isCustomScriptComponent(sourceDump, normalizedType)) {
            pendingCustomScriptSerializations.push({
                record: base,
                value,
                componentType: serializedType,
            });
            return base;
        }
        return null;
    }
    normalizePrefabComponentType(componentType) {
        const normalized = componentType.trim();
        if (!normalized) {
            return null;
        }
        if (normalized.startsWith("cc.")) {
            return normalized;
        }
        if (/^[A-Z][A-Za-z0-9]*$/.test(normalized)) {
            return `cc.${normalized}`;
        }
        return normalized;
    }
    resolvePrefabSerializedComponentType(normalizedType, sourceDump) {
        const cid = typeof sourceDump.cid === "string" && sourceDump.cid.trim()
            ? sourceDump.cid.trim()
            : null;
        if (cid) {
            return cid;
        }
        return normalizedType;
    }
    isCustomScriptComponent(sourceDump, normalizedType) {
        if (typeof sourceDump.cid === "string" && sourceDump.cid.trim()) {
            return true;
        }
        const sourceValue = sourceDump.value;
        if (!sourceValue ||
            typeof sourceValue !== "object" ||
            Array.isArray(sourceValue)) {
            return false;
        }
        return Boolean(this.readAssetUuid(sourceValue["__scriptAsset"]));
    }
    readStringField(value, key, fallback) {
        const field = this.readFieldValue(value[key]);
        return typeof field === "string" ? field : fallback;
    }
    readNumberField(value, key, fallback) {
        const field = this.readFieldValue(value[key]);
        return typeof field === "number" && Number.isFinite(field) ? field : fallback;
    }
    readBooleanField(value, key, fallback) {
        const field = this.readFieldValue(value[key]);
        return typeof field === "boolean" ? field : fallback;
    }
    readObjectField(value, key) {
        const field = this.readFieldValue(value[key]);
        return field && typeof field === "object" && !Array.isArray(field)
            ? field
            : null;
    }
    readArrayField(value, key) {
        const field = this.readFieldValue(value[key]);
        return Array.isArray(field) ? field : [];
    }
    readFieldRecord(value, key) {
        const field = value[key];
        return field && typeof field === "object" && !Array.isArray(field)
            ? field
            : null;
    }
    readFieldValue(field) {
        if (!field || typeof field !== "object" || Array.isArray(field)) {
            return field;
        }
        const record = field;
        return "value" in record ? record.value : field;
    }
    readAssetUuid(field) {
        const value = this.readFieldValue(field);
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return null;
        }
        const uuid = value.uuid;
        return typeof uuid === "string" && uuid.trim() ? uuid.trim() : null;
    }
    toVec3(value) {
        return {
            __type__: "cc.Vec3",
            x: typeof value.x === "number" ? value.x : 0,
            y: typeof value.y === "number" ? value.y : 0,
            z: typeof value.z === "number" ? value.z : 0,
        };
    }
    toVec2(value) {
        return {
            __type__: "cc.Vec2",
            x: typeof value.x === "number" ? value.x : 0,
            y: typeof value.y === "number" ? value.y : 0,
        };
    }
    toSize(value) {
        return {
            __type__: "cc.Size",
            width: typeof value.width === "number" ? value.width : 0,
            height: typeof value.height === "number" ? value.height : 0,
        };
    }
    toColor(value) {
        return {
            __type__: "cc.Color",
            r: typeof value.r === "number" ? value.r : 255,
            g: typeof value.g === "number" ? value.g : 255,
            b: typeof value.b === "number" ? value.b : 255,
            a: typeof value.a === "number" ? value.a : 255,
        };
    }
    toQuat(value) {
        const x = typeof value.x === "number" ? value.x : 0;
        const y = typeof value.y === "number" ? value.y : 0;
        const z = typeof value.z === "number" ? value.z : 0;
        return {
            __type__: "cc.Quat",
            x,
            y,
            z,
            w: 1,
        };
    }
    toAssetRef(value) {
        const uuid = value ? this.readAssetUuid({ value }) : null;
        if (!uuid) {
            return null;
        }
        const type = value && typeof value.type === "string" ? value.type : undefined;
        return {
            __uuid__: uuid,
            ...(type ? { __expectedType__: type } : {}),
        };
    }
    toNodeValueRef(value, fallbackNodeId) {
        const uuid = value ? this.readAssetUuid({ value }) : null;
        if (!uuid) {
            return { __id__: fallbackNodeId };
        }
        return { __id__: fallbackNodeId };
    }
    serializeCustomScriptFields(record, value, componentType, nodeRecordIds, componentRecordIds, droppedReferences) {
        const internalKeys = new Set([
            "uuid",
            "name",
            "enabled",
            "_name",
            "_objFlags",
            "__scriptAsset",
            "node",
            "_enabled",
        ]);
        for (const key of Object.keys(value)) {
            if (internalKeys.has(key)) {
                continue;
            }
            const fieldRecord = this.readFieldRecord(value, key);
            if (!fieldRecord) {
                continue;
            }
            if (key.startsWith("_") && fieldRecord.visible === false) {
                continue;
            }
            const serializedValue = this.serializeCustomScriptFieldValue(key, componentType, fieldRecord, nodeRecordIds, componentRecordIds, droppedReferences);
            if (serializedValue !== undefined) {
                record[key] = serializedValue;
            }
        }
    }
    serializeCustomScriptFieldValue(fieldName, componentType, fieldRecord, nodeRecordIds, componentRecordIds, droppedReferences) {
        const value = this.readFieldValue(fieldRecord);
        if (value === null ||
            value === undefined ||
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean") {
            return value;
        }
        if (Array.isArray(value)) {
            return value
                .map((entry, index) => this.serializeCustomScriptFieldValue(`${fieldName}[${index}]`, componentType, this.isFieldRecordLike(entry)
                ? entry
                : this.buildNestedFieldRecord(fieldRecord, entry), nodeRecordIds, componentRecordIds, droppedReferences))
                .filter((entry) => entry !== undefined);
        }
        if (typeof value !== "object") {
            return undefined;
        }
        const expectedType = typeof fieldRecord.type === "string" ? fieldRecord.type : undefined;
        const extendsList = Array.isArray(fieldRecord.extends)
            ? fieldRecord.extends.filter((entry) => typeof entry === "string")
            : [];
        const uuid = this.readAssetUuid(fieldRecord);
        if (uuid) {
            if (expectedType === "cc.Node") {
                const nodeId = nodeRecordIds.get(uuid);
                if (nodeId === undefined) {
                    droppedReferences.push({
                        componentType,
                        field: fieldName,
                        referenceKind: "node",
                        targetUuid: uuid,
                        reason: "outside_prefab_scope",
                    });
                }
                return nodeId === undefined ? null : { __id__: nodeId };
            }
            if (extendsList.includes("cc.Component")) {
                const componentId = componentRecordIds.get(uuid);
                if (componentId === undefined) {
                    droppedReferences.push({
                        componentType,
                        field: fieldName,
                        referenceKind: "component",
                        targetUuid: uuid,
                        reason: "outside_prefab_scope",
                    });
                }
                return componentId === undefined ? null : { __id__: componentId };
            }
            if (extendsList.includes("cc.Asset")) {
                return {
                    __uuid__: uuid,
                    ...(expectedType ? { __expectedType__: expectedType } : {}),
                };
            }
        }
        if (expectedType === "cc.Vec2") {
            return this.toVec2(value);
        }
        if (expectedType === "cc.Vec3") {
            return this.toVec3(value);
        }
        if (expectedType === "cc.Color") {
            return this.toColor(value);
        }
        if (expectedType === "cc.Size") {
            return this.toSize(value);
        }
        const serializedObject = this.serializePlainCustomObject(fieldName, componentType, value, nodeRecordIds, componentRecordIds, droppedReferences);
        if (serializedObject !== undefined) {
            return serializedObject;
        }
        return undefined;
    }
    serializePlainCustomObject(fieldName, componentType, value, nodeRecordIds, componentRecordIds, droppedReferences) {
        const result = {};
        let hasSerializedField = false;
        for (const [key, entry] of Object.entries(value)) {
            const childRecord = this.isFieldRecordLike(entry)
                ? entry
                : { value: entry };
            const serializedValue = this.serializeCustomScriptFieldValue(`${fieldName}.${key}`, componentType, childRecord, nodeRecordIds, componentRecordIds, droppedReferences);
            if (serializedValue !== undefined) {
                result[key] = serializedValue;
                hasSerializedField = true;
            }
        }
        return hasSerializedField ? result : undefined;
    }
    buildNestedFieldRecord(parentFieldRecord, entry) {
        const nested = { value: entry };
        if (typeof parentFieldRecord.type === "string") {
            nested.type = this.normalizeCollectionElementType(parentFieldRecord.type);
        }
        if (Array.isArray(parentFieldRecord.extends)) {
            nested.extends = parentFieldRecord.extends;
        }
        return nested;
    }
    normalizeCollectionElementType(type) {
        const trimmed = type.trim();
        if (!trimmed) {
            return trimmed;
        }
        if (trimmed.endsWith("[]")) {
            return trimmed.slice(0, -2).trim();
        }
        const arrayMatch = trimmed.match(/^Array<(.+)>$/);
        if (arrayMatch) {
            return arrayMatch[1].trim();
        }
        return trimmed;
    }
    isFieldRecordLike(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return false;
        }
        const record = value;
        return ("value" in record ||
            "type" in record ||
            "extends" in record ||
            "readonly" in record ||
            "visible" in record);
    }
    toWidgetTargetRef(value) {
        const uuid = value ? this.readAssetUuid({ value }) : null;
        if (!uuid) {
            return null;
        }
        return { __uuid__: uuid };
    }
    serializeClickEvents(entries, appendRecord, makeRef) {
        const result = [];
        for (const entry of entries) {
            const eventValue = this.readFieldValue(entry);
            if (!eventValue || typeof eventValue !== "object" || Array.isArray(eventValue)) {
                continue;
            }
            const record = eventValue;
            const target = this.readObjectField(record, "target");
            const targetUuid = target ? this.readAssetUuid({ value: target }) : null;
            const clickEventId = appendRecord({
                __type__: "cc.ClickEvent",
                target: targetUuid ? { __uuid__: targetUuid } : null,
                component: this.readStringField(record, "component", ""),
                _componentId: this.readStringField(record, "_componentId", ""),
                handler: this.readStringField(record, "handler", ""),
                customEventData: this.readStringField(record, "customEventData", ""),
            });
            result.push(makeRef(clickEventId));
        }
        return result;
    }
    async resolveSceneUrl(identifier) {
        const sceneUrl = identifier.sceneUrl?.trim();
        if (sceneUrl) {
            await this.ensureSceneAssetExists(sceneUrl);
            return sceneUrl;
        }
        const sceneAssetUuid = identifier.assetUuid?.trim() ?? identifier.sceneUuid?.trim();
        if (!sceneAssetUuid) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "sceneUrl or assetUuid is required");
        }
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        try {
            const resolved = await Editor.Message.request("asset-db", "query-url", sceneAssetUuid);
            if (typeof resolved !== "string" || !resolved.trim()) {
                throw new shared_1.AppError("INVALID_ARGUMENT", `Scene asset url was not found for assetUuid "${sceneAssetUuid}"`);
            }
            return resolved.trim();
        }
        catch (error) {
            throw this.normalizeSceneAccessError(error);
        }
    }
    async ensureSceneAssetExists(sceneUrl) {
        await this.resolveSceneAsset(sceneUrl);
    }
    async resolveSceneAsset(sceneUrl) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        try {
            const info = await Editor.Message.request("asset-db", "query-asset-info", sceneUrl);
            if (!info || typeof info !== "object") {
                throw new shared_1.AppError("INVALID_ARGUMENT", `Scene asset "${sceneUrl}" was not found`);
            }
            const record = info;
            const uuid = typeof record.uuid === "string" ? record.uuid.trim() : "";
            const url = typeof record.url === "string" ? record.url.trim() : sceneUrl;
            if (!uuid) {
                throw new shared_1.AppError("INVALID_ARGUMENT", `Scene asset "${sceneUrl}" did not expose an asset uuid`);
            }
            return {
                uuid,
                url,
            };
        }
        catch (error) {
            if (error instanceof shared_1.AppError) {
                throw error;
            }
            throw new shared_1.AppError("INVALID_ARGUMENT", `Scene asset "${sceneUrl}" was not found`, {
                reason: `The requested scene asset could not be resolved.`,
                context: {
                    sceneUrl,
                },
                suggestion: "Use a valid db://assets/...scene path or resolve the scene asset first.",
            });
        }
    }
    normalizeSceneAccessError(error) {
        if (error instanceof shared_1.AppError) {
            return error;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("currentState") ||
            message.includes("No active scene is loaded")) {
            return new shared_1.AppError("NO_ACTIVE_SCENE", "No active scene is loaded", {
                reason: "The editor did not expose an active scene state for this request.",
                context: {
                    originalMessage: message,
                },
                suggestion: "Open a scene in Cocos Creator and retry the tool call.",
            });
        }
        return error;
    }
    getNodePropertyDump(nodeDump, property) {
        return nodeDump[property];
    }
    async resolveComponentPropertyForNode(request) {
        const nodeDump = await this.queryNodeDump(request.nodeUuid);
        const componentRef = await this.executeSceneScript("resolveNodeComponentReference", {
            nodeUuid: request.nodeUuid,
            nodePath: request.nodePath,
            componentType: request.componentType,
        });
        if (!componentRef.uuid) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Component "${request.componentType}" uuid is unavailable`);
        }
        const { path, dump } = this.resolveComponentPropertyTarget(nodeDump, componentRef.uuid, request.componentType, request.property);
        return {
            propertyPath: path,
            propertyDump: dump,
        };
    }
    resolveComponentPropertyTarget(nodeDump, componentUuid, componentType, property) {
        const componentIndex = this.resolveComponentIndex(nodeDump, componentUuid, componentType);
        const segments = this.parsePropertyPath(property);
        if (segments.length === 0) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "Component property path must not be empty");
        }
        let dump;
        try {
            dump = this.readDumpAtPath(nodeDump, `__comps__.${componentIndex}.value.${segments[0]}`);
            for (const segment of segments.slice(1)) {
                dump = this.resolveNestedDumpSegment(dump, segment, property);
            }
        }
        catch (error) {
            throw this.toMissingComponentPropertyError({
                error,
                nodeDump,
                componentIndex,
                componentType,
                property,
            });
        }
        return {
            path: `__comps__.${componentIndex}.${property}`,
            dump,
        };
    }
    parsePropertyPath(property) {
        return property
            .split(".")
            .map((entry) => entry.trim())
            .filter(Boolean);
    }
    toMissingComponentPropertyError(request) {
        if (!(request.error instanceof shared_1.AppError)) {
            return new shared_1.AppError("INVALID_ARGUMENT", `Component property "${request.property}" could not be resolved`);
        }
        const component = Array.isArray(request.nodeDump.__comps__)
            ? request.nodeDump.__comps__[request.componentIndex]
            : undefined;
        const value = component && typeof component.value === "object"
            ? component.value.value
            : undefined;
        const availableFields = value && typeof value === "object" && !Array.isArray(value)
            ? Object.keys(value).filter((field) => !field.startsWith("__"))
            : [];
        return new shared_1.AppError("INVALID_ARGUMENT", `Property dump was not found for component field "${request.property}"`, {
            reason: "The field is not currently visible in the editor component dump, so an apply write would fail.",
            context: {
                componentType: request.componentType,
                property: request.property,
                availableFields,
                originalMessage: request.error.message,
            },
            suggestion: "If this field was just added to a TypeScript component, run script_refresh with expectedFields before retrying the write.",
        });
    }
    resolveNestedDumpSegment(currentDump, segment, fullProperty) {
        if (currentDump.isArray || Array.isArray(currentDump.value)) {
            const index = Number(segment);
            if (!Number.isInteger(index) || index < 0) {
                throw new shared_1.AppError("INVALID_ARGUMENT", `Property path "${fullProperty}" requires a numeric array index at segment "${segment}"`);
            }
            const entries = Array.isArray(currentDump.value) ? currentDump.value : [];
            const existing = entries[index];
            if (existing && typeof existing === "object") {
                return existing;
            }
            const template = this.readCollectionElementTemplate(currentDump);
            if (template) {
                return this.cloneDump(template);
            }
        }
        const value = currentDump.value;
        if (value && typeof value === "object" && !Array.isArray(value)) {
            const nested = value[segment];
            if (nested && typeof nested === "object") {
                return nested;
            }
        }
        throw new shared_1.AppError("INVALID_ARGUMENT", `Property dump was not found at nested segment "${segment}" for path "${fullProperty}"`);
    }
    readCollectionElementTemplate(dump) {
        const explicit = dump.elementTypeData;
        if (explicit && typeof explicit === "object") {
            return explicit;
        }
        if (Array.isArray(dump.value)) {
            const firstObject = dump.value.find((entry) => entry && typeof entry === "object");
            if (firstObject && typeof firstObject === "object") {
                return firstObject;
            }
        }
        return null;
    }
    resolveComponentIndex(nodeDump, componentUuid, componentType) {
        const components = Array.isArray(nodeDump.__comps__) ? nodeDump.__comps__ : [];
        const componentIndex = components.findIndex((component) => {
            const uuidValue = this.readOptionalDumpValue(component, "value.uuid.value");
            if (typeof uuidValue === "string" && uuidValue === componentUuid) {
                return true;
            }
            return this.matchesComponentType(component, componentType);
        });
        if (componentIndex >= 0) {
            return componentIndex;
        }
        throw new shared_1.AppError("INVALID_ARGUMENT", `Component "${componentType}" was not found on node`);
    }
    collectComponentTypeCandidates(component) {
        const candidates = new Set();
        const push = (value) => {
            if (typeof value === "string" && value.trim()) {
                candidates.add(value.trim());
            }
        };
        const pushNested = (value) => {
            if (!value || typeof value !== "object") {
                return;
            }
            const record = value;
            push(record.value);
            push(record.name);
            push(record.type);
            push(record.cid);
            push(record.displayName);
            push(record.__type__);
        };
        push(component.cid);
        push(component.name);
        push(component.type);
        push(component.displayName);
        push(component.__type__);
        pushNested(component.value);
        pushNested(component.name);
        pushNested(component.type);
        return [...candidates];
    }
    matchesComponentType(component, componentType) {
        const normalized = componentType.split(".").filter(Boolean).at(-1);
        const candidates = this.collectComponentTypeCandidates(component);
        return candidates.some((candidate) => {
            if (candidate === componentType || candidate === normalized) {
                return true;
            }
            return (Boolean(normalized) &&
                (candidate.endsWith(`.${normalized}`) ||
                    candidate.endsWith(`/${normalized}`)));
        });
    }
    readOptionalDumpValue(root, path) {
        try {
            return this.readDumpAtPath(root, path).value;
        }
        catch {
            return undefined;
        }
    }
    readDumpAtPath(root, path) {
        const cursor = path.split(".").reduce((current, key) => {
            if (current === null || current === undefined) {
                return undefined;
            }
            if (Array.isArray(current)) {
                const index = Number(key);
                return Number.isInteger(index) ? current[index] : undefined;
            }
            if (typeof current !== "object") {
                return undefined;
            }
            return current[key];
        }, root);
        if (!cursor || typeof cursor !== "object") {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Property dump was not found at path "${path}"`);
        }
        return cursor;
    }
    cloneDump(dump) {
        return JSON.parse(JSON.stringify(dump));
    }
    buildUpdatedPropertyDump(propertyDump, value) {
        const nextDump = this.cloneDump(propertyDump);
        nextDump.value = this.encodeValueForDump(nextDump, value);
        return nextDump;
    }
    encodeValueForDump(templateDump, value) {
        if (templateDump.isArray || Array.isArray(templateDump.value)) {
            if (!Array.isArray(value)) {
                throw new shared_1.AppError("INVALID_ARGUMENT", `Expected an array value for property type "${templateDump.type ?? "array"}"`);
            }
            const elementTemplate = this.readCollectionElementTemplate(templateDump);
            if (!elementTemplate) {
                return value;
            }
            return value.map((entry) => this.buildCollectionElementDump(elementTemplate, entry));
        }
        if (value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            templateDump.value &&
            typeof templateDump.value === "object" &&
            !Array.isArray(templateDump.value) &&
            this.isStructuredFieldRecordMap(templateDump.value)) {
            const templateFields = templateDump.value;
            const inputFields = value;
            const result = {};
            for (const [key, templateField] of Object.entries(templateFields)) {
                if (this.isFieldRecordLike(templateField)) {
                    const nextField = this.cloneDump(templateField);
                    if (Object.prototype.hasOwnProperty.call(inputFields, key)) {
                        nextField.value = this.encodeValueForDump(nextField, inputFields[key]);
                    }
                    result[key] = nextField;
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(inputFields, key)) {
                    result[key] = inputFields[key];
                }
                else {
                    result[key] = templateField;
                }
            }
            for (const [key, inputField] of Object.entries(inputFields)) {
                if (!(key in result)) {
                    result[key] = inputField;
                }
            }
            return result;
        }
        return value;
    }
    buildCollectionElementDump(elementTemplate, value) {
        const nextElement = this.cloneDump(elementTemplate);
        nextElement.value = this.encodeValueForDump(nextElement, value);
        return nextElement;
    }
    isStructuredFieldRecordMap(value) {
        const entries = Object.values(value);
        return entries.length > 0 && entries.every((entry) => this.isFieldRecordLike(entry));
    }
    async assertExpectedRevision(expectedRevision) {
        const currentRevision = await this.getRevision();
        if (typeof expectedRevision !== "number") {
            throw new shared_1.AppError("INVALID_ARGUMENT", "expectedRevision is required when preview is false");
        }
        if (expectedRevision !== currentRevision) {
            throw new shared_1.AppError("REVISION_CONFLICT", `Expected revision ${expectedRevision}, current revision is ${currentRevision}`, {
                expectedRevision,
                currentRevision,
            });
        }
        return currentRevision;
    }
    async advanceSceneRevision() {
        return this.executeSceneScript("advanceSceneRevision");
    }
    async beginRecording(uuids) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        return Editor.Message.request("scene", "begin-recording", uuids);
    }
    async finishRecording(undoId, cancel) {
        if (!Editor?.Message?.request || !undoId) {
            return;
        }
        if (cancel) {
            await Editor.Message.request("scene", "cancel-recording", undoId);
            return;
        }
        await Editor.Message.request("scene", "end-recording", undoId);
    }
    async touchNode(uuid) {
        const nodeDump = await this.queryNodeDump(uuid);
        const propertyDump = this.getNodePropertyDump(nodeDump, "active");
        const nextDump = this.cloneDump(propertyDump);
        await Editor.Message.request("scene", "set-property", {
            uuid,
            path: propertyDump.path ?? "active",
            dump: nextDump,
        });
    }
    readSelectionUuids(value) {
        if (Array.isArray(value)) {
            return value.filter((entry) => typeof entry === "string");
        }
        if (typeof value === "string" && value.trim()) {
            return [value];
        }
        return null;
    }
}
exports.CocosSceneFacade = CocosSceneFacade;
//# sourceMappingURL=scene-facade.js.map