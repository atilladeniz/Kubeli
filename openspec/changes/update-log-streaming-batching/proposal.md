# Change: Batch Log Stream Rendering

## Why
High-volume log streams currently update the UI per line, which causes unnecessary render churn and can make the log viewer sluggish on noisy pods.

## What Changes
- Add buffered/batched log updates in the frontend log stream handler.
- Ensure max line limits are enforced without excessive array copying.
- Document the batching requirement in the logs specification.

## Impact
- Affected specs: logs-debugging
- Affected code: src/lib/hooks/useLogs.ts, src/components/features/logs/LogViewer.tsx
