const https = require('https');
const { parseBooleanEnv, parseIntegerEnv } = require('../provider-config.cjs');
const { normalizeExtractProviderResult } = require('../extract-provider-contract.cjs');

const TAVILY_EXTRACT_URL = 'https://api.tavily.com/extract';

function buildPayload(url) {
  const payload = {
    urls: [url],
    extract_depth: process.env.TAVILY_EXTRACT_DEPTH || 'advanced',
    format: process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_FORMAT || process.env.TAVILY_EXTRACT_FORMAT || 'markdown',
    include_images: parseBooleanEnv(process.env.TAVILY_EXTRACT_INCLUDE_IMAGES, false),
    include_favicon: parseBooleanEnv(process.env.TAVILY_EXTRACT_INCLUDE_FAVICON, false),
    timeout: parseIntegerEnv(process.env.TAVILY_EXTRACT_REQUEST_TIMEOUT, 30),
  };

  if (process.env.TAVILY_EXTRACT_QUERY) {
    payload.query = process.env.TAVILY_EXTRACT_QUERY;
    payload.chunks_per_source = Math.max(1, Math.min(parseIntegerEnv(process.env.TAVILY_EXTRACT_CHUNKS_PER_SOURCE, 3), 5));
  }

  return payload;
}

function request(url, apiKey, timeoutSec) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(buildPayload(url));
    const req = https.request(TAVILY_EXTRACT_URL, {
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

        const result = Array.isArray(data?.results) ? data.results[0] : null;
        const content = String(result?.raw_content || result?.content || '').trim();
        if (!content) {
          resolve({ ok: false, error: 'Tavily Extract returned empty content' });
          return;
        }

        resolve({
          ok: true,
          result: normalizeExtractProviderResult({
            provider: 'tavily',
            providerLabel: 'Tavily Extract',
            url,
            finalUrl: result?.url || url,
            title: result?.title || '',
            content,
            contentFormat: process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_FORMAT || process.env.TAVILY_EXTRACT_FORMAT || 'markdown',
            raw: data,
          }),
        });
      });
    });

    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', (error) => resolve({ ok: false, error: error.message || 'Unknown request error' }));
    req.write(payload);
    req.end();
  });
}

async function extract({ url, apiKey, timeoutSec }) {
  return request(url, apiKey, timeoutSec);
}

module.exports = {
  extract,
};
