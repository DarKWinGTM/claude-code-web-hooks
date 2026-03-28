function normalizeExtractProviderResult({
  provider,
  providerLabel,
  url,
  finalUrl = '',
  title = '',
  content = '',
  contentFormat = 'markdown',
  raw = null,
}) {
  return {
    provider: String(provider || '').trim(),
    providerLabel: String(providerLabel || '').trim(),
    url: String(url || '').trim(),
    finalUrl: String(finalUrl || '').trim(),
    title: String(title || '').trim(),
    content: String(content || '').trim(),
    contentFormat: String(contentFormat || 'markdown').trim() || 'markdown',
    raw,
  };
}

function formatExtractProviderResult({ url, prompt = '', detection, result, fallbackProviderUsed = false }) {
  const lines = [
    `[WebFetch Result via ${result.providerLabel}]`,
    '',
    `URL: ${result.finalUrl || result.url || url}`,
    `Detection: ${detection.reason}`,
  ];

  if (fallbackProviderUsed) {
    lines.push(`Fallback backend used: ${result.provider}`);
  }

  if (prompt) {
    lines.push(`Original WebFetch prompt: ${prompt}`);
  }

  if (result.title) {
    lines.push(`Title: ${result.title}`);
  }

  lines.push('', result.content, '', '---', 'Use this extracted content instead of the original WebFetch result.');
  return lines.join('\n');
}

module.exports = {
  normalizeExtractProviderResult,
  formatExtractProviderResult,
};
