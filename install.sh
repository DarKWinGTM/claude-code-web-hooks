#!/usr/bin/env bash
set -euo pipefail

TARGET="claude-code"
INSTALL_CCS_MCP_PASS_THROUGH=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --with-ccs-mcp-pass-through)
      INSTALL_CCS_MCP_PASS_THROUGH=1
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

INSTALL_CLAUDE=0
INSTALL_COPILOT_WRAPPERS=0
INSTALL_COPILOT_VSCODE=0
INSTALL_COPILOT_CLI=0
case "$TARGET" in
  claude-code)
    INSTALL_CLAUDE=1
    ;;
  copilot-vscode)
    INSTALL_COPILOT_WRAPPERS=1
    INSTALL_COPILOT_VSCODE=1
    ;;
  copilot-cli)
    INSTALL_COPILOT_WRAPPERS=1
    INSTALL_COPILOT_CLI=1
    ;;
  all)
    INSTALL_CLAUDE=1
    INSTALL_COPILOT_WRAPPERS=1
    INSTALL_COPILOT_VSCODE=1
    INSTALL_COPILOT_CLI=1
    ;;
esac

WEBSEARCH_SRC="${PROJECT_DIR}/hooks/websearch-custom.cjs"
WEBFETCH_SRC="${PROJECT_DIR}/hooks/webfetch-scraper.cjs"
COPILOT_WEBSEARCH_SRC="${PROJECT_DIR}/hooks/copilot-websearch.cjs"
COPILOT_WEBFETCH_SRC="${PROJECT_DIR}/hooks/copilot-webfetch.cjs"
FAILURE_POLICY_SRC="${PROJECT_DIR}/hooks/shared/failure-policy.cjs"
TOOL_NAMES_SRC="${PROJECT_DIR}/hooks/shared/tool-names.cjs"
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
WEBSEARCH_MCP_PASS_THROUGH_SRC="${PROJECT_DIR}/hooks/websearch-mcp-pass-through.cjs"
WEBSEARCH_MCP_PASS_THROUGH_DST="${TARGET_HOOK_DIR}/websearch-mcp-pass-through.cjs"
WEBSEARCH_MCP_COMPANION_SRC="${PROJECT_DIR}/hooks/websearch-mcp-companion.cjs"
WEBSEARCH_MCP_COMPANION_DST="${TARGET_HOOK_DIR}/websearch-mcp-companion.cjs"
WEBFETCH_DST="${TARGET_HOOK_DIR}/webfetch-scraper.cjs"
COPILOT_WEBSEARCH_DST="${TARGET_HOOK_DIR}/copilot-websearch.cjs"
COPILOT_WEBFETCH_DST="${TARGET_HOOK_DIR}/copilot-webfetch.cjs"
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

mkdir -p "${BACKUP_DIR}"

if [ "$INSTALL_CLAUDE" -eq 1 ]; then
  mkdir -p "${TARGET_HOOK_DIR}" "${TARGET_SHARED_DIR}" "${TARGET_SEARCH_PROVIDER_DIR}" "${TARGET_EXTRACT_PROVIDER_DIR}"
  cp "${WEBSEARCH_SRC}" "${WEBSEARCH_DST}"
  if [ "$INSTALL_CCS_MCP_PASS_THROUGH" -eq 1 ]; then
    cp "${WEBSEARCH_MCP_PASS_THROUGH_SRC}" "${WEBSEARCH_MCP_PASS_THROUGH_DST}"
    cp "${WEBSEARCH_MCP_COMPANION_SRC}" "${WEBSEARCH_MCP_COMPANION_DST}"
  fi
  cp "${WEBFETCH_SRC}" "${WEBFETCH_DST}"
  cp "${FAILURE_POLICY_SRC}" "${FAILURE_POLICY_DST}"
  cp "${TOOL_NAMES_SRC}" "${TOOL_NAMES_DST}"
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
  chmod 755 "${WEBSEARCH_DST}" "${WEBFETCH_DST}" "${FAILURE_POLICY_DST}" "${TOOL_NAMES_DST}" "${PROVIDER_CONFIG_DST}" "${SEARCH_PROVIDER_CONTRACT_DST}" "${SEARCH_PROVIDER_POLICY_DST}" "${EXTRACT_PROVIDER_CONTRACT_DST}" "${EXTRACT_PROVIDER_POLICY_DST}" "${WEBSEARCHAPI_PROVIDER_DST}" "${TAVILY_PROVIDER_DST}" "${EXA_PROVIDER_DST}" "${WEBSEARCHAPI_EXTRACTOR_DST}" "${TAVILY_EXTRACTOR_DST}" "${EXA_EXTRACTOR_DST}"
  if [ "$INSTALL_CCS_MCP_PASS_THROUGH" -eq 1 ]; then
    chmod 755 "${WEBSEARCH_MCP_PASS_THROUGH_DST}" "${WEBSEARCH_MCP_COMPANION_DST}"
  fi

  if [ -f "${TARGET_SETTINGS}" ]; then
    cp "${TARGET_SETTINGS}" "${BACKUP_DIR}/settings.${TIMESTAMP}.json"
  else
    printf '{\n  "hooks": {\n    "PreToolUse": []\n  }\n}\n' > "${TARGET_SETTINGS}"
    cp "${TARGET_SETTINGS}" "${BACKUP_DIR}/settings.${TIMESTAMP}.json"
  fi

  node - "${TARGET_SETTINGS}" "${WEBSEARCH_DST}" "${WEBFETCH_DST}" "${WEBSEARCH_MCP_PASS_THROUGH_DST}" "${WEBSEARCH_MCP_COMPANION_DST}" "${INSTALL_CCS_MCP_PASS_THROUGH}" <<'NODE'
const fs = require('fs');
const settingsPath = process.argv[2];
const websearchHook = process.argv[3];
const webfetchHook = process.argv[4];
const websearchMcpPassThroughHook = process.argv[5];
const websearchMcpCompanionHook = process.argv[6];
const installCcsMcpPassThrough = process.argv[7] === '1';

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

const ensureHook = (matcher, command, timeout = 120) => {
  const existing = settings.hooks.PreToolUse.find((entry) => entry && entry.matcher === matcher);
  const hookObject = {
    matcher,
    hooks: [
      {
        type: 'command',
        command: `node \"${command}\"`,
        timeout,
      },
    ],
  };

  if (!existing) {
    settings.hooks.PreToolUse.push(hookObject);
    return;
  }

  existing.hooks = hookObject.hooks;
};

const ensureHookIfAbsent = (matcher, command, timeout = 30) => {
  const existing = settings.hooks.PreToolUse.find((entry) => entry && entry.matcher === matcher);
  if (existing) {
    return false;
  }
  ensureHook(matcher, command, timeout);
  return true;
};

ensureHook('WebSearch', websearchHook);
ensureHook('WebFetch', webfetchHook);
let installedCcsMcpPassThrough = false;
let preservedExistingCcsMcpMatcher = false;
let installedCcsMcpCompanion = false;
let preservedExistingCcsMcpPostToolUseMatcher = false;
let installedCcsMcpFailureFallback = false;
let preservedExistingCcsMcpPostToolUseFailureMatcher = false;
if (installCcsMcpPassThrough) {
  installedCcsMcpPassThrough = ensureHookIfAbsent('mcp__ccs-websearch__WebSearch', websearchMcpPassThroughHook, 30);
  preservedExistingCcsMcpMatcher = !installedCcsMcpPassThrough;

  if (!settings.hooks.PostToolUse || !Array.isArray(settings.hooks.PostToolUse)) {
    settings.hooks.PostToolUse = [];
  }
  const existingPostToolUse = settings.hooks.PostToolUse.find((entry) => entry && entry.matcher === 'mcp__ccs-websearch__WebSearch');
  if (!existingPostToolUse) {
    settings.hooks.PostToolUse.push({
      matcher: 'mcp__ccs-websearch__WebSearch',
      hooks: [
        {
          type: 'command',
          command: `node \"${websearchMcpCompanionHook}\"`,
          timeout: 120,
        },
      ],
    });
    installedCcsMcpCompanion = true;
  } else {
    preservedExistingCcsMcpPostToolUseMatcher = true;
  }

  if (!settings.hooks.PostToolUseFailure || !Array.isArray(settings.hooks.PostToolUseFailure)) {
    settings.hooks.PostToolUseFailure = [];
  }
  const existingPostToolUseFailure = settings.hooks.PostToolUseFailure.find((entry) => entry && entry.matcher === 'mcp__ccs-websearch__WebSearch');
  if (!existingPostToolUseFailure) {
    settings.hooks.PostToolUseFailure.push({
      matcher: 'mcp__ccs-websearch__WebSearch',
      hooks: [
        {
          type: 'command',
          command: `node \"${websearchMcpCompanionHook}\"`,
          timeout: 120,
        },
      ],
    });
    installedCcsMcpFailureFallback = true;
  } else {
    preservedExistingCcsMcpPostToolUseFailureMatcher = true;
  }
}

fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
if (installCcsMcpPassThrough) {
  if (installedCcsMcpPassThrough) {
    console.error('Installed optional CCS MCP pass-through matcher: mcp__ccs-websearch__WebSearch');
  } else if (preservedExistingCcsMcpMatcher) {
    console.error('Preserved existing matcher for: mcp__ccs-websearch__WebSearch');
  }

  if (installedCcsMcpCompanion) {
    console.error('Installed optional CCS MCP PostToolUse companion matcher: mcp__ccs-websearch__WebSearch');
  } else if (preservedExistingCcsMcpPostToolUseMatcher) {
    console.error('Preserved existing PostToolUse matcher for: mcp__ccs-websearch__WebSearch');
  }

  if (installedCcsMcpFailureFallback) {
    console.error('Installed optional CCS MCP PostToolUseFailure fallback matcher: mcp__ccs-websearch__WebSearch');
  } else if (preservedExistingCcsMcpPostToolUseFailureMatcher) {
    console.error('Preserved existing PostToolUseFailure matcher for: mcp__ccs-websearch__WebSearch');
  }
}
NODE

  printf 'Installed Claude Code hooks:\n'
  printf '  - %s\n' "${WEBSEARCH_DST}"
  printf '  - %s\n' "${WEBFETCH_DST}"
  if [ "$INSTALL_CCS_MCP_PASS_THROUGH" -eq 1 ]; then
    printf 'Optional CCS MCP pass-through hook available at:\n'
    printf '  - %s\n' "${WEBSEARCH_MCP_PASS_THROUGH_DST}"
    printf 'Optional CCS MCP PostToolUse companion hook available at:\n'
    printf '  - %s\n' "${WEBSEARCH_MCP_COMPANION_DST}"
  fi
  printf 'Installed Claude Code shared helpers:\n'
  printf '  - %s\n' "${FAILURE_POLICY_DST}"
  printf '  - %s\n' "${TOOL_NAMES_DST}"
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
  if [ "$INSTALL_CCS_MCP_PASS_THROUGH" -eq 1 ]; then
    printf 'CCS MCP coexistence matcher handling:\n'
    printf '  - matcher: mcp__ccs-websearch__WebSearch\n'
    printf '  - PreToolUse mode: allow-only pass-through\n'
    printf '  - PostToolUse mode: MCP output replacement with appended claude-code-web-hooks companion results\n'
    printf '  - PostToolUseFailure mode: additional fallback context with provider-backed results when CCS MCP search fails\n'
  fi
  printf 'Backup created:\n'
  printf '  - %s\n' "${BACKUP_DIR}/settings.${TIMESTAMP}.json"
fi

if [ "$INSTALL_COPILOT_WRAPPERS" -eq 1 ]; then
  mkdir -p "${TARGET_HOOK_DIR}"
  cp "${COPILOT_WEBSEARCH_SRC}" "${COPILOT_WEBSEARCH_DST}"
  cp "${COPILOT_WEBFETCH_SRC}" "${COPILOT_WEBFETCH_DST}"
  chmod 755 "${COPILOT_WEBSEARCH_DST}" "${COPILOT_WEBFETCH_DST}"
  printf 'Installed Copilot compatibility hooks:\n'
  printf '  - %s\n' "${COPILOT_WEBSEARCH_DST}"
  printf '  - %s\n' "${COPILOT_WEBFETCH_DST}"
fi

if [ "$INSTALL_COPILOT_VSCODE" -eq 1 ]; then
  mkdir -p "${COPILOT_USER_HOOK_DIR}"
  cat > "${COPILOT_HOOK_FILE}" <<EOF
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "type": "command",
        "bash": "node \"${COPILOT_WEBSEARCH_DST}\"",
        "powershell": "node \"${COPILOT_WEBSEARCH_DST}\"",
        "timeoutSec": 30
      },
      {
        "type": "command",
        "bash": "node \"${COPILOT_WEBFETCH_DST}\"",
        "powershell": "node \"${COPILOT_WEBFETCH_DST}\"",
        "timeoutSec": 30
      }
    ]
  }
}
EOF
  printf 'Installed Copilot user hook config:\n'
  printf '  - %s\n' "${COPILOT_HOOK_FILE}"
fi

if [ "$INSTALL_COPILOT_VSCODE" -eq 1 ] || [ "$INSTALL_COPILOT_CLI" -eq 1 ]; then
  printf 'Workspace Copilot hook file available at:\n'
  printf '  - %s\n' "${WORKSPACE_COPILOT_HOOK_FILE}"
fi

if [ "$INSTALL_COPILOT_CLI" -eq 1 ]; then
  if [ ! -f "${WORKSPACE_COPILOT_HOOK_FILE}" ]; then
    echo "Missing repo-scoped Copilot CLI hook file: ${WORKSPACE_COPILOT_HOOK_FILE}" >&2
    exit 1
  fi
  printf 'Copilot CLI uses the repo-scoped hook config above when run from this repository.\n'
fi

printf '\nInstall target completed: %s\n' "$TARGET"
