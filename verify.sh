#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

printf '== Syntax checks ==\n'
node --check "${PROJECT_DIR}/hooks/shared/failure-policy.cjs"
node --check "${PROJECT_DIR}/hooks/shared/search-provider-contract.cjs"
node --check "${PROJECT_DIR}/hooks/shared/search-provider-policy.cjs"
node --check "${PROJECT_DIR}/hooks/shared/search-providers/websearchapi.cjs"
node --check "${PROJECT_DIR}/hooks/shared/search-providers/tavily.cjs"
node --check "${PROJECT_DIR}/hooks/websearch-custom.cjs"
node --check "${PROJECT_DIR}/hooks/webfetch-scraper.cjs"
bash -n "${PROJECT_DIR}/install.sh"
bash -n "${PROJECT_DIR}/uninstall.sh"

printf '\n== Example config check ==\n'
jq -e '.hooks.PreToolUse | length >= 2' "${PROJECT_DIR}/settings.example.json" >/dev/null

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

printf '\nAll checks passed.\n'
