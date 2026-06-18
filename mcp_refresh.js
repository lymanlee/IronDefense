#!/usr/bin/env node
const http = require('http');

const HOST = '127.0.0.1';
const PORT = Number(process.env.COCOS_MCP_PORT || 3603);
const PROTOCOL_VERSION = '2025-06-18';

let nextId = 1;
let sessionId = '';

function post(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      Accept: 'application/json',
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;

    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: '/mcp',
        method: 'POST',
        headers,
      },
      (res) => {
        if (res.headers['mcp-session-id']) {
          sessionId = res.headers['mcp-session-id'];
        }

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch {
            resolve(data);
          }
        });
      },
    );

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function callTool(name, args = {}) {
  const response = await post({
    jsonrpc: '2.0',
    id: nextId++,
    method: 'tools/call',
    params: {
      name,
      arguments: args,
    },
  });

  if (response.error) {
    throw new Error(`${name} failed: ${JSON.stringify(response.error)}`);
  }
  return response.result;
}

async function main() {
  const init = await post({
    jsonrpc: '2.0',
    id: nextId++,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'first-game-mcp-helper',
        version: '1.0.0',
      },
    },
  });
  if (init.error) throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);

  await post({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  });

  const status = await callTool('cocos_scene_status');
  const editor = await callTool('cocos_editor_status');
  console.log(JSON.stringify({ editor: editor.structuredContent, scene: status.structuredContent }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
