## Context
Resource tables and the log viewer currently render all rows, which creates performance issues for large datasets. We already expose a virtual scroll threshold in settings, but it is not applied.

## Goals / Non-Goals
- Goals:
  - Smooth scrolling for large resource lists and log outputs.
  - Preserve existing UI behaviors (sorting, filtering, selection, context menus).
  - Use the existing virtual scroll threshold setting as the switch.
- Non-Goals:
  - Redesign the table layout or change existing data models.
  - Add server-side pagination at this stage.

## Decisions
- Decision: Use a lightweight virtualization library for row rendering (prefer `@tanstack/react-virtual` for flexibility with tables).
- Decision: Keep the existing table markup for small lists and switch to virtualization only above the threshold.
- Decision: Apply virtualization separately for resource tables and log viewer to avoid cross-component coupling.

## Risks / Trade-offs
- Sticky headers and row measurement can be tricky with table layouts.
- Virtualization may impact keyboard selection if not carefully mapped.

## Migration Plan
1. Add virtualization wrapper for resource tables behind the threshold.
2. Add virtualization wrapper for log viewer behind the threshold.
3. Validate selection, context menu, and filtering behavior.

## Open Questions
- Should we standardize row heights for easier virtualization, or measure dynamically?
