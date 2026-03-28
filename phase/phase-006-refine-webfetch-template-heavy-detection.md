# Phase 006 - Refine WebFetch Template-Heavy Detection

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P6
> **Status:** Completed
> **Design References:** `design.md` section: Detection Model for WebFetch
> **Patch References:** none

---

## Objective

Refine the WebFetch detection heuristic so low-text structured portal pages with repeated metadata blocks classify as `template-heavy` instead of falling through as `fetch-readable`.

## Why this phase exists

Runtime verification showed that the installed hook and the project source are identical, but the current heuristic still misclassifies `template-heavy.html` as `fetch-readable`. That means the next useful move is a narrow logic refinement, not an installation fix.

## Design extraction
- Source design: template-heavy / portal-heavy pages should prefer scraper fallback when readable body content is effectively absent
- Derived execution work: add a narrower rule for low-text structured portal pages without lowering global thresholds broadly
- Target outcome: structured metadata-heavy portal pages classify as `template-heavy` while readable articles and true app shells keep their current classes

## Entry conditions / prerequisites
- installed hook and project source have been verified as identical
- current runtime verification has reproduced the `template-heavy.html` miss
- the refinement stays bounded to WebFetch classification only

## Action points
- [x] Add a narrow low-text structured portal rule to `detectRenderingMode()`
- [x] Keep `browser-render-required` logic separate from the new rule
- [x] Re-run fixture verification for `article-readable.html`, `template-heavy.html`, and `browser-shell.html`
- [x] Confirm the new rule fixes the target case without broad threshold relaxation

## Out of scope
- changing WebSearch provider behavior
- broad global threshold reductions across all template-heavy logic
- new scraper providers or WebFetch provider abstraction work

## Affected artifacts
- `hooks/webfetch-scraper.cjs`
- `verify.sh`
- `README.md`
- `design.md`
- `TODO.md`
- `changelog.md`

## TODO coordination
- maps to: `Refine WebFetch low-text structured portal detection so template-heavy pages with repeated metadata blocks do not fall through as fetch-readable`

## Changelog coordination
- recorded the bounded WebFetch heuristic refinement and the verified fixture outcome in `changelog.md`

## Verification
- `article-readable.html` remains `fetch-readable`
- `template-heavy.html` becomes `template-heavy`
- `browser-shell.html` remains `browser-render-required`
- installed hook behavior matches the updated project source after deployment

## Exit criteria
- the target fixture miss is resolved
- the refinement remains narrow and does not blur template-heavy with app-shell detection
- verification evidence has been updated to match the intended behavior

## Risks / rollback notes
- risk: over-broad heuristic changes create new false positives for normal low-text pages
- rollback: remove only the narrow refinement rule and keep the previous thresholds intact if regression appears

## Next possible phases
- `phase-005-verify-docs-and-release-sync.md`
- follow-up WebFetch heuristic refinement if new fixture classes appear
