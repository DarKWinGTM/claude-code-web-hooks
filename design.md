# Claude Code Web Hooks - Design

> **Current Version:** 0.1.0
> **Project:** Claude Code Web Hooks
> **Status:** Draft
> **Last Updated:** 2026-03-24

---

## Purpose

`Claude Code Web Hooks` is a standalone hook-tool project for Claude Code that provides web-capability augmentation at the client runtime layer, without depending on an external gateway or runtime manager as the owning runtime.

The project exists to separate three concerns clearly:
- **WebSearch augmentation** for environments where native WebSearch does not work reliably with third-party/custom model paths
- **WebFetch augmentation** for pages that need browser-rendered scraping because normal fetch is insufficient
- **Gateway independence** so this logic is not trapped inside 9router or other transport/gateway projects

---

## Problem Statement

Native Claude Code behavior and third-party model behavior do not always align.

Two concrete problems were observed:
1. **WebSearch incompatibility** for some non-native model/runtime paths, especially when the IDE can emit native WebSearch intent but the upstream provider/model path cannot execute it correctly
2. **WebFetch limitations** on CSR-heavy pages, where a simple fetch can retrieve HTML but still miss the rendered content the user actually needs

A particularly important practical case is **custom endpoint usage**.
Claude Code can still issue search/fetch tool intent, but a custom endpoint may not support the same server-side search process or tool lifecycle assumptions as Claude’s native stack. In that situation, native tool intent exists, but the custom endpoint path cannot complete the expected search process server-side.

A gateway like 9router can sometimes emulate or intercept parts of this behavior, but the root interaction point for these two features is often the **IDE/runtime client tool lifecycle** rather than the HTTP gateway lifecycle.

---

## Design Goal

Provide a reusable standalone hook layer that can be installed directly into Claude Code and behave as a client-side augmentation toolkit.

### Core goals
- Work **without** requiring 9router ownership
- Work **without** requiring CCS ownership
- Keep `WebSearch` and `WebFetch` responsibilities separate
- Preserve native Claude Code behavior as the default fallback when custom logic should not take over
- Make interception deterministic and easy to reason about
- Keep install/removal simple
- Keep the architecture open to future search-provider substitution without changing the Claude Code hook model

### Current provider scope
Current implementation scope is now split by role:
- WebSearch path = WebSearchAPI.ai + Tavily Search
- WebFetch scraper path = WebSearchAPI.ai

This is a current implementation decision, not a claim that this provider set is final forever.
If a stronger provider is identified later, provider selection can be expanded while keeping the same runtime-hook architecture.

### Current implementation goal update
The current implementation goal is:
- complete **Tavily Search** integration as part of a configurable multi-provider search architecture
- keep WebFetch extraction on the current stable path until a later extract-provider expansion phase is justified

---

## Scope

### In scope
- Claude Code `PreToolUse` hook for `WebSearch`
- Claude Code `PreToolUse` hook for `WebFetch`
- Search augmentation using WebSearchAPI.ai
- Auto-detection for fetch-readable vs CSR-heavy pages before scraper fallback
- Optional key-pool support for multiple API keys
- Standalone hook scripts under `~/.claude/hooks/` or project-scoped equivalents
- User-level `settings.json` integration for Claude Code

### Out of scope
- Re-implementing full browser automation as the default path
- Making 9router itself the primary owner of WebSearch or WebFetch augmentation
- Converting this into a generic gateway-side search engine
- Solving every client/tool runtime outside Claude Code in the first version

---

## Architecture

### Layer model

```text
Claude Code tool event
  ↓
Standalone hook layer
  ↓
Decision / fallback logic
  ↓
Native tool continuation OR custom provider call
```

### Split responsibilities

#### 1) WebSearch hook
Role:
- intercept Claude Code `WebSearch`
- when a WebSearchAPI key exists, perform custom search substitution
- when no key exists, exit cleanly and allow native WebSearch flow to continue

Contract:
- `WebSearch = source discovery`
- return concise search results and sources
- do not force scraping in this layer

#### 2) WebFetch hook
Role:
- intercept Claude Code `WebFetch`
- inspect initial HTML first
- if the page is fetch-readable, allow native WebFetch to continue
- if the page appears CSR-heavy or shell-heavy, optionally call a browser-rendered scraping backend instead
- if scraper fallback cannot run, allow native WebFetch to continue

Contract:
- `WebFetch = URL reading`
- scraping is an escalation/fallback path, not the default path

---

## Detection Model for WebFetch

The WebFetch hook should classify pages into three practical classes:

### A. Fetch-readable
Signals:
- meaningful paragraph/article content is present
- content nodes are usable
- the page does not look shell-heavy or template-heavy

Action:
- allow native WebFetch

### B. Template-heavy / portal-heavy
Signals:
- page contains lots of text, links, metadata, or listing structure
- article body is weak or missing
- portal/category layout dominates usable article content
- domain heuristics indicate known template-heavy/news-portal behavior

Action:
- prefer scraper fallback when available
- otherwise allow native WebFetch to continue

### C. Browser-render required
Signals:
- app shell patterns (`#root`, `#__next`, `#app`, etc.)
- very low meaningful text in initial HTML
- high script density with weak document body

Action:
- use scraper fallback when key/config exists
- otherwise allow native WebFetch to continue

---

## Fallback Philosophy

The project should preserve native behavior whenever custom takeover is not clearly justified.

### WebSearch
- key available → custom search path
- key missing → allow native flow
- auth / credit / quota / transient provider failure → allow native flow

### WebFetch
- initial HTML sufficient → allow native flow
- initial HTML insufficient + scraper available → scraper fallback
- scraper unavailable/fails → allow native flow

This keeps the project additive rather than destructive.

### Shared failure policy
A shared helper (`hooks/shared/failure-policy.cjs`) now defines failure-classification behavior used by both hooks.

Current shared classes:
- `auth-failed`
- `credit-or-quota-failed`
- `transient-provider-failed`
- `unknown`

Current policy:
- known auth/credit/quota/transient failures should not trap the user inside the custom path when the native tool can still continue
- unknown failures should also fall through to the native tool

Current mode: **fully permissive fallback**

### Multi-provider direction
The next architectural step is to separate provider policy from provider implementation.

Recommended future split:
- search provider adapters
  - WebSearchAPI.ai Search
  - Tavily Search
- extraction provider adapters
  - WebSearchAPI.ai Scrape
  - Tavily Extract (future candidate)
- provider policy layer
  - `single`
  - `fallback`
  - `parallel`

Current default after Tavily Search integration:
- `WebSearch`: `parallel`
  - provider order: `tavily,websearchapi`
  - if one succeeds, the hook returns the first successful normalized result
  - if both fail, native Claude Code WebSearch remains the final fallback

This keeps the project resilient while preferring provider redundancy before native fallback.

---

## Installation Model

### Phase 1
Manual installation:
- place scripts under `~/.claude/hooks/`
- merge hook entries into `~/.claude/settings.json`
- keep env management external/user-controlled

### Phase 2
Provide installer utility:
- create/update hook files
- merge settings safely
- detect existing hook duplication
- support user-scope and project-scope install

---

## Initial File Set

Recommended project layout:

```text
claude-code-web-hooks/
  design.md
  changelog.md
  TODO.md
  settings.example.json
  hooks/
    websearch-custom.cjs
    webfetch-scraper.cjs
    shared/
      failure-policy.cjs
  install/
  src/
```

Current scaffold now includes:
- `design.md`
- `changelog.md`
- `TODO.md`
- `settings.example.json`
- `hooks/websearch-custom.cjs`
- `hooks/webfetch-scraper.cjs`

---

## How to add to Claude Code

### 1) Copy or keep the project in a stable absolute path
Example:
- `/absolute/path/to/claude-code-web-hooks`

### 2) Open your Claude Code user settings file
Recommended file:
- `~/.claude/settings.json`

### 3) Merge the hook entries from `settings.example.json`
Do not blindly replace the whole settings file; merge the `hooks.PreToolUse` entries and the env block you actually want.

### 4) Update the example command paths
Replace:
- `/ABSOLUTE/PATH/TO/claude-code-web-hooks/hooks/websearch-custom.cjs`
- `/ABSOLUTE/PATH/TO/claude-code-web-hooks/hooks/webfetch-scraper.cjs`

with the real absolute path on your machine.

### 5) Optional environment configuration
If you set `WEBSEARCHAPI_API_KEY`, the custom hooks can take over:
- `WebSearch` → WebSearchAPI.ai search substitution
- `WebFetch` → auto-detect + scraper fallback for CSR-heavy pages

`WEBSEARCHAPI_API_KEY` supports two input modes:
- inline key or inline pool, e.g. `key1|key2|key3`
- local file path pointing to either:
  - a JSON array file, e.g. `/path/to/apikey.json`
  - a newline-separated text file, e.g. `/path/to/apikeys.txt`

Example JSON file content:

```json
["apikey1", "apikey2"]
```

Example newline-separated file content:

```text
apikey1
apikey2
```

If the env value looks like a local path, the hooks attempt to read keys from that file.
They first try JSON-array parsing, then fall back to newline-separated text parsing.

In both inline-pool and file-pool mode, the hooks:
- ignore empty entries
- ignore comment-like entries that begin with `#`
- shuffle the key pool per request
- try one key first
- automatically try the next key when a request fails

If you do not set the key:
- `WebSearch` hook exits cleanly and allows native flow
- `WebFetch` hook exits cleanly and allows native flow

---

## Risks and Constraints

### Technical risks
- false positives in CSR detection
- overly noisy hook messages if every allow-through is surfaced
- key delimiter ambiguity if API keys themselves contain `-`
- duplicated hooks in settings leading to confusing output

### Behavioral constraints
- hooks only work in runtimes that support Claude Code hook events
- this is not a universal gateway-side solution
- WebSearch substitution and WebFetch scraper fallback should remain clearly labeled to avoid pretending they are native backend capabilities

---

## Success Criteria

The project is successful when:
- WebSearch hook can substitute third-party WebSearch reliably when configured
- WebSearch falls back cleanly to native flow when unconfigured
- WebFetch hook avoids unnecessary scraping on fetch-readable pages
- WebFetch hook can escalate to scraper fallback on CSR-heavy pages
- installation is understandable without CCS/9router-specific knowledge
- the hook layer is cleanly reusable across Claude Code setups

---

## Next Stage

The next useful move after this design baseline is:
- define the standalone project TODO
- record changelog baseline
- optionally extract the currently working hook scripts into this project as implementation artifacts
