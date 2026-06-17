"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
const shared_1 = require("@cocos-mcp/shared");
class ToolRegistry {
    gate;
    options;
    tools = new Map();
    idempotencyRecords = new Map();
    static IDEMPOTENCY_RETENTION_MS = 6 * 60 * 60 * 1000;
    static IDEMPOTENCY_MAX_ENTRIES = 200;
    constructor(gate, options = {}) {
        this.gate = gate;
        this.options = options;
    }
    register(definition) {
        this.tools.set(definition.name, definition);
    }
    registerMany(definitions) {
        for (const definition of definitions) {
            this.register(definition);
        }
    }
    async list() {
        const visible = [];
        for (const tool of this.tools.values()) {
            if (await this.gate.hasFeature(tool.feature)) {
                visible.push({
                    name: tool.name,
                    title: tool.title,
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                });
            }
        }
        return visible;
    }
    async listToolNames() {
        const visible = await this.list();
        return visible.map((tool) => tool.name);
    }
    async invoke(toolName, args, request) {
        const startedAt = Date.now();
        const revisionBefore = await this.safeSceneRevision();
        const context = {
            requestId: request.id === undefined || request.id === null
                ? undefined
                : String(request.id),
        };
        try {
            const tool = this.tools.get(toolName);
            if (!tool) {
                throw new shared_1.AppError("INVALID_ARGUMENT", `Unknown tool "${toolName}"`);
            }
            await this.gate.assertFeature(tool.feature);
            const result = await this.executeWithIdempotency(toolName, tool, args, context);
            this.options.telemetry?.recordToolCall({
                toolName,
                requestId: context.requestId,
                args,
                result,
                success: true,
                durationMs: Date.now() - startedAt,
                sceneRevisionBefore: revisionBefore,
                sceneRevisionAfter: await this.safeSceneRevision(),
            });
            return result;
        }
        catch (error) {
            this.options.telemetry?.recordToolCall({
                toolName,
                requestId: context.requestId,
                args,
                success: false,
                errorCode: error instanceof shared_1.AppError ? error.code : "INTERNAL_ERROR",
                durationMs: Date.now() - startedAt,
                sceneRevisionBefore: revisionBefore,
                sceneRevisionAfter: await this.safeSceneRevision(),
            });
            throw error;
        }
    }
    async executeWithIdempotency(toolName, tool, args, context) {
        const keyInfo = this.getIdempotencyKeyInfo(toolName, tool, args);
        if (!keyInfo) {
            return tool.handler(args, context);
        }
        this.pruneIdempotencyRecords();
        const existing = this.idempotencyRecords.get(keyInfo.cacheKey);
        if (existing) {
            if (existing.payloadKey !== keyInfo.payloadKey) {
                throw new shared_1.AppError("IDEMPOTENCY_CONFLICT", `idempotencyKey "${keyInfo.idempotencyKey}" was already used for a different ${toolName} apply payload`, {
                    reason: "The same idempotencyKey was reused with a different apply payload.",
                    context: {
                        toolName,
                        idempotencyKey: keyInfo.idempotencyKey,
                    },
                    suggestion: "Retry with the original payload, or generate a new idempotencyKey for a new apply request.",
                });
            }
            return existing.promise;
        }
        const promise = tool.handler(args, context);
        const createdAt = Date.now();
        this.idempotencyRecords.set(keyInfo.cacheKey, {
            payloadKey: keyInfo.payloadKey,
            promise,
            createdAt,
        });
        try {
            const result = await promise;
            const completedAt = Date.now();
            this.idempotencyRecords.set(keyInfo.cacheKey, {
                payloadKey: keyInfo.payloadKey,
                promise: Promise.resolve(result),
                createdAt,
                completedAt,
            });
            return result;
        }
        catch (error) {
            this.idempotencyRecords.delete(keyInfo.cacheKey);
            throw error;
        }
    }
    getIdempotencyKeyInfo(toolName, tool, args) {
        if (tool.feature !== "scene.write" || args.preview !== false) {
            return undefined;
        }
        if (typeof args.idempotencyKey !== "string" || !args.idempotencyKey.trim()) {
            return undefined;
        }
        const idempotencyKey = args.idempotencyKey.trim();
        const payloadKey = stableStringify(stripIdempotencyEnvelope(args, new Set(["preview", "expectedRevision", "idempotencyKey"])));
        return {
            cacheKey: `${toolName}:${idempotencyKey}`,
            idempotencyKey,
            payloadKey,
        };
    }
    pruneIdempotencyRecords() {
        const now = Date.now();
        for (const [cacheKey, record] of this.idempotencyRecords.entries()) {
            const age = now - (record.completedAt ?? record.createdAt);
            if (age > ToolRegistry.IDEMPOTENCY_RETENTION_MS) {
                this.idempotencyRecords.delete(cacheKey);
            }
        }
        if (this.idempotencyRecords.size <= ToolRegistry.IDEMPOTENCY_MAX_ENTRIES) {
            return;
        }
        const orderedEntries = Array.from(this.idempotencyRecords.entries()).sort((left, right) => (left[1].completedAt ?? left[1].createdAt) -
            (right[1].completedAt ?? right[1].createdAt));
        for (const [cacheKey] of orderedEntries.slice(0, this.idempotencyRecords.size - ToolRegistry.IDEMPOTENCY_MAX_ENTRIES)) {
            this.idempotencyRecords.delete(cacheKey);
        }
    }
    async safeSceneRevision() {
        if (!this.options.getSceneRevision) {
            return undefined;
        }
        try {
            return await this.options.getSceneRevision();
        }
        catch {
            return undefined;
        }
    }
}
exports.ToolRegistry = ToolRegistry;
function stripIdempotencyEnvelope(value, keysToRemove) {
    if (Array.isArray(value)) {
        return value.map((item) => stripIdempotencyEnvelope(item, keysToRemove));
    }
    if (!value || typeof value !== "object") {
        return value;
    }
    const entries = Object.entries(value)
        .filter(([key]) => !keysToRemove.has(key))
        .map(([key, item]) => [key, stripIdempotencyEnvelope(item, keysToRemove)])
        .filter(([, item]) => item !== undefined);
    return Object.fromEntries(entries);
}
function stableStringify(value) {
    if (value === undefined) {
        return "null";
    }
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
        .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
        .join(",")}}`;
}
//# sourceMappingURL=tool-registry.js.map