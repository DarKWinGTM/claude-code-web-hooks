# WebSearch MCP Coexistence Patch

> **Current Version:** 0.1.0
> **Session:** 5abadc67-2a78-4337-97bd-a2a5fadd4e47
> **Status:** Draft
> **Target Design:** `design.md` v0.1.6
> **Full history:** `changelog.md`

---

## Context

`claude-code-web-hooks` currently owns native `WebSearch` substitution. In the checked local CCS + Claude Code environment, `mcp__ccs-websearch__WebSearch` is a separate MCP tool path that should remain executable and unblocked.

## Analysis

The repo needs an explicit coexistence contract so support for the CCS MCP path does not accidentally become ownership of that path.

## Change items

### 1. Add MCP pass-through hook
- **Target artifact:** `hooks/websearch-mcp-pass-through.cjs`
- **Change type:** additive
- **Before:** no explicit repo-owned MCP coexistence hook exists
- **After:** a dedicated allow-only hook exists for `mcp__ccs-websearch__WebSearch`

### 2. Preserve native ownership boundary
- **Target artifact:** `hooks/websearch-custom.cjs`
- **Change type:** replacement
- **Before:** native path only checks exact `WebSearch`
- **After:** native path still owns `WebSearch` only, with an explicit allow-through guard for the CCS MCP tool if encountered

### 3. Add optional install surface for MCP coexistence
- **Target artifact:** `install.sh`, `uninstall.sh`, `settings.example.json`
- **Change type:** restructuring
- **Before:** install/uninstall/settings examples only describe native `WebSearch` ownership
- **After:** optional MCP pass-through matcher can be installed and removed as a repo-owned coexistence helper without claiming unrelated user MCP config

### 4. Add verification coverage
- **Target artifact:** `verify.sh`
- **Change type:** additive
- **Before:** no explicit MCP coexistence verification exists
- **After:** verification proves pass-through, no block, and no double-search for `mcp__ccs-websearch__WebSearch`

### 5. Sync governance and user docs
- **Target artifact:** `design.md`, `README.md`, `TODO.md`, `changelog.md`, `phase/SUMMARY.md`, `phase/phase-010-stage-websearch-mcp-coexistence.md`
- **Change type:** replacement
- **Before:** docs do not describe the native/MCP coexistence boundary
- **After:** docs clearly distinguish native substitution from optional MCP pass-through coexistence

## Verification
- run `./verify.sh --target claude-code`
- run `./verify.sh --target all`
- manually confirm native `WebSearch` substitution still works
- manually confirm `mcp__ccs-websearch__WebSearch` continues normally without hook blocking

## Rollback approach
- remove only the MCP coexistence additions
- keep native `WebSearch` substitution path unchanged
- keep existing install/uninstall behavior for native hooks intact
