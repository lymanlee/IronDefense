"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidationTools = createValidationTools;
const shared_1 = require("@cocos-mcp/shared");
const v2_shared_1 = require("./v2-shared");
function createValidationTools(sceneFacade) {
    return [
        {
            name: "scene_validate",
            title: "Scene Validate",
            description: "Run lightweight layout, references, or hierarchy checks against the active scene.",
            feature: "scene.read",
            inputSchema: {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        enum: ["layout", "references", "hierarchy"],
                    },
                },
                required: ["mode"],
                additionalProperties: false,
            },
            handler: async (args) => {
                const mode = args.mode === "layout" ||
                    args.mode === "references" ||
                    args.mode === "hierarchy"
                    ? args.mode
                    : null;
                if (!mode) {
                    throw new shared_1.AppError("INVALID_ARGUMENT", "mode must be one of layout, references, or hierarchy");
                }
                const hierarchy = await sceneFacade.getHierarchy();
                const issues = mode === "hierarchy"
                    ? collectHierarchyIssues(hierarchy)
                    : [];
                const result = {
                    mode,
                    issues,
                };
                return {
                    content: [
                        {
                            type: "text",
                            text: issues.length
                                ? `Validation found ${issues.length} issue(s).`
                                : `Validation completed with no issues.`,
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
    ];
}
function collectHierarchyIssues(hierarchy) {
    const issues = [];
    const allNodes = (0, v2_shared_1.flattenNodes)(hierarchy);
    for (const node of allNodes) {
        if (depthOf(node.path) > 12) {
            issues.push({
                severity: "warn",
                path: node.path,
                message: "Hierarchy depth exceeds the recommended limit of 12.",
            });
        }
    }
    for (const parent of allNodes) {
        const nameCounts = new Map();
        for (const child of parent.children) {
            nameCounts.set(child.name, (nameCounts.get(child.name) ?? 0) + 1);
        }
        for (const [name, count] of nameCounts.entries()) {
            if (count > 1) {
                issues.push({
                    severity: "warn",
                    path: parent.path,
                    message: `Sibling name "${name}" appears ${count} times.`,
                });
            }
        }
    }
    return issues;
}
function depthOf(path) {
    return path.split("/").filter(Boolean).length;
}
//# sourceMappingURL=validation-tools.js.map