# Phase 005 - Verify, Document, and Release Sync

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P5
> **Status:** In Progress
> **Design References:** `design.md`, `README.md`, `verify.sh`, `TODO.md`, `changelog.md`
> **Patch References:** none

---

## Objective

Bring documentation, verification scripts, and release-facing artifacts into alignment with the new multi-provider WebSearch behavior.

## Why this phase exists

Multi-provider behavior is not complete until users can install it, understand it, configure it, and verify it reliably.

## Design extraction
- Source design: provider policy should be explicit and user-facing docs should explain the real behavior
- Derived execution work: update docs/examples/tests/release notes for the final multi-provider search flow
- Target outcome: implementation and release-facing artifacts stay synchronized

## Entry conditions / prerequisites
- Tavily Search adapter exists
- provider policy exists
- WebSearch hook routing has been updated

## Action points
- [x] Update `README.md` for multi-provider search usage
- [x] Update `settings.example.json` for search provider policy config
- [x] Update `verify.sh` to include provider-policy checks
- [x] Update `TODO.md` and `changelog.md`
- [ ] Prepare next release notes once implementation is stable
- [x] Document aggregate parallel-result behavior and partial-failure reporting

## Out of scope
- new provider integrations beyond the current WebSearch provider set
- non-Claude-Code runtime support

## Affected artifacts
- `README.md`
- `settings.example.json`
- `verify.sh`
- `TODO.md`
- `changelog.md`

## TODO coordination
- maps to: `Extend verify coverage for multi-provider search behavior`

## Changelog coordination
- record final multi-provider rollout wording, env naming, and verification coverage

## Verification
- README instructions match real implementation
- example settings reflect actual config keys
- verify script covers provider policy, aggregate parallel behavior, and fallback behavior

## Exit criteria
- docs, tests, and release notes align with the shipped behavior

## Risks / rollback notes
- risk: docs drift from code during provider integration
- rollback: do not tag a release until verification and docs match runtime behavior

## Next possible phases
- `phase-006-refine-webfetch-template-heavy-detection.md`
- follow-up provider expansion
- WebFetch extract-provider abstraction if needed later
