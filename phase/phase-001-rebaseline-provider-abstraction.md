# Phase 010 - Rebaseline Provider Abstraction

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P1
> **Status:** Completed
> **Design References:** `design.md` sections: Purpose, Current provider scope, Multi-provider direction
> **Patch References:** none

---

## Objective

Define the internal abstraction boundary for search providers so current WebSearchAPI.ai logic stops being treated as the only search path.

## Why this phase exists

Without a provider abstraction, adding Tavily directly will make the WebSearch hook grow into a brittle provider-specific conditional chain.

## Design extraction
- Source design: multi-provider direction in `design.md`
- Derived execution work: define normalized search-provider interface and normalized search-result shape
- Target outcome: later provider additions can plug into a stable shared contract

## Entry conditions / prerequisites
- Current provider-specific WebSearch hook is stable enough to preserve as baseline
- Shared failure policy helper already exists

## Action points
- [x] Define internal search provider interface
- [x] Define normalized search result structure
- [x] Identify current WebSearchAPI.ai logic that should move behind the provider boundary
- [x] Keep native fallback behavior unchanged during abstraction work

## Out of scope
- Adding Tavily request logic
- Adding policy configuration
- Updating release docs beyond abstraction notes

## Affected artifacts
- `hooks/websearch-custom.cjs`
- possible future shared provider modules
- `design.md`

## TODO coordination
- maps to: `Add search provider abstraction layer`

## Changelog coordination
- record the abstraction boundary once introduced

## Verification
- current WebSearchAPI.ai-only path still works after abstraction refactor
- native fallback still works for no-key and provider-failure cases

## Exit criteria
- search provider contract is explicit
- current provider logic can be represented as one implementation of that contract

## Risks / rollback notes
- risk: abstraction too vague and later phases drift
- rollback: keep current provider-specific logic in place if abstraction is not yet stable

## Next possible phases
- `phase-002-add-tavily-search-adapter.md`
- `phase-003-add-search-provider-policy.md`
