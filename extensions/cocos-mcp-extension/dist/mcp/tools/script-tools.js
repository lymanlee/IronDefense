"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createScriptTools = createScriptTools;
const shared_1 = require("@cocos-mcp/shared");
const target_resolution_1 = require("./target-resolution");
const v2_shared_1 = require("./v2-shared");
function createScriptTools(assetFacade, sceneFacade) {
    return [
        {
            name: "script_find",
            title: "Script Find",
            description: "Find project TypeScript component scripts and return compact attach-ready candidates.",
            feature: "project.read",
            inputSchema: {
                type: "object",
                properties: {
                    pattern: { type: "string" },
                    exact: { type: "boolean" },
                    maxResults: { type: "number" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const result = await assetFacade.findScripts({
                    pattern: typeof args.pattern === "string" ? args.pattern : undefined,
                    exact: typeof args.exact === "boolean" ? args.exact : undefined,
                    maxResults: typeof args.maxResults === "number" ? args.maxResults : undefined,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Found ${result.matches.length} script match(es).`,
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
        {
            name: "script_create",
            title: "Script Create",
            description: "Create a project TypeScript component script under assets and return an attach-ready script summary.",
            feature: "project.write",
            inputSchema: {
                type: "object",
                properties: {
                    scriptUrl: { type: "string" },
                    scriptPath: { type: "string" },
                    className: { type: "string" },
                    overwrite: { type: "boolean" },
                    openAfterCreate: { type: "boolean" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const result = await assetFacade.createScript({
                    scriptUrl: typeof args.scriptUrl === "string" ? args.scriptUrl : undefined,
                    scriptPath: typeof args.scriptPath === "string" ? args.scriptPath : undefined,
                    className: typeof args.className === "string" ? args.className : undefined,
                    overwrite: typeof args.overwrite === "boolean" ? args.overwrite : undefined,
                    openAfterCreate: typeof args.openAfterCreate === "boolean"
                        ? args.openAfterCreate
                        : undefined,
                    template: "component",
                });
                const structuredContent = result;
                return {
                    content: [
                        {
                            type: "text",
                            text: `Created script ${result.script.className} at ${result.script.url}.`,
                        },
                    ],
                    structuredContent,
                };
            },
        },
        {
            name: "script_refresh",
            title: "Script Refresh",
            description: "Reimport a TypeScript component script and optionally wait until expected component fields are visible in the editor component dump before writing them.",
            feature: "project.write",
            inputSchema: {
                type: "object",
                properties: {
                    scriptUrl: { type: "string" },
                    scriptUuid: { type: "string" },
                    target: {
                        type: "object",
                        properties: {
                            uuid: { type: "string" },
                            path: { type: "string" },
                            name: { type: "string" },
                        },
                        additionalProperties: false,
                    },
                    componentType: { type: "string" },
                    expectedFields: {
                        type: "array",
                        items: { type: "string" },
                    },
                    timeoutMs: { type: "number" },
                    pollIntervalMs: { type: "number" },
                },
                additionalProperties: false,
            },
            handler: async (args) => {
                const scriptUrl = typeof args.scriptUrl === "string" ? args.scriptUrl : undefined;
                const scriptUuid = typeof args.scriptUuid === "string" ? args.scriptUuid : undefined;
                if (!scriptUrl?.trim() && !scriptUuid?.trim()) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "scriptUrl or scriptUuid is required");
                }
                const startedAt = Date.now();
                const script = await assetFacade.refreshScript({
                    url: scriptUrl,
                    uuid: scriptUuid,
                });
                const expectedFields = parseExpectedFields(args.expectedFields);
                const hasFieldWait = expectedFields.length > 0;
                const waitTarget = args.target === undefined ? undefined : (0, v2_shared_1.parseTargetSelector)(args.target);
                const componentType = typeof args.componentType === "string" ? args.componentType.trim() : "";
                let foundFields = [];
                let missingFields = expectedFields;
                if (hasFieldWait) {
                    if (!waitTarget || !componentType) {
                        throw new shared_1.AppError("INVALID_ARGUMENT", "target and componentType are required when expectedFields is provided");
                    }
                    const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, waitTarget);
                    const waited = await waitForComponentFields({
                        sceneFacade,
                        targetIdentifier,
                        componentType,
                        expectedFields,
                        timeoutMs: normalizeTimeout(args.timeoutMs),
                        pollIntervalMs: normalizePollInterval(args.pollIntervalMs),
                    });
                    foundFields = waited.foundFields;
                    missingFields = waited.missingFields;
                    if (missingFields.length > 0) {
                        throw new shared_1.AppError("INVALID_ARGUMENT", `Script fields are not visible in component dump: ${missingFields.join(", ")}`, {
                            reason: "The script was refreshed, but the editor component dump did not expose all expected fields before timeout.",
                            context: {
                                scriptUrl: script.url,
                                componentType,
                                expectedFields,
                                foundFields,
                                missingFields,
                                elapsedMs: Date.now() - startedAt,
                            },
                            suggestion: "Check TypeScript compile errors in Cocos Creator, then retry script_refresh after the editor finishes compiling.",
                        });
                    }
                }
                const structuredContent = {
                    script,
                    refreshed: true,
                    waitedForFields: hasFieldWait,
                    expectedFields,
                    foundFields,
                    missingFields,
                    elapsedMs: Date.now() - startedAt,
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: hasFieldWait
                                ? `Refreshed script ${script.className}; expected fields are visible.`
                                : `Refreshed script ${script.className}.`,
                        },
                    ],
                    structuredContent,
                };
            },
        },
        {
            name: "component_attach_script",
            title: "Component Attach Script",
            description: "Attach a project TypeScript component script to a node by script url or uuid. After apply, if verification is needed, do one serialized state-sensitive read instead of repeated scene_status or component-dump polling.",
            feature: "component.write",
            inputSchema: {
                type: "object",
                properties: {
                    target: {
                        type: "object",
                        properties: {
                            uuid: { type: "string" },
                            path: { type: "string" },
                            name: { type: "string" },
                        },
                        additionalProperties: false,
                    },
                    scriptUrl: { type: "string" },
                    scriptUuid: { type: "string" },
                    preview: { type: "boolean" },
                    expectedRevision: { type: "number" },
                    idempotencyKey: { type: "string" },
                },
                required: ["target"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const target = (0, v2_shared_1.parseTargetSelector)(args.target);
                const targetIdentifier = await (0, target_resolution_1.resolveSelectorForSceneFacade)(sceneFacade, target);
                const scriptUrl = typeof args.scriptUrl === "string" ? args.scriptUrl : undefined;
                const scriptUuid = typeof args.scriptUuid === "string" ? args.scriptUuid : undefined;
                if (!scriptUrl?.trim() && !scriptUuid?.trim()) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "scriptUrl or scriptUuid is required");
                }
                const script = await assetFacade.resolveScript({
                    url: scriptUrl,
                    uuid: scriptUuid,
                });
                const result = await sceneFacade.addComponent({
                    nodeUuid: targetIdentifier.uuid,
                    nodePath: targetIdentifier.path,
                    componentType: script.className,
                    preview: typeof args.preview === "boolean" ? args.preview : true,
                    expectedRevision: typeof args.expectedRevision === "number"
                        ? args.expectedRevision
                        : undefined,
                    idempotencyKey: typeof args.idempotencyKey === "string"
                        ? args.idempotencyKey
                        : undefined,
                });
                const structuredContent = {
                    ...result,
                    componentType: script.className,
                    script,
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: result.preview
                                ? (0, v2_shared_1.mutationText)(result)
                                : (0, v2_shared_1.withVerificationHint)((0, v2_shared_1.mutationText)(result), result),
                        },
                    ],
                    structuredContent,
                };
            },
        },
    ];
}
function parseExpectedFields(value) {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "expectedFields must be an array of field names");
    }
    const fields = value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean);
    if (fields.length !== value.length) {
        throw new shared_1.AppError("INVALID_ARGUMENT", "expectedFields must contain only non-empty strings");
    }
    return [...new Set(fields)];
}
function normalizeTimeout(value) {
    if (typeof value !== "number") {
        return 8000;
    }
    return Math.min(30000, Math.max(500, Math.floor(value)));
}
function normalizePollInterval(value) {
    if (typeof value !== "number") {
        return 300;
    }
    return Math.min(2000, Math.max(100, Math.floor(value)));
}
async function waitForComponentFields(request) {
    const deadline = Date.now() + request.timeoutMs;
    let lastFoundFields = [];
    let lastMissingFields = request.expectedFields;
    while (Date.now() <= deadline) {
        const dump = await request.sceneFacade.getRawComponentDump({
            nodeUuid: request.targetIdentifier.uuid,
            nodePath: request.targetIdentifier.path,
            componentType: request.componentType,
        });
        lastFoundFields = request.expectedFields.filter((field) => hasDumpField(dump, field));
        lastMissingFields = request.expectedFields.filter((field) => !lastFoundFields.includes(field));
        if (lastMissingFields.length === 0) {
            break;
        }
        await sleep(request.pollIntervalMs);
    }
    return {
        foundFields: lastFoundFields,
        missingFields: lastMissingFields,
    };
}
function hasDumpField(dump, field) {
    const segments = field
        .split(".")
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (segments.length === 0) {
        return false;
    }
    let cursor = dump;
    for (const segment of ["value", ...segments]) {
        if (!cursor || typeof cursor !== "object") {
            return false;
        }
        if (Array.isArray(cursor)) {
            const index = Number(segment);
            if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
                return false;
            }
            cursor = cursor[index];
            continue;
        }
        if (!(segment in cursor)) {
            return false;
        }
        cursor = cursor[segment];
    }
    return cursor !== undefined && cursor !== null;
}
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
//# sourceMappingURL=script-tools.js.map