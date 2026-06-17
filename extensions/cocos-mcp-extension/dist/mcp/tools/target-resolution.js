"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSelectorForSceneFacade = resolveSelectorForSceneFacade;
const shared_1 = require("@cocos-mcp/shared");
const v2_shared_1 = require("./v2-shared");
async function resolveSelectorForSceneFacade(sceneFacade, selector, fieldName = "target") {
    if (selector.uuid || selector.path) {
        return {
            uuid: selector.uuid,
            path: selector.path,
        };
    }
    const hierarchy = await sceneFacade.getHierarchy();
    const name = selector.name?.trim().toLowerCase();
    const matches = (0, v2_shared_1.flattenNodes)(hierarchy).filter((node) => typeof name === "string" ? node.name.toLowerCase() === name : false);
    if (matches.length === 0) {
        const candidates = findCandidateMatches(hierarchy, selector.name);
        throw new shared_1.AppError("NODE_NOT_FOUND", "Scene node was not found", {
            reason: typeof selector.name === "string" && selector.name.trim()
                ? `${fieldName} name "${selector.name}" did not match any scene node`
                : `${fieldName} did not resolve to a scene node`,
            context: {
                fieldName,
                selector,
            },
            candidates,
            suggestion: candidates.length
                ? "Use one of the candidate paths or switch to uuid targeting."
                : "Use node_find first or provide a more specific path or uuid.",
        });
    }
    if (matches.length > 1) {
        throw new shared_1.AppError("INVALID_ARGUMENT", `${fieldName} name "${selector.name}" is ambiguous`, {
            reason: `${fieldName} name "${selector.name}" matched multiple scene nodes`,
            context: {
                fieldName,
                selector,
                matchCount: matches.length,
            },
            candidates: matches.map(toMatchDetail),
            suggestion: "Use path or uuid targeting instead of name.",
        });
    }
    return {
        uuid: matches[0].uuid,
    };
}
function toMatchDetail(node) {
    return {
        uuid: node.uuid,
        path: node.path,
    };
}
function findCandidateMatches(hierarchy, targetName) {
    const normalizedTarget = targetName?.trim().toLowerCase();
    if (!normalizedTarget) {
        return [];
    }
    return (0, v2_shared_1.flattenNodes)(hierarchy)
        .filter((node) => {
        const normalizedName = node.name.toLowerCase();
        return (normalizedName.includes(normalizedTarget) ||
            normalizedTarget.includes(normalizedName));
    })
        .slice(0, 5)
        .map(toMatchDetail);
}
//# sourceMappingURL=target-resolution.js.map