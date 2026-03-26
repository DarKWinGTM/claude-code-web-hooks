# Phase 030 - Add Search Provider Policy

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P3
> **Status:** Completed
> **Design References:** `design.md` sections: Multi-provider direction, Fallback Philosophy
> **Patch References:** none

---

## Objective

Add configurable search-provider policy so users can choose between `fallback` or `parallel` provider behavior.

## Why this phase exists

Adding another provider is not enough; the hook needs an explicit policy layer so behavior is understandable and configurable.

## Design extraction
- Source design: provider policy should be separated from provider implementation
- Derived execution work: define policy config and execution order
- Target outcome: provider selection is deterministic and configurable

## Entry conditions / prerequisites
- provider abstraction is available
- Tavily adapter exists or is ready enough to route toward

## Action points
- [x] Define provider policy config keys
- [x] Define provider order / primary / secondary behavior
- [x] Define behavior for `fallback` and `parallel`
- [x] Keep native fallback as final safety path in every mode

## Out of scope
- docs release sync
- extract-provider policy for WebFetch

## Affected artifacts
- provider policy logic in WebSearch path
- `settings.example.json`
- `README.md`
- `design.md`

## TODO coordination
- maps to: `Add search provider policy config`
- maps to: `Wire WebSearch flow to use provider policy`

## Changelog coordination
- record provider-policy support once implemented

## Verification
- `fallback` tries providers one by one in effective provider order
- `fallback` tries provider order and then native fallback
- `parallel` behavior is explicit and deterministic
- `parallel` returns all successful provider results instead of the first success only
- partial provider failures are preserved as failure summaries

## Exit criteria
- provider mode is configurable
- provider routing order is no longer implicit or hardcoded

## Risks / rollback notes
- risk: too many modes too early create confusion
- rollback: keep only `fallback` if `parallel` is not stable enough yet

## Next possible phases
- `phase-004-wire-websearch-hook.md`
- `phase-005-verify-docs-and-release-sync.md`
