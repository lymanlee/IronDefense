"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = void 0;
class ConsoleLogger {
    scope;
    constructor(scope) {
        this.scope = scope;
    }
    info(message, extra) {
        console.log(`[${this.scope}] ${message}`, extra ?? "");
    }
    warn(message, extra) {
        console.warn(`[${this.scope}] ${message}`, extra ?? "");
    }
    error(message, extra) {
        console.error(`[${this.scope}] ${message}`, extra ?? "");
    }
}
exports.ConsoleLogger = ConsoleLogger;
//# sourceMappingURL=logger.js.map