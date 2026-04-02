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
  claude-code|copilot-vscode|all) ;;
  *)
    echo "Unsupported target: $TARGET" >&2
    echo "Expected one of: claude-code, copilot-vscode, all" >&2
    exit 1
    ;;
esac

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERIFY_CLAUDE=0
VERIFY_COPILOT=0
case "$TARGET" in
  claude-code)
    VERIFY_CLAUDE=1
    ;;
  copilot-vscode)
    VERIFY_COPILOT=1
    ;;
  all)
    VERIFY_CLAUDE=1
    VERIFY_COPILOT=1
    ;;
esac

printf '== Syntax checks ==\n'
node --check "${PROJECT_DIR}/hooks/shared/failure-policy.cjs"
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
node --check "${PROJECT_DIR}/hooks/webfetch-scraper.cjs"
if [ "$VERIFY_COPILOT" -eq 1 ]; then
  node --check "${PROJECT_DIR}/hooks/copilot-websearch.cjs"
  node --check "${PROJECT_DIR}/hooks/copilot-webfetch.cjs"
fi
bash -n "${PROJECT_DIR}/install.sh"
bash -n "${PROJECT_DIR}/uninstall.sh"

printf '\n== Example config check ==\n'
PROJECT_DIR_ENV="${PROJECT_DIR}" VERIFY_COPILOT_ENV="$VERIFY_COPILOT" node - <<'NODE'
const fs = require('fs');
const path = require('path');
const projectDir = process.env.PROJECT_DIR_ENV;
const verifyCopilot = process.env.VERIFY_COPILOT_ENV === '1';
const settings = JSON.parse(fs.readFileSync(path.join(projectDir, 'settings.example.json'), 'utf8'));
if (!Array.isArray(settings?.hooks?.PreToolUse) || settings.hooks.PreToolUse.length < 2) {
  throw new Error('settings.example.json missing Claude PreToolUse hooks');
}
if (verifyCopilot) {
  if (!Array.isArray(settings?.copilotHooksExample?.hooks?.PreToolUse) || settings.copilotHooksExample.hooks.PreToolUse.length < 2) {
    throw new Error('settings.example.json missing Copilot PreToolUse hook example');
  }
}
console.log(JSON.stringify({ claudeHookCount: settings.hooks.PreToolUse.length, copilotHookCount: settings?.copilotHooksExample?.hooks?.PreToolUse?.length || 0 }, null, 2));
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

if [ "$VERIFY_COPILOT" -eq 1 ]; then
  printf '\n== Copilot wrapper check ==\n'
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
if (typeof child.status !== 'number') throw new Error('Copilot wrapper did not exit cleanly');
console.log(JSON.stringify({ status: child.status, stdoutPresent: !!child.stdout }, null, 2));
NODE
fi

printf '\nAll checks passed for target: %s\n' "$TARGET"
