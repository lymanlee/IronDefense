"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const fs = require("node:fs");
const path = require("node:path");
class TelemetryService {
    projectContext;
    logger;
    currentSessionId;
    sequence = 0;
    constructor(projectContext, logger) {
        this.projectContext = projectContext;
        this.logger = logger;
    }
    startSession(request) {
        const params = this.asRecord(request.params);
        return this.openSession({
            clientInfo: this.asRecord(params.clientInfo),
        });
    }
    getCurrentSessionId() {
        return this.currentSessionId;
    }
    ensureSession(request, defaults) {
        if (this.currentSessionId) {
            return this.currentSessionId;
        }
        const params = this.asRecord(request?.params);
        const clientInfo = {
            ...this.asRecord(params.clientInfo),
            ...(defaults?.hostName ? { name: defaults.hostName } : {}),
            ...(defaults?.hostVersion ? { version: defaults.hostVersion } : {}),
        };
        return this.openSession({
            clientInfo,
        });
    }
    getTelemetryDir() {
        return this.telemetryDir();
    }
    getRecentToolCalls(input) {
        const limit = clampInteger(input?.limit, 20, 1, 50);
        const events = this.readJsonLines("events.jsonl").filter((event) => event &&
            event.eventType === "tool_call" &&
            (input?.toolName ? event.toolName === input.toolName : true) &&
            (input?.sessionId ? event.sessionId === input.sessionId : true) &&
            (input?.mode ? event.mode === input.mode : true) &&
            (typeof input?.success === "boolean" ? event.success === input.success : true));
        return events
            .sort(compareToolCallRecords)
            .slice(-limit)
            .reverse();
    }
    recordToolCall(input) {
        const record = {
            eventType: "tool_call",
            timestamp: new Date().toISOString(),
            sessionId: this.currentSessionId,
            requestId: input.requestId,
            sequence: ++this.sequence,
            toolName: input.toolName,
            mode: summarizeMode(input.args),
            success: input.success,
            errorCode: input.errorCode,
            durationMs: input.durationMs,
            resultBytes: measureResultBytes(input.result),
            sceneRevisionBefore: input.sceneRevisionBefore,
            sceneRevisionAfter: input.sceneRevisionAfter,
            argsSummary: summarizeArgs(input.args),
            resultSummary: summarizeResult(input.result),
        };
        this.writeJsonLine("events.jsonl", record);
    }
    telemetryDir() {
        return path.join(this.projectContext.getProjectInfo().projectPath, "temp", "cocos-mcp", "telemetry");
    }
    openSession(input) {
        const clientInfo = input.clientInfo ?? {};
        const projectInfo = this.projectContext.getProjectInfo();
        const sessionId = `sess_${Date.now().toString(36)}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;
        const record = {
            sessionId,
            startedAt: new Date().toISOString(),
            hostName: typeof clientInfo.name === "string" && clientInfo.name.trim()
                ? clientInfo.name.trim()
                : "implicit-client",
            hostVersion: typeof clientInfo.version === "string" && clientInfo.version.trim()
                ? clientInfo.version.trim()
                : undefined,
            projectPath: projectInfo.projectPath,
            editorVersion: projectInfo.editorVersion,
        };
        this.currentSessionId = sessionId;
        this.sequence = 0;
        this.writeJsonLine("sessions.jsonl", record);
        return sessionId;
    }
    writeJsonLine(filename, payload) {
        try {
            const dir = this.telemetryDir();
            fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, filename);
            rotateIfNeeded(filePath);
            fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, "utf8");
        }
        catch (error) {
            this.logger.warn("Failed to write telemetry record", {
                filename,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    readJsonLines(filename) {
        try {
            const filePath = path.join(this.telemetryDir(), filename);
            if (!fs.existsSync(filePath)) {
                return [];
            }
            return fs
                .readFileSync(filePath, "utf8")
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => JSON.parse(line));
        }
        catch (error) {
            this.logger.warn("Failed to read telemetry records", {
                filename,
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    asRecord(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {};
        }
        return value;
    }
}
exports.TelemetryService = TelemetryService;
function summarizeMode(args) {
    if (typeof args.preview === "boolean") {
        return args.preview ? "preview" : "apply";
    }
    return "read";
}
function summarizeArgs(args) {
    const summary = {
        targetKind: summarizeTargetKind(args.target),
        hasName: typeof args.name === "string" || hasTargetField(args.target, "name"),
        hasUuid: typeof args.uuid === "string" || hasTargetField(args.target, "uuid"),
        hasPath: typeof args.path === "string" || hasTargetField(args.target, "path"),
        view: typeof args.view === "string" ? args.view : undefined,
        depth: typeof args.depth === "number" ? args.depth : undefined,
        maxDepth: typeof args.maxDepth === "number" ? args.maxDepth : undefined,
        includeComponents: typeof args.includeComponents === "boolean"
            ? args.includeComponents
            : undefined,
        maxResults: typeof args.maxResults === "number" ? args.maxResults : undefined,
        componentType: typeof args.componentType === "string" ? args.componentType : undefined,
        preview: typeof args.preview === "boolean" ? args.preview : undefined,
        hasExpectedRevision: typeof args.expectedRevision === "number",
        hasIdempotencyKey: typeof args.idempotencyKey === "string",
        propKeys: args.props && typeof args.props === "object" && !Array.isArray(args.props)
            ? Object.keys(args.props).sort()
            : undefined,
    };
    return compactRecord(summary);
}
function summarizeResult(result) {
    const structured = result?.structuredContent && typeof result.structuredContent === "object"
        ? result.structuredContent
        : undefined;
    const summary = {
        contentCount: Array.isArray(result?.content) ? result?.content.length : 0,
        matchCount: Array.isArray(structured?.matches) ? structured?.matches.length : undefined,
        rootCount: Array.isArray(structured?.roots) ? structured?.roots.length : undefined,
        nodeCount: Array.isArray(structured?.nodes) ? structured?.nodes.length : undefined,
        issueCount: Array.isArray(structured?.issues) ? structured?.issues.length : undefined,
        bindingCount: Array.isArray(structured?.bindings)
            ? structured?.bindings.length
            : undefined,
        warningCount: Array.isArray(structured?.warnings)
            ? structured?.warnings.length
            : undefined,
        saved: typeof structured?.saved === "boolean" ? structured.saved : undefined,
        dirty: typeof structured?.dirty === "boolean" ? structured.dirty : undefined,
        revision: typeof structured?.revision === "number" ? structured.revision : undefined,
        currentRevision: typeof structured?.currentRevision === "number"
            ? structured.currentRevision
            : undefined,
        nextRevision: typeof structured?.nextRevision === "number"
            ? structured.nextRevision
            : undefined,
        appliedRevision: typeof structured?.appliedRevision === "number"
            ? structured.appliedRevision
            : undefined,
        dirtyBefore: typeof structured?.dirtyBefore === "boolean"
            ? structured.dirtyBefore
            : undefined,
        dirtyAfter: typeof structured?.dirtyAfter === "boolean"
            ? structured.dirtyAfter
            : undefined,
        noop: typeof structured?.noop === "boolean" ? structured.noop : undefined,
        selectionCount: typeof structured?.count === "number" ? structured.count : undefined,
    };
    return compactRecord(summary);
}
function summarizeTargetKind(target) {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
        return undefined;
    }
    const record = target;
    const present = ["uuid", "path", "name"].filter((key) => typeof record[key] === "string" && String(record[key]).trim());
    if (present.length === 0) {
        return undefined;
    }
    return present.length === 1 ? present[0] : "mixed";
}
function hasTargetField(target, field) {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
        return false;
    }
    return typeof target[field] === "string";
}
function compactRecord(record) {
    return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}
function measureResultBytes(result) {
    if (!result) {
        return 0;
    }
    try {
        return Buffer.byteLength(JSON.stringify(result));
    }
    catch {
        return 0;
    }
}
function rotateIfNeeded(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return;
        }
        const stat = fs.statSync(filePath);
        if (stat.size < 10 * 1024 * 1024) {
            return;
        }
        const rotatedPath = `${filePath}.${Date.now()}`;
        fs.renameSync(filePath, rotatedPath);
    }
    catch {
        // Ignore rotation failures in the first version. The next append will still
        // attempt to write the current record.
    }
}
function compareToolCallRecords(left, right) {
    const sessionCompare = String(left.sessionId ?? "").localeCompare(String(right.sessionId ?? ""));
    if (sessionCompare !== 0) {
        return sessionCompare;
    }
    const sequenceCompare = left.sequence - right.sequence;
    if (sequenceCompare !== 0) {
        return sequenceCompare;
    }
    return String(left.timestamp).localeCompare(String(right.timestamp));
}
function clampInteger(value, fallback, min, max) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.floor(value)));
}
//# sourceMappingURL=telemetry-service.js.map