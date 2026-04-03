# Phase 009 - Stage Multiple-Target Install and Runtime Compatibility

> **Summary File:** `phase/SUMMARY.md`
> **Phase ID:** P9
> **Status:** In Progress
> **Design References:** `README.md` section: How to install; `design.md` section: Installation Model
> **Patch References:** none

---

## Objective

Stage a target-aware installation / uninstallation / verification design that supports multiple runtime targets rather than only a Claude-Code-specific path.

## Why this phase exists

The current installer flow is still Claude-Code-centric. The next useful expansion is not just “dual-target” support, because the runtime model should remain open to more than two targets over time. The immediate planned targets are:
- `claude-code`
- `copilot-vscode`
- `copilot-cli`
- `all`

## Design extraction
- Source design: shared hook logic should stay reusable while runtime-specific installation and compatibility details remain explicit
- Derived execution work: define target-aware install / uninstall / verify behavior and stage any required Copilot-specific wrapper/config placement
- Checked Copilot docs implication: Claude-style hook config locations are readable in VS Code, but matcher values are ignored and tool / `tool_input` naming may differ, so runtime-specific wrappers are required there
- Checked Copilot CLI docs implication: CLI repo hooks live under `.github/hooks/`, are loaded from the current working directory, and `preToolUse` uses `toolName` plus stringified `toolArgs`, so the wrappers must also adapt CLI payloads and output
- Target outcome: installation/runtime compatibility can expand cleanly without freezing the design at only two targets

## Entry conditions / prerequisites
- current Claude Code install path remains stable
- current WebFetch/WebSearch shared logic remains reusable from a runtime-neutral core
- Copilot-on-VS-Code compatibility is treated as an explicit staged runtime path, not assumed drop-in reuse

## Action points
- [x] Define the target model explicitly:
  - `claude-code`
  - `copilot-vscode`
  - `copilot-cli`
  - `all`
- [x] Define how `install.sh`, `uninstall.sh`, and `verify.sh` should behave per target
- [x] Define which shared files stay runtime-neutral and which wrappers/configs become runtime-specific
- [x] Define Copilot-on-VS-Code hook file placement and compatibility-wrapper expectations
- [x] Extend the same wrapper pair to adapt Copilot CLI `toolName` / `toolArgs` input and CLI permission output
- [x] Keep the current Claude Code path intact while staging the broader multiple-target model

## Out of scope
- inventing a separate provider core for Copilot targets
- replacing the current Claude Code install path
- limiting the architecture to exactly two long-term targets

## Affected artifacts
- `README.md`
- `design.md`
- `TODO.md`
- `changelog.md`
- `phase/SUMMARY.md`
- future target-aware install/runtime phase files

## TODO coordination
- maps to: `Design target-aware install / uninstall / verify support for multiple runtime targets (claude-code, copilot-vscode, copilot-cli, all)`
- maps to: `Define Copilot-on-VS-Code compatibility wrappers / config placement without breaking the current Claude Code path`
- maps to: `Extend the Copilot compatibility layer to also support Copilot CLI payload/input-output rules`

## Changelog coordination
- record the multiple-target installation/runtime compatibility boundary once this phase is completed

## Verification
- docs clearly distinguish the current Claude Code path from multiple-target support
- the target model is explicit enough to support later implementation without ambiguity
- `all` is represented as a first-class target, not as an afterthought
- checked Copilot docs are reflected in the staged compatibility boundary:
  - Claude-style hook config locations are readable in VS Code
  - matcher values are ignored
  - tool names and `tool_input` field names may differ
- checked Copilot CLI docs are reflected in the staged compatibility boundary:
  - repo hook config lives under `.github/hooks/`
  - hooks are loaded from the current working directory in CLI mode
  - `preToolUse` input uses `toolName` and stringified `toolArgs`
  - repo hook config uses `version: 1` and lower-camel event keys such as `preToolUse`

## Exit criteria
- the multiple-target model is stated clearly
- installer / uninstaller / verifier responsibilities are scoped per target
- the current Claude Code path remains readable and stable while future targets are staged explicitly
- the initial target-aware implementation boundary is clear enough for later rollout hardening
- Copilot compatibility is explicitly split into:
  - VS Code user-hook/runtime path
  - Copilot CLI repo-hook/runtime path
  - shared wrapper/core reuse instead of duplicated logic

## Risks / rollback notes
- risk: “dual-target” wording freezes the design too early and makes future target expansion awkward
- rollback: keep the current Claude Code-only installation path as the active default until multiple-target support is explicitly implemented

## Next possible phases
- target-aware installer / uninstaller implementation
- Copilot target verification hardening across VS Code and CLI payload shapes
- future additional runtime-target staging if needed
