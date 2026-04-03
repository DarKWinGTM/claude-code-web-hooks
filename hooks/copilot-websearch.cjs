#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const { CCS_MCP_WEBSEARCH_TOOL_NAME } = require('./shared/tool-names.cjs');

function emitAllow(runtime) {
  if (runtime === 'copilot-cli') {
    console.log(JSON.stringify({ permissionDecision: 'allow' }));
  } else {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
      },
    }));
  }
  process.exit(0);
}

function parseCsvEnv(names) {
  const values = [];
  for (const name of names) {
    const raw = String(process.env[name] || '');
    raw.split(',').map((item) => item.trim()).filter(Boolean).forEach((item) => values.push(item));
  }
  return [...new Set(values)];
}

function firstString(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function detectRuntime(data) {
  if (Object.prototype.hasOwnProperty.call(data, 'toolName') || Object.prototype.hasOwnProperty.call(data, 'toolArgs')) {
    return 'copilot-cli';
  }
  return 'copilot-vscode';
}

function parseCliArgs(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function extractToolContext(data, runtime) {
  if (runtime === 'copilot-cli') {
    const toolName = String(data.toolName || '').trim();
    const toolInput = parseCliArgs(data.toolArgs);
    return { toolName, toolInput };
  }
  return {
    toolName: String(data.tool_name || '').trim(),
    toolInput: data.tool_input || {},
  };
}

function mapChildOutputForCli(rawStdout) {
  try {
    const parsed = JSON.parse(String(rawStdout || '').trim() || '{}');
    const hookSpecificOutput = parsed.hookSpecificOutput || {};
    const out = {};
    if (hookSpecificOutput.permissionDecision) out.permissionDecision = hookSpecificOutput.permissionDecision;
    if (hookSpecificOutput.permissionDecisionReason) out.permissionDecisionReason = hookSpecificOutput.permissionDecisionReason;
    if (hookSpecificOutput.updatedInput) out.modifiedArgs = JSON.stringify(hookSpecificOutput.updatedInput);
    if (hookSpecificOutput.additionalContext) out.additionalContext = hookSpecificOutput.additionalContext;
    if (!out.permissionDecision) out.permissionDecision = 'allow';
    return JSON.stringify(out);
  } catch {
    return JSON.stringify({ permissionDecision: 'allow' });
  }
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
  emitAllow('copilot-vscode');
});

function processHook() {
  try {
    const data = JSON.parse(input);
    const runtime = detectRuntime(data);
    const { toolName, toolInput } = extractToolContext(data, runtime);
    if (toolName === CCS_MCP_WEBSEARCH_TOOL_NAME) {
      emitAllow(runtime);
    }
    const supportedToolNames = parseCsvEnv(['COPILOT_WEBSEARCH_TOOL_NAMES', 'COPILOT_CLI_WEBSEARCH_TOOL_NAMES']);
    if (!toolName || supportedToolNames.length === 0 || !supportedToolNames.includes(toolName)) {
      emitAllow(runtime);
    }

    const query = firstString([toolInput.query, toolInput.prompt, toolInput.searchQuery]);
    if (!query) emitAllow(runtime);

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

    if (child.stderr) process.stderr.write(child.stderr);

    if (runtime === 'copilot-cli') {
      process.stdout.write(mapChildOutputForCli(child.stdout));
      process.exit(0);
    }

    if (child.stdout) process.stdout.write(child.stdout);
    process.exit(typeof child.status === 'number' ? child.status : 0);
  } catch {
    emitAllow('copilot-vscode');
  }
}
