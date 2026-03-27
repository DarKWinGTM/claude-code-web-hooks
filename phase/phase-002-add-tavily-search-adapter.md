# Phase 002 - Add Tavily Search Adapter

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P2
> **Status:** Completed
> **Design References:** `design.md` sections: Current provider scope, Multi-provider direction
> **Patch References:** none

---

## Objective

Add a Tavily Search adapter that can execute search requests and normalize Tavily responses into the project’s shared search-result shape.

## Why this phase exists

Tavily Search should be integrated as a real provider implementation, not as an ad hoc branch inside the hook.

## Design extraction
- Source design: provider-specific now, provider-agnostic direction later
- Derived execution work: implement Tavily Search request/response mapping behind the provider abstraction
- Target outcome: Tavily becomes a first-class search provider in the project

## Entry conditions / prerequisites
- provider abstraction from P1 is available or stable enough to target

## Action points
- [x] Add Tavily Search request client
- [x] Map request fields from hook intent to Tavily Search input
- [x] Normalize Tavily response fields into shared result format
- [x] Map Tavily provider failures into the shared failure policy helper where needed

## Out of scope
- policy ordering between providers
- WebFetch extract integration
- release-note finalization

## Affected artifacts
- search provider code path
- shared result normalization logic
- shared failure policy if Tavily-specific error handling is needed

## TODO coordination
- maps to: `Add Tavily Search adapter`
- maps to: `Normalize Tavily Search responses`

## Changelog coordination
- record Tavily Search adapter introduction once complete

## Verification
- Tavily Search can run independently
- Tavily result shape matches expected shared result contract
- Tavily failures do not break native fallback policy

## Exit criteria
- Tavily Search is callable as a standalone provider implementation
- output is compatible with current WebSearch hook formatting expectations

## Risks / rollback notes
- risk: response normalization mismatch
- rollback: keep Tavily adapter behind non-default path until validated

## Next possible phases
- `phase-003-add-search-provider-policy.md`
- `phase-004-wire-websearch-hook.md`
