const https = require('https');
const { parseBooleanEnv } = require('../provider-config.cjs');
const { normalizeExtractProviderResult } = require('../extract-provider-contract.cjs');

const WEBSEARCHAPI_SCRAPE_URL = 'https://api.websearchapi.ai/scrape';

function buildHeaders(apiKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Return-Format': process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_FORMAT || process.env.WEBFETCH_SCRAPER_RETURN_FORMAT || 'markdown',
    'X-Engine': process.env.WEBSEARCHAPI_SCRAPE_ENGINE || process.env.WEBFETCH_SCRAPER_ENGINE || 'browser',
  };

  if (process.env.WEBSEARCHAPI_SCRAPE_TARGET_SELECTOR || process.env.WEBFETCH_SCRAPER_TARGET_SELECTOR) {
    headers['X-Target-Selector'] = process.env.WEBSEARCHAPI_SCRAPE_TARGET_SELECTOR || process.env.WEBFETCH_SCRAPER_TARGET_SELECTOR;
  }

  if (process.env.WEBSEARCHAPI_SCRAPE_REMOVE_SELECTOR || process.env.WEBFETCH_SCRAPER_REMOVE_SELECTOR) {
    headers['X-Remove-Selector'] = process.env.WEBSEARCHAPI_SCRAPE_REMOVE_SELECTOR || process.env.WEBFETCH_SCRAPER_REMOVE_SELECTOR;
  }

  if (parseBooleanEnv(process.env.WEBSEARCHAPI_SCRAPE_WITH_LINKS_SUMMARY ?? process.env.WEBFETCH_SCRAPER_WITH_LINKS_SUMMARY, false)) {
    headers['X-With-Links-Summary'] = 'true';
  }

  if (parseBooleanEnv(process.env.WEBSEARCHAPI_SCRAPE_WITH_GENERATED_ALT ?? process.env.WEBFETCH_SCRAPER_WITH_GENERATED_ALT, false)) {
    headers['X-With-Generated-Alt'] = 'true';
  }

  return headers;
}

function request(url, apiKey, timeoutSec) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ url });
    const request = https.request(WEBSEARCHAPI_SCRAPE_URL, {
      method: 'POST',
      headers: buildHeaders(apiKey),
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
          resolve({ ok: false, error: `invalid JSON from scraper: ${error.message}` });
          return;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          resolve({ ok: false, error: data?.error || data?.message || `HTTP ${response.statusCode}` });
          return;
        }

        const scraped = data?.data || {};
        const content = String(scraped.content || '').trim();
        if (!content) {
          resolve({ ok: false, error: 'scraper returned empty content' });
          return;
        }

        resolve({
          ok: true,
          result: normalizeExtractProviderResult({
            provider: 'websearchapi',
            providerLabel: 'WebSearchAPI.ai Scrape',
            url,
            finalUrl: scraped.url || url,
            title: scraped.title || '',
            content,
            contentFormat: process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_FORMAT || process.env.WEBFETCH_SCRAPER_RETURN_FORMAT || 'markdown',
            raw: data,
          }),
        });
      });
    });

    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', (error) => resolve({ ok: false, error: error.message || 'request error' }));
    request.write(payload);
    request.end();
  });
}

async function extract({ url, apiKey, timeoutSec }) {
  return request(url, apiKey, timeoutSec);
}

module.exports = {
  extract,
};
