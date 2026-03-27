#!/usr/bin/env node
/**
 * Claude Code WebSearch Hook - multi-provider search substitution
 *
 * Current built-in provider support:
 *   - WebSearchAPI.ai
 *   - Tavily Search
 *   - Exa Search
 *
 * Behavior:
 *   - Executes provider policy in `fallback` or `parallel` mode
 *   - If the custom provider path succeeds, returns provider-backed search results
 *   - If the custom provider path fails, allows native WebSearch to continue
 *
 * Environment Variables:
 *   WEBSEARCHAPI_API_KEY                    - WebSearchAPI.ai key, key pool, or key file path
 *   TAVILY_API_KEY                          - Tavily key, key pool, or key file path
 *   EXA_API_KEY                             - Exa key, key pool, or key file path
 *   CLAUDE_WEB_HOOKS_SEARCH_MODE            - `fallback` or `parallel` (default: `parallel`)
 *   CLAUDE_WEB_HOOKS_SEARCH_PROVIDERS       - comma-separated provider order (default: `tavily,websearchapi`)
 *   CLAUDE_WEB_HOOKS_SEARCH_PRIMARY         - optional priority override for provider ordering
 *   CLAUDE_WEB_HOOKS_SEARCH_TIMEOUT         - default search timeout in seconds (default: 55)
 *   TAVILY_SEARCH_TIMEOUT                   - Tavily-specific search timeout override in seconds
 *   EXA_SEARCH_TIMEOUT                      - Exa-specific search timeout override in seconds
 *
 *   Backward compatibility:
 *   - `CLAUDE_WEB_HOOKS_WEBSEARCH_TIMEOUT` is still accepted as fallback for `CLAUDE_WEB_HOOKS_SEARCH_TIMEOUT`
 *   - `TAVILY_TIMEOUT` is still accepted as fallback for `TAVILY_SEARCH_TIMEOUT`
 *   - `EXA_TIMEOUT` is still accepted as fallback for `EXA_SEARCH_TIMEOUT`
 *   WEBSEARCHAPI_MAX_RESULTS                - WebSearchAPI.ai max results
 *   WEBSEARCHAPI_INCLUDE_CONTENT            - WebSearchAPI.ai include content flag
 *   WEBSEARCHAPI_COUNTRY                    - WebSearchAPI.ai country
 *   WEBSEARCHAPI_LANGUAGE                   - WebSearchAPI.ai language
 *   TAVILY_SEARCH_DEPTH                     - Tavily search depth
 *   TAVILY_MAX_RESULTS                      - Tavily max results
 *   TAVILY_TOPIC                            - Tavily topic
 *   TAVILY_INCLUDE_ANSWER                   - Tavily include answer flag
 *   TAVILY_INCLUDE_RAW_CONTENT              - Tavily raw content mode
 *   TAVILY_INCLUDE_DOMAINS                  - Tavily include domains CSV
 *   TAVILY_EXCLUDE_DOMAINS                  - Tavily exclude domains CSV
 *   TAVILY_COUNTRY                          - Tavily country override
 *   TAVILY_INCLUDE_USAGE                    - Tavily include usage flag
 *   CLAUDE_WEB_HOOKS_DEBUG=1                - Enable debug output
 *
 * Exit codes:
 *   0 - Allow tool / fall through to native WebSearch
 *   2 - Block tool and return hook-provided results
 */

const { classifyProviderFailure, shouldAllowNativeFallback } = require('./shared/failure-policy.cjs');
const { executeSearchProviderPolicy } = require('./shared/search-provider-policy.cjs');
const { formatAggregateSearchProviderResult } = require('./shared/search-provider-contract.cjs');

function debugLog(message) {
  if (process.env.CLAUDE_WEB_HOOKS_DEBUG) {
    console.error(`[WebSearch Hook] ${message}`);
  }
}

function hasAnySearchProviderConfigured() {
  return Boolean(process.env.WEBSEARCHAPI_API_KEY || process.env.TAVILY_API_KEY || process.env.EXA_API_KEY);
}

function outputSuccess(query, policyResult) {
  const formattedResults = formatAggregateSearchProviderResult({
    query,
    successes: policyResult.successes || [],
    failures: policyResult.failures || [],
  });

  const successProviders = (policyResult.successes || []).map((item) => item.provider).join(',') || 'none';
  const output = {
    decision: 'block',
    reason: `WebSearch completed via ${successProviders}`,
    systemMessage: `[WebSearch hook] class=search-substitution -> ${policyResult.mode}-results`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: formattedResults,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}

function outputAllowContinuation(message) {
  console.log(JSON.stringify({
    systemMessage: message,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
    },
  }));
  process.exit(0);
}

function outputError(query, error) {
  if (shouldAllowNativeFallback(error)) {
    const failureClass = classifyProviderFailure(error);
    outputAllowContinuation(`[WebSearch hook] class=search-substitution -> native-websearch (${failureClass})`);
  }

  const message = [
    '[WebSearch hook] class=search-substitution -> failed',
    '',
    `Error: ${error}`,
    '',
    `Query: "${query}"`,
  ].join('\n');

  const output = {
    decision: 'block',
    reason: `WebSearch failed: ${error}`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: message,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
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

async function processHook() {
  try {
    const data = JSON.parse(input);
    if (data.tool_name !== 'WebSearch') {
      process.exit(0);
    }

    const query = data.tool_input?.query || '';
    if (!query) {
      process.exit(0);
    }

    if (!hasAnySearchProviderConfigured()) {
      outputAllowContinuation('[WebSearch hook] class=search-substitution -> native-websearch (no-provider-key)');
    }

    debugLog('Executing multi-provider WebSearch policy');
    const result = await executeSearchProviderPolicy({ query, debugLog });
    if (result.success && Array.isArray(result.successes) && result.successes.length > 0) {
      outputSuccess(query, result);
      return;
    }

    outputError(query, result.error || 'unknown provider error');
  } catch (err) {
    if (process.env.CLAUDE_WEB_HOOKS_DEBUG) {
      console.error('[WebSearch Hook] Parse error:', err.message);
    }
    process.exit(0);
  }
}
