import { renderHook, act } from "@testing-library/react";
import { useLogFilter } from "../useLogFilter";
import type { LogEntry } from "@/lib/types";

const createLogEntry = (message: string, timestamp: string): LogEntry => ({
  message,
  timestamp,
  container: "main",
  pod: "test-pod",
  namespace: "default",
});

describe("useLogFilter", () => {
  const mockLogs: LogEntry[] = [
    createLogEntry("INFO: Application started", "2024-01-01T10:00:00Z"),
    createLogEntry("ERROR: Connection failed", "2024-01-01T10:01:00Z"),
    createLogEntry("WARN: High memory usage", "2024-01-01T10:02:00Z"),
    createLogEntry("DEBUG: Processing request", "2024-01-01T10:03:00Z"),
    createLogEntry("INFO: Request completed", "2024-01-01T10:04:00Z"),
  ];

  it("returns all logs when no filters applied", () => {
    const { result } = renderHook(() => useLogFilter({ logs: mockLogs }));
    expect(result.current.filteredLogs).toHaveLength(5);
  });

  it("filters by search query (case insensitive)", () => {
    const { result } = renderHook(() => useLogFilter({ logs: mockLogs }));

    act(() => {
      result.current.setSearchQuery("error");
    });

    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].message).toContain("ERROR");
  });

  it("filters by log level", () => {
    const { result } = renderHook(() => useLogFilter({ logs: mockLogs }));

    act(() => {
      result.current.setLogLevel("error");
    });

    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].message).toContain("ERROR");
  });

  it("filters by warn level", () => {
    const { result } = renderHook(() => useLogFilter({ logs: mockLogs }));

    act(() => {
      result.current.setLogLevel("warn");
    });

    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].message).toContain("WARN");
  });

  it("filters by info level", () => {
    const { result } = renderHook(() => useLogFilter({ logs: mockLogs }));

    act(() => {
      result.current.setLogLevel("info");
    });

    expect(result.current.filteredLogs).toHaveLength(2);
  });

  it("filters by debug level", () => {
    const { result } = renderHook(() => useLogFilter({ logs: mockLogs }));

    act(() => {
      result.current.setLogLevel("debug");
    });

    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].message).toContain("DEBUG");
  });

  it("combines search and log level filters", () => {
    const { result } = renderHook(() => useLogFilter({ logs: mockLogs }));

    act(() => {
      result.current.setSearchQuery("connection");
      result.current.setLogLevel("error");
    });

    expect(result.current.filteredLogs).toHaveLength(1);
  });

  it("validates regex and sets error for invalid pattern", () => {
    const { result } = renderHook(() => useLogFilter({ logs: mockLogs }));

    act(() => {
      result.current.setUseRegex(true);
      result.current.setSearchQuery("[invalid");
    });

    expect(result.current.regexError).not.toBeNull();
    // Invalid regex should not filter (returns all logs)
    expect(result.current.filteredLogs).toHaveLength(5);
  });

  it("filters with valid regex", () => {
    const { result } = renderHook(() => useLogFilter({ logs: mockLogs }));

    act(() => {
      result.current.setUseRegex(true);
      result.current.setSearchQuery("INFO");
    });

    expect(result.current.regexError).toBeNull();
    expect(result.current.filteredLogs).toHaveLength(2); // 2 INFO messages
  });

  it("filters with regex alternation pattern", () => {
    const { result } = renderHook(() => useLogFilter({ logs: mockLogs }));

    act(() => {
      result.current.setUseRegex(true);
      result.current.setSearchQuery("started|completed");
    });

    expect(result.current.regexError).toBeNull();
    expect(result.current.filteredLogs).toHaveLength(2); // "started" and "completed"
  });

  it("returns empty array when no matches", () => {
    const { result } = renderHook(() => useLogFilter({ logs: mockLogs }));

    act(() => {
      result.current.setSearchQuery("nonexistent");
    });

    expect(result.current.filteredLogs).toHaveLength(0);
  });

  it("handles empty logs array", () => {
    const { result } = renderHook(() => useLogFilter({ logs: [] }));

    expect(result.current.filteredLogs).toHaveLength(0);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.logLevel).toBe("all");
  });
});
