# Change: Virtualized Resource and Log Lists

## Why
Large resource lists and long log streams render every row, which can degrade scrolling and filtering performance as data grows.

## What Changes
- Virtualize resource tables when item counts exceed the configured threshold.
- Virtualize log viewer rendering for large log outputs.
- Preserve existing selection, sorting, filtering, and context menu behavior.

## Impact
- Affected specs: resource-management, logs-debugging
- Affected code: src/components/features/resources/ResourceList.tsx, src/components/features/logs/LogViewer.tsx, src/lib/stores/ui-store.ts
