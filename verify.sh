#!/usr/bin/env bash
set -euo pipefail

TARGET="all"
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
  claude-code|copilot-vscode|copilot-cli|all) ;;
  *)
    echo "Unsupported target: $TARGET" >&2
    echo "Expected one of: claude-code, copilot-vscode, copilot-cli, all" >&2
    exit 1
    ;;
esac

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERIFY_CLAUDE=0
VERIFY_COPILOT_VSCODE=0
VERIFY_COPILOT_CLI=0
case "$TARGET" in
  claude-code)
    VERIFY_CLAUDE=1
    ;;
  copilot-vscode)
    VERIFY_COPILOT_VSCODE=1
    ;;
  copilot-cli)
    VERIFY_COPILOT_CLI=1
    ;;
  all)
    VERIFY_CLAUDE=1
    VERIFY_COPILOT_VSCODE=1
    VERIFY_COPILOT_CLI=1
    ;;
esac

printf '== Syntax checks ==\n'
node --check "${PROJECT_DIR}/hooks/shared/failure-policy.cjs"
node --check "${PROJECT_DIR}/hooks/shared/tool-names.cjs"
node --check "${PROJECT_DIR}/hooks/shared/provider-config.cjs"
node --check "${PROJECT_DIR}/hooks/shared/search-provider-contract.cjs"
node --check "${PROJECT_DIR}/hooks/shared/search-provider-policy.cjs"
node --check "${PROJECT_DIR}/hooks/shared/extract-provider-contract.cjs"
node --check "${PROJECT_DIR}/hooks/shared/extract-provider-policy.cjs"
node --check "${PROJECT_DIR}/hooks/shared/search-providers/websearchapi.cjs"
node --check "${PROJECT_DIR}/hooks/shared/search-providers/tavily.cjs"
node --check "${PROJECT_DIR}/hooks/shared/search-providers/exa.cjs"
node --check "${PROJECT_DIR}/hooks/shared/extract-providers/websearchapi.cjs"
node --check "${PROJECT_DIR}/hooks/shared/extract-providers/tavily.cjs"
node --check "${PROJECT_DIR}/hooks/shared/extract-providers/exa.cjs"
node --check "${PROJECT_DIR}/hooks/websearch-custom.cjs"
node --check "${PROJECT_DIR}/hooks/websearch-mcp-pass-through.cjs"
node --check "${PROJECT_DIR}/hooks/websearch-mcp-companion.cjs"
node --check "${PROJECT_DIR}/hooks/webfetch-scraper.cjs"
if [ "$VERIFY_COPILOT_VSCODE" -eq 1 ] || [ "$VERIFY_COPILOT_CLI" -eq 1 ]; then
  node --check "${PROJECT_DIR}/hooks/copilot-websearch.cjs"
  node --check "${PROJECT_DIR}/hooks/copilot-webfetch.cjs"
fi
bash -n "${PROJECT_DIR}/install.sh"
bash -n "${PROJECT_DIR}/uninstall.sh"

printf '\n== Example config check ==\n'
PROJECT_DIR_ENV="${PROJECT_DIR}" VERIFY_COPILOT_VSCODE_ENV="$VERIFY_COPILOT_VSCODE" VERIFY_COPILOT_CLI_ENV="$VERIFY_COPILOT_CLI" node - <<'NODE'
const fs = require('fs');
const path = require('path');
const projectDir = process.env.PROJECT_DIR_ENV;
const verifyCopilotVsCode = process.env.VERIFY_COPILOT_VSCODE_ENV === '1';
const verifyCopilotCli = process.env.VERIFY_COPILOT_CLI_ENV === '1';
const settings = JSON.parse(fs.readFileSync(path.join(projectDir, 'settings.example.json'), 'utf8'));
const summary = {
  claudeHookCount: Array.isArray(settings?.hooks?.PreToolUse) ? settings.hooks.PreToolUse.length : 0,
  ccsMcpPreToolUseHookCount: 0,
  ccsMcpPostToolUseHookCount: 0,
  ccsMcpPostToolUseFailureHookCount: 0,
  copilotUserHookCount: 0,
  copilotCliHookCount: 0,
};
if (!Array.isArray(settings?.hooks?.PreToolUse) || settings.hooks.PreToolUse.length < 2) {
  throw new Error('settings.example.json missing Claude PreToolUse hooks');
}
const ccsMcpPreToolUse = settings?.ccsMcpHooksExample?.hooks?.PreToolUse;
if (!Array.isArray(ccsMcpPreToolUse) || ccsMcpPreToolUse.length < 1) {
  throw new Error('settings.example.json missing CCS MCP pass-through hook example');
}
summary.ccsMcpPreToolUseHookCount = ccsMcpPreToolUse.length;
const ccsMcpPostToolUse = settings?.ccsMcpHooksExample?.hooks?.PostToolUse;
if (!Array.isArray(ccsMcpPostToolUse) || ccsMcpPostToolUse.length < 1) {
  throw new Error('settings.example.json missing CCS MCP companion PostToolUse hook example');
}
summary.ccsMcpPostToolUseHookCount = ccsMcpPostToolUse.length;
const ccsMcpPostToolUseFailure = settings?.ccsMcpHooksExample?.hooks?.PostToolUseFailure;
if (!Array.isArray(ccsMcpPostToolUseFailure) || ccsMcpPostToolUseFailure.length < 1) {
  throw new Error('settings.example.json missing CCS MCP failure-fallback PostToolUseFailure hook example');
}
summary.ccsMcpPostToolUseFailureHookCount = ccsMcpPostToolUseFailure.length;
if (verifyCopilotVsCode) {
  const preToolUse = settings?.copilotHooksExample?.hooks?.preToolUse;
  if (settings?.copilotHooksExample?.version !== 1 || !Array.isArray(preToolUse) || preToolUse.length < 2) {
    throw new Error('settings.example.json missing Copilot user hook example');
  }
  summary.copilotUserHookCount = preToolUse.length;
}
if (verifyCopilotCli) {
  const repoHookFile = JSON.parse(fs.readFileSync(path.join(projectDir, '.github/hooks/claude-code-web-hooks.json'), 'utf8'));
  const preToolUse = repoHookFile?.hooks?.preToolUse;
  if (repoHookFile?.version !== 1 || !Array.isArray(preToolUse) || preToolUse.length < 2) {
    throw new Error('.github/hooks/claude-code-web-hooks.json missing Copilot CLI preToolUse hooks');
  }
  summary.copilotCliHookCount = preToolUse.length;
}
console.log(JSON.stringify(summary, null, 2));
NODE

printf '\n== Fixture classification check ==\n'
PROJECT_DIR_ENV="${PROJECT_DIR}" node - <<'NODE'
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const projectDir = process.env.PROJECT_DIR_ENV;
const hookPath = path.join(projectDir, 'hooks/webfetch-scraper.cjs');
const code = fs.readFileSync(hookPath, 'utf8');
const hookRequire = createRequire(hookPath);
const sandbox = {
  require: hookRequire,
  console: { log() {}, error() {} },
  process: { env: {}, stdin: { setEncoding() {}, on() {} }, exit() {}, cwd: () => projectDir },
  Buffer,
  URL,
  Math,
  Set,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const article = fs.readFileSync(path.join(projectDir, 'fixtures/article-readable.html'), 'utf8');
const template = fs.readFileSync(path.join(projectDir, 'fixtures/template-heavy.html'), 'utf8');
const shell = fs.readFileSync(path.join(projectDir, 'fixtures/browser-shell.html'), 'utf8');
const out = {
  article: sandbox.detectRenderingMode('https://example.com/article', article).classification,
  template: sandbox.detectRenderingMode('https://www.sanook.com/news/', template).classification,
  shell: sandbox.detectRenderingMode('https://example.com/app', shell).classification,
};
console.log(JSON.stringify(out, null, 2));
if (out.article !== 'fetch-readable') throw new Error('article fixture misclassified');
if (out.template !== 'template-heavy') throw new Error('template fixture misclassified');
if (out.shell !== 'browser-render-required') throw new Error('shell fixture misclassified');
NODE

printf '\n== Failure policy check ==\n'
FAILURE_POLICY_PATH="${PROJECT_DIR}/hooks/shared/failure-policy.cjs" node - <<'NODE'
const { classifyProviderFailure, shouldAllowNativeFallback } = require(process.env.FAILURE_POLICY_PATH);
const checks = [
  'Invalid API key',
  'quota exceeded',
  'Gateway timeout',
  'some unknown provider error',
];
const out = checks.map((error) => ({ error, class: classifyProviderFailure(error), allow: shouldAllowNativeFallback(error) }));
console.log(JSON.stringify(out, null, 2));
if (!out.every((item) => item.allow === true)) {
  throw new Error('failure policy is not fully permissive');
}
NODE

printf '\n== Search provider policy check ==\n'
PROJECT_DIR_ENV="${PROJECT_DIR}" node - <<'NODE'
const path = require('path');
const projectDir = process.env.PROJECT_DIR_ENV;
const policyPath = path.join(projectDir, 'hooks/shared/search-provider-policy.cjs');
const tavilyPath = path.join(projectDir, 'hooks/shared/search-providers/tavily.cjs');
const websearchapiPath = path.join(projectDir, 'hooks/shared/search-providers/websearchapi.cjs');

process.env.CLAUDE_WEB_HOOKS_SEARCH_MODE = 'parallel';
process.env.CLAUDE_WEB_HOOKS_SEARCH_PROVIDERS = 'tavily,websearchapi';
process.env.TAVILY_API_KEY = 'dummy';
process.env.WEBSEARCHAPI_API_KEY = 'dummy';

const tavily = require(tavilyPath);
const websearchapi = require(websearchapiPath);
const { executeSearchProviderPolicy } = require(policyPath);

tavily.search = async ({ query }) => ({ ok: true, result: { provider: 'tavily', providerLabel: 'Tavily', query, items: [{ title: 'T', url: 'https://t.example', summary: 't' }] } });
websearchapi.search = async ({ query }) => ({ ok: false, error: 'quota exceeded', provider: 'websearchapi' });

(async () => {
  const out = await executeSearchProviderPolicy({ query: 'verify parallel', debugLog: () => {} });
  console.log(JSON.stringify({
    available: typeof executeSearchProviderPolicy === 'function',
    mode: out.mode,
    successCount: out.successes.length,
    failureCount: out.failures.length,
    firstSuccessProvider: out.successes[0]?.provider || null
  }, null, 2));
  if (typeof executeSearchProviderPolicy !== 'function') throw new Error('search provider policy helper not available');
  if (out.mode !== 'parallel') throw new Error('parallel mode not applied');
  if (out.successes.length !== 1) throw new Error('parallel success aggregation is incorrect');
  if (out.failures.length !== 1) throw new Error('parallel failure aggregation is incorrect');
})();
NODE

printf '\n== CCS MCP WebSearch coexistence checks ==\n'
PROJECT_DIR_ENV="${PROJECT_DIR}" node - <<'NODE'
const path = require('path');
const { spawnSync } = require('child_process');
const { buildMcpCompanionHookOutput } = require(path.join(process.env.PROJECT_DIR_ENV, 'hooks/websearch-mcp-companion.cjs'));
const projectDir = process.env.PROJECT_DIR_ENV;
const passThroughScriptPath = path.join(projectDir, 'hooks/websearch-mcp-pass-through.cjs');
const successPayload = {
  tool_name: 'mcp__ccs-websearch__WebSearch',
  hook_event_name: 'PostToolUse',
  tool_input: {
    query: 'latest ccs docs',
  },
  tool_response: 'Provider: DuckDuckGo\nResult count: 1\n1. CCS result\nURL: https://example.com/ccs\n',
};
const failurePayload = {
  tool_name: 'mcp__ccs-websearch__WebSearch',
  hook_event_name: 'PostToolUseFailure',
  tool_input: {
    query: 'latest ccs docs',
  },
  error: 'CCS local WebSearch failed ... DuckDuckGo returned non-result HTML response (possible anti-bot/challenge page) (status 202)',
};
const child = spawnSync('node', [passThroughScriptPath], {
  input: JSON.stringify(successPayload),
  encoding: 'utf8',
  env: process.env,
});
if (typeof child.status !== 'number') throw new Error('CCS MCP pass-through hook did not exit cleanly');
const parsed = JSON.parse(String(child.stdout || '').trim() || '{}');
if (parsed?.hookSpecificOutput?.permissionDecision !== 'allow') {
  throw new Error('CCS MCP pass-through hook did not allow MCP tool execution');
}
if (parsed?.hookSpecificOutput?.permissionDecisionReason) {
  throw new Error('CCS MCP pass-through hook should not substitute MCP results');
}

(async () => {
  const executePolicy = async ({ query }) => ({
    success: true,
    successes: [
      {
        provider: 'tavily',
        providerLabel: 'Tavily',
        query,
        items: [
          {
            title: 'Companion result',
            url: 'https://example.com/companion',
            summary: 'companion summary',
          },
        ],
      },
    ],
    failures: [
      {
        provider: 'websearchapi',
        error: 'quota exceeded',
      },
    ],
  });

  const companion = await buildMcpCompanionHookOutput(successPayload, {
    searchProvidersConfigured: true,
    executePolicy,
  });

  if (!companion?.hookSpecificOutput?.updatedMCPToolOutput) {
    throw new Error('CCS MCP companion hook did not return updatedMCPToolOutput');
  }
  if (companion?.hookSpecificOutput?.hookEventName !== 'PostToolUse') {
    throw new Error('CCS MCP companion hook did not identify itself as PostToolUse');
  }
  if (!companion.hookSpecificOutput.updatedMCPToolOutput.includes('[CCS MCP WebSearch Result]')) {
    throw new Error('CCS MCP companion output did not preserve original MCP result section');
  }
  if (!companion.hookSpecificOutput.updatedMCPToolOutput.includes('[claude-code-web-hooks Companion Result]')) {
    throw new Error('CCS MCP companion output did not append companion result section');
  }
  if (!companion.hookSpecificOutput.updatedMCPToolOutput.includes('Companion result')) {
    throw new Error('CCS MCP companion output did not include companion search content');
  }

  const failureCompanion = await buildMcpCompanionHookOutput(failurePayload, {
    searchProvidersConfigured: true,
    executePolicy,
  });
  if (!failureCompanion?.hookSpecificOutput?.additionalContext) {
    throw new Error('CCS MCP failure companion hook did not return additionalContext');
  }
  if (failureCompanion?.hookSpecificOutput?.hookEventName !== 'PostToolUseFailure') {
    throw new Error('CCS MCP failure companion hook did not identify itself as PostToolUseFailure');
  }
  if (!failureCompanion.hookSpecificOutput.additionalContext.includes('[claude-code-web-hooks Failure Fallback]')) {
    throw new Error('CCS MCP failure fallback did not emit failure fallback context');
  }
  if (!failureCompanion.hookSpecificOutput.additionalContext.includes('Use the fallback result below as the replacement search context for this turn.')) {
    throw new Error('CCS MCP failure fallback did not include the result-first summary guidance');
  }
  if (!failureCompanion.hookSpecificOutput.additionalContext.includes('[Original CCS MCP Error]')) {
    throw new Error('CCS MCP failure fallback did not preserve original error context');
  }
  if (!failureCompanion.hookSpecificOutput.additionalContext.includes('[claude-code-web-hooks Fallback Result]')) {
    throw new Error('CCS MCP failure fallback did not include fallback result section');
  }
  if (
    failureCompanion.hookSpecificOutput.additionalContext.indexOf('[claude-code-web-hooks Fallback Result]') >
    failureCompanion.hookSpecificOutput.additionalContext.indexOf('[Original CCS MCP Error]')
  ) {
    throw new Error('CCS MCP failure fallback did not surface the fallback result before the original error block');
  }

  const skipped = await buildMcpCompanionHookOutput(successPayload, {
    searchProvidersConfigured: false,
  });
  if (skipped !== null) {
    throw new Error('CCS MCP companion hook should skip output when no provider key is configured');
  }

  console.log(JSON.stringify({
    passThroughStatus: child.status,
    permissionDecision: parsed.hookSpecificOutput.permissionDecision,
    successCompanionOutputMode: 'updatedMCPToolOutput',
    failureCompanionOutputMode: 'additionalContext',
  }, null, 2));
})();
NODE

printf '\n== WebFetch extraction provider policy check ==\n'
PROJECT_DIR_ENV="${PROJECT_DIR}" node - <<'NODE'
const path = require('path');
const projectDir = process.env.PROJECT_DIR_ENV;
const policyPath = path.join(projectDir, 'hooks/shared/extract-provider-policy.cjs');
const websearchapiPath = path.join(projectDir, 'hooks/shared/extract-providers/websearchapi.cjs');
const tavilyPath = path.join(projectDir, 'hooks/shared/extract-providers/tavily.cjs');
const exaPath = path.join(projectDir, 'hooks/shared/extract-providers/exa.cjs');

const websearchapi = require(websearchapiPath);
const tavily = require(tavilyPath);
const exa = require(exaPath);
const { executeExtractProviderPolicy } = require(policyPath);

const makeResult = (provider, label) => ({
  ok: true,
  result: {
    provider,
    providerLabel: label,
    url: 'https://example.com',
    finalUrl: 'https://example.com',
    title: `${label} title`,
    content: `${label} content`,
    contentFormat: 'markdown',
    raw: null,
  },
});

(async () => {
  process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_MODE = 'fallback';
  process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_PROVIDERS = 'websearchapi,tavily,exa';
  process.env.WEBSEARCHAPI_API_KEY = 'w';
  process.env.TAVILY_API_KEY = 't';
  process.env.EXA_API_KEY = 'e';

  websearchapi.extract = async () => ({ ok: false, error: 'quota exceeded' });
  tavily.extract = async () => makeResult('tavily', 'Tavily Extract');
  exa.extract = async () => makeResult('exa', 'Exa Contents');

  process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_PRIMARY = 'websearchapi';
  const primaryWebsearchapi = await executeExtractProviderPolicy({ url: 'https://example.com', debugLog: () => {} });
  if (!primaryWebsearchapi.success) throw new Error('PRIMARY=websearchapi should fallback to next provider');
  if (primaryWebsearchapi.result.provider !== 'tavily') throw new Error('PRIMARY=websearchapi fallback order incorrect');

  process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_PRIMARY = 'tavily';
  const primaryTavily = await executeExtractProviderPolicy({ url: 'https://example.com', debugLog: () => {} });
  if (!primaryTavily.success || primaryTavily.result.provider !== 'tavily') throw new Error('PRIMARY=tavily should succeed first');

  tavily.extract = async () => ({ ok: false, error: 'timeout' });
  exa.extract = async () => makeResult('exa', 'Exa Contents');
  process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_PRIMARY = 'exa';
  const primaryExa = await executeExtractProviderPolicy({ url: 'https://example.com', debugLog: () => {} });
  if (!primaryExa.success || primaryExa.result.provider !== 'exa') throw new Error('PRIMARY=exa should succeed first');

  delete process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_PRIMARY;
  const originalRandom = Math.random;
  Math.random = () => 0.99;
  const randomSelection = await executeExtractProviderPolicy({ url: 'https://example.com', debugLog: () => {} });
  Math.random = originalRandom;
  if (!randomSelection.success || randomSelection.selectedProvider !== 'exa') throw new Error('random selection should choose available provider when PRIMARY is unset');

  websearchapi.extract = async () => ({ ok: false, error: 'quota exceeded' });
  tavily.extract = async () => ({ ok: false, error: 'timeout' });
  exa.extract = async () => ({ ok: false, error: 'auth failed' });
  process.env.CLAUDE_WEB_HOOKS_WEBFETCH_EXTRACT_PRIMARY = 'websearchapi';
  const allFail = await executeExtractProviderPolicy({ url: 'https://example.com', debugLog: () => {} });
  if (allFail.success) throw new Error('all providers failing should not report success');
  if (allFail.failures.length !== 3) throw new Error('all provider failures should be captured');

  console.log(JSON.stringify({
    available: typeof executeExtractProviderPolicy === 'function',
    primaryWebsearchapiWinner: primaryWebsearchapi.result.provider,
    primaryTavilyWinner: primaryTavily.result.provider,
    primaryExaWinner: primaryExa.result.provider,
    randomSelectedProvider: randomSelection.selectedProvider,
    allFailureCount: allFail.failures.length,
  }, null, 2));
})();
NODE

if [ "$VERIFY_COPILOT_VSCODE" -eq 1 ]; then
  printf '\n== Copilot VS Code wrapper check ==\n'
  PROJECT_DIR_ENV="${PROJECT_DIR}" node - <<'NODE'
const path = require('path');
const { spawnSync } = require('child_process');
const projectDir = process.env.PROJECT_DIR_ENV;
const scriptPath = path.join(projectDir, 'hooks/copilot-webfetch.cjs');
const payload = JSON.stringify({
  tool_name: 'fetchWebPage',
  tool_input: {
    uri: 'https://example.com',
    prompt: 'read page',
  },
  tool_use_id: 'tool-123',
});
const child = spawnSync('node', [scriptPath], {
  input: payload,
  encoding: 'utf8',
  env: {
    ...process.env,
    COPILOT_WEBFETCH_TOOL_NAMES: 'fetchWebPage,readWebPage',
  },
});
if (typeof child.status !== 'number') throw new Error('Copilot VS Code wrapper did not exit cleanly');
const parsed = JSON.parse(String(child.stdout || '').trim() || '{}');
if (!parsed.hookSpecificOutput || !parsed.hookSpecificOutput.permissionDecision) {
  throw new Error('Copilot VS Code wrapper did not return Claude/VS Code hook output');
}
console.log(JSON.stringify({ status: child.status, permissionDecision: parsed.hookSpecificOutput.permissionDecision }, null, 2));
NODE
fi

if [ "$VERIFY_COPILOT_CLI" -eq 1 ]; then
  printf '\n== Copilot CLI wrapper check ==\n'
  PROJECT_DIR_ENV="${PROJECT_DIR}" node - <<'NODE'
const path = require('path');
const { spawnSync } = require('child_process');
const projectDir = process.env.PROJECT_DIR_ENV;
const scriptPath = path.join(projectDir, 'hooks/copilot-webfetch.cjs');
const payload = JSON.stringify({
  toolName: 'fetchWebPage',
  toolArgs: JSON.stringify({
    uri: 'https://example.com',
    prompt: 'read page',
  }),
});
const child = spawnSync('node', [scriptPath], {
  input: payload,
  encoding: 'utf8',
  env: {
    ...process.env,
    COPILOT_CLI_WEBFETCH_TOOL_NAMES: 'fetchWebPage,readWebPage',
  },
});
if (typeof child.status !== 'number') throw new Error('Copilot CLI wrapper did not exit cleanly');
const parsed = JSON.parse(String(child.stdout || '').trim() || '{}');
if (!parsed.permissionDecision) {
  throw new Error('Copilot CLI wrapper did not return CLI permission output');
}
console.log(JSON.stringify({ status: child.status, permissionDecision: parsed.permissionDecision }, null, 2));
NODE
fi

printf '\nAll checks passed for target: %s\n' "$TARGET"
