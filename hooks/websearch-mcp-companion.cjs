#!/usr/bin/env node

const { executeSearchProviderPolicy } = require('./shared/search-provider-policy.cjs');
const { formatAggregateSearchProviderResult } = require('./shared/search-provider-contract.cjs');
const { CCS_MCP_WEBSEARCH_TOOL_NAME } = require('./shared/tool-names.cjs');

function debugLog(message) {
  if (process.env.CLAUDE_WEB_HOOKS_DEBUG) {
    console.error(`[WebSearch MCP companion] ${message}`);
  }
}

function hasAnySearchProviderConfigured() {
  return Boolean(process.env.WEBSEARCHAPI_API_KEY || process.env.TAVILY_API_KEY || process.env.EXA_API_KEY);
}

function stringifyToolResponse(toolResponse) {
  if (toolResponse == null) return '';
  if (typeof toolResponse === 'string') return toolResponse.trim();
  try {
    return JSON.stringify(toolResponse, null, 2).trim();
  } catch {
    return String(toolResponse).trim();
  }
}

function stringifyToolError(toolError) {
  if (toolError == null) return '';
  if (typeof toolError === 'string') return toolError.trim();
  try {
    return JSON.stringify(toolError, null, 2).trim();
  } catch {
    return String(toolError).trim();
  }
}

function formatCombinedOutput({ originalToolResponse, companionOutput }) {
  const originalOutput = stringifyToolResponse(originalToolResponse);
  const companionText = String(companionOutput || '').trim();

  const lines = [
    '[CCS MCP WebSearch Result]',
    '',
    originalOutput || 'No MCP tool output was returned.',
    '',
    '[claude-code-web-hooks Companion Result]',
    '',
    companionText || 'No companion search result was returned.',
  ];

  return lines.join('\n').trim();
}

function formatFailureAdditionalContext({ originalError, companionOutput }) {
  const errorText = stringifyToolError(originalError);
  const companionText = String(companionOutput || '').trim();
  const lines = [
    '[claude-code-web-hooks Failure Fallback]',
    '',
    'CCS MCP WebSearch failed.',
    'claude-code-web-hooks ran a provider-backed fallback search for the same query.',
    'Use the fallback result below as the replacement search context for this turn.',
    '',
    '[claude-code-web-hooks Fallback Result]',
    '',
    companionText || 'No fallback search result was returned.',
  ];

  if (errorText) {
    lines.push('', '[Original CCS MCP Error]', '', errorText);
  }

  return lines.join('\n').trim();
}

async function buildMcpCompanionHookOutput(data, options = {}) {
  const executePolicy = options.executePolicy || executeSearchProviderPolicy;
  const searchProvidersConfigured = options.searchProvidersConfigured ?? hasAnySearchProviderConfigured();

  const toolName = typeof data?.tool_name === 'string'
    ? data.tool_name.trim()
    : (typeof data?.toolName === 'string' ? data.toolName.trim() : '');

  if (toolName !== CCS_MCP_WEBSEARCH_TOOL_NAME) {
    return null;
  }

  const query = typeof data?.tool_input?.query === 'string'
    ? data.tool_input.query.trim()
    : '';

  if (!query) {
    debugLog('Skipping companion output because query is empty');
    return null;
  }

  if (!searchProvidersConfigured) {
    debugLog('Skipping companion output because no provider key is configured');
    return null;
  }

  const hookEventName = typeof data?.hook_event_name === 'string'
    ? data.hook_event_name.trim()
    : (typeof data?.hookEventName === 'string' ? data.hookEventName.trim() : '');
  const eventName = hookEventName || (data?.error != null ? 'PostToolUseFailure' : 'PostToolUse');

  const policyResult = await executePolicy({ query, debugLog });
  if (!policyResult?.success || !Array.isArray(policyResult.successes) || policyResult.successes.length === 0) {
    debugLog(`Skipping companion output because no provider succeeded for query "${query}"`);
    return null;
  }

  const companionOutput = formatAggregateSearchProviderResult({
    query,
    successes: policyResult.successes || [],
    failures: policyResult.failures || [],
  });

  if (eventName === 'PostToolUseFailure') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PostToolUseFailure',
        additionalContext: formatFailureAdditionalContext({
          originalError: data?.error,
          companionOutput,
        }),
      },
    };
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedMCPToolOutput: formatCombinedOutput({
        originalToolResponse: data.tool_response,
        companionOutput,
      }),
    },
  };
}

let input = '';

function runFromStdin() {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  process.stdin.on('end', async () => {
    try {
      const data = JSON.parse(input);
      const output = await buildMcpCompanionHookOutput(data);
      if (output) {
        console.log(JSON.stringify(output));
      }
      process.exit(0);
    } catch (error) {
      debugLog(`Parse error: ${error.message}`);
      process.exit(0);
    }
  });
  process.stdin.on('error', () => {
    process.exit(0);
  });
}

if (require.main === module) {
  runFromStdin();
}

module.exports = {
  buildMcpCompanionHookOutput,
  formatCombinedOutput,
  hasAnySearchProviderConfigured,
  stringifyToolResponse,
};
