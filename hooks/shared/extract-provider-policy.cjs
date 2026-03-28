const {
  parseApiKeyInput,
  shuffle,
  parseIntegerEnv,
  getOrderedProviders,
  chooseStartingProvider,
} = require('./provider-config.cjs');

const websearchapi = require('./extract-providers/websearchapi.cjs');
const tavily = require('./extract-providers/tavily.cjs');
const exa = require('./extract-providers/exa.cjs');

function getExtractMode() {
  const mode = process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_MODE || 'fallback';
  return mode === 'fallback' ? 'fallback' : 'fallback';
}

function getProviderOrder() {
  return getOrderedProviders({
    providersEnv: process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_PROVIDERS || 'websearchapi,tavily,exa',
    defaultProviders: ['websearchapi', 'tavily', 'exa'],
    primaryEnv: process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_PRIMARY || '',
  });
}

function getProviderApiKeys(provider) {
  if (provider === 'websearchapi') return parseApiKeyInput(process.env.WEBSEARCHAPI_API_KEY);
  if (provider === 'tavily') return parseApiKeyInput(process.env.TAVILY_API_KEY);
  if (provider === 'exa') return parseApiKeyInput(process.env.EXA_API_KEY);
  return [];
}

function getProviderTimeout(provider) {
  const sharedTimeout = parseIntegerEnv(process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_TIMEOUT, 25);
  if (provider === 'websearchapi') return parseIntegerEnv(process.env.WEBSEARCHAPI_SCRAPE_TIMEOUT || process.env.WEBFETCH_SCRAPER_TIMEOUT || process.env.WEBFETCH_SCRAPER_API_TIMEOUT, sharedTimeout);
  if (provider === 'tavily') return parseIntegerEnv(process.env.TAVILY_EXTRACT_TIMEOUT, sharedTimeout);
  if (provider === 'exa') return parseIntegerEnv(process.env.EXA_CONTENTS_TIMEOUT, sharedTimeout);
  return sharedTimeout;
}

function getProviderImplementation(provider) {
  if (provider === 'websearchapi') return websearchapi;
  if (provider === 'tavily') return tavily;
  if (provider === 'exa') return exa;
  return null;
}

async function executeProvider(provider, url, debugLog) {
  const implementation = getProviderImplementation(provider);
  if (!implementation) {
    return { ok: false, provider, error: `unsupported provider: ${provider}` };
  }

  const keys = shuffle(getProviderApiKeys(provider));
  if (keys.length === 0) {
    return { ok: false, provider, error: `no key configured for provider: ${provider}` };
  }

  const errors = [];
  for (const apiKey of keys) {
    const result = await implementation.extract({ url, apiKey, timeoutSec: getProviderTimeout(provider) });
    if (result.ok) {
      return { ok: true, provider, result: result.result };
    }
    errors.push(result.error || 'unknown error');
    if (debugLog) debugLog(`[${provider}] extraction failed, trying next key if available: ${result.error || 'unknown error'}`);
  }

  return { ok: false, provider, error: errors.join(' | ') || 'unknown error' };
}

async function executeExtractProviderPolicy({ url, debugLog }) {
  const mode = getExtractMode();
  const orderedProviders = getProviderOrder();
  const availableProviders = orderedProviders.filter((provider) => getProviderApiKeys(provider).length > 0);
  const providers = chooseStartingProvider({
    orderedProviders,
    availableProviders,
    primary: process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_PRIMARY || '',
  });

  const attempts = [];
  const failures = [];
  for (const provider of providers) {
    const outcome = await executeProvider(provider, url, debugLog);
    attempts.push(outcome);
    if (outcome.ok) {
      return {
        mode,
        orderedProviders,
        providersTried: providers,
        selectedProvider: providers[0] || null,
        success: true,
        result: outcome.result,
        fallbackProviderUsed: outcome.provider !== providers[0],
        attempts,
        failures,
      };
    }
    failures.push({ provider: outcome.provider, error: outcome.error });
  }

  return {
    mode,
    orderedProviders,
    providersTried: providers,
    selectedProvider: providers[0] || null,
    success: false,
    result: null,
    fallbackProviderUsed: false,
    attempts,
    failures,
    error: failures.map((item) => item.error).filter(Boolean).join(' | '),
  };
}

module.exports = {
  executeExtractProviderPolicy,
};
