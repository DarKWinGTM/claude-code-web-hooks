const https = require('https');
const { normalizeSearchProviderResult } = require('../search-provider-contract.cjs');

const DEFAULT_TIMEOUT_SEC = 55;
const EXA_SEARCH_URL = 'https://api.exa.ai/search';

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseIntegerEnv(value, fallback) {
  const parsed = parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildPayload(query) {
  const payload = {
    query,
    type: process.env.EXA_SEARCH_TYPE || 'auto',
    numResults: Math.max(1, Math.min(parseIntegerEnv(process.env.EXA_NUM_RESULTS, 10), 100)),
    category: process.env.EXA_CATEGORY || undefined,
    includeDomains: process.env.EXA_INCLUDE_DOMAINS ? process.env.EXA_INCLUDE_DOMAINS.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
    excludeDomains: process.env.EXA_EXCLUDE_DOMAINS ? process.env.EXA_EXCLUDE_DOMAINS.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
    userLocation: process.env.EXA_USER_LOCATION || undefined,
    moderation: parseBooleanEnv(process.env.EXA_MODERATION, false),
    contents: {
      summary: parseBooleanEnv(process.env.EXA_INCLUDE_SUMMARY, true) ? { query } : undefined,
      text: parseBooleanEnv(process.env.EXA_INCLUDE_TEXT, false) ? true : undefined,
      highlights: parseBooleanEnv(process.env.EXA_INCLUDE_HIGHLIGHTS, false) ? { query, maxCharacters: parseIntegerEnv(process.env.EXA_HIGHLIGHT_MAX_CHARS, 400) } : undefined,
    },
  };

  return payload;
}

function request(payload, apiKey, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  return new Promise((resolve) => {
    const req = https.request(EXA_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
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
          resolve({ ok: false, error: `Invalid JSON response: ${error.message}` });
          return;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          resolve({ ok: false, error: data?.error || data?.message || `HTTP ${response.statusCode}` });
          return;
        }

        resolve({ ok: true, data });
      });
    });

    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', (error) => resolve({ ok: false, error: error.message || 'Unknown request error' }));
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function search({ query, apiKey, timeoutSec }) {
  const payload = buildPayload(query);
  const response = await request(payload, apiKey, timeoutSec);
  if (!response.ok) return response;

  const items = Array.isArray(response.data?.results)
    ? response.data.results.map((item) => ({ title: item.title, url: item.url, summary: item.summary || '' }))
    : [];

  return {
    ok: true,
    result: normalizeSearchProviderResult({
      provider: 'exa',
      providerLabel: 'Exa',
      query,
      items,
      raw: response.data,
    }),
  };
}

module.exports = {
  search,
};
