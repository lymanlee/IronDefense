const path = require("path");

function normalizeWriteHeadArgs(statusCode, reasonOrHeaders, maybeHeaders) {
  if (typeof reasonOrHeaders === "string") {
    return {
      statusCode,
      statusMessage: reasonOrHeaders,
      headers: maybeHeaders || {},
    };
  }

  return {
    statusCode,
    statusMessage: undefined,
    headers: reasonOrHeaders || {},
  };
}

function writeHeadWithNormalizedArgs(res, originalWriteHead, normalized) {
  if (normalized.statusMessage !== undefined) {
    return originalWriteHead(
      normalized.statusCode,
      normalized.statusMessage,
      normalized.headers
    );
  }

  return originalWriteHead(normalized.statusCode, normalized.headers);
}

function hasBodyChunk(chunk) {
  if (chunk == null) {
    return false;
  }

  if (Buffer.isBuffer(chunk)) {
    return chunk.length > 0;
  }

  return String(chunk).length > 0;
}

function installPatch(pluginDistDir) {
  const mcpServerPath = path.join(pluginDistDir, "mcp-server.js");
  const { MCPServer } = require(mcpServerPath);
  const proto = MCPServer && MCPServer.prototype;

  if (!proto || proto.__codexNotificationPatchInstalled) {
    return false;
  }

  const originalHandleMCPRequest = proto.handleMCPRequest;
  if (typeof originalHandleMCPRequest !== "function") {
    throw new Error("MCPServer.prototype.handleMCPRequest not found");
  }

  proto.handleMCPRequest = function patchedHandleMCPRequest(req, res, ...args) {
    let rawBody = "";
    let isNotification = false;

    req.on("data", (chunk) => {
      rawBody += chunk.toString();
    });

    req.on("end", () => {
      try {
        const message = JSON.parse(rawBody);
        isNotification =
          !!message &&
          typeof message.method === "string" &&
          (message.id === undefined || message.id === null);
      } catch {
        isNotification = false;
      }
    });

    const originalWriteHead = res.writeHead.bind(res);
    const originalEnd = res.end.bind(res);

    res.writeHead = function patchedWriteHead(
      statusCode,
      reasonOrHeaders,
      maybeHeaders
    ) {
      const normalized = normalizeWriteHeadArgs(
        statusCode,
        reasonOrHeaders,
        maybeHeaders
      );

      if (isNotification && normalized.statusCode === 202) {
        normalized.statusCode = 200;
        normalized.headers = {
          ...normalized.headers,
          "Content-Type":
            normalized.headers["Content-Type"] ||
            normalized.headers["content-type"] ||
            "application/json",
        };
      }

      return writeHeadWithNormalizedArgs(res, originalWriteHead, normalized);
    };

    res.end = function patchedEnd(chunk, encoding, callback) {
      if (isNotification) {
        if (!res.headersSent) {
          res.statusCode = res.statusCode === 202 ? 200 : res.statusCode || 200;

          if (!res.getHeader("Content-Type")) {
            res.setHeader("Content-Type", "application/json");
          }
        }

        if (!hasBodyChunk(chunk)) {
          return originalEnd("{}", encoding, callback);
        }
      }

      return originalEnd(chunk, encoding, callback);
    };

    return originalHandleMCPRequest.call(this, req, res, ...args);
  };

  Object.defineProperty(proto, "__codexNotificationPatchInstalled", {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return true;
}

module.exports = {
  installPatch,
};
