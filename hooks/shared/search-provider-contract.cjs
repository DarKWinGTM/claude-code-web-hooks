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

function formatSingleProviderResult(result) {
  const lines = [
    `## Provider: ${result.providerLabel}`,
    '',
  ];

  if (!Array.isArray(result.items) || result.items.length === 0) {
    lines.push('No organic search results were returned.');
    return lines.join('\n').trim();
  }

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

  return lines.join('\n').trim();
}

function formatNormalizedSearchProviderResult(result) {
  const lines = [
    `[WebSearch Result via ${result.providerLabel}]`,
    '',
    `Query: "${result.query || ''}"`,
    '',
    formatSingleProviderResult(result),
  ];

  return lines.join('\n').trim();
}

function formatAggregateSearchProviderResult({ query, successes = [], failures = [] }) {
  const lines = [
    '[WebSearch Result via Multi-Provider Search]',
    '',
    `Query: "${query || ''}"`,
    '',
  ];

  if (!Array.isArray(successes) || successes.length === 0) {
    lines.push('No provider returned successful search results.');
  } else {
    successes.forEach((result, index) => {
      if (index > 0) lines.push('');
      lines.push(formatSingleProviderResult(result));
    });
  }

  if (Array.isArray(failures) && failures.length > 0) {
    lines.push('');
    lines.push('Failed providers:');
    failures.forEach((failure) => {
      lines.push(`- ${failure.provider}: ${failure.error}`);
    });
  }

  return lines.join('\n').trim();
}

module.exports = {
  normalizeSearchProviderResult,
  formatNormalizedSearchProviderResult,
  formatAggregateSearchProviderResult,
};
