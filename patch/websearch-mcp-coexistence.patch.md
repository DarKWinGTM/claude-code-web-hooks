# WebSearch MCP Coexistence Patch

> **Current Version:** 0.2.0
> **Session:** 5abadc67-2a78-4337-97bd-a2a5fadd4e47
> **Status:** Draft
> **Target Design:** `design.md` v0.1.7
> **Full history:** `changelog.md`

---

## Context

`claude-code-web-hooks` currently owns native `WebSearch` substitution. In the checked local CCS + Claude Code environment, `mcp__ccs-websearch__WebSearch` is a separate MCP tool path that should remain executable and unblocked, but the user also wants the repo to contribute its own companion search results in the same visible outcome.

## Analysis

The repo needs an explicit coexistence contract so support for the CCS MCP path does not accidentally become ownership of that path. The safe supported shape is split across hook stages: `PreToolUse` must stay allow-only so CCS executes first, then `PostToolUse` can replace the visible MCP output with a combined payload that preserves the original CCS result and appends the repo companion result.

## Change items

### 1. Add MCP pass-through hook
- **Target artifact:** `hooks/websearch-mcp-pass-through.cjs`
- **Change type:** additive
- **Before:** no explicit repo-owned MCP coexistence hook exists
- **After:** a dedicated allow-only `PreToolUse` hook exists for `mcp__ccs-websearch__WebSearch`

### 2. Add MCP companion output hook
- **Target artifact:** `hooks/websearch-mcp-companion.cjs`
- **Change type:** additive
- **Before:** no repo-owned `PostToolUse` companion path exists for the CCS MCP tool
- **After:** a `PostToolUse` hook can preserve the original CCS MCP output and append a clearly labeled `claude-code-web-hooks` companion result via `updatedMCPToolOutput`

### 3. Preserve native ownership boundary
- **Target artifact:** `hooks/websearch-custom.cjs`
- **Change type:** replacement
- **Before:** native path only checks exact `WebSearch`
- **After:** native path still owns `WebSearch` only, with an explicit allow-through guard for the CCS MCP tool if encountered

### 4. Add optional install surface for MCP coexistence
- **Target artifact:** `install.sh`, `uninstall.sh`, `settings.example.json`
- **Change type:** restructuring
- **Before:** install/uninstall/settings examples only describe native `WebSearch` ownership
- **After:** optional MCP coexistence can install and remove a repo-owned hook pair (`PreToolUse` + `PostToolUse`) without claiming unrelated user MCP config

### 5. Add verification coverage
- **Target artifact:** `verify.sh`
- **Change type:** additive
- **Before:** no explicit MCP coexistence verification exists
- **After:** verification proves allow-only pass-through plus preserved-original-output and appended-companion-output behavior for `mcp__ccs-websearch__WebSearch`

### 6. Sync governance and user docs
- **Target artifact:** `design.md`, `README.md`, `TODO.md`, `changelog.md`, `phase/SUMMARY.md`, `phase/phase-010-stage-websearch-mcp-coexistence.md`
- **Change type:** replacement
- **Before:** docs do not describe the native/MCP coexistence boundary
- **After:** docs clearly distinguish native substitution from optional MCP coexistence with appended companion results

## Verification
- run `./verify.sh --target claude-code`
- run `./verify.sh --target all`
- manually confirm native `WebSearch` substitution still works
- manually confirm `mcp__ccs-websearch__WebSearch` continues normally without hook blocking
- manually confirm one MCP run can show both:
  - the original CCS MCP result
  - the appended `claude-code-web-hooks` companion result

## Rollback approach
- remove only the MCP coexistence additions
- keep native `WebSearch` substitution path unchanged
- keep existing install/uninstall behavior for native hooks intact
- if needed, roll back only the `PostToolUse` companion path first while preserving the allow-only `PreToolUse` pass-through matcher
