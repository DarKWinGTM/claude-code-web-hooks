# Hook Decision Transport Contract Patch

> **Current Version:** 0.1.10
> **Session:** 027eebcc-5949-4d4e-b8eb-594a499e06bf
> **Status:** Draft
> **Target Design:** `design.md` v0.1.10
> **Full history:** `changelog.md`

---

## Context

`claude-code-web-hooks` already emits JSON-based hook decisions for native `WebSearch` and `WebFetch`, but the checked `WebFetch` failure showed that a normal handled substitution path still exited non-zero. In Claude Code, that turns a valid handled decision into a hook-command error. The repo therefore needs an explicit source-owned contract that separates hook-process success from tool-decision ownership.

## Analysis

The safe fix is narrow and architectural rather than cosmetic: keep `hookSpecificOutput.permissionDecision` as the allow/deny owner, make handled decisions exit `0`, and reserve non-zero exit codes for actual hook-command failure rather than normal substitution. Because the bug was discovered first in an installed runtime copy, the patch also needs source-owned verification and install-surface sync so a future install does not silently reintroduce the regression.

## Change items

### 1. Normalize WebFetch handled substitution exit behavior
- **Target artifact:** `hooks/webfetch-scraper.cjs`
- **Change type:** replacement
- **Before:** extraction success emitted valid deny/substitution JSON and then exited non-zero
- **After:** extraction success emits the same deny/substitution JSON and exits `0`

### 2. Normalize WebSearch handled decision exit behavior
- **Target artifact:** `hooks/websearch-custom.cjs`
- **Change type:** replacement
- **Before:** handled success and handled deny/error paths exited non-zero even when they had already produced a complete hook decision
- **After:** handled decision paths emit the same JSON contract and exit `0`

### 3. Align source comments to the corrected contract
- **Target artifact:** `hooks/webfetch-scraper.cjs`, `hooks/websearch-custom.cjs`
- **Change type:** replacement
- **Before:** comments described exit-code ownership as if block/substitution required a non-zero process exit
- **After:** comments describe exit `0` as successful hook completion with JSON-controlled allow/deny behavior

### 4. Add verifier coverage for the decision transport contract
- **Target artifact:** `verify.sh`
- **Change type:** additive
- **Before:** verification covered syntax, fixtures, provider policy, and MCP coexistence, but not the direct handled-decision exit-code contract
- **After:** verification asserts that handled `WebSearch` success, handled `WebSearch` deny/error, and handled `WebFetch` substitution all emit JSON and exit `0`

### 5. Sync governed docs and install surfaces
- **Target artifact:** `README.md`, `design.md`, `changelog.md`, `TODO.md`, `phase/SUMMARY.md`, `phase/phase-011-normalize-hook-decision-transport-contract.md`
- **Change type:** replacement
- **Before:** source-owned docs did not explicitly capture the corrected hook-process-vs-decision contract
- **After:** the repo documents the normalized contract, verifier coverage, and source-first install/sync path

## Verification
- run `bash verify.sh --target claude-code`
- confirm the decision-transport verifier block reports exit code `0` for handled `WebSearch` success, handled `WebSearch` deny/error, and handled `WebFetch` substitution
- reinstall the Claude Code runtime hooks from source after verification passes
- confirm the runtime copy now comes from source rather than a runtime-only hotfix

## Rollback approach
- revert the source hook exit-contract edits and the verifier block together
- revert the governed doc/phase/patch sync if the contract change itself is rolled back
- reinstall the runtime hooks from the reverted source so runtime and repo state do not drift
