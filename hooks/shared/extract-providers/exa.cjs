const https = require('https');
const { normalizeExtractProviderResult } = require('../extract-provider-contract.cjs');

const EXA_CONTENTS_URL = 'https://api.exa.ai/contents';

function buildPayload(url) {
  return {
    urls: [url],
    text: {
      maxCharacters: parseInt(process.env.EXA_CONTENTS_MAX_CHARACTERS || '20000', 10),
      includeHtmlTags: false,
      verbosity: process.env.EXA_CONTENTS_VERBOSITY || 'standard',
    },
    maxAgeHours: parseInt(process.env.EXA_CONTENTS_MAX_AGE_HOURS || '0', 10),
    subpages: parseInt(process.env.EXA_CONTENTS_SUBPAGES || '0', 10) || undefined,
    subpageTarget: process.env.EXA_CONTENTS_SUBPAGE_TARGET
      ? process.env.EXA_CONTENTS_SUBPAGE_TARGET.split(',').map((item) => item.trim()).filter(Boolean)
      : undefined,
  };
}

function request(url, apiKey, timeoutSec) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(buildPayload(url));
    const req = https.request(EXA_CONTENTS_URL, {
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

        const result = Array.isArray(data?.results) ? data.results[0] : null;
        const content = String(result?.text || '').trim();
        if (!content) {
          resolve({ ok: false, error: 'Exa Contents returned empty content' });
          return;
        }

        resolve({
          ok: true,
          result: normalizeExtractProviderResult({
            provider: 'exa',
            providerLabel: 'Exa Contents',
            url,
            finalUrl: result?.url || url,
            title: result?.title || '',
            content,
            contentFormat: 'markdown',
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
