function normalizeSearchItem(item) {
  return {
    title: String(item?.title || '').trim(),
    url: String(item?.url || '').trim(),
    summary: String(item?.summary || item?.content || '').trim(),
  };
}

function normalizeSearchProviderResult({ provider, providerLabel, query, items = [], raw = null }) {
  return {
    provider,
    providerLabel,
    query: String(query || '').trim(),
    items: items.map(normalizeSearchItem).filter((item) => item.url || item.title || item.summary),
    raw,
  };
}

function formatNormalizedSearchProviderResult(result) {
  const lines = [
    `[WebSearch Result via ${result.providerLabel}]`,
    '',
    `Query: "${result.query || ''}"`,
    '',
  ];

  if (!Array.isArray(result.items) || result.items.length === 0) {
    lines.push('No organic search results were returned.');
  } else {
    lines.push('Search results:');
    lines.push('');

    result.items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title || 'Untitled result'}`);
      if (item.url) lines.push(`URL: ${item.url}`);
      if (item.summary) lines.push(`Summary: ${item.summary}`);
      lines.push('');
    });

    lines.push('Sources:');
    result.items.forEach((item) => {
      if (item.url) {
        lines.push(`- [${item.title || item.url}](${item.url})`);
      }
    });
  }

  return lines.join('\n').trim();
}

module.exports = {
  normalizeSearchProviderResult,
  formatNormalizedSearchProviderResult,
};
