function normalizeErrorText(error) {
  return String(error || '').toLowerCase();
}

function classifyProviderFailure(error) {
  const text = normalizeErrorText(error);

  if (!text) {
    return 'unknown';
  }

  if (
    text.includes('invalid api key') ||
    text.includes('unauthorized') ||
    text.includes('forbidden') ||
    text.includes('authentication') ||
    text.includes('401') ||
    text.includes('403')
  ) {
    return 'auth-failed';
  }

  if (
    text.includes('quota') ||
    text.includes('credit') ||
    text.includes('credits') ||
    text.includes('balance') ||
    text.includes('payment required') ||
    text.includes('insufficient') ||
    text.includes('billing') ||
    text.includes('429') ||
    text.includes('rate limit') ||
    text.includes('rate-limit')
  ) {
    return 'credit-or-quota-failed';
  }

  if (
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('fetch failed') ||
    text.includes('gateway timeout') ||
    text.includes('bad gateway') ||
    text.includes('request error') ||
    text.includes('network') ||
    text.includes('502') ||
    text.includes('503') ||
    text.includes('504')
  ) {
    return 'transient-provider-failed';
  }

  return 'unknown';
}

function shouldAllowNativeFallback(error) {
  const failureClass = classifyProviderFailure(error);
  return failureClass === 'auth-failed' || failureClass === 'credit-or-quota-failed' || failureClass === 'transient-provider-failed' || failureClass === 'unknown';
}

module.exports = {
  classifyProviderFailure,
  shouldAllowNativeFallback,
};
