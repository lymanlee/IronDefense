#!/usr/bin/env node
const http = require('http');

const SESSION_ID = '8acd1572-d524-4ce3-bd36-a4e8df154b25';
const HOST = '127.0.0.1';
const PORT = 3000;

// MCP JSON-RPC 请求 - 使用 tools/call 方法
const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'cocos_editor',
    arguments: {
      action: 'log_read',
      lines: 50
    }
  }
};

const postData = JSON.stringify(request);

const options = {
  hostname: HOST,
  port: PORT,
  path: '/mcp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Mcp-Session-Id': SESSION_ID,
    'Accept': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
