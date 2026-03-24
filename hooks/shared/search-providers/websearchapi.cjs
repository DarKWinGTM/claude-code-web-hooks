const https = require('https');
const { normalizeSearchProviderResult } = require('../search-provider-contract.cjs');

const DEFAULT_TIMEOUT_SEC = 55;
const WEBSEARCHAPI_SEARCH_URL = 'https://api.websearchapi.ai/ai-search';

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseIntegerEnv(value, fallback) {
  const parsed = parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildPayload(query) {
  return {
    query,
    maxResults: Math.max(1, Math.min(parseIntegerEnv(process.env.WEBSEARCHAPI_MAX_RESULTS, 5), 10)),
    includeContent: parseBooleanEnv(process.env.WEBSEARCHAPI_INCLUDE_CONTENT, false),
    country: process.env.WEBSEARCHAPI_COUNTRY || 'us',
    language: process.env.WEBSEARCHAPI_LANGUAGE || 'en',
  };
}

function request(payload, apiKey, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  return new Promise((resolve) => {
    const req = https.request(WEBSEARCHAPI_SEARCH_URL, {
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

  const items = Array.isArray(response.data?.organic)
    ? response.data.organic.map((item) => ({ title: item.title, url: item.url, summary: item.description }))
    : [];

  return {
    ok: true,
    result: normalizeSearchProviderResult({
      provider: 'websearchapi',
      providerLabel: 'WebSearchAPI.ai',
      query,
      items,
      raw: response.data,
    }),
  };
}

module.exports = {
  search,
};
