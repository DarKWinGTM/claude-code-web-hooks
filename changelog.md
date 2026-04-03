# Claude Code Web Hooks - Changelog

> **Current Version:** 0.1.3
> **Project:** Claude Code Web Hooks
> **Status:** Active Draft History
> **Last Updated:** 2026-03-28

---

## Version 0.1.3 - 2026-03-28

### Added
- Added a narrow low-text structured portal rule to WebFetch detection so repeated JSON-LD / metadata pages with no real body content classify as `template-heavy`
- Added a shared WebFetch extraction-provider layer with three interchangeable backends:
  - WebSearchAPI.ai Scrape
  - Tavily Extract
  - Exa Contents

### Updated
- Recorded the verified runtime finding that the installed `webfetch-scraper.cjs` matches project source exactly, confirming the earlier `template-heavy` miss was a heuristic-gap issue rather than an installation drift issue
- Updated design / TODO / phase planning to reflect that the WebFetch template-heavy refinement slice is now implemented and verified
- Added selectable WebFetch extraction backend support with one active backend per request, ordered fallback across the remaining providers, and native Claude `WebFetch` as the final escape hatch
- Added target-aware installer / uninstaller / verifier support for multiple runtime targets:
  - `claude-code`
  - `copilot-vscode`
  - `copilot-cli`
  - `all`
- Added Copilot compatibility wrappers that now support both VS Code Copilot hook payloads and Copilot CLI hook payloads
- Added target-aware Copilot config paths for both user-level VS Code hooks and repo-scoped Copilot CLI hooks
- Verified fixture coverage now confirms:
  - `article-readable.html` → `fetch-readable`
  - `template-heavy.html` → `template-heavy`
  - `browser-shell.html` → `browser-render-required`
- Ran real API smoke tests with available keys and confirmed direct extraction success for Tavily Extract and Exa Contents, plus real ordered fallback behavior in the installed hook
- Verified target-aware `verify.sh` coverage now includes Claude Code, Copilot on VS Code, Copilot CLI, and combined `all` target flows

### Notes
- The refinement remains intentionally narrow: improve low-text structured portal detection without broadening `browser-render-required` or lowering global thresholds
- Checked next extractor candidates for future WebFetch integration: Tavily Extract and Exa Contents look viable as documented content-extraction APIs
- Captured the first bounded comparison notes for WebFetch backend selection:
  - Tavily Extract is closer to the current scraper-replacement shape
  - Exa Contents is stronger when richer extraction modes / freshness control / subpage crawling matter
- Implementation now targets all three interchangeable WebFetch extraction backends from the first rollout:
  - WebSearchAPI.ai Scrape
  - Tavily Extract
  - Exa Contents
- WebFetch execution model is now: one active backend per request, ordered fallback across the remaining providers, and native Claude `WebFetch` as the final escape hatch
- The next installation/runtime compatibility slice should be framed as **multiple targets**, not dual-target only:
  - `claude-code`
  - `copilot-vscode`
  - `all`
- Checked Copilot-on-VS-Code hook docs confirm the compatibility boundary that matters for later implementation:
  - VS Code reads Claude-style hook config locations
  - matcher values are ignored
  - tool names and `tool_input` field names may differ from Claude Code
  - runtime-specific wrappers will likely be required for safe compatibility

---

## Version 0.1.2 - 2026-03-24

### Added
- Added Exa Search as an additional search-provider adapter in the shared search abstraction layer
- Added Exa-related configuration examples to `settings.example.json`
- Added aggregate `parallel` search-result behavior so all successful providers are returned together and partial failures are listed

### Updated
- Simplified search mode guidance by removing `single` mode from the public-facing behavior model
- Clarified README documentation for `fallback` and `parallel` behavior, provider ordering, and `SEARCH_PRIMARY`
- Normalized timeout and probe-related env naming toward:
  - `CLAUDE_WEB_HOOKS_SEARCH_TIMEOUT`
  - `TAVILY_SEARCH_TIMEOUT`
  - `EXA_SEARCH_TIMEOUT`
  - `WEBFETCH_PROBE_TIMEOUT`
  - `WEBFETCH_PROBE_MAX_HTML_BYTES`
  - `WEBFETCH_SCRAPER_TIMEOUT`
- Kept backward compatibility for the legacy timeout env names
- Updated install/uninstall handling for the expanded shared helper/provider file set
- Updated phase documents to reflect completed multi-provider implementation phases and in-progress verification/doc sync

### Notes
- Current default search mode remains `parallel`
- Current default provider order remains `tavily,websearchapi`
- Native fallback remains fully permissive when custom search execution does not complete successfully

---

## Version 0.1.0 - 2026-03-20

### Added
- Established the new standalone project identity: **Claude Code Web Hooks**
- Created initial design baseline for separating web-capability augmentation from external gateway/runtime ownership
- Defined two primary standalone hook roles:
  - `WebSearch` augmentation hook
  - `WebFetch` auto-detect + scraper fallback hook
- Defined practical rendering classes for URL handling:
  - fetch-readable
  - metadata-readable only
  - browser-render required
- Defined fallback philosophy that preserves native Claude Code behavior when custom takeover is not justified
- Added project-owned hook source files under `hooks/`
- Added `settings.example.json` to show how to wire the hooks into Claude Code
- Added installation guidance into the design baseline
- Added file-based API key pool support so `WEBSEARCHAPI_API_KEY` can point to a JSON array file instead of only inline key strings
- Added automatic next-key fallback across the API key pool when one key fails during WebSearch or WebFetch scraper execution
- Switched inline API key pool delimiter from `-` to `|` to avoid conflicts with key values that contain hyphens
- Added newline-separated file mode for API key pools, in addition to JSON-array file mode
- Added `install.sh` to copy hooks into `~/.claude/hooks/`, back up `~/.claude/settings.json`, and merge required `PreToolUse` entries into `~/.claude/settings.json`
- Added `uninstall.sh` to remove installed hooks and detach the project-owned `PreToolUse` entries without touching unrelated settings
- Added support for ignoring comment-like inline pool fragments that begin with `#`
- Improved WebFetch classification to distinguish `fetch-readable`, `template-heavy`, and `browser-render-required` cases instead of relying only on shell-style CSR detection
- Added direct domain heuristics for `sanook`, `thaipost`, and `khaosod` to bias template-heavy detection more appropriately
- Added a shared failure-policy helper used by both WebSearch and WebFetch hooks
- Expanded WebSearch native fallback policy to include auth, credit/quota, and transient provider failures so custom-path failures do not unnecessarily block native tool flow
- Switched the shared failure policy to fully permissive mode so unknown provider failures also fall through to native tool behavior
- Expanded README and design wording to explain that the project increases practical WebSearch/WebFetch capability and addresses custom-endpoint cases where Claude Code cannot complete the expected search process server-side
- Added explicit documentation that the current implementation targets WebSearchAPI.ai only, while preserving the architectural option to support other search APIs later
- Added a current provider plan snapshot in the README as a non-binding planning reference
- Expanded the README with Tavily pricing and practical usage notes for search/extract/crawl credit planning
- Added a practical provider comparison section for WebSearchAPI.ai vs Tavily and documented Exa.ai as a future search-provider candidate
- Added Tavily Search adapter, provider abstraction, provider policy helper, and WebSearch multi-provider routing implementation in project source
- Set the default search provider mode to `parallel` with provider order `tavily,websearchapi`
- Updated `parallel` mode so it returns all successful provider results and reports partial provider failures instead of collapsing to the first success only
- Normalized timeout/probe env names toward `CLAUDE_WEB_HOOKS_SEARCH_TIMEOUT`, `TAVILY_SEARCH_TIMEOUT`, `EXA_SEARCH_TIMEOUT`, `WEBFETCH_PROBE_TIMEOUT`, `WEBFETCH_PROBE_MAX_HTML_BYTES`, and `WEBFETCH_SCRAPER_TIMEOUT` with temporary backward compatibility for legacy names

### Decision notes
- The project is positioned as a **client runtime hook layer**, not a gateway feature
- `WebSearch` and `WebFetch` are intentionally separated by role
- scraping is treated as a **fallback/escalation path** for URL reading, not a default behavior for search

### Current state
- Documentation scaffold created
- Implementation extraction into this standalone project is not yet completed
- Current next goal documented: add Tavily Search through a multi-provider search architecture
- README now clarifies that Tavily uses `TAVILY_API_KEY` rather than `WEBSEARCHAPI_API_KEY`
