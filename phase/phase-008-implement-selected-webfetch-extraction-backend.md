# Phase 008 - Implement Selectable WebFetch Extraction Backends

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P8
> **Status:** Completed
> **Design References:** `design.md` section: Extractor-provider candidates for WebFetch
> **Patch References:** none

---

## Objective

Implement selectable WebFetch extraction backends across WebSearchAPI.ai Scrape, Tavily Extract, and Exa Contents with one active backend per request and ordered fallback across the remaining providers.

## Why this phase exists

The project now has a staged design boundary and an initial capability comparison for Tavily Extract and Exa Contents. The user direction is explicit: all three extraction services should be supported from the first runtime implementation, with one active backend per request and ordered fallback across the remaining providers.

## Design extraction
- Source design: extraction backends should remain interchangeable and should not split responsibilities between providers
- Derived execution work: implement all three extraction adapters, add one active-backend-per-request selection, and preserve ordered fallback plus native fallback
- Target outcome: WebFetch gains three supported extraction backends from the first implementation without introducing parallel extraction aggregation

## Entry conditions / prerequisites
- the bounded scraping/content-extraction design slice is complete
- the config/env boundary for all three backends is defined
- the current fallback and native-escape behavior remain explicit during rollout

## Action points
- [x] Add all three extraction adapters / integration paths
- [x] Add or normalize the required config/env surface
- [x] Add verification coverage for selection / fallback behavior
- [x] Keep the current native fallback / bounded rollout behavior explicit
- [x] Run implementation verification and capture the current smoke-test state
- [x] Finalize implementation/release-sync wording after the current rollout state is reflected across docs

## Out of scope
- parallel extraction aggregation across multiple providers
- splitting responsibilities between providers by page type or provider role
- replacing WebSearch behavior

## Affected artifacts
- `hooks/webfetch-scraper.cjs`
- future shared extractor helpers if introduced
- `settings.example.json`
- `verify.sh`
- `README.md`
- `design.md`
- `TODO.md`
- `changelog.md`

## TODO coordination
- maps to: `Select the first future WebFetch extraction backend to implement (Tavily Extract or Exa Contents) based on the bounded capability comparison`
- maps to: `Decide whether future WebFetch extractor support should use a provider-policy model or remain single-active-backend with staged replacement`

## Changelog coordination
- record the three-backend WebFetch extraction rollout once implementation verification is completed

## Verification
- three-backend WebFetch extraction path is wired in runtime
- real-key smoke confirms direct extraction success for Tavily Extract and Exa Contents
- `PRIMARY` forces first-attempt ordering when set
- when `PRIMARY` is omitted, the initial provider is chosen randomly from available keyed providers
- current fallback behavior remains explicit and native Claude `WebFetch` remains the final escape hatch

## Exit criteria
- all three extraction backends are integrated cleanly
- verification covers selection / fallback / native escape behavior
- the current architecture remains readable and non-confusing

## Risks / rollback notes
- risk: config and runtime behavior become harder to read if selection/fallback semantics are not documented clearly
- rollback: revert to the current WebSearchAPI.ai Scrape-only runtime path until the three-backend integration is verified

## Next possible phases
- follow-up verification / release sync
- extractor-policy refinement only if runtime evidence shows the first three-backend rollout needs it
