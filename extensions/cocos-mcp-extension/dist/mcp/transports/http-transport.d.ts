import type { Logger } from "../../core/logger";
import type { EmbeddedMcpServer } from "../server";
export interface HttpTransportOptions {
    host: string;
    port: number;
}
export declare class EmbeddedHttpTransport {
    private readonly mcpServer;
    private readonly logger;
    private readonly options;
    private server;
    private readonly sessions;
    constructor(mcpServer: EmbeddedMcpServer, logger: Logger, options: HttpTransportOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): {
        running: boolean;
        host: string;
        port: number;
    };
    private handlePost;
    private handleGet;
    private handleDelete;
    private createSession;
    private readSessionId;
    private writeJson;
}
