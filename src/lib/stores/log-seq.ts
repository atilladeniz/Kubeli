import type { LogEntry } from "@/lib/types";

// Monotonic ingest ID for stable React keys across ring-buffer trims.
// Shared by every log path (single-pod store and aggregated workload hooks) so
// that IDs stay unique when several viewers are open at once.
let logSeq = 0;

export const stampSeq = (entry: LogEntry): LogEntry => ({ ...entry, seq: ++logSeq });
