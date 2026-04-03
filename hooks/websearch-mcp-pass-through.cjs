#!/usr/bin/env node

const { CCS_MCP_WEBSEARCH_TOOL_NAME } = require('./shared/tool-names.cjs');

function debugLog(message) {
  if (process.env.CLAUDE_WEB_HOOKS_DEBUG) {
    console.error(`[WebSearch MCP pass-through] ${message}`);
  }
}

function emitAllow() {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
    },
  }));
  process.exit(0);
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
  process.exit(0);
});

function processHook() {
  try {
    const data = JSON.parse(input);
    const toolName = typeof data.tool_name === 'string'
      ? data.tool_name.trim()
      : (typeof data.toolName === 'string' ? data.toolName.trim() : '');

    if (toolName !== CCS_MCP_WEBSEARCH_TOOL_NAME) {
      process.exit(0);
    }

    debugLog(`Allowing MCP tool ${toolName} to continue without substitution`);
    emitAllow();
  } catch (error) {
    debugLog(`Parse error: ${error.message}`);
    process.exit(0);
  }
}
