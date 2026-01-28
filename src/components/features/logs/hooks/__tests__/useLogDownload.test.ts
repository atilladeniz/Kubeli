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
    podName: "test-pod",
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
    expect(toast.success).toHaveBeenCalledWith("messages.saveSuccess");
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

    expect(toast.error).toHaveBeenCalledWith("messages.saveError");
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
