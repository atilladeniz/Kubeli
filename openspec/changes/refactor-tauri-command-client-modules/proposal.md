# Change: Refactor Frontend Tauri Command Client into Modular Domains

## Why

`src/lib/tauri/commands.ts` is a large, mixed-responsibility file that makes maintenance and safe refactoring harder. The current size increases coupling and slows down onboarding and code review.

## What Changes

- Split `src/lib/tauri/commands.ts` into domain-focused modules under `src/lib/tauri/commands/`.
- Keep a shared internal invoke helper for Tauri/mock routing.
- Preserve the public API from `@/lib/tauri/commands` (same exported names and signatures).
- Add parity checks to confirm no command name or payload mapping changes.

## Impact

- Affected specs: architecture
- Affected code:
  - `src/lib/tauri/commands.ts` (entrypoint/barrel after split)
  - `src/lib/tauri/commands/*` (new domain modules)
  - related frontend imports that consume command wrappers
