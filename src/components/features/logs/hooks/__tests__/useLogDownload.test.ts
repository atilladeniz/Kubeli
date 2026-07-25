import { renderHook, act } from "@testing-library/react";
import { useLogDownload } from "../useLogDownload";
import type { LogEntry } from "@/lib/types";

// Mock Tauri plugins
jest.mock("@tauri-apps/plugin-dialog", () => ({
  save: jest.fn(),
}));

jest.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

const mockSave = save as jest.MockedFunction<typeof save>;
const mockWriteTextFile = writeTextFile as jest.MockedFunction<typeof writeTextFile>;

const createLogEntry = (message: string, timestamp: string): LogEntry => ({
  message,
  timestamp,
  container: "main",
  pod: "test-pod",
  namespace: "default",
});

describe("useLogDownload", () => {
  const mockLogs: LogEntry[] = [
    createLogEntry("INFO: Started", "2024-01-01T10:00:00Z"),
    createLogEntry("ERROR: Failed", "2024-01-01T10:01:00Z"),
  ];

  const mockT = jest.fn((key: string) => key);

  const defaultOptions = {
    sourceName: "test-pod",
    container: "main",
    logs: mockLogs,
    filteredLogs: [],
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns isDownloading and downloadLogs function", () => {
    const { result } = renderHook(() => useLogDownload(defaultOptions));

    expect(result.current.isDownloading).toBe(false);
    expect(typeof result.current.downloadLogs).toBe("function");
  });

  it("downloads logs as text format", async () => {
    mockSave.mockResolvedValue("/path/to/file.log");
    mockWriteTextFile.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLogDownload(defaultOptions));

    await act(async () => {
      await result.current.downloadLogs("text");
    });

    expect(mockSave).toHaveBeenCalledWith({
      defaultPath: "test-pod-main.log",
      filters: [{ name: "Log File", extensions: ["log"] }],
    });
    expect(mockWriteTextFile).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("logs.downloadSuccess");
  });

  it("downloads logs as JSON format", async () => {
    mockSave.mockResolvedValue("/path/to/file.json");
    mockWriteTextFile.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLogDownload(defaultOptions));

    await act(async () => {
      await result.current.downloadLogs("json");
    });

    expect(mockSave).toHaveBeenCalledWith({
      defaultPath: "test-pod-main.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
  });

  it("downloads logs with timestamps format", async () => {
    mockSave.mockResolvedValue("/path/to/file.log");
    mockWriteTextFile.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLogDownload(defaultOptions));

    await act(async () => {
      await result.current.downloadLogs("timestamps");
    });

    expect(mockSave).toHaveBeenCalledWith({
      defaultPath: "test-pod-main-timestamps.log",
      filters: [{ name: "Log File", extensions: ["log"] }],
    });
  });

  it("uses filteredLogs when available", async () => {
    const filteredLogs = [mockLogs[0]];
    mockSave.mockResolvedValue("/path/to/file.log");
    mockWriteTextFile.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useLogDownload({ ...defaultOptions, filteredLogs })
    );

    await act(async () => {
      await result.current.downloadLogs("text");
    });

    // Should use filtered logs (1 entry) instead of all logs (2 entries)
    const writeCall = mockWriteTextFile.mock.calls[0];
    expect(writeCall[1]).toBe("INFO: Started");
  });

  it("does nothing when user cancels save dialog", async () => {
    mockSave.mockResolvedValue(null);

    const { result } = renderHook(() => useLogDownload(defaultOptions));

    await act(async () => {
      await result.current.downloadLogs("text");
    });

    expect(mockWriteTextFile).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows error toast on failure", async () => {
    // Suppress expected console.error
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockSave.mockRejectedValue(new Error("Save failed"));

    const { result } = renderHook(() => useLogDownload(defaultOptions));

    await act(async () => {
      await result.current.downloadLogs("text");
    });

    expect(toast.error).toHaveBeenCalledWith("logs.downloadError");
    expect(consoleSpy).toHaveBeenCalledWith("Download failed:", expect.any(Error));

    consoleSpy.mockRestore();
  });

  it("sets isDownloading during download", async () => {
    let resolvePromise: (value: string | null) => void;
    mockSave.mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve; })
    );

    const { result } = renderHook(() => useLogDownload(defaultOptions));

    expect(result.current.isDownloading).toBe(false);

    let downloadPromise: Promise<void>;
    act(() => {
      downloadPromise = result.current.downloadLogs("text");
    });

    // Should be downloading now
    expect(result.current.isDownloading).toBe(true);

    // Resolve and wait
    await act(async () => {
      resolvePromise!(null);
      await downloadPromise;
    });

    expect(result.current.isDownloading).toBe(false);
  });
});

describe("useLogDownload aggregated (multi-pod) export", () => {
  const mockT = jest.fn((key: string) => key);

  const fromPod = (pod: string, message: string, timestamp: string): LogEntry => ({
    message,
    timestamp,
    container: "main",
    pod,
    namespace: "default",
  });

  const aggregatedLogs: LogEntry[] = [
    fromPod("demo-web-abc", "INFO: Started", "2024-01-01T10:00:00Z"),
    fromPod("demo-web-xyz", "ERROR: Failed", "2024-01-01T10:01:00Z"),
  ];

  const aggregatedOptions = {
    sourceName: "demo-web",
    container: null,
    logs: aggregatedLogs,
    filteredLogs: [],
    includePodNames: true,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue("/path/to/file.log");
    mockWriteTextFile.mockResolvedValue(undefined);
  });

  it("prefixes every text line with its source pod", async () => {
    const { result } = renderHook(() => useLogDownload(aggregatedOptions));

    await act(async () => {
      await result.current.downloadLogs("text");
    });

    expect(mockWriteTextFile).toHaveBeenCalledWith(
      "/path/to/file.log",
      "[demo-web-abc] INFO: Started\n[demo-web-xyz] ERROR: Failed"
    );
  });

  it("keeps the pod prefix after the timestamp in timestamps format", async () => {
    const { result } = renderHook(() => useLogDownload(aggregatedOptions));

    await act(async () => {
      await result.current.downloadLogs("timestamps");
    });

    expect(mockWriteTextFile).toHaveBeenCalledWith(
      "/path/to/file.log",
      "2024-01-01T10:00:00Z\t[demo-web-abc] INFO: Started\n" +
        "2024-01-01T10:01:00Z\t[demo-web-xyz] ERROR: Failed"
    );
  });

  it("does not add a prefix to JSON, which already carries log.pod", async () => {
    const { result } = renderHook(() => useLogDownload(aggregatedOptions));

    await act(async () => {
      await result.current.downloadLogs("json");
    });

    const written = mockWriteTextFile.mock.calls[0][1] as string;
    expect(JSON.parse(written)).toEqual(aggregatedLogs);
  });

  it("names the file after the workload, not a pod", async () => {
    const { result } = renderHook(() => useLogDownload(aggregatedOptions));

    await act(async () => {
      await result.current.downloadLogs("text");
    });

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: "demo-web-logs.log" })
    );
  });

  it("exports only the filtered pods when a pod filter is active", async () => {
    const { result } = renderHook(() =>
      useLogDownload({
        ...aggregatedOptions,
        filteredLogs: [aggregatedLogs[1]],
      })
    );

    await act(async () => {
      await result.current.downloadLogs("text");
    });

    expect(mockWriteTextFile).toHaveBeenCalledWith(
      "/path/to/file.log",
      "[demo-web-xyz] ERROR: Failed"
    );
  });

  it("omits the prefix for single-pod logs", async () => {
    const { result } = renderHook(() =>
      useLogDownload({ ...aggregatedOptions, includePodNames: false })
    );

    await act(async () => {
      await result.current.downloadLogs("text");
    });

    expect(mockWriteTextFile).toHaveBeenCalledWith(
      "/path/to/file.log",
      "INFO: Started\nERROR: Failed"
    );
  });
});
