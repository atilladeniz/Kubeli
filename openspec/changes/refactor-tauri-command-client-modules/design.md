## Context

The frontend currently exposes all Tauri IPC wrappers from one file (`src/lib/tauri/commands.ts`). This mixes unrelated domains and increases merge conflicts and maintenance cost.

## Goals

- Improve maintainability by grouping IPC wrappers by domain.
- Preserve all public exports and call signatures.
- Preserve runtime behavior (command names, payload keys, mock mode routing).

## Non-Goals

- No new commands, no command renaming.
- No UI redesign or behavior changes.
- No backend IPC contract changes.

## Design

- Introduce `src/lib/tauri/commands/core.ts`:
  - shared `invoke<T>(command, payload?)`
  - shared helper types used across domains
- Split wrappers into domain files:
  - `cluster.ts`, `resources.ts`, `logs.ts`, `shell.ts`, `portforward.ts`, `metrics.ts`, `graph.ts`, `helm.ts`, `flux.ts`, `network.ts`, `ai.ts`, `mcp.ts`
- Keep a stable public entrypoint:
  - `src/lib/tauri/commands.ts` becomes a compatibility barrel re-exporting all domain modules.

## Risks and Mitigations

- Risk: accidental payload key change during move.
  - Mitigation: parity checks on command wrapper signatures and `invoke` arguments.
- Risk: import path churn in consumers.
  - Mitigation: preserve existing `@/lib/tauri/commands` surface.
- Risk: type export regressions.
  - Mitigation: explicit export list validation during refactor.

## Validation Plan

- Type-check and tests must pass after split.
- Verify representative wrappers per domain keep exact command names and payload field names.
