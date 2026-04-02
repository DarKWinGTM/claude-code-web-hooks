# Claude Code Web Hooks - TODO

> **Last Updated:** 2026-03-28

---

## ✅ Completed

- [x] Chosen project name: `Claude Code Web Hooks`
- [x] Created standalone project folder for the project scaffold
- [x] Created initial `design.md`
- [x] Created initial `changelog.md`
- [x] Created initial `TODO.md`
- [x] Added project-owned hook source files under `hooks/`
- [x] Added `settings.example.json` for Claude Code integration
- [x] Added installation/how-to-add guidance into `design.md`

---

## 📋 Tasks To Do

### Documentation / Planning
- [x] Refine standalone project scope and installation model
- [x] Decide final file layout for `hooks/`, `src/`, and `install/`
- [x] Define configuration strategy for user-scope vs project-scope installation

### Extraction / Implementation
- [x] Extract current WebSearch hook into project-owned implementation files
- [x] Extract current WebFetch scraper hook into project-owned implementation files
- [x] Move shared helper logic into reusable modules
- [x] Add installer/update script for safe `settings.json` merge
- [x] Add uninstaller for project-owned hook removal

### Behavior / Quality
- [x] Improve API key pool format to avoid delimiter ambiguity
- [ ] Reduce noisy hook messaging while preserving decision visibility
- [x] Make `parallel` mode return all successful provider results and report partial failures
- [x] Add domain heuristics for better WebFetch scrape escalation decisions
- [x] Refine WebFetch low-text structured portal detection so template-heavy pages with repeated metadata blocks do not fall through as `fetch-readable`
- [x] Add tests or repeatable verification flow for hook decision branches

### Multi-provider roadmap
- [x] Add search provider abstraction layer
- [x] Add Tavily Search adapter
- [x] Add search provider policy config (`fallback` / `parallel`)
- [x] Wire WebSearch flow to use provider policy instead of hardcoded provider-specific routing
- [x] Normalize Tavily Search responses into the project’s shared search-result format
- [x] Extend verify coverage for multi-provider search behavior
- [x] Research and evaluate Exa.ai as an additional search-provider adapter
- [x] Decide whether Exa should be search-only first or enter a later extract-provider phase
- [x] Design a bounded WebFetch extractor-provider slice for Tavily Extract and Exa Contents while keeping WebSearchAPI.ai Scrape as the active backend
- [x] Decide that future WebFetch extractor support should use a provider-policy model with ordered fallback
- [x] Implement three interchangeable WebFetch extraction backends from the first rollout (`WebSearchAPI.ai Scrape`, `Tavily Extract`, `Exa Contents`)
- [x] Finalize three-backend WebFetch verification and release-sync wording
- [x] Run live smoke tests with real provider keys for WebSearchAPI.ai Scrape, Tavily Extract, and Exa Contents
- [x] Design target-aware install / uninstall / verify support for multiple runtime targets (`claude-code`, `copilot-vscode`, `all`)
- [x] Define Copilot-on-VS-Code compatibility wrappers / config placement without breaking the current Claude Code path
- [x] Define multiple-target installer semantics that keep the design open to future targets beyond `claude-code` and `copilot-vscode`

### Release readiness checklist
- [x] Add `.gitignore`
- [x] Add `LICENSE`
- [x] Add public-facing `README.md` with install and use instructions
- [x] Add Claude Code flow diagram to README
- [x] Add fixtures directory for verification
- [x] Add `verify.sh`
- [x] Review repository text for any remaining machine-specific paths that should stay placeholder/generic in public release
- [ ] Decide whether to keep or remove direct host heuristics before public release
- [x] Create repository and push when ready
- [x] Create first tagged release when ready

---

## 📜 History

| Date | Changes |
|------|---------|
| 2026-03-28 | Implemented and verified the narrow WebFetch heuristic refinement for low-text structured portal pages, then completed the three-backend WebFetch extraction rollout in repo state: added interchangeable extraction backends for WebSearchAPI.ai Scrape, Tavily Extract, and Exa Contents; added one-active-backend-per-request selection with ordered fallback; updated install/uninstall/settings/verify/docs/phase files; completed real-key smoke testing for Tavily Extract and Exa Contents plus ordered fallback behavior; and staged then implemented target-aware install / uninstall / verify support for the multiple-target model (`claude-code`, `copilot-vscode`, `all`) including Copilot compatibility wrappers. |
| 2026-03-27 | Audited `design.md` and `phase/` against the current implementation, aligned wording to the active provider set (WebSearchAPI.ai, Tavily, Exa), normalized phase titles to `001`-`005`, and closed stale TODO items that had already been implemented. |
| 2026-03-20 | Created new standalone project scaffold `claude-code-web-hooks` with initial design, changelog, and TODO to separate web hook logic from external gateway/runtime ownership. |
