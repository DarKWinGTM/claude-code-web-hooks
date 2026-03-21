#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_HOOK_DIR="${HOME}/.claude/hooks"
TARGET_SHARED_DIR="${TARGET_HOOK_DIR}/shared"
TARGET_SETTINGS="${HOME}/.claude/settings.json"
BACKUP_DIR="${PROJECT_DIR}/backups"
WEBSEARCH_DST="${TARGET_HOOK_DIR}/websearch-websearchapi-custom.cjs"
WEBFETCH_DST="${TARGET_HOOK_DIR}/webfetch-websearchapi-scraper.cjs"
FAILURE_POLICY_DST="${TARGET_SHARED_DIR}/failure-policy.cjs"
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

    const ownsWebSearch = entry.matcher === 'WebSearch' && commands.some((cmd) => cmd.includes('websearch-websearchapi-custom.cjs'));
    const ownsWebFetch = entry.matcher === 'WebFetch' && commands.some((cmd) => cmd.includes('webfetch-websearchapi-scraper.cjs'));
    return !(ownsWebSearch || ownsWebFetch);
  });
}

fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
NODE
fi

rm -f "${WEBSEARCH_DST}" "${WEBFETCH_DST}" "${FAILURE_POLICY_DST}"

printf 'Removed hooks if present:\n'
printf '  - %s\n' "${WEBSEARCH_DST}"
printf '  - %s\n' "${WEBFETCH_DST}"
printf 'Removed shared helper if present:\n'
printf '  - %s\n' "${FAILURE_POLICY_DST}"
if [ -f "${TARGET_SETTINGS}" ]; then
  printf 'Updated settings:\n'
  printf '  - %s\n' "${TARGET_SETTINGS}"
  printf 'Backup created:\n'
  printf '  - %s\n' "${BACKUP_DIR}/settings.uninstall.${TIMESTAMP}.json"
fi
printf '\nReview or reload hooks in Claude Code if needed.\n'
