#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_HOOK_DIR="${HOME}/.claude/hooks"
TARGET_SHARED_DIR="${TARGET_HOOK_DIR}/shared"
TARGET_SETTINGS="${HOME}/.claude/settings.json"
BACKUP_DIR="${PROJECT_DIR}/backups"
WEBSEARCH_SRC="${PROJECT_DIR}/hooks/websearch-websearchapi-custom.cjs"
WEBFETCH_SRC="${PROJECT_DIR}/hooks/webfetch-websearchapi-scraper.cjs"
FAILURE_POLICY_SRC="${PROJECT_DIR}/hooks/shared/failure-policy.cjs"
WEBSEARCH_DST="${TARGET_HOOK_DIR}/websearch-websearchapi-custom.cjs"
WEBFETCH_DST="${TARGET_HOOK_DIR}/webfetch-websearchapi-scraper.cjs"
FAILURE_POLICY_DST="${TARGET_SHARED_DIR}/failure-policy.cjs"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "${TARGET_HOOK_DIR}" "${TARGET_SHARED_DIR}" "${BACKUP_DIR}"
cp "${WEBSEARCH_SRC}" "${WEBSEARCH_DST}"
cp "${WEBFETCH_SRC}" "${WEBFETCH_DST}"
cp "${FAILURE_POLICY_SRC}" "${FAILURE_POLICY_DST}"
chmod 755 "${WEBSEARCH_DST}" "${WEBFETCH_DST}" "${FAILURE_POLICY_DST}"

if [ -f "${TARGET_SETTINGS}" ]; then
  cp "${TARGET_SETTINGS}" "${BACKUP_DIR}/settings.${TIMESTAMP}.json"
else
  printf '{\n  "hooks": {\n    "PreToolUse": []\n  }\n}\n' > "${TARGET_SETTINGS}"
  cp "${TARGET_SETTINGS}" "${BACKUP_DIR}/settings.${TIMESTAMP}.json"
fi

node - "${TARGET_SETTINGS}" "${WEBSEARCH_DST}" "${WEBFETCH_DST}" <<'NODE'
const fs = require('fs');
const settingsPath = process.argv[2];
const websearchHook = process.argv[3];
const webfetchHook = process.argv[4];

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse ${file}: ${error.message}`);
  }
};

const settings = readJson(settingsPath);
if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {};
if (!Array.isArray(settings.hooks.PreToolUse)) settings.hooks.PreToolUse = [];

const ensureHook = (matcher, command) => {
  const existing = settings.hooks.PreToolUse.find((entry) => entry && entry.matcher === matcher);
  const hookObject = {
    matcher,
    hooks: [
      {
        type: 'command',
        command: `node \"${command}\"`,
        timeout: 120,
      },
    ],
  };

  if (!existing) {
    settings.hooks.PreToolUse.push(hookObject);
    return;
  }

  existing.hooks = hookObject.hooks;
};

ensureHook('WebSearch', websearchHook);
ensureHook('WebFetch', webfetchHook);

fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
NODE

printf 'Installed hooks:\n'
printf '  - %s\n' "${WEBSEARCH_DST}"
printf '  - %s\n' "${WEBFETCH_DST}"
printf 'Installed shared helper:\n'
printf '  - %s\n' "${FAILURE_POLICY_DST}"
printf 'Updated settings:\n'
printf '  - %s\n' "${TARGET_SETTINGS}"
printf 'Backup created:\n'
printf '  - %s\n' "${BACKUP_DIR}/settings.${TIMESTAMP}.json"
printf '\nReview or reload hooks in Claude Code if needed.\n'
