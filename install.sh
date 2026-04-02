#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="claude-code"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

case "$TARGET" in
  claude-code|copilot-vscode|all) ;;
  *)
    echo "Unsupported target: $TARGET" >&2
    echo "Expected one of: claude-code, copilot-vscode, all" >&2
    exit 1
    ;;
esac

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_HOOK_DIR="${HOME}/.claude/hooks"
TARGET_SHARED_DIR="${TARGET_HOOK_DIR}/shared"
TARGET_SEARCH_PROVIDER_DIR="${TARGET_SHARED_DIR}/search-providers"
TARGET_EXTRACT_PROVIDER_DIR="${TARGET_SHARED_DIR}/extract-providers"
TARGET_SETTINGS="${HOME}/.claude/settings.json"
COPILOT_USER_HOOK_DIR="${HOME}/.copilot/hooks"
COPILOT_HOOK_FILE="${COPILOT_USER_HOOK_DIR}/claude-code-web-hooks.json"
BACKUP_DIR="${PROJECT_DIR}/backups"
INSTALL_CLAUDE=0
INSTALL_COPILOT=0
case "$TARGET" in
  claude-code)
    INSTALL_CLAUDE=1
    ;;
  copilot-vscode)
    INSTALL_COPILOT=1
    ;;
  all)
    INSTALL_CLAUDE=1
    INSTALL_COPILOT=1
    ;;
esac
WEBSEARCH_SRC="${PROJECT_DIR}/hooks/websearch-custom.cjs"
WEBFETCH_SRC="${PROJECT_DIR}/hooks/webfetch-scraper.cjs"
COPILOT_WEBSEARCH_SRC="${PROJECT_DIR}/hooks/copilot-websearch.cjs"
COPILOT_WEBFETCH_SRC="${PROJECT_DIR}/hooks/copilot-webfetch.cjs"
FAILURE_POLICY_SRC="${PROJECT_DIR}/hooks/shared/failure-policy.cjs"
PROVIDER_CONFIG_SRC="${PROJECT_DIR}/hooks/shared/provider-config.cjs"
SEARCH_PROVIDER_CONTRACT_SRC="${PROJECT_DIR}/hooks/shared/search-provider-contract.cjs"
SEARCH_PROVIDER_POLICY_SRC="${PROJECT_DIR}/hooks/shared/search-provider-policy.cjs"
EXTRACT_PROVIDER_CONTRACT_SRC="${PROJECT_DIR}/hooks/shared/extract-provider-contract.cjs"
EXTRACT_PROVIDER_POLICY_SRC="${PROJECT_DIR}/hooks/shared/extract-provider-policy.cjs"
WEBSEARCHAPI_PROVIDER_SRC="${PROJECT_DIR}/hooks/shared/search-providers/websearchapi.cjs"
TAVILY_PROVIDER_SRC="${PROJECT_DIR}/hooks/shared/search-providers/tavily.cjs"
EXA_PROVIDER_SRC="${PROJECT_DIR}/hooks/shared/search-providers/exa.cjs"
WEBSEARCHAPI_EXTRACTOR_SRC="${PROJECT_DIR}/hooks/shared/extract-providers/websearchapi.cjs"
TAVILY_EXTRACTOR_SRC="${PROJECT_DIR}/hooks/shared/extract-providers/tavily.cjs"
EXA_EXTRACTOR_SRC="${PROJECT_DIR}/hooks/shared/extract-providers/exa.cjs"
WEBSEARCH_DST="${TARGET_HOOK_DIR}/websearch-custom.cjs"
WEBFETCH_DST="${TARGET_HOOK_DIR}/webfetch-scraper.cjs"
COPILOT_WEBSEARCH_DST="${TARGET_HOOK_DIR}/copilot-websearch.cjs"
COPILOT_WEBFETCH_DST="${TARGET_HOOK_DIR}/copilot-webfetch.cjs"
WORKSPACE_COPILOT_HOOK_FILE="${PROJECT_DIR}/.github/hooks/claude-code-web-hooks.json"
FAILURE_POLICY_DST="${TARGET_SHARED_DIR}/failure-policy.cjs"
PROVIDER_CONFIG_DST="${TARGET_SHARED_DIR}/provider-config.cjs"
SEARCH_PROVIDER_CONTRACT_DST="${TARGET_SHARED_DIR}/search-provider-contract.cjs"
SEARCH_PROVIDER_POLICY_DST="${TARGET_SHARED_DIR}/search-provider-policy.cjs"
EXTRACT_PROVIDER_CONTRACT_DST="${TARGET_SHARED_DIR}/extract-provider-contract.cjs"
EXTRACT_PROVIDER_POLICY_DST="${TARGET_SHARED_DIR}/extract-provider-policy.cjs"
WEBSEARCHAPI_PROVIDER_DST="${TARGET_SEARCH_PROVIDER_DIR}/websearchapi.cjs"
TAVILY_PROVIDER_DST="${TARGET_SEARCH_PROVIDER_DIR}/tavily.cjs"
EXA_PROVIDER_DST="${TARGET_SEARCH_PROVIDER_DIR}/exa.cjs"
WEBSEARCHAPI_EXTRACTOR_DST="${TARGET_EXTRACT_PROVIDER_DIR}/websearchapi.cjs"
TAVILY_EXTRACTOR_DST="${TARGET_EXTRACT_PROVIDER_DIR}/tavily.cjs"
EXA_EXTRACTOR_DST="${TARGET_EXTRACT_PROVIDER_DIR}/exa.cjs"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "${BACKUP_DIR}"

if [ "$INSTALL_CLAUDE" -eq 1 ]; then
  mkdir -p "${TARGET_HOOK_DIR}" "${TARGET_SHARED_DIR}" "${TARGET_SEARCH_PROVIDER_DIR}" "${TARGET_EXTRACT_PROVIDER_DIR}"
  cp "${WEBSEARCH_SRC}" "${WEBSEARCH_DST}"
  cp "${WEBFETCH_SRC}" "${WEBFETCH_DST}"
  cp "${FAILURE_POLICY_SRC}" "${FAILURE_POLICY_DST}"
  cp "${PROVIDER_CONFIG_SRC}" "${PROVIDER_CONFIG_DST}"
  cp "${SEARCH_PROVIDER_CONTRACT_SRC}" "${SEARCH_PROVIDER_CONTRACT_DST}"
  cp "${SEARCH_PROVIDER_POLICY_SRC}" "${SEARCH_PROVIDER_POLICY_DST}"
  cp "${EXTRACT_PROVIDER_CONTRACT_SRC}" "${EXTRACT_PROVIDER_CONTRACT_DST}"
  cp "${EXTRACT_PROVIDER_POLICY_SRC}" "${EXTRACT_PROVIDER_POLICY_DST}"
  cp "${WEBSEARCHAPI_PROVIDER_SRC}" "${WEBSEARCHAPI_PROVIDER_DST}"
  cp "${TAVILY_PROVIDER_SRC}" "${TAVILY_PROVIDER_DST}"
  cp "${EXA_PROVIDER_SRC}" "${EXA_PROVIDER_DST}"
  cp "${WEBSEARCHAPI_EXTRACTOR_SRC}" "${WEBSEARCHAPI_EXTRACTOR_DST}"
  cp "${TAVILY_EXTRACTOR_SRC}" "${TAVILY_EXTRACTOR_DST}"
  cp "${EXA_EXTRACTOR_SRC}" "${EXA_EXTRACTOR_DST}"
  chmod 755 "${WEBSEARCH_DST}" "${WEBFETCH_DST}" "${FAILURE_POLICY_DST}" "${PROVIDER_CONFIG_DST}" "${SEARCH_PROVIDER_CONTRACT_DST}" "${SEARCH_PROVIDER_POLICY_DST}" "${EXTRACT_PROVIDER_CONTRACT_DST}" "${EXTRACT_PROVIDER_POLICY_DST}" "${WEBSEARCHAPI_PROVIDER_DST}" "${TAVILY_PROVIDER_DST}" "${EXA_PROVIDER_DST}" "${WEBSEARCHAPI_EXTRACTOR_DST}" "${TAVILY_EXTRACTOR_DST}" "${EXA_EXTRACTOR_DST}"

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

  printf 'Installed Claude Code hooks:\n'
  printf '  - %s\n' "${WEBSEARCH_DST}"
  printf '  - %s\n' "${WEBFETCH_DST}"
  printf 'Installed Claude Code shared helpers:\n'
  printf '  - %s\n' "${FAILURE_POLICY_DST}"
  printf '  - %s\n' "${PROVIDER_CONFIG_DST}"
  printf '  - %s\n' "${SEARCH_PROVIDER_CONTRACT_DST}"
  printf '  - %s\n' "${SEARCH_PROVIDER_POLICY_DST}"
  printf '  - %s\n' "${EXTRACT_PROVIDER_CONTRACT_DST}"
  printf '  - %s\n' "${EXTRACT_PROVIDER_POLICY_DST}"
  printf 'Installed Claude Code search provider adapters:\n'
  printf '  - %s\n' "${WEBSEARCHAPI_PROVIDER_DST}"
  printf '  - %s\n' "${TAVILY_PROVIDER_DST}"
  printf '  - %s\n' "${EXA_PROVIDER_DST}"
  printf 'Installed Claude Code extraction provider adapters:\n'
  printf '  - %s\n' "${WEBSEARCHAPI_EXTRACTOR_DST}"
  printf '  - %s\n' "${TAVILY_EXTRACTOR_DST}"
  printf '  - %s\n' "${EXA_EXTRACTOR_DST}"
  printf 'Updated Claude settings:\n'
  printf '  - %s\n' "${TARGET_SETTINGS}"
  printf 'Backup created:\n'
  printf '  - %s\n' "${BACKUP_DIR}/settings.${TIMESTAMP}.json"
fi

if [ "$INSTALL_COPILOT" -eq 1 ]; then
  mkdir -p "${TARGET_HOOK_DIR}" "${COPILOT_USER_HOOK_DIR}"
  cp "${COPILOT_WEBSEARCH_SRC}" "${COPILOT_WEBSEARCH_DST}"
  cp "${COPILOT_WEBFETCH_SRC}" "${COPILOT_WEBFETCH_DST}"
  chmod 755 "${COPILOT_WEBSEARCH_DST}" "${COPILOT_WEBFETCH_DST}"
  cat > "${COPILOT_HOOK_FILE}" <<EOF
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "node \"${COPILOT_WEBSEARCH_DST}\"",
        "timeout": 30
      },
      {
        "type": "command",
        "command": "node \"${COPILOT_WEBFETCH_DST}\"",
        "timeout": 30
      }
    ]
  }
}
EOF
  printf 'Installed Copilot compatibility hooks:\n'
  printf '  - %s\n' "${COPILOT_WEBSEARCH_DST}"
  printf '  - %s\n' "${COPILOT_WEBFETCH_DST}"
  printf 'Installed Copilot user hook config:\n'
  printf '  - %s\n' "${COPILOT_HOOK_FILE}"
  printf 'Workspace Copilot hook file available at:\n'
  printf '  - %s\n' "${WORKSPACE_COPILOT_HOOK_FILE}"
fi

printf '\nInstall target completed: %s\n' "$TARGET"
