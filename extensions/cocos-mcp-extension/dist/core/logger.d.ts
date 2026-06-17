export interface Logger {
    info(message: string, extra?: unknown): void;
    warn(message: string, extra?: unknown): void;
    error(message: string, extra?: unknown): void;
}
export declare class ConsoleLogger implements Logger {
    private readonly scope;
    constructor(scope: string);
    info(message: string, extra?: unknown): void;
    warn(message: string, extra?: unknown): void;
    error(message: string, extra?: unknown): void;
}
