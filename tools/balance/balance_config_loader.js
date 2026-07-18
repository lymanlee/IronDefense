const fs = require('fs');
const path = require('path');

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!base[key] || typeof base[key] !== 'object' || Array.isArray(base[key])) {
        base[key] = {};
      }
      deepMerge(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

function extractGameConfigSource() {
  const filePath = path.resolve(__dirname, '../../assets/scripts/data/GameConfig.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const marker = 'export const GameConfig =';
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error('Unable to extract GameConfig literal from GameConfig.ts');
  }
  const braceStart = source.indexOf('{', start);
  if (braceStart < 0) {
    throw new Error('Unable to locate GameConfig object start');
  }

  let depth = 0;
  let end = -1;
  let state = 'code';
  let stringQuote = '';
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === 'lineComment') {
      if (ch === '\n') state = 'code';
      continue;
    }
    if (state === 'blockComment') {
      if (ch === '*' && next === '/') {
        state = 'code';
        i++;
      }
      continue;
    }
    if (state === 'string') {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === stringQuote) {
        state = 'code';
        stringQuote = '';
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      state = 'lineComment';
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      state = 'blockComment';
      i++;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') {
      state = 'string';
      stringQuote = ch;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error('Unable to locate GameConfig object end');
  }

  return `module.exports = ${source.slice(braceStart, end + 1)};`;
}

function loadGameConfigSnapshot() {
  const mod = { exports: {} };
  const wrapped = extractGameConfigSource();
  const fn = new Function('module', 'exports', wrapped);
  fn(mod, mod.exports);
  return deepClone(mod.exports);
}

function createConfigSnapshot(overrides = {}) {
  const snapshot = loadGameConfigSnapshot();
  return deepMerge(snapshot, deepClone(overrides));
}

module.exports = {
  loadGameConfigSnapshot,
  createConfigSnapshot,
  deepMerge,
};
