#!/usr/bin/env node
/**
 * Claude Code WebFetch Hook - Auto-detect CSR and fallback to WebSearchAPI scraper
 *
 * Behavior:
 *   - If URL looks fetch-readable from initial HTML: exit 0 and allow native WebFetch
 *   - If URL looks CSR-heavy / shell-heavy and WEBSEARCHAPI_API_KEY exists: scrape via WebSearchAPI.ai and return scraped content
 *   - If key is missing or scraper path fails: exit 0 and allow native WebFetch
 *
 * Environment Variables:
 *   WEBSEARCHAPI_API_KEY                 - WebSearchAPI.ai bearer token(s); multiple keys allowed via '|' delimiter
 *   WEBFETCH_SCRAPER_TIMEOUT             - Initial HTML fetch timeout in seconds (default: 12)
 *   WEBFETCH_SCRAPER_MAX_HTML_BYTES      - Max initial HTML bytes to inspect (default: 262144)
 *   WEBFETCH_SCRAPER_API_TIMEOUT         - Scraper API timeout in seconds (default: 25)
 *   WEBFETCH_SCRAPER_RETURN_FORMAT       - Scraper return format (default: markdown)
 *   WEBFETCH_SCRAPER_ENGINE              - Scraper engine (default: browser)
 *   WEBFETCH_SCRAPER_TARGET_SELECTOR     - Optional target selector
 *   WEBFETCH_SCRAPER_REMOVE_SELECTOR     - Optional remove selector
 *   WEBFETCH_SCRAPER_WITH_LINKS_SUMMARY  - Enable links summary when truthy
 *   WEBFETCH_SCRAPER_WITH_GENERATED_ALT  - Enable generated alt text when truthy
 *   CLAUDE_WEB_HOOKS_DEBUG=1                          - Enable debug logging
 *
 * Exit codes:
 *   0 - Allow tool / fall through to native WebFetch
 *   2 - Block tool and return hook-provided scraped content
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { classifyProviderFailure } = require('./shared/failure-policy.cjs');

const DEFAULT_FETCH_TIMEOUT_SEC = 12;
const DEFAULT_SCRAPER_API_TIMEOUT_SEC = 25;
const DEFAULT_MAX_HTML_BYTES = 262144;
const WEBSEARCHAPI_SCRAPE_URL = 'https://api.websearchapi.ai/scrape';
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const TEMPLATE_HEAVY_HOSTS = [
  'sanook.com',
  'thaipost.net',
  'khaosod.co.th',
];

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
  return rawValue.split('|').map((item) => item.trim()).filter((item) => item && !item.startsWith('#'));
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

function debugLog(message) {
  if (process.env.CLAUDE_WEB_HOOKS_DEBUG) {
    console.error(`[WebFetch Scraper Hook] ${message}`);
  }
}

function isSupportedHttpUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMatches(input, pattern) {
  return (input.match(pattern) || []).length;
}

function isTemplateHeavyHost(targetUrl) {
  try {
    const hostname = new URL(targetUrl).hostname.toLowerCase();
    return TEMPLATE_HEAVY_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function detectRenderingMode(targetUrl, html) {
  const normalizedHtml = String(html || '').slice(0, parseIntegerEnv(process.env.WEBFETCH_SCRAPER_MAX_HTML_BYTES, DEFAULT_MAX_HTML_BYTES));
  const text = htmlToText(normalizedHtml);
  const textLength = text.length;
  const scriptCount = countMatches(normalizedHtml, /<script\b/gi);
  const contentNodeCount = countMatches(normalizedHtml, /<(article|main|section|p|h1|h2)\b/gi);
  const paragraphCount = countMatches(normalizedHtml, /<p\b/gi);
  const articleCount = countMatches(normalizedHtml, /<article\b/gi);
  const mainCount = countMatches(normalizedHtml, /<main\b/gi);
  const jsonLdCount = countMatches(normalizedHtml, /<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi);
  const linkCount = countMatches(normalizedHtml, /<a\b/gi);
  const shellPatterns = [
    /<div[^>]+id=["']__next["'][^>]*>\s*<\/div>/i,
    /<div[^>]+id=["']root["'][^>]*>\s*<\/div>/i,
    /<div[^>]+id=["']app["'][^>]*>\s*<\/div>/i,
    /<div[^>]+id=["']app-root["'][^>]*>\s*<\/div>/i,
    /<div[^>]+id=["']svelte["'][^>]*>\s*<\/div>/i,
  ];
  const shellPatternMatched = shellPatterns.some((pattern) => pattern.test(normalizedHtml));
  const looksLikeMetadataOnly = textLength < 450 && contentNodeCount <= 3;
  const templateHeavyHost = isTemplateHeavyHost(targetUrl);
  const portalHeavy =
    (textLength >= 5000 && paragraphCount <= 2 && articleCount === 0) ||
    (linkCount >= 80 && paragraphCount <= 2) ||
    (jsonLdCount >= 2 && paragraphCount <= 2 && textLength >= 2000) ||
    (templateHeavyHost && paragraphCount <= 3);
  const browserRenderRequired =
    (shellPatternMatched && textLength < 700) ||
    (scriptCount >= 8 && textLength < 450) ||
    (looksLikeMetadataOnly && scriptCount >= 5);
  const scrapeRecommended = browserRenderRequired || portalHeavy;
  const classification = browserRenderRequired
    ? 'browser-render-required'
    : portalHeavy
      ? 'template-heavy'
      : 'fetch-readable';

  return {
    classification,
    scrapeRecommended,
    browserRenderRequired,
    portalHeavy,
    shellPatternMatched,
    templateHeavyHost,
    textLength,
    scriptCount,
    contentNodeCount,
    paragraphCount,
    articleCount,
    mainCount,
    jsonLdCount,
    linkCount,
    reason: browserRenderRequired
      ? `browser-render-required initial HTML (text=${textLength}, scripts=${scriptCount}, contentNodes=${contentNodeCount}, paragraphs=${paragraphCount})`
      : portalHeavy
        ? `template-heavy initial HTML (text=${textLength}, scripts=${scriptCount}, contentNodes=${contentNodeCount}, paragraphs=${paragraphCount}, links=${linkCount}, jsonLd=${jsonLdCount})`
        : `fetch-readable initial HTML (text=${textLength}, scripts=${scriptCount}, contentNodes=${contentNodeCount}, paragraphs=${paragraphCount})`,
  };
}

function fetchInitialHtml(targetUrl, timeoutSec = DEFAULT_FETCH_TIMEOUT_SEC, redirectCount = 0) {
  return new Promise((resolve) => {
    if (!isSupportedHttpUrl(targetUrl)) {
      resolve({ ok: false, error: 'unsupported URL scheme' });
      return;
    }

    if (redirectCount > 4) {
      resolve({ ok: false, error: 'too many redirects' });
      return;
    }

    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'http:' ? http : https;
    const maxBytes = parseIntegerEnv(process.env.WEBFETCH_SCRAPER_MAX_HTML_BYTES, DEFAULT_MAX_HTML_BYTES);

    const request = client.request(parsed, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity',
        'User-Agent': 'ClaudeCode-WebFetch-CSR-Detector/1.0'
      },
      timeout: timeoutSec * 1000,
    }, (response) => {
      if (REDIRECT_STATUS_CODES.has(response.statusCode) && response.headers.location) {
        const redirectedUrl = new URL(response.headers.location, parsed).toString();
        response.resume();
        fetchInitialHtml(redirectedUrl, timeoutSec, redirectCount + 1).then(resolve);
        return;
      }

      const contentType = String(response.headers['content-type'] || '');
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        response.resume();
        resolve({ ok: false, contentType, error: `non-HTML content-type: ${contentType || 'unknown'}` });
        return;
      }

      let raw = '';
      let totalBytes = 0;
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        totalBytes += Buffer.byteLength(chunk, 'utf8');
        if (totalBytes <= maxBytes) {
          raw += chunk;
        }
      });
      response.on('end', () => {
        resolve({ ok: true, url: parsed.toString(), html: raw, contentType, statusCode: response.statusCode });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('timeout'));
    });

    request.on('error', (error) => {
      resolve({ ok: false, error: error.message || 'request error' });
    });

    request.end();
  });
}

function buildScraperHeaders(apiKey) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Return-Format': process.env.WEBFETCH_SCRAPER_RETURN_FORMAT || 'markdown',
    'X-Engine': process.env.WEBFETCH_SCRAPER_ENGINE || 'browser',
  };

  if (process.env.WEBFETCH_SCRAPER_TARGET_SELECTOR) {
    headers['X-Target-Selector'] = process.env.WEBFETCH_SCRAPER_TARGET_SELECTOR;
  }

  if (process.env.WEBFETCH_SCRAPER_REMOVE_SELECTOR) {
    headers['X-Remove-Selector'] = process.env.WEBFETCH_SCRAPER_REMOVE_SELECTOR;
  }

  if (parseBooleanEnv(process.env.WEBFETCH_SCRAPER_WITH_LINKS_SUMMARY, false)) {
    headers['X-With-Links-Summary'] = 'true';
  }

  if (parseBooleanEnv(process.env.WEBFETCH_SCRAPER_WITH_GENERATED_ALT, false)) {
    headers['X-With-Generated-Alt'] = 'true';
  }

  return headers;
}

function scrapeUrl(targetUrl, apiKey, timeoutSec = DEFAULT_SCRAPER_API_TIMEOUT_SEC) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ url: targetUrl });
    const request = https.request(WEBSEARCHAPI_SCRAPE_URL, {
      method: 'POST',
      headers: buildScraperHeaders(apiKey),
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
          const apiError = data?.error || data?.message || `HTTP ${response.statusCode}`;
          resolve({ ok: false, error: apiError, data });
          return;
        }

        const scraped = data?.data || {};
        const content = String(scraped.content || '').trim();
        if (!content) {
          resolve({ ok: false, error: 'scraper returned empty content', data });
          return;
        }

        resolve({ ok: true, data: scraped });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('timeout'));
    });

    request.on('error', (error) => {
      resolve({ ok: false, error: error.message || 'request error' });
    });

    request.write(payload);
    request.end();
  });
}

function formatScrapedResult(url, prompt, detection, scraped) {
  const lines = [
    '[WebFetch Result via WebSearchAPI.ai Scraper]',
    '',
    `URL: ${scraped.url || url}`,
    `Detection: ${detection.reason}`,
  ];

  if (prompt) {
    lines.push(`Original WebFetch prompt: ${prompt}`);
  }

  if (scraped.title) {
    lines.push(`Title: ${scraped.title}`);
  }

  lines.push('', String(scraped.content || '').trim(), '', '---', 'Use this scraped content instead of the original WebFetch result.');
  return lines.join('\n');
}

function outputScrapedSuccess(url, prompt, detection, scraped) {
  const formatted = formatScrapedResult(url, prompt, detection, scraped);
  const output = {
    decision: 'block',
    reason: 'WebFetch replaced with WebSearchAPI.ai scraper result',
    systemMessage: `[WebFetch hook] class=${detection.classification} -> scraper-fallback`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: formatted,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}

function outputAllowContinuation(message) {
  const output = {
    systemMessage: message,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
    },
  };

  console.log(JSON.stringify(output));
  process.exit(0);
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
    if (data.tool_name !== 'WebFetch') {
      process.exit(0);
    }

    const targetUrl = data.tool_input?.url;
    const prompt = data.tool_input?.prompt || '';
    if (!targetUrl || !isSupportedHttpUrl(targetUrl)) {
      outputAllowContinuation('[WebFetch hook] class=unsupported-url -> native-webfetch');
    }

    const initial = await fetchInitialHtml(targetUrl, parseIntegerEnv(process.env.WEBFETCH_SCRAPER_TIMEOUT, DEFAULT_FETCH_TIMEOUT_SEC));
    if (!initial.ok) {
      debugLog(`Initial HTML probe skipped fallback for ${targetUrl}: ${initial.error || 'unknown reason'}`);
      outputAllowContinuation(`[WebFetch hook] class=probe-unusable -> native-webfetch (${initial.error || 'unknown reason'})`);
    }

    const detection = detectRenderingMode(targetUrl, initial.html);
    if (!detection.scrapeRecommended) {
      debugLog(`Allowing native WebFetch for ${targetUrl}: ${detection.reason}`);
      outputAllowContinuation(`[WebFetch hook] class=${detection.classification} -> native-webfetch`);
    }

    const apiKeys = getApiKeyAttempts();
    if (apiKeys.length === 0) {
      debugLog(`${detection.classification} detected but no WEBSEARCHAPI_API_KEY configured for ${targetUrl}`);
      outputAllowContinuation(`[WebFetch hook] class=${detection.classification} -> native-webfetch (no-key)`);
    }

    debugLog(`${detection.classification} detected for ${targetUrl}; using scraper fallback (${detection.reason})`);
    const errors = [];
    for (const apiKey of apiKeys) {
      const scraped = await scrapeUrl(targetUrl, apiKey, parseIntegerEnv(process.env.WEBFETCH_SCRAPER_API_TIMEOUT, DEFAULT_SCRAPER_API_TIMEOUT_SEC));
      if (scraped.ok) {
        outputScrapedSuccess(targetUrl, prompt, detection, scraped.data);
      }

      errors.push(scraped.error || 'unknown error');
      debugLog(`Scraper fallback attempt failed for ${targetUrl}; trying next key if available: ${scraped.error || 'unknown error'}`);
    }

    const summarizedFailureClass = classifyProviderFailure(errors[0] || '');
    outputAllowContinuation(`[WebFetch hook] class=${detection.classification} -> native-webfetch (scraper-fallback-failed:${summarizedFailureClass})`);
  } catch (error) {
    debugLog(`Hook parse/runtime error: ${error.message || String(error)}`);
    process.exit(0);
  }
}
