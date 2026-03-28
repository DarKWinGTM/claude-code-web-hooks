# Phase 007 - Stage WebFetch Scraping / Content-Extraction Design

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P7
> **Status:** Completed
> **Design References:** `design.md` sections: Detection Model for WebFetch, Multi-provider direction
> **Patch References:** none

---

## Objective

Stage a bounded WebFetch scraping / content-extraction design slice for Tavily Extract and Exa Contents while keeping WebSearchAPI.ai Scrape as the current active backend.

## Why this phase exists

Checked documentation now shows that Tavily Extract and Exa Contents are real content-extraction APIs, but the current runtime path still uses WebSearchAPI.ai Scrape only. The next useful move is to stage the design boundary first rather than jump directly into runtime branching.

## Design extraction
- Source design: WebFetch should remain an escalation path for URL reading, and future extractor expansion should follow explicit provider architecture rather than ad hoc branching
- Derived execution work: define a fallback-only provider-policy model with three interchangeable extraction backends from the first implementation
- Target outcome: future WebFetch extractor expansion is bounded, explicit, and does not alter the current runtime path prematurely

## Entry conditions / prerequisites
- current WebFetch backend remains WebSearchAPI.ai Scrape
- Tavily Extract and Exa Contents have been checked as documented extraction-capable APIs
- the existing WebFetch heuristic refinement slice is complete and verified

## Action points
- [x] Record extractor-provider capability comparison for WebSearchAPI.ai Scrape vs Tavily Extract vs Exa Contents
- [x] Decide that the future extractor layer should be provider-policy driven with ordered fallback, not single-active-backend staged replacement
- [x] Define the minimum config/env surface needed for three-backend extraction support
- [x] Keep current runtime behavior unchanged while the design slice is staged

## Out of scope
- wiring Tavily Extract into the active hook
- wiring Exa Contents into the active hook
- changing the current WebFetch backend away from WebSearchAPI.ai Scrape

## Affected artifacts
- `design.md`
- `TODO.md`
- `changelog.md`
- `phase/SUMMARY.md`
- `phase/phase-008-implement-selected-webfetch-extraction-backend.md`
- future extractor design notes if added later

## TODO coordination
- maps to: `Design a bounded WebFetch extractor-provider slice for Tavily Extract and Exa Contents while keeping WebSearchAPI.ai Scrape as the active backend`
- maps to: `Decide whether future WebFetch extractor support should use a provider-policy model or remain single-active-backend with staged replacement`

## Changelog coordination
- record the staged extractor-provider design boundary once this phase is completed

## Verification
- design docs clearly state that WebFetch will support three interchangeable extraction backends
- the provider-policy decision is explicit enough to support implementation without guesswork
- config/env surface is explicit enough to support implementation without ambiguity
- no runtime behavior changes are introduced during this design-only phase

## Exit criteria
- the three-backend extraction model is stated clearly
- the capability comparison is captured clearly enough to support implementation
- the provider-policy decision is explicit enough to avoid ad hoc expansion
- the next implementation boundary is explicit enough to avoid confusion

## Risks / rollback notes
- risk: design wording accidentally implies that Tavily Extract or Exa Contents are already active runtime paths
- rollback: keep the current extraction architecture wording centered on WebSearchAPI.ai Scrape as the sole active backend until implementation is explicitly approved

## Next possible phases
- `phase-008-implement-selected-webfetch-extraction-backend.md`
- follow-up extractor comparison refinement if more provider evidence is needed
