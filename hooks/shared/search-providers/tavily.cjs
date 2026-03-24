const https = require('https');
const { normalizeSearchProviderResult } = require('../search-provider-contract.cjs');

const DEFAULT_TIMEOUT_SEC = 55;
const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

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
    search_depth: process.env.TAVILY_SEARCH_DEPTH || 'advanced',
    max_results: Math.max(1, Math.min(parseIntegerEnv(process.env.TAVILY_MAX_RESULTS, 5), 20)),
    topic: process.env.TAVILY_TOPIC || 'general',
    include_answer: parseBooleanEnv(process.env.TAVILY_INCLUDE_ANSWER, false),
    include_raw_content: process.env.TAVILY_INCLUDE_RAW_CONTENT || false,
    include_domains: process.env.TAVILY_INCLUDE_DOMAINS ? process.env.TAVILY_INCLUDE_DOMAINS.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
    exclude_domains: process.env.TAVILY_EXCLUDE_DOMAINS ? process.env.TAVILY_EXCLUDE_DOMAINS.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
    country: process.env.TAVILY_COUNTRY || undefined,
    include_usage: parseBooleanEnv(process.env.TAVILY_INCLUDE_USAGE, false),
  };
}

function request(payload, apiKey, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  return new Promise((resolve) => {
    const req = https.request(TAVILY_SEARCH_URL, {
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

  const items = Array.isArray(response.data?.results)
    ? response.data.results.map((item) => ({ title: item.title, url: item.url, summary: item.content || item.raw_content || '' }))
    : [];

  return {
    ok: true,
    result: normalizeSearchProviderResult({
      provider: 'tavily',
      providerLabel: 'Tavily',
      query,
      items,
      raw: response.data,
    }),
  };
}

module.exports = {
  search,
};
