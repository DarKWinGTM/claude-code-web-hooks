const path = require('path');
const fs = require('fs');

const websearchapi = require('./search-providers/websearchapi.cjs');
const tavily = require('./search-providers/tavily.cjs');

function parseInlineEntries(rawValue, delimiter = '|') {
  return String(rawValue || '')
    .split(delimiter)
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith('#'));
}

function looksLikeLocalPath(value) {
  return value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || value.startsWith('~/') || value.includes('/') || value.includes('\\');
}

function resolveLocalPath(rawValue) {
  if (rawValue.startsWith('~/')) {
    return path.join(require('os').homedir(), rawValue.slice(2));
  }
  const cwd = typeof process.cwd === 'function' ? process.cwd() : require('os').homedir();
  return path.resolve(cwd, rawValue);
}

function parseApiKeyInput(rawValue) {
  if (typeof rawValue !== 'string') return [];
  const trimmed = rawValue.trim();
  if (!trimmed) return [];

  if (looksLikeLocalPath(trimmed)) {
    try {
      const resolved = resolveLocalPath(trimmed);
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) return [];
      const fileContent = fs.readFileSync(resolved, 'utf8');
      try {
        const parsed = JSON.parse(fileContent);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      } catch {
        return fileContent.split(/\r?\n/).map((item) => item.trim()).filter((item) => item && !item.startsWith('#'));
      }
    } catch {
      return [];
    }
  }

  return parseInlineEntries(trimmed, '|');
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getProviderMode() {
  return process.env.CLAUDE_WEB_HOOKS_SEARCH_MODE || 'parallel';
}

function getProviderOrder() {
  const configured = parseInlineEntries(process.env.CLAUDE_WEB_HOOKS_SEARCH_PROVIDERS || 'tavily,websearchapi', ',');
  return configured.length > 0 ? configured : ['tavily', 'websearchapi'];
}

function getProviderApiKeys(provider) {
  if (provider === 'websearchapi') return parseApiKeyInput(process.env.WEBSEARCHAPI_API_KEY);
  if (provider === 'tavily') return parseApiKeyInput(process.env.TAVILY_API_KEY);
  return [];
}

function getProviderTimeout(provider) {
  if (provider === 'tavily') return parseInt(process.env.TAVILY_TIMEOUT || process.env.CLAUDE_WEB_HOOKS_WEBSEARCH_TIMEOUT || '55', 10);
  return parseInt(process.env.CLAUDE_WEB_HOOKS_WEBSEARCH_TIMEOUT || '55', 10);
}

function getProviderImplementation(provider) {
  if (provider === 'websearchapi') return websearchapi;
  if (provider === 'tavily') return tavily;
  return null;
}

async function executeProvider(provider, query, debugLog) {
  const implementation = getProviderImplementation(provider);
  if (!implementation) {
    return { ok: false, error: `unsupported provider: ${provider}`, provider };
  }

  const keys = shuffle(getProviderApiKeys(provider));
  if (keys.length === 0) {
    return { ok: false, error: `no key configured for provider: ${provider}`, provider };
  }

  const errors = [];
  for (const apiKey of keys) {
    const result = await implementation.search({ query, apiKey, timeoutSec: getProviderTimeout(provider) });
    if (result.ok) {
      return { ok: true, provider, result: result.result };
    }
    errors.push(result.error || 'unknown error');
    if (debugLog) debugLog(`[${provider}] failed, trying next key if available: ${result.error || 'unknown error'}`);
  }

  return { ok: false, provider, error: errors.join(' | ') || 'unknown error' };
}

async function executeSearchProviderPolicy({ query, debugLog }) {
  const mode = getProviderMode();
  const providers = getProviderOrder();

  if (mode === 'single') {
    const primary = process.env.CLAUDE_WEB_HOOKS_SEARCH_PRIMARY || providers[0] || 'websearchapi';
    const outcome = await executeProvider(primary, query, debugLog);
    return { mode, attempts: [outcome], success: outcome.ok, result: outcome.result, error: outcome.error };
  }

  if (mode === 'parallel') {
    const outcomes = await Promise.all(providers.map((provider) => executeProvider(provider, query, debugLog)));
    const success = outcomes.find((item) => item.ok);
    return { mode, attempts: outcomes, success: Boolean(success), result: success?.result, error: outcomes.map((item) => item.error).filter(Boolean).join(' | ') };
  }

  const attempts = [];
  for (const provider of providers) {
    const outcome = await executeProvider(provider, query, debugLog);
    attempts.push(outcome);
    if (outcome.ok) {
      return { mode: 'fallback', attempts, success: true, result: outcome.result };
    }
  }

  return { mode: 'fallback', attempts, success: false, error: attempts.map((item) => item.error).filter(Boolean).join(' | ') };
}

module.exports = {
  executeSearchProviderPolicy,
};
