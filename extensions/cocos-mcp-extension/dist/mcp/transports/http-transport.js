"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddedHttpTransport = void 0;
const { createServer } = require("http");
const { randomUUID } = require("crypto");
class EmbeddedHttpTransport {
    mcpServer;
    logger;
    options;
    server = null;
    sessions = new Map();
    constructor(mcpServer, logger, options) {
        this.mcpServer = mcpServer;
        this.logger = logger;
        this.options = options;
    }
    async start() {
        if (this.server) {
            return;
        }
        this.server = createServer(async (req, res) => {
            const requestUrl = new URL(req.url ?? "/", `http://${this.options.host}:${this.options.port}`);
            if (requestUrl.pathname === "/health") {
                this.writeJson(res, 200, {
                    ok: true,
                    host: this.options.host,
                    port: this.options.port,
                });
                return;
            }
            if (requestUrl.pathname !== "/mcp") {
                this.writeJson(res, 404, { error: "Not found" });
                return;
            }
            switch (req.method) {
                case "POST":
                    this.handlePost(req, res);
                    return;
                case "GET":
                    this.handleGet(req, res);
                    return;
                case "DELETE":
                    this.handleDelete(req, res);
                    return;
                case "OPTIONS":
                    res.writeHead(204, {
                        "content-type": "application/json",
                        "content-length": "0",
                        allow: "POST, GET, DELETE, OPTIONS",
                        "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
                        "access-control-allow-headers": "content-type, accept, mcp-session-id",
                    });
                    res.end();
                    return;
                default:
                    res.writeHead(405, {
                        "content-type": "application/json",
                        allow: "POST, GET, DELETE, OPTIONS",
                    });
                    res.end(JSON.stringify({ error: "Method not allowed" }));
            }
        });
        await new Promise((resolve, reject) => {
            this.server?.once("error", (error) => reject(error));
            this.server?.listen(this.options.port, this.options.host, () => {
                this.logger.info("Embedded MCP server listening", this.options);
                resolve();
            });
        });
    }
    async stop() {
        if (!this.server) {
            return;
        }
        for (const session of this.sessions.values()) {
            for (const stream of session.streams) {
                clearInterval(stream.heartbeat);
                try {
                    stream.response.end();
                }
                catch (error) {
                    this.logger.warn("Failed to close SSE stream during shutdown", error);
                }
            }
        }
        this.sessions.clear();
        const server = this.server;
        this.server = null;
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
    getStatus() {
        return {
            running: this.server !== null,
            host: this.options.host,
            port: this.options.port,
        };
    }
    handlePost(req, res) {
        let rawBody = "";
        req.setEncoding?.("utf8");
        req.on("data", (chunk) => {
            rawBody += chunk;
        });
        req.on("end", async () => {
            let payload;
            try {
                payload = JSON.parse(rawBody);
            }
            catch (error) {
                this.logger.warn("Invalid JSON payload", error);
                this.writeJson(res, 400, {
                    error: "Invalid JSON payload",
                });
                return;
            }
            const sessionIdHeader = this.readSessionId(req);
            const isInitialize = payload.method === "initialize";
            let sessionId = sessionIdHeader;
            if (isInitialize && !sessionId) {
                sessionId = this.createSession().id;
            }
            if (sessionId) {
                const session = this.sessions.get(sessionId);
                if (!session) {
                    this.writeJson(res, 404, {
                        error: "Unknown MCP session",
                    });
                    return;
                }
                session.lastSeenAt = new Date().toISOString();
            }
            const response = await this.mcpServer.handle(payload);
            const headers = {
                "content-type": "application/json",
            };
            if (sessionId) {
                headers["mcp-session-id"] = sessionId;
            }
            if (response === null || payload.id === undefined) {
                this.writeJson(res, 200, {}, headers);
                return;
            }
            this.writeJson(res, 200, response, headers);
        });
    }
    handleGet(req, res) {
        const sessionId = this.readSessionId(req);
        const session = sessionId ? this.sessions.get(sessionId) : undefined;
        if (sessionId && !session) {
            this.writeJson(res, 404, {
                error: "Unknown MCP session",
            });
            return;
        }
        const headers = {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
        };
        if (sessionId) {
            headers["mcp-session-id"] = sessionId;
            session.lastSeenAt = new Date().toISOString();
        }
        res.writeHead(200, headers);
        res.write(": connected\n\n");
        const heartbeat = setInterval(() => {
            try {
                res.write(": heartbeat\n\n");
            }
            catch (error) {
                this.logger.warn("Failed to write SSE heartbeat", error);
            }
        }, 15000);
        if (session) {
            session.streams.add({
                response: res,
                heartbeat,
            });
        }
        res.on?.("close", () => {
            clearInterval(heartbeat);
            if (session) {
                for (const entry of session.streams) {
                    if (entry.response === res) {
                        session.streams.delete(entry);
                        break;
                    }
                }
            }
        });
    }
    handleDelete(req, res) {
        const sessionId = this.readSessionId(req);
        if (!sessionId) {
            this.writeJson(res, 400, {
                error: "Missing mcp-session-id header",
            });
            return;
        }
        const session = this.sessions.get(sessionId);
        if (!session) {
            res.writeHead(204, {
                "content-type": "application/json",
                "content-length": "0",
            });
            res.end();
            return;
        }
        for (const stream of session.streams) {
            clearInterval(stream.heartbeat);
            try {
                stream.response.end();
            }
            catch (error) {
                this.logger.warn("Failed to close SSE stream", error);
            }
        }
        this.sessions.delete(sessionId);
        res.writeHead(204, {
            "content-type": "application/json",
            "content-length": "0",
        });
        res.end();
    }
    createSession() {
        const session = {
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            streams: new Set(),
        };
        this.sessions.set(session.id, session);
        return session;
    }
    readSessionId(req) {
        const value = req.headers?.["mcp-session-id"] ?? req.headers?.["Mcp-Session-Id"];
        if (Array.isArray(value)) {
            return value[0]?.trim() || undefined;
        }
        return typeof value === "string" && value.trim() ? value.trim() : undefined;
    }
    writeJson(res, statusCode, body, extraHeaders = {}) {
        const responseBody = JSON.stringify(body);
        res.writeHead(statusCode, {
            "content-type": "application/json",
            "content-length": String(Buffer.byteLength(responseBody)),
            ...extraHeaders,
        });
        res.end(responseBody);
    }
}
exports.EmbeddedHttpTransport = EmbeddedHttpTransport;
//# sourceMappingURL=http-transport.js.map