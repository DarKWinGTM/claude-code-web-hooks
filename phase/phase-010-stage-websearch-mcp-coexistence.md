# Phase 010 - Stage WebSearch MCP Coexistence

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P10
> **Status:** In Progress
> **Design References:** `design.md` sections: WebSearch hook, Fallback Philosophy, Installation Model
> **Patch References:** `patch/websearch-mcp-coexistence.patch.md`

---

## Objective

Add explicit, non-blocking coexistence support for the CCS MCP tool `mcp__ccs-websearch__WebSearch` without changing ownership of the native `WebSearch` substitution path, while allowing one MCP run to surface both the original CCS result and a `claude-code-web-hooks` companion result.

## Why this phase exists

The project currently owns native Claude `WebSearch` substitution only. In the checked local CCS + Claude Code setup, a separate MCP tool path also exists for CCS-managed web search. This slice exists so the repo can recognize that MCP path safely without blocking CCS execution, while still appending a second provider-backed companion result after the MCP tool completes.

## Design extraction
- Source design: native `WebSearch` substitution should remain exact-name scoped and fallback-permissive.
- Derived execution work: add a dedicated allow-only `PreToolUse` companion hook plus a `PostToolUse` MCP-output replacement hook for the CCS MCP tool, keep install behavior non-owning, and document the coexistence boundary clearly.
- Target outcome: native `WebSearch` and CCS MCP WebSearch can coexist in one user environment without authority confusion, while one MCP run can surface both outputs together.

## Entry conditions / prerequisites
- current native `WebSearch` hook behavior is stable
- current install/uninstall ownership logic already distinguishes repo-owned matcher entries
- the CCS MCP tool path is treated as external authority, not as a project-owned search backend

## Action points
- [x] Keep native `WebSearch` substitution exact-name only
- [x] Add `hooks/websearch-mcp-pass-through.cjs` as an allow-only `PreToolUse` MCP companion hook
- [x] Add `hooks/websearch-mcp-companion.cjs` as a `PostToolUse` MCP-output replacement hook
- [x] Extend install/uninstall/settings support for the optional MCP coexistence hook pair
- [x] Add verify coverage for pass-through / preserved-original-output / appended-companion-output behavior
- [x] Sync README / design / changelog / TODO / phase / patch wording

## Out of scope
- taking ownership of CCS MCP search execution
- suppressing or overwriting the original CCS MCP result before it exists
- broadening native `WebSearch` interception into a generic search-tool matcher
- fixing CCS repo doc drift itself

## Affected artifacts
- `hooks/websearch-custom.cjs`
- `hooks/websearch-mcp-pass-through.cjs`
- `hooks/websearch-mcp-companion.cjs`
- `install.sh`
- `uninstall.sh`
- `settings.example.json`
- `verify.sh`
- `README.md`
- `design.md`
- `changelog.md`
- `TODO.md`
- `phase/SUMMARY.md`
- `patch/websearch-mcp-coexistence.patch.md`

## TODO coordination
- maps to: `Add explicit non-blocking coexistence support for CCS MCP WebSearch`
- maps to: `Extend CCS MCP coexistence so the original CCS result and a claude-code-web-hooks companion result can both be surfaced together via PostToolUse`
- maps to: `Verify native WebSearch substitution and CCS MCP pass-through together`
- maps to: `Verify CCS MCP companion replacement behavior with preserved original MCP output plus appended companion results`

## Changelog coordination
- record the coexistence boundary, optional MCP hook-pair install surface, and dual-output verification coverage once implemented

## Verification
- native `WebSearch` still substitutes on success
- native `WebSearch` still falls through to native when custom provider path fails
- `mcp__ccs-websearch__WebSearch` always returns `allow` in `PreToolUse`
- the MCP pass-through path never blocks the original CCS execution
- the `PostToolUse` companion path preserves the original CCS MCP output first
- the `PostToolUse` companion path appends a clearly labeled provider-backed companion result second
- no duplicate provider execution is introduced before the original CCS MCP run completes

## Exit criteria
- the native path and MCP path are explicitly separated in code and docs
- install/uninstall only manage repo-owned matcher entries
- verification proves pass-through / preserved-original-output / appended-companion-output behavior

## Risks / rollback notes
- risk: widening matcher ownership accidentally causes MCP interception drift
- risk: replacing MCP output incorrectly could hide the original CCS result instead of preserving it first
- rollback: remove only the MCP companion matcher/hook path and keep native `WebSearch` ownership unchanged

## Next possible phases
- broader docs/release cleanup around multi-search-path integration
- optional formatting refinements for the combined MCP output if later needed
