## 1. Implementation
- [x] 1.1 Add buffered log line queue with timed flush in `useLogs`
- [x] 1.2 Enforce `maxLines` without repeated full-array copies
- [x] 1.3 Flush pending buffer on stream stop and unmount
- [x] 1.4 Update log viewer to handle batched updates (no behavior regressions)
- [x] 1.5 Add lightweight manual test steps for high-volume streams

## Manual Tests
- Stream logs from a noisy pod and confirm UI updates in batches without lag.
- Verify the log list stays capped at `maxLines` while streaming.
