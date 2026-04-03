# Phase 010 - Stage WebSearch MCP Coexistence

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P10
> **Status:** In Progress
> **Design References:** `design.md` sections: WebSearch hook, Fallback Philosophy, Installation Model
> **Patch References:** `patch/websearch-mcp-coexistence.patch.md`

---

## Objective

Add explicit, non-blocking coexistence support for the CCS MCP tool `mcp__ccs-websearch__WebSearch` without changing ownership of the native `WebSearch` substitution path.

## Why this phase exists

The project currently owns native Claude `WebSearch` substitution only. In the checked local CCS + Claude Code setup, a separate MCP tool path also exists for CCS-managed web search. This slice exists so the repo can recognize that MCP path safely without blocking it, replacing it, or double-running search.

## Design extraction
- Source design: native `WebSearch` substitution should remain exact-name scoped and fallback-permissive.
- Derived execution work: add a dedicated allow-only companion hook for the CCS MCP tool, keep install behavior non-owning, and document the coexistence boundary clearly.
- Target outcome: native `WebSearch` and CCS MCP WebSearch can coexist in one user environment without authority confusion.

## Entry conditions / prerequisites
- current native `WebSearch` hook behavior is stable
- current install/uninstall ownership logic already distinguishes repo-owned matcher entries
- the CCS MCP tool path is treated as external authority, not as a project-owned search backend

## Action points
- [x] Keep native `WebSearch` substitution exact-name only
- [x] Add `hooks/websearch-mcp-pass-through.cjs` as an allow-only MCP companion hook
- [x] Extend install/uninstall/settings support for the optional MCP pass-through matcher
- [x] Add verify coverage for pass-through / no-block / no-double-search behavior
- [x] Sync README / design / changelog / TODO / phase / patch wording

## Out of scope
- taking ownership of CCS MCP search execution
- substituting results for `mcp__ccs-websearch__WebSearch`
- broadening native `WebSearch` interception into a generic search-tool matcher
- fixing CCS repo doc drift itself

## Affected artifacts
- `hooks/websearch-custom.cjs`
- `hooks/websearch-mcp-pass-through.cjs`
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
- maps to: `Verify native WebSearch substitution and CCS MCP pass-through together`

## Changelog coordination
- record the coexistence boundary, optional MCP pass-through install surface, and verification coverage once implemented

## Verification
- native `WebSearch` still substitutes on success
- native `WebSearch` still falls through to native when custom provider path fails
- `mcp__ccs-websearch__WebSearch` always returns `allow`
- the MCP pass-through path never substitutes results
- no duplicate provider execution is introduced by the MCP path

## Exit criteria
- the native path and MCP path are explicitly separated in code and docs
- install/uninstall only manage repo-owned matcher entries
- verification proves pass-through / no block / no double-search

## Risks / rollback notes
- risk: widening matcher ownership accidentally causes MCP interception drift
- rollback: remove only the MCP companion matcher/hook path and keep native `WebSearch` ownership unchanged

## Next possible phases
- optional `PostToolUse` observation-only MCP formatting slice if later needed
- broader docs/release cleanup around multi-search-path integration
