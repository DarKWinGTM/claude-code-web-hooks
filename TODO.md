# Claude Code Web Hooks - TODO

> **Last Updated:** 2026-03-24

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
- [ ] Refine standalone project scope and installation model
- [x] Decide final file layout for `hooks/`, `src/`, and `install/`
- [x] Define configuration strategy for user-scope vs project-scope installation

### Extraction / Implementation
- [ ] Extract current WebSearch hook into project-owned implementation files
- [ ] Extract current WebFetch scraper hook into project-owned implementation files
- [x] Move shared helper logic into reusable modules
- [x] Add installer/update script for safe `settings.json` merge
- [x] Add uninstaller for project-owned hook removal

### Behavior / Quality
- [x] Improve API key pool format to avoid delimiter ambiguity
- [ ] Reduce noisy hook messaging while preserving decision visibility
- [x] Make `parallel` mode return all successful provider results and report partial failures
- [x] Add domain heuristics for better WebFetch scrape escalation decisions
- [x] Add tests or repeatable verification flow for hook decision branches

### Multi-provider roadmap
- [x] Add search provider abstraction layer
- [x] Add Tavily Search adapter
- [x] Add search provider policy config (`fallback` / `parallel`)
- [x] Wire WebSearch flow to use provider policy instead of hardcoded provider-specific routing
- [x] Normalize Tavily Search responses into the project’s shared search-result format
- [x] Extend verify coverage for multi-provider search behavior
- [ ] Research and evaluate Exa.ai as an additional search-provider adapter
- [ ] Decide whether Exa should be search-only first or enter a later extract-provider phase

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
| 2026-03-20 | Created new standalone project scaffold `claude-code-web-hooks` with initial design, changelog, and TODO to separate web hook logic from external gateway/runtime ownership. |
