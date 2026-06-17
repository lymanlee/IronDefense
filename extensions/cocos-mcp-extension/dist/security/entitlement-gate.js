"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevelopmentEntitlementGate = void 0;
const shared_1 = require("@cocos-mcp/shared");
class DevelopmentEntitlementGate {
    snapshot;
    constructor() {
        const features = [
            "server.start",
            "debug.read",
            "editor.read",
            "project.read",
            "project.write",
            "scene.read",
            "scene.write",
            "component.read",
            "component.write",
        ];
        this.snapshot = {
            mode: "development",
            plan: "dev",
            features,
        };
    }
    async getSnapshot() {
        return this.snapshot;
    }
    async assertFeature(feature) {
        if (!(await this.hasFeature(feature))) {
            throw new shared_1.AppError("PERMISSION_DENIED", `Feature "${feature}" is not enabled`);
        }
    }
    async hasFeature(feature) {
        return this.snapshot.features.includes(feature);
    }
}
exports.DevelopmentEntitlementGate = DevelopmentEntitlementGate;
//# sourceMappingURL=entitlement-gate.js.map