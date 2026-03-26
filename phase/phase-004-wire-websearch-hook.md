# Phase 040 - Wire WebSearch Hook to Provider Policy

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P4
> **Status:** Completed
> **Design References:** `design.md` sections: WebSearch hook, Fallback Philosophy, Multi-provider direction
> **Patch References:** none

---

## Objective

Replace the current provider-specific WebSearch execution path with provider-policy routing that can call WebSearchAPI.ai, Tavily, or Exa according to configuration.

## Why this phase exists

The hook is where user-facing behavior becomes real. The abstraction and provider adapters only matter once the WebSearch hook actually routes through them.

## Design extraction
- Source design: WebSearch should remain source discovery, preserve native fallback, and support provider substitution
- Derived execution work: connect hook execution path to provider abstraction and provider policy
- Target outcome: WebSearch hook becomes multi-provider aware without losing native fallback behavior

## Entry conditions / prerequisites
- provider abstraction exists
- Tavily Search adapter exists
- provider policy exists

## Action points
- [x] Replace direct WebSearchAPI.ai execution call with provider-policy execution path
- [x] Preserve current output format for search results
- [x] Preserve fully permissive native fallback behavior
- [x] Preserve key-pool behavior for each provider that supports it

## Out of scope
- WebFetch extractor provider expansion
- release metadata polish

## Affected artifacts
- `hooks/websearch-custom.cjs`
- shared provider logic
- shared failure policy if necessary

## TODO coordination
- maps to: `Wire WebSearch flow to use provider policy instead of hardcoded provider-specific routing`

## Changelog coordination
- record WebSearch hook multi-provider routing once complete

## Verification
- WebSearch works in WebSearchAPI.ai-only mode
- WebSearch works in Tavily-only mode
- WebSearch works in fallback mode
- WebSearch works in parallel mode with aggregated successful results
- provider failure still falls through to native WebSearch when all providers fail

## Exit criteria
- no hardcoded provider-specific search path remains in WebSearch hook
- provider mode changes actual runtime behavior

## Risks / rollback notes
- risk: regress current stable WebSearchAPI.ai path
- rollback: keep a stable WebSearchAPI.ai path available throughout integration if needed

## Next possible phases
- `phase-005-verify-docs-and-release-sync.md`
