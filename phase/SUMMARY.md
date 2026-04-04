# Phase Summary - Provider and Runtime Compatibility Rollout

> **Project:** Claude Code Web Hooks
> **Scope:** Multi-provider WebSearch + WebFetch rollout with Claude Code, Copilot on VS Code, and Copilot CLI compatibility
> **Status:** In Progress
> **Last Updated:** 2026-04-04

---

## Overall goal

Deliver the current provider-and-runtime rollout for `Claude Code Web Hooks` without changing the shared hook core unnecessarily.

The shipped goal now includes:
- configurable multi-provider WebSearch across WebSearchAPI.ai, Tavily Search, and Exa Search
- three interchangeable WebFetch extraction backends across WebSearchAPI.ai Scrape, Tavily Extract, and Exa Contents
- preserved native fallback for both WebSearch and WebFetch
- explicit runtime compatibility across:
  - `claude-code`
  - `copilot-vscode`
  - `copilot-cli`
  - `all`
- explicit coexistence boundary for native `WebSearch` plus optional CCS MCP WebSearch dual-output companion flow

---

## Source-input extraction table

| Phase | Phase File | Design Source | Patch Source | Derived Execution Work | Target Outcome |
|------|------------|---------------|--------------|-------------------------|----------------|
| P1 | `phase-001-rebaseline-provider-abstraction.md` | `design.md` sections: Purpose, Current provider scope, Multi-provider direction | none | Reframe the current provider-specific search path into a provider abstraction target | One explicit search-provider model |
| P2 | `phase-002-add-tavily-search-adapter.md` | `design.md` sections: Multi-provider direction, Shared failure policy | none | Add Tavily Search adapter and normalize response shape | Tavily Search becomes a real selectable provider |
| P3 | `phase-003-add-search-provider-policy.md` | `design.md` sections: Multi-provider direction, Fallback Philosophy | none | Add policy controls for `fallback` / `parallel` and aggregate parallel results | Search path becomes configurable |
| P4 | `phase-004-wire-websearch-hook.md` | `design.md` sections: WebSearch hook, Fallback Philosophy | none | Replace hardcoded provider execution in WebSearch hook with provider-policy routing across WebSearchAPI.ai, Tavily, and Exa | WebSearch hook becomes multi-provider aware |
| P5 | `phase-005-verify-docs-and-release-sync.md` | `README.md`, `changelog.md`, `TODO.md`, `verify.sh` | none | Expand docs, tests, and release notes for the final multi-provider search flow | Docs and verification align with implementation |
| P6 | `phase-006-refine-webfetch-template-heavy-detection.md` | `design.md` section: Detection Model for WebFetch | none | Narrow the WebFetch heuristic so low-text structured portal pages with repeated metadata blocks classify as `template-heavy` instead of `fetch-readable` | Runtime detection matches intended fixture behavior without broad global threshold relaxation |
| P7 | `phase-007-stage-webfetch-scraping-content-extraction-design.md` | `design.md` sections: Detection Model for WebFetch, Multi-provider direction | none | Define a bounded scraping/content-extraction design slice for Tavily Extract and Exa Contents while keeping WebSearchAPI.ai Scrape as the active backend | Future WebFetch extractor expansion is staged without changing the current runtime path |
| P8 | `phase-008-implement-selected-webfetch-extraction-backend.md` | `design.md` section: WebFetch extraction backends | none | Implement selectable WebFetch extraction backends across WebSearchAPI.ai Scrape, Tavily Extract, and Exa Contents with one active backend per request and ordered fallback | Three interchangeable extraction backends are available from the first runtime implementation |
| P9 | `phase-009-stage-multiple-target-install-and-runtime-compatibility.md` | `README.md` section: How to install; `design.md` section: Installation Model | none | Define target-aware install / uninstall / verify support across multiple runtime targets (`claude-code`, `copilot-vscode`, `copilot-cli`, `all`) and stage Copilot compatibility wrappers/config placement | Future installation/runtime compatibility can expand beyond Claude Code without freezing the model at only two targets |
| P10 | `phase-010-stage-websearch-mcp-coexistence.md` | `design.md` sections: WebSearch hook, Fallback Philosophy, Installation Model | `patch/websearch-mcp-coexistence.patch.md` | Add explicit non-blocking coexistence support for `mcp__ccs-websearch__WebSearch` while preserving exact native `WebSearch` substitution ownership and appending a second companion result after MCP completion | Native WebSearch and CCS MCP WebSearch can coexist without blocking, while one MCP run can show both the original CCS result and the repo companion result |

---

## Overview flow diagram

```text
Initial WebSearch hook baseline
  → provider-specific WebSearchAPI.ai path
  → native fallback only

Target state
  → search provider abstraction
  → provider policy layer
      → `fallback`
      → `parallel`
      → native fallback
  → Tavily Search added as supported provider
  → Exa Search added as supported provider
  → WebFetch template-heavy detection refined for low-text structured portal pages
  → future scraping/content-extraction candidates staged (Tavily Extract / Exa Contents)
  → bounded capability comparison captured
  → future multiple-target install/runtime compatibility staged (`claude-code`, `copilot-vscode`, `copilot-cli`, `all`)
  → docs + verification updated
```

---

## Review summary table

| Phase | Phase File | Sign-Off Status | Reviewer Severity | Reviewer Disposition | Blocker / Follow-Up State |
|------|------------|-----------------|-------------------|----------------------|---------------------------|
| P1 | `phase-001-rebaseline-provider-abstraction.md` | Approved | None | Approved As-Is | completed |
| P2 | `phase-002-add-tavily-search-adapter.md` | Approved | None | Approved As-Is | completed |
| P3 | `phase-003-add-search-provider-policy.md` | Approved | None | Approved As-Is | completed |
| P4 | `phase-004-wire-websearch-hook.md` | Approved | None | Approved As-Is | completed |
| P5 | `phase-005-verify-docs-and-release-sync.md` | Approved | None | Approved As-Is | completed |
| P6 | `phase-006-refine-webfetch-template-heavy-detection.md` | Approved | None | Approved As-Is | implemented and verified against fixture/runtime checks |
| P7 | `phase-007-stage-webfetch-scraping-content-extraction-design.md` | Approved | None | Approved As-Is | design slice staged and first bounded capability comparison recorded |
| P8 | `phase-008-implement-selected-webfetch-extraction-backend.md` | Approved | None | Approved As-Is | completed |
| P9 | `phase-009-stage-multiple-target-install-and-runtime-compatibility.md` | Approved | None | Approved As-Is | completed |
| P10 | `phase-010-stage-websearch-mcp-coexistence.md` | Approved With Follow-up | Follow-Up | May Proceed With Follow-Up | implementation and release sync in progress |

---

## Cross-phase coordination

- P1 is complete and established the abstraction boundary.
- P2 is complete and Tavily Search now exists as a provider adapter.
- P3 is complete and provider policy now supports `fallback` and `parallel`, including aggregate parallel results.
- P4 is complete and the WebSearch hook now routes through provider policy across WebSearchAPI.ai, Tavily, and Exa.
- P5 is complete and docs, verification, and release-facing wording are now synchronized with the shipped provider/runtime behavior.
- P6 is complete and the narrow WebFetch detection refinement now classifies low-text structured portal pages as `template-heavy` without broadening the overall classification model.
- P7 is complete and includes the first bounded capability comparison for Tavily Extract and Exa Contents while keeping WebSearchAPI.ai Scrape as the active backend.
- P8 is complete and implements three supported WebFetch extraction backends with one active backend per request plus ordered fallback.
- Real-key smoke is complete and confirms direct extraction success for Tavily Extract and Exa Contents plus real ordered fallback behavior in the installed hook.
- P9 is complete and adds target-aware install / uninstall / verify support for multiple runtime targets rather than freezing the model at only two targets.
- Current P9 expansion now covers Copilot on VS Code and Copilot CLI through the same wrapper pair, with VS Code user-hook config and repo-scoped Copilot CLI hook config kept explicit.
- P10 is in progress and adds an explicit coexistence boundary for the CCS MCP WebSearch tool so the project can recognize `mcp__ccs-websearch__WebSearch` without taking ownership of that MCP path, while still appending a second provider-backed companion result after CCS finishes the MCP search.
- Native fallback policy must remain preserved through every phase.

---

## Verification requirements

End-to-end success should show:
- WebSearch works with WebSearchAPI.ai only
- WebSearch works with Tavily only
- WebSearch works with Exa only
- WebSearch works with `parallel` mode using provider order `tavily,websearchapi`
- `parallel` mode returns all successful provider results
- partial provider failures are shown without suppressing successful provider results
- provider failure does not trap the user away from native WebSearch when all providers fail
- WebFetch fixture verification classifies `template-heavy.html` as `template-heavy` without changing `article-readable.html` or `browser-shell.html`
- WebFetch extraction now targets three interchangeable backends with one active backend per request and ordered fallback across the remaining providers
- when `PRIMARY` is omitted, the initial provider is chosen randomly from available keyed providers
- real-key smoke confirms direct success for Tavily Extract and Exa Contents and confirms real ordered fallback behavior in the installed hook
- target-aware install / uninstall / verify now covers `claude-code`, `copilot-vscode`, `copilot-cli`, and `all`
- Copilot verification must confirm both runtime shapes:
  - VS Code / Claude-style payloads with `tool_name` and `tool_input`
  - Copilot CLI payloads with `toolName` and stringified `toolArgs`
- CCS MCP coexistence verification must confirm:
  - `mcp__ccs-websearch__WebSearch` returns `allow` in `PreToolUse`
  - the MCP path does not block or replace the original CCS execution before the tool runs
  - the `PostToolUse` companion path can replace the visible MCP output with a combined original-plus-companion payload
  - the original CCS MCP result remains visible first inside that combined payload
  - the appended companion section contains provider-backed results from this repo
  - the MCP path does not trigger duplicate provider execution before the original CCS run completes
- docs and verification scripts now reflect the shipped behavior

---

## Rollback boundary

If multi-provider work becomes unstable:
- keep the current WebSearchAPI.ai path intact
- keep the shared failure policy intact
- do not remove native fallback behavior
- defer newer provider usage rather than weakening the current stable path
