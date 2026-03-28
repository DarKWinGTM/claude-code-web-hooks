const path = require('path');
const fs = require('fs');
const os = require('os');

function parseInlineEntries(rawValue, delimiter = '|') {
  return String(rawValue || '')
    .split(delimiter)
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith('#'));
}

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

function parseApiKeyInput(rawValue) {
  if (typeof rawValue !== 'string') return [];
  const trimmed = rawValue.trim();
  if (!trimmed) return [];

  if (looksLikeLocalPath(trimmed)) {
    try {
      const resolved = resolveLocalPath(trimmed);
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) return [];
      const fileContent = fs.readFileSync(resolved, 'utf8');
      try {
        const parsed = JSON.parse(fileContent);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      } catch {
        return fileContent
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter((item) => item && !item.startsWith('#'));
      }
    } catch {
      return [];
    }
  }

  return parseInlineEntries(trimmed, '|');
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseIntegerEnv(value, fallback) {
  const parsed = parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getOrderedProviders({ providersEnv, defaultProviders, primaryEnv }) {
  const configured = parseInlineEntries(providersEnv, ',');
  const order = configured.length > 0 ? configured : defaultProviders;
  const primary = String(primaryEnv || '').trim();
  if (!primary) return order;
  return [primary, ...order.filter((item) => item !== primary)];
}

function chooseStartingProvider({ orderedProviders, availableProviders, primary }) {
  if (!Array.isArray(orderedProviders) || orderedProviders.length === 0) return [];
  const availableSet = new Set(availableProviders);
  const filtered = orderedProviders.filter((provider) => availableSet.has(provider));
  if (filtered.length === 0) return [];

  const normalizedPrimary = String(primary || '').trim();
  if (normalizedPrimary) return filtered;

  const firstIndex = Math.floor(Math.random() * filtered.length);
  return [filtered[firstIndex], ...filtered.filter((_, index) => index !== firstIndex)];
}

module.exports = {
  parseInlineEntries,
  looksLikeLocalPath,
  resolveLocalPath,
  parseApiKeyInput,
  shuffle,
  parseBooleanEnv,
  parseIntegerEnv,
  getOrderedProviders,
  chooseStartingProvider,
};
