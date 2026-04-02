#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

function allow() {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
    },
  }));
  process.exit(0);
}

function parseCsvEnv(name) {
  return String(process.env[name] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstString(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  processHook();
});
process.stdin.on('error', () => {
  allow();
});

function processHook() {
  try {
    const data = JSON.parse(input);
    const toolName = String(data.tool_name || '').trim();
    const supportedToolNames = parseCsvEnv('COPILOT_WEBSEARCH_TOOL_NAMES');
    if (!toolName || supportedToolNames.length === 0 || !supportedToolNames.includes(toolName)) {
      allow();
    }

    const toolInput = data.tool_input || {};
    const query = firstString([toolInput.query, toolInput.prompt, toolInput.searchQuery]);
    if (!query) allow();

    const claudePayload = JSON.stringify({
      tool_name: 'WebSearch',
      tool_input: {
        query,
      },
    });

    const targetScript = path.join(__dirname, 'websearch-custom.cjs');
    const child = spawnSync('node', [targetScript], {
      input: claudePayload,
      encoding: 'utf8',
      env: process.env,
    });

    if (child.stdout) process.stdout.write(child.stdout);
    if (child.stderr) process.stderr.write(child.stderr);
    process.exit(typeof child.status === 'number' ? child.status : 0);
  } catch {
    allow();
  }
}
