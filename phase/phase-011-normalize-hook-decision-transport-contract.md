# Phase 011 - Normalize Hook Decision Transport Contract

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P11
> **Status:** Completed
> **Design References:** `design.md` sections: WebSearch hook, WebFetch hook, Hook decision transport contract, Installation Model
> **Patch References:** `patch/hook-decision-transport-contract.patch.md`

---

## Objective

Normalize the source-owned hook decision transport contract so successful `allow` / `deny` / substitution decisions complete with exit code `0`, keep tool ownership in `hookSpecificOutput.permissionDecision`, add repeatable verification for that contract, and sync the governed docs/install surfaces to the corrected behavior.

## Why this phase exists

The checked `WebFetch` failure showed a real contract mismatch: the hook emitted valid decision JSON, but the process still exited non-zero on a normal substitution path. That made Claude Code treat a handled hook decision as a hook-command failure. This phase exists to move the repo back to the intended model where hook-process success and tool-decision ownership are separate concerns.

## Design extraction
- Source design: the project is additive, preserves native fallback, and routes tool ownership through the hook layer rather than through external gateway semantics.
- Derived execution work: normalize source hook exit behavior, keep `permissionDecision` as the authoritative allow/deny owner, add verifier coverage for the decision-transport contract, and sync install/docs/phase surfaces so runtime copies are no longer the only place where the fix is visible.
- Target outcome: a handled substitution or deny decision is no longer misclassified as a hook failure, and repo verification catches the regression class before install/release.

## Entry conditions / prerequisites
- the root cause is verified in source-owned hooks, not only in an installed runtime copy
- source/runtime ownership is already clear through the existing installer model
- current hook output shape is already JSON-based with `hookSpecificOutput.permissionDecision`

## Action points
- [x] Change `hooks/webfetch-scraper.cjs` so the extraction-substitution success path exits `0`
- [x] Change `hooks/websearch-custom.cjs` so handled deny/substitution paths exit `0`
- [x] Align source comments to the corrected hook-process contract
- [x] Add verification coverage that asserts handled decision paths emit JSON and exit `0`
- [x] Sync README / design / changelog / TODO / phase / patch wording
- [x] Reinstall the Claude Code runtime copy from source after verification passes

## Out of scope
- redesigning provider policy or failure-policy classes
- changing MCP coexistence ownership
- forcing a release/push decision without separate remote-state readiness review
- broad wrapper rewrites when the shared Claude-style core contract is sufficient for the checked fix

## Affected artifacts
- `hooks/webfetch-scraper.cjs`
- `hooks/websearch-custom.cjs`
- `verify.sh`
- `README.md`
- `design.md`
- `changelog.md`
- `TODO.md`
- `phase/SUMMARY.md`
- `patch/hook-decision-transport-contract.patch.md`

## TODO coordination
- maps to: normalize hook decision transport so handled deny/substitution paths exit `0`
- maps to: add repeatable verification coverage for the hook decision transport contract
- maps to: sync source-owned docs/install surfaces to the corrected behavior

## Changelog coordination
- record the exit-code contract correction, verifier expansion, and source-owned doc/install sync in the next version entry

## Verification
- `bash verify.sh --target claude-code` passes
- the verifier proves `WebSearch` handled-success decisions exit `0`
- the verifier proves `WebSearch` handled-deny decisions exit `0`
- the verifier proves `WebFetch` handled-substitution decisions exit `0`
- the verifier proves those handled decision paths still emit `permissionDecision: "deny"` with formatted replacement content

## Exit criteria
- source-owned hooks no longer use non-zero exit codes for normal handled decision paths
- verifier coverage catches the checked regression class directly
- runtime install is refreshed from source after verification
- docs and phase artifacts describe the corrected contract without relying on runtime-only hotfix drift

## Risks / rollback notes
- risk: widening the fix into unrelated wrapper/runtime behavior would raise blast radius unnecessarily
- risk: syncing docs without verifier coverage would leave the regression class easy to reintroduce
- rollback: restore the previous source hook files and verifier block together, then reinstall from source so runtime state and repo state stay aligned

## Next possible phases
- optional wrapper hardening if a checked Copilot runtime later shows the same child-status sensitivity despite the normalized shared-core contract
- unresolved public-release cleanup around direct host heuristics if that release-readiness item is selected later
