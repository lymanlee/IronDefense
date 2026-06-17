"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEditorTools = createEditorTools;
function createEditorTools(projectContext, sceneFacade) {
    return [
        {
            name: "editor_get_status",
            title: "Editor Status",
            description: "Return editor availability and current project metadata.",
            feature: "editor.read",
            inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            handler: async () => {
                const info = projectContext.getProjectInfo();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Editor ready for project ${info.projectName}.`,
                        },
                    ],
                    structuredContent: {
                        editorReady: true,
                        project: info,
                    },
                };
            },
        },
        {
            name: "project_get_info",
            title: "Project Info",
            description: "Return the current Cocos project name, path and editor version.",
            feature: "project.read",
            inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            handler: async () => {
                const info = projectContext.getProjectInfo();
                return {
                    content: [
                        {
                            type: "text",
                            text: `${info.projectName} (${info.editorVersion})`,
                        },
                    ],
                    structuredContent: info,
                };
            },
        },
        {
            name: "project_save_scene",
            title: "Save Scene",
            description: "Persist the current scene if it is dirty. This uses editor message strategies inferred from public Cocos message APIs.",
            feature: "project.write",
            inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            handler: async () => {
                const result = await sceneFacade.saveScene();
                return {
                    content: [
                        {
                            type: "text",
                            text: result.saved
                                ? `Scene save completed via ${result.strategy}.`
                                : `Scene save attempted via ${result.strategy}, but scene is still dirty.`,
                        },
                    ],
                    structuredContent: result,
                };
            },
        },
    ];
}
//# sourceMappingURL=editor-tools.js.map