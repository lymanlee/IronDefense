"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectContextService = void 0;
class ProjectContextService {
    getProjectInfo() {
        const projectPath = Editor?.Project?.path ?? "";
        const editorVersion = Editor?.App?.version ?? "unknown";
        const parts = String(projectPath).split(/[\\/]/).filter(Boolean);
        const projectName = parts.at(-1) ?? "unknown-project";
        return {
            projectName,
            projectPath,
            editorVersion,
        };
    }
}
exports.ProjectContextService = ProjectContextService;
//# sourceMappingURL=project-context.js.map