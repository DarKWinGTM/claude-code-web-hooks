#!/usr/bin/env node
/**
 * Claude Code WebSearch Hook - WebSearchAPI.ai search only
 *
 * Standalone hook script for direct Claude Code usage without relying on externally managed hook paths.
 *
 * Behavior:
 *   - If WEBSEARCHAPI_API_KEY exists: intercept WebSearch and return WebSearchAPI.ai results
 *   - If WEBSEARCHAPI_API_KEY is missing: exit 0 and allow native WebSearch flow to continue
 *
 * Environment Variables:
 *   WEBSEARCHAPI_API_KEY           - WebSearchAPI.ai bearer token(s); multiple keys allowed via '|' delimiter
 *   WEBSEARCHAPI_MAX_RESULTS       - Search max results (default: 5)
 *   WEBSEARCHAPI_INCLUDE_CONTENT   - Include content in AI search response (default: false)
 *   WEBSEARCHAPI_COUNTRY           - Search country code (default: us)
 *   WEBSEARCHAPI_LANGUAGE          - Search language code (default: en)
 *   CLAUDE_WEB_HOOKS_WEBSEARCH_TIMEOUT          - Search timeout in seconds (default: 55)
 *   CLAUDE_WEB_HOOKS_DEBUG=1                    - Enable debug output
 *
 * Exit codes:
 *   0 - Allow tool / fall through to native WebSearch
 *   2 - Block tool and return hook-provided results
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { classifyProviderFailure, shouldAllowNativeFallback } = require('./shared/failure-policy.cjs');

const MIN_VALID_RESPONSE_LENGTH = 20;
const DEFAULT_TIMEOUT_SEC = 55;
const WEBSEARCHAPI_SEARCH_URL = 'https://api.websearchapi.ai/ai-search';

function debugLog(message) {
  if (process.env.CLAUDE_WEB_HOOKS_DEBUG) {
    console.error(`[WebSearch Hook] ${message}`);
  }
}

function looksLikeLocalPath(value) {
  return value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || value.startsWith('~/') || value.includes('/') || value.includes('\\');
}

function resolveLocalPath(rawValue) {
  if (rawValue.startsWith('~/')) {
    return path.join(os.homedir(), rawValue.slice(2));
  }

  const cwd = typeof process.cwd === 'function' ? process.cwd() : os.homedir();
  return path.resolve(cwd, rawValue);
}

function parseInlineApiKeys(rawValue) {
  return rawValue
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith('#'));
}

function parseApiKeys(rawValue) {
  if (typeof rawValue !== 'string') return [];

  const trimmed = rawValue.trim();
  if (!trimmed) return [];

  if (looksLikeLocalPath(trimmed)) {
    try {
      const resolved = resolveLocalPath(trimmed);
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) {
        debugLog(`WEBSEARCHAPI_API_KEY points to a non-file path: ${resolved}`);
        return [];
      }

      const fileContent = fs.readFileSync(resolved, 'utf8');
      try {
        const parsed = JSON.parse(fileContent);
        if (!Array.isArray(parsed)) {
          debugLog(`WEBSEARCHAPI_API_KEY JSON file must contain an array: ${resolved}`);
          return [];
        }

        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      } catch {
        return fileContent
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter((item) => item && !item.startsWith('#'));
      }
    } catch (error) {
      debugLog(`Failed to load API keys from file path: ${error.message}`);
      return [];
    }
  }

  return parseInlineApiKeys(trimmed);
}

function hasWebSearchApiConfigured() {
  return parseApiKeys(process.env.WEBSEARCHAPI_API_KEY).length > 0;
}

function shuffleKeys(keys) {
  const shuffled = [...keys];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getApiKeyAttempts() {
  const keys = parseApiKeys(process.env.WEBSEARCHAPI_API_KEY);
  if (keys.length === 0) return [];
  return shuffleKeys(keys);
}

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseIntegerEnv(value, fallback) {
  const parsed = parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatSearchResults(query, content, providerName) {
  return [
    `[WebSearch Result via ${providerName}]`,
    '',
    `Query: "${query}"`,
    '',
    content,
    '',
    '---',
    'Use this information to answer the user.',
  ].join('\n');
}

function outputSuccess(query, content, providerName) {
  const formattedResults = providerName === 'WebSearchAPI.ai' && String(content || '').startsWith('[WebSearch Result via WebSearchAPI.ai]')
    ? content
    : formatSearchResults(query, content, providerName);

  const output = {
    decision: 'block',
    reason: `WebSearch completed via ${providerName}`,
    systemMessage: '[WebSearch hook] class=search-substitution -> websearchapi',
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

function outputError(query, error, providerName) {
  if (shouldAllowNativeFallback(error)) {
    const failureClass = classifyProviderFailure(error);
    outputAllowContinuation(`[WebSearch hook] class=search-substitution -> native-websearch (${failureClass})`);
  }

  const message = [
    `[WebSearch hook] class=search-substitution -> failed`,
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

function buildSearchPayload(query) {
  return {
    query,
    maxResults: Math.max(1, Math.min(parseIntegerEnv(process.env.WEBSEARCHAPI_MAX_RESULTS, 5), 10)),
    includeContent: parseBooleanEnv(process.env.WEBSEARCHAPI_INCLUDE_CONTENT, false),
    country: process.env.WEBSEARCHAPI_COUNTRY || 'us',
    language: process.env.WEBSEARCHAPI_LANGUAGE || 'en',
  };
}

function formatWebSearchApiResults(data) {
  const params = data?.searchParameters || {};
  const organic = Array.isArray(data?.organic) ? data.organic : [];

  const lines = [
    '[WebSearch Result via WebSearchAPI.ai]',
    '',
    `Query: "${params.query || ''}"`,
    '',
  ];

  if (organic.length === 0) {
    lines.push('No organic search results were returned.');
  } else {
    lines.push('Search results:');
    lines.push('');

    for (const item of organic) {
      const position = item.position ? `${item.position}. ` : '- ';
      lines.push(`${position}${item.title || 'Untitled result'}`);
      if (item.url) lines.push(`URL: ${item.url}`);
      if (item.description) lines.push(`Summary: ${item.description}`);
      lines.push('');
    }

    lines.push('Sources:');
    for (const item of organic) {
      if (item.url) {
        lines.push(`- [${item.title || item.url}](${item.url})`);
      }
    }
  }

  return lines.join('\n').trim();
}

function postJson(url, payload, timeoutSec, apiKey) {
  return new Promise((resolve) => {
    const request = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: timeoutSec * 1000,
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        let data;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (error) {
          resolve({ ok: false, statusCode: response.statusCode, error: `Invalid JSON response: ${error.message}` });
          return;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          const apiError = data?.error || data?.message || `HTTP ${response.statusCode}`;
          resolve({ ok: false, statusCode: response.statusCode, error: apiError, data });
          return;
        }

        resolve({ ok: true, statusCode: response.statusCode, data });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Request timed out'));
    });

    request.on('error', (error) => {
      resolve({ ok: false, error: error.message || 'Unknown request error' });
    });

    request.write(JSON.stringify(payload));
    request.end();
  });
}

async function tryWebSearchApi(query, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  const apiKeys = getApiKeyAttempts();
  if (apiKeys.length === 0) {
    return { success: false, error: 'WebSearchAPI.ai key missing' };
  }

  const searchPayload = buildSearchPayload(query);
  const errors = [];

  for (const apiKey of apiKeys) {
    const response = await postJson(WEBSEARCHAPI_SEARCH_URL, searchPayload, timeoutSec, apiKey);

    if (!response.ok) {
      errors.push(response.error || 'unknown error');
      debugLog(`WebSearchAPI.ai attempt failed; trying next key if available: ${response.error || 'unknown error'}`);
      continue;
    }

    const organic = Array.isArray(response.data?.organic) ? response.data.organic : [];
    const formatted = formatWebSearchApiResults({
      searchParameters: { ...searchPayload },
      organic,
    });

    if (!formatted || formatted.length < MIN_VALID_RESPONSE_LENGTH) {
      errors.push('WebSearchAPI.ai returned an empty or too short response');
      debugLog('WebSearchAPI.ai attempt returned too-short content; trying next key if available');
      continue;
    }

    return { success: true, content: formatted };
  }

  return { success: false, error: `WebSearchAPI.ai error: ${errors.join(' | ') || 'unknown error'}` };
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

    if (!hasWebSearchApiConfigured()) {
      console.log(JSON.stringify({
        systemMessage: '[WebSearch hook] class=search-substitution -> native-websearch (no-key)',
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
        },
      }));
      process.exit(0);
    }

    if (process.env.CLAUDE_WEB_HOOKS_DEBUG) {
      console.error('[Claude Hook] Using standalone WebSearchAPI.ai hook (search only)');
    }

    const timeout = parseInt(process.env.CLAUDE_WEB_HOOKS_WEBSEARCH_TIMEOUT || DEFAULT_TIMEOUT_SEC, 10);
    const result = await tryWebSearchApi(query, timeout);
    if (result.success) {
      outputSuccess(query, result.content, 'WebSearchAPI.ai');
      return;
    }

    outputError(query, result.error, 'WebSearchAPI.ai');
  } catch (err) {
    if (process.env.CLAUDE_WEB_HOOKS_DEBUG) {
      console.error('[Claude Hook] Parse error:', err.message);
    }
    process.exit(0);
  }
}
