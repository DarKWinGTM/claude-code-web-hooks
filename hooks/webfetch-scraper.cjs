#!/usr/bin/env node
/**
 * Claude Code WebFetch Hook - Auto-detect CSR and fallback across selectable extraction backends
 *
 * Behavior:
 *   - If URL looks fetch-readable from initial HTML: exit 0 and allow native WebFetch
 *   - If URL needs extraction, try one active backend and rotate across WebSearchAPI.ai Scrape, Tavily Extract, and Exa Contents
 *   - If all extraction backends fail: exit 0 and allow native WebFetch
 *
 * Environment Variables:
 *   WEBSEARCHAPI_API_KEY                           - WebSearchAPI.ai bearer token(s); multiple keys allowed via '|' delimiter
 *   TAVILY_API_KEY                                 - Tavily bearer token(s); multiple keys allowed via '|' delimiter
 *   EXA_API_KEY                                    - Exa key(s); multiple keys allowed via '|' delimiter
 *   CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_MODE         - fallback-only extractor mode (default: fallback)
 *   CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_PROVIDERS    - ordered extraction providers (default: websearchapi,tavily,exa)
 *   CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_PRIMARY      - optional preferred provider to try first
 *   CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_TIMEOUT      - shared extraction timeout in seconds (default: 25)
 *   CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_FORMAT       - extraction output format (default: markdown)
 *   WEBFETCH_PROBE_TIMEOUT                         - Initial HTML fetch timeout in seconds (default: 12)
 *   WEBFETCH_PROBE_MAX_HTML_BYTES                  - Max initial HTML bytes to inspect (default: 262144)
 *   WEBFETCH_SCRAPER_TIMEOUT                       - Legacy shared scraper timeout alias (default: 25)
 *
 *   Backward compatibility:
 *   - `WEBFETCH_SCRAPER_TIMEOUT` (old probe timeout name) is still accepted as fallback for `WEBFETCH_PROBE_TIMEOUT`
 *   - `WEBFETCH_SCRAPER_MAX_HTML_BYTES` (old probe bytes name) is still accepted as fallback for `WEBFETCH_PROBE_MAX_HTML_BYTES`
 *   - `WEBFETCH_SCRAPER_API_TIMEOUT` (old scraper API timeout name) is still accepted as fallback for `WEBFETCH_SCRAPER_TIMEOUT`
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

const http = require('http');
const https = require('https');
const { classifyProviderFailure } = require('./shared/failure-policy.cjs');
const { parseIntegerEnv } = require('./shared/provider-config.cjs');
const { executeExtractProviderPolicy } = require('./shared/extract-provider-policy.cjs');
const { formatExtractProviderResult } = require('./shared/extract-provider-contract.cjs');

const DEFAULT_FETCH_TIMEOUT_SEC = 12;
const DEFAULT_SCRAPER_API_TIMEOUT_SEC = 25;
const DEFAULT_MAX_HTML_BYTES = 262144;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const TEMPLATE_HEAVY_HOSTS = [
  'sanook.com',
  'thaipost.net',
  'khaosod.co.th',
];


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
  const normalizedHtml = String(html || '').slice(0, parseIntegerEnv(process.env.WEBFETCH_PROBE_MAX_HTML_BYTES || process.env.WEBFETCH_SCRAPER_MAX_HTML_BYTES, DEFAULT_MAX_HTML_BYTES));
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
  const lowTextStructuredPortal =
    jsonLdCount >= 2 &&
    paragraphCount === 0 &&
    contentNodeCount === 0 &&
    !shellPatternMatched &&
    scriptCount <= 4;
  const portalHeavy =
    lowTextStructuredPortal ||
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
    const maxBytes = parseIntegerEnv(process.env.WEBFETCH_PROBE_MAX_HTML_BYTES || process.env.WEBFETCH_SCRAPER_MAX_HTML_BYTES, DEFAULT_MAX_HTML_BYTES);

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

function outputScrapedSuccess(url, prompt, detection, policyResult) {
  const formatted = formatExtractProviderResult({
    url,
    prompt,
    detection,
    result: policyResult.result,
    fallbackProviderUsed: policyResult.fallbackProviderUsed,
  });
  const output = {
    decision: 'block',
    reason: `WebFetch replaced with ${policyResult.result.providerLabel} result`,
    systemMessage: `[WebFetch hook] class=${detection.classification} -> scraper-fallback (${policyResult.result.provider})`,
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

    const initial = await fetchInitialHtml(targetUrl, parseIntegerEnv(process.env.WEBFETCH_PROBE_TIMEOUT || process.env.WEBFETCH_SCRAPER_TIMEOUT, DEFAULT_FETCH_TIMEOUT_SEC));
    if (!initial.ok) {
      debugLog(`Initial HTML probe skipped fallback for ${targetUrl}: ${initial.error || 'unknown reason'}`);
      outputAllowContinuation(`[WebFetch hook] class=probe-unusable -> native-webfetch (${initial.error || 'unknown reason'})`);
    }

    const detection = detectRenderingMode(targetUrl, initial.html);
    if (!detection.scrapeRecommended) {
      debugLog(`Allowing native WebFetch for ${targetUrl}: ${detection.reason}`);
      outputAllowContinuation(`[WebFetch hook] class=${detection.classification} -> native-webfetch`);
    }

    debugLog(`${detection.classification} detected for ${targetUrl}; using extractor-provider fallback (${detection.reason})`);
    const result = await executeExtractProviderPolicy({ url: targetUrl, debugLog });
    if (result.success && result.result) {
      outputScrapedSuccess(targetUrl, prompt, detection, result);
    }

    const firstFailure = result.failures?.[0]?.error || result.error || 'unknown error';
    const summarizedFailureClass = classifyProviderFailure(firstFailure);
    const providerNote = result.providersTried && result.providersTried.length > 0
      ? `providers:${result.providersTried.join(',')}`
      : 'no-provider';
    outputAllowContinuation(`[WebFetch hook] class=${detection.classification} -> native-webfetch (scraper-fallback-failed:${summarizedFailureClass};${providerNote})`);
  } catch (error) {
    debugLog(`Hook parse/runtime error: ${error.message || String(error)}`);
    process.exit(0);
  }
}
