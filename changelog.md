# Claude Code Web Hooks - Changelog

> **Current Version:** 0.1.0
> **Project:** Claude Code Web Hooks
> **Status:** Active Draft History
> **Last Updated:** 2026-03-20

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

### Decision notes
- The project is positioned as a **client runtime hook layer**, not a gateway feature
- `WebSearch` and `WebFetch` are intentionally separated by role
- scraping is treated as a **fallback/escalation path** for URL reading, not a default behavior for search

### Current state
- Documentation scaffold created
- Implementation extraction into this standalone project is not yet completed
