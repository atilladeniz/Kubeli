## 1. Implementation
- [ ] 1.1 Add buffered log line queue with timed flush in `useLogs`
- [ ] 1.2 Enforce `maxLines` without repeated full-array copies
- [ ] 1.3 Flush pending buffer on stream stop and unmount
- [ ] 1.4 Update log viewer to handle batched updates (no behavior regressions)
- [ ] 1.5 Add lightweight manual test steps for high-volume streams
