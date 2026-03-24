#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_HOOK_DIR="${HOME}/.claude/hooks"
TARGET_SHARED_DIR="${TARGET_HOOK_DIR}/shared"
TARGET_SEARCH_PROVIDER_DIR="${TARGET_SHARED_DIR}/search-providers"
TARGET_SETTINGS="${HOME}/.claude/settings.json"
BACKUP_DIR="${PROJECT_DIR}/backups"
WEBSEARCH_DST="${TARGET_HOOK_DIR}/websearch-custom.cjs"
WEBFETCH_DST="${TARGET_HOOK_DIR}/webfetch-scraper.cjs"
FAILURE_POLICY_DST="${TARGET_SHARED_DIR}/failure-policy.cjs"
SEARCH_PROVIDER_CONTRACT_DST="${TARGET_SHARED_DIR}/search-provider-contract.cjs"
SEARCH_PROVIDER_POLICY_DST="${TARGET_SHARED_DIR}/search-provider-policy.cjs"
WEBSEARCHAPI_PROVIDER_DST="${TARGET_SEARCH_PROVIDER_DIR}/websearchapi.cjs"
TAVILY_PROVIDER_DST="${TARGET_SEARCH_PROVIDER_DIR}/tavily.cjs"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "${BACKUP_DIR}"

if [ -f "${TARGET_SETTINGS}" ]; then
  cp "${TARGET_SETTINGS}" "${BACKUP_DIR}/settings.uninstall.${TIMESTAMP}.json"

  node - "${TARGET_SETTINGS}" <<'NODE'
const fs = require('fs');
const settingsPath = process.argv[2];
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

if (settings.hooks && Array.isArray(settings.hooks.PreToolUse)) {
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter((entry) => {
    if (!entry || !Array.isArray(entry.hooks) || typeof entry.matcher !== 'string') return true;
    const commands = entry.hooks
      .filter((hook) => hook && hook.type === 'command' && typeof hook.command === 'string')
      .map((hook) => hook.command);

    const ownsWebSearch = entry.matcher === 'WebSearch' && commands.some((cmd) => cmd.includes('websearch-custom.cjs'));
    const ownsWebFetch = entry.matcher === 'WebFetch' && commands.some((cmd) => cmd.includes('webfetch-scraper.cjs'));
    return !(ownsWebSearch || ownsWebFetch);
  });
}

fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
NODE
fi

rm -f "${WEBSEARCH_DST}" "${WEBFETCH_DST}" "${FAILURE_POLICY_DST}" "${SEARCH_PROVIDER_CONTRACT_DST}" "${SEARCH_PROVIDER_POLICY_DST}" "${WEBSEARCHAPI_PROVIDER_DST}" "${TAVILY_PROVIDER_DST}"

printf 'Removed hooks if present:\n'
printf '  - %s\n' "${WEBSEARCH_DST}"
printf '  - %s\n' "${WEBFETCH_DST}"
printf 'Removed shared helpers if present:\n'
printf '  - %s\n' "${FAILURE_POLICY_DST}"
printf '  - %s\n' "${SEARCH_PROVIDER_CONTRACT_DST}"
printf '  - %s\n' "${SEARCH_PROVIDER_POLICY_DST}"
printf 'Removed provider adapters if present:\n'
printf '  - %s\n' "${WEBSEARCHAPI_PROVIDER_DST}"
printf '  - %s\n' "${TAVILY_PROVIDER_DST}"
if [ -f "${TARGET_SETTINGS}" ]; then
  printf 'Updated settings:\n'
  printf '  - %s\n' "${TARGET_SETTINGS}"
  printf 'Backup created:\n'
  printf '  - %s\n' "${BACKUP_DIR}/settings.uninstall.${TIMESTAMP}.json"
fi
printf '\nReview or reload hooks in Claude Code if needed.\n'
