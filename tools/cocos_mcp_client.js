#!/usr/bin/env node
const http = require('http');
const crypto = require('crypto');

const HOST = process.env.COCOS_MCP_HOST || '127.0.0.1';
const PORT = Number(process.env.COCOS_MCP_PORT || 3603);
const PATH = process.env.COCOS_MCP_PATH || '/mcp';
const PROTOCOL_VERSION = process.env.COCOS_MCP_PROTOCOL_VERSION || '2025-06-18';

let nextId = 1;
let sessionId = '';
let currentRevision = null;

function post(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      Accept: 'application/json',
    };
    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
    }

    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: PATH,
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
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function initialize() {
  const init = await post({
    jsonrpc: '2.0',
    id: nextId++,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'first-game-cocos-mcp-client',
        version: '1.0.0',
      },
    },
  });
  if (init.error) {
    throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);
  }

  await post({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
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

function extractRevision(result) {
  const source = result?.structuredContent || result?.content?.[0]?.json || result;
  return source?.revision ?? source?.nextRevision ?? source?.revisionAfter ?? null;
}

async function sceneStatus() {
  const result = await callTool('cocos_scene_status', {});
  const revision = extractRevision(result);
  if (revision !== null && revision !== undefined) {
    currentRevision = revision;
  }
  return result;
}

function makeIdempotencyKey(prefix = 'codex') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function withWriteDefaults(args = {}, prefix = 'codex') {
  if (currentRevision === null) {
    throw new Error('No current revision. Call sceneStatus() before write tools.');
  }
  return {
    preview: false,
    expectedRevision: currentRevision,
    idempotencyKey: makeIdempotencyKey(prefix),
    ...args,
  };
}

async function writeTool(name, args = {}, prefix = 'codex') {
  const result = await callTool(name, withWriteDefaults(args, prefix));
  const revision = extractRevision(result);
  if (revision !== null && revision !== undefined) {
    currentRevision = revision;
  }
  return result;
}

async function saveScene() {
  return callTool('cocos_scene_save', {});
}

async function listTools() {
  const response = await post({
    jsonrpc: '2.0',
    id: nextId++,
    method: 'tools/list',
    params: {},
  });
  if (response.error) {
    throw new Error(`tools/list failed: ${JSON.stringify(response.error)}`);
  }
  return response.result;
}

async function main() {
  const command = process.argv[2] || 'status';
  await initialize();

  if (command === 'status') {
    const [tools, scene, editor] = await Promise.all([
      listTools(),
      sceneStatus(),
      callTool('cocos_editor_status', {}),
    ]);
    console.log(JSON.stringify({
      endpoint: `http://${HOST}:${PORT}${PATH}`,
      tools: tools,
      scene: scene.structuredContent || scene,
      editor: editor.structuredContent || editor,
    }, null, 2));
    return;
  }

  if (command === 'scene-status') {
    const result = await sceneStatus();
    console.log(JSON.stringify(result.structuredContent || result, null, 2));
    return;
  }

  console.error(`Unsupported command: ${command}`);
  process.exit(1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  initialize,
  listTools,
  callTool,
  sceneStatus,
  writeTool,
  saveScene,
  withWriteDefaults,
  makeIdempotencyKey,
};
