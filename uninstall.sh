#!/usr/bin/env bash
set -euo pipefail

TARGET="claude-code"
REMOVE_CCS_MCP_PASS_THROUGH=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --with-ccs-mcp-pass-through)
      REMOVE_CCS_MCP_PASS_THROUGH=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

case "$TARGET" in
  claude-code|copilot-vscode|copilot-cli|all) ;;
  *)
    echo "Unsupported target: $TARGET" >&2
    echo "Expected one of: claude-code, copilot-vscode, copilot-cli, all" >&2
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
WORKSPACE_COPILOT_HOOK_FILE="${PROJECT_DIR}/.github/hooks/claude-code-web-hooks.json"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

REMOVE_CLAUDE=0
REMOVE_COPILOT_VSCODE=0
REMOVE_COPILOT_CLI=0
case "$TARGET" in
  claude-code)
    REMOVE_CLAUDE=1
    ;;
  copilot-vscode)
    REMOVE_COPILOT_VSCODE=1
    ;;
  copilot-cli)
    REMOVE_COPILOT_CLI=1
    ;;
  all)
    REMOVE_CLAUDE=1
    REMOVE_COPILOT_VSCODE=1
    REMOVE_COPILOT_CLI=1
    ;;
esac

WEBSEARCH_DST="${TARGET_HOOK_DIR}/websearch-custom.cjs"
WEBSEARCH_MCP_PASS_THROUGH_DST="${TARGET_HOOK_DIR}/websearch-mcp-pass-through.cjs"
WEBSEARCH_MCP_COMPANION_DST="${TARGET_HOOK_DIR}/websearch-mcp-companion.cjs"
WEBFETCH_DST="${TARGET_HOOK_DIR}/webfetch-scraper.cjs"
FAILURE_POLICY_DST="${TARGET_SHARED_DIR}/failure-policy.cjs"
TOOL_NAMES_DST="${TARGET_SHARED_DIR}/tool-names.cjs"
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
COPILOT_WEBSEARCH_DST="${TARGET_HOOK_DIR}/copilot-websearch.cjs"
COPILOT_WEBFETCH_DST="${TARGET_HOOK_DIR}/copilot-webfetch.cjs"

mkdir -p "${BACKUP_DIR}"

if [ "$REMOVE_CLAUDE" -eq 1 ] && [ -f "${TARGET_SETTINGS}" ]; then
  cp "${TARGET_SETTINGS}" "${BACKUP_DIR}/settings.uninstall.${TIMESTAMP}.json"

  node - "${TARGET_SETTINGS}" "${REMOVE_CCS_MCP_PASS_THROUGH}" <<'NODE'
const fs = require('fs');
const settingsPath = process.argv[2];
const removeCcsMcpPassThrough = process.argv[3] === '1';
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

if (settings.hooks && Array.isArray(settings.hooks.PreToolUse)) {
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter((entry) => {
    if (!entry || !Array.isArray(entry.hooks) || typeof entry.matcher !== 'string') return true;
    const commands = entry.hooks
      .filter((hook) => hook && hook.type === 'command' && typeof hook.command === 'string')
      .map((hook) => hook.command);

    const ownsWebSearch = entry.matcher === 'WebSearch' && commands.some((cmd) => cmd.includes('websearch-custom.cjs'));
    const ownsWebFetch = entry.matcher === 'WebFetch' && commands.some((cmd) => cmd.includes('webfetch-scraper.cjs'));
    const ownsWebSearchMcpPassThrough = removeCcsMcpPassThrough && entry.matcher === 'mcp__ccs-websearch__WebSearch' && commands.some((cmd) => cmd.includes('websearch-mcp-pass-through.cjs'));
    return !(ownsWebSearch || ownsWebFetch || ownsWebSearchMcpPassThrough);
  });
}

if (settings.hooks && Array.isArray(settings.hooks.PostToolUse)) {
  settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter((entry) => {
    if (!entry || !Array.isArray(entry.hooks) || typeof entry.matcher !== 'string') return true;
    const commands = entry.hooks
      .filter((hook) => hook && hook.type === 'command' && typeof hook.command === 'string')
      .map((hook) => hook.command);

    const ownsWebSearchMcpCompanion = removeCcsMcpPassThrough && entry.matcher === 'mcp__ccs-websearch__WebSearch' && commands.some((cmd) => cmd.includes('websearch-mcp-companion.cjs'));
    return !ownsWebSearchMcpCompanion;
  });
}

if (settings.hooks && Array.isArray(settings.hooks.PostToolUseFailure)) {
  settings.hooks.PostToolUseFailure = settings.hooks.PostToolUseFailure.filter((entry) => {
    if (!entry || !Array.isArray(entry.hooks) || typeof entry.matcher !== 'string') return true;
    const commands = entry.hooks
      .filter((hook) => hook && hook.type === 'command' && typeof hook.command === 'string')
      .map((hook) => hook.command);

    const ownsWebSearchMcpFailureFallback = removeCcsMcpPassThrough && entry.matcher === 'mcp__ccs-websearch__WebSearch' && commands.some((cmd) => cmd.includes('websearch-mcp-companion.cjs'));
    return !ownsWebSearchMcpFailureFallback;
  });
}

fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
NODE
fi

if [ "$REMOVE_CLAUDE" -eq 1 ]; then
  rm -f "${WEBSEARCH_DST}" "${WEBFETCH_DST}" "${FAILURE_POLICY_DST}" "${TOOL_NAMES_DST}" "${PROVIDER_CONFIG_DST}" "${SEARCH_PROVIDER_CONTRACT_DST}" "${SEARCH_PROVIDER_POLICY_DST}" "${EXTRACT_PROVIDER_CONTRACT_DST}" "${EXTRACT_PROVIDER_POLICY_DST}" "${WEBSEARCHAPI_PROVIDER_DST}" "${TAVILY_PROVIDER_DST}" "${EXA_PROVIDER_DST}" "${WEBSEARCHAPI_EXTRACTOR_DST}" "${TAVILY_EXTRACTOR_DST}" "${EXA_EXTRACTOR_DST}"
  if [ "$REMOVE_CCS_MCP_PASS_THROUGH" -eq 1 ]; then
    rm -f "${WEBSEARCH_MCP_PASS_THROUGH_DST}" "${WEBSEARCH_MCP_COMPANION_DST}"
  fi

  printf 'Removed Claude Code hooks if present:\n'
  printf '  - %s\n' "${WEBSEARCH_DST}"
  printf '  - %s\n' "${WEBFETCH_DST}"
  if [ "$REMOVE_CCS_MCP_PASS_THROUGH" -eq 1 ]; then
    printf 'Removed optional CCS MCP pass-through hook if present:\n'
    printf '  - %s\n' "${WEBSEARCH_MCP_PASS_THROUGH_DST}"
    printf 'Removed optional CCS MCP PostToolUse companion hook if present:\n'
    printf '  - %s\n' "${WEBSEARCH_MCP_COMPANION_DST}"
    printf 'Removed optional CCS MCP PostToolUseFailure fallback hook if present through settings cleanup:\n'
    printf '  - matcher: mcp__ccs-websearch__WebSearch\n'
  fi
  printf 'Removed Claude Code shared helpers if present:\n'
  printf '  - %s\n' "${FAILURE_POLICY_DST}"
  printf '  - %s\n' "${TOOL_NAMES_DST}"
  printf '  - %s\n' "${PROVIDER_CONFIG_DST}"
  printf '  - %s\n' "${SEARCH_PROVIDER_CONTRACT_DST}"
  printf '  - %s\n' "${SEARCH_PROVIDER_POLICY_DST}"
  printf '  - %s\n' "${EXTRACT_PROVIDER_CONTRACT_DST}"
  printf '  - %s\n' "${EXTRACT_PROVIDER_POLICY_DST}"
  printf 'Removed Claude Code search provider adapters if present:\n'
  printf '  - %s\n' "${WEBSEARCHAPI_PROVIDER_DST}"
  printf '  - %s\n' "${TAVILY_PROVIDER_DST}"
  printf '  - %s\n' "${EXA_PROVIDER_DST}"
  printf 'Removed Claude Code extraction provider adapters if present:\n'
  printf '  - %s\n' "${WEBSEARCHAPI_EXTRACTOR_DST}"
  printf '  - %s\n' "${TAVILY_EXTRACTOR_DST}"
  printf '  - %s\n' "${EXA_EXTRACTOR_DST}"
  if [ -f "${TARGET_SETTINGS}" ]; then
    printf 'Updated Claude settings:\n'
    printf '  - %s\n' "${TARGET_SETTINGS}"
    printf 'Backup created:\n'
    printf '  - %s\n' "${BACKUP_DIR}/settings.uninstall.${TIMESTAMP}.json"
  fi
fi

if [ "$REMOVE_COPILOT_VSCODE" -eq 1 ]; then
  rm -f "${COPILOT_HOOK_FILE}"
  printf 'Removed Copilot user hook config if present:\n'
  printf '  - %s\n' "${COPILOT_HOOK_FILE}"
fi

if [ "$REMOVE_COPILOT_VSCODE" -eq 1 ] || [ "$REMOVE_COPILOT_CLI" -eq 1 ]; then
  rm -f "${COPILOT_WEBSEARCH_DST}" "${COPILOT_WEBFETCH_DST}"
  printf 'Removed legacy Copilot wrapper copies from ~/.claude/hooks if present:\n'
  printf '  - %s\n' "${COPILOT_WEBSEARCH_DST}"
  printf '  - %s\n' "${COPILOT_WEBFETCH_DST}"
fi

if [ "$REMOVE_COPILOT_CLI" -eq 1 ]; then
  printf 'Repo-scoped Copilot CLI hook file remains at:\n'
  printf '  - %s\n' "${WORKSPACE_COPILOT_HOOK_FILE}"
fi

printf '\nUninstall target completed: %s\n' "$TARGET"
