import { renderHook, act, waitFor } from "@testing-library/react";
import { useLogAnalysis } from "../useLogAnalysis";
import type { LogEntry } from "@/lib/types";

// Mock stores
jest.mock("@/lib/stores/ai-store", () => ({
  useAIStore: jest.fn(),
}));

jest.mock("@/lib/stores/cluster-store", () => ({
  useClusterStore: jest.fn(),
}));

jest.mock("@/lib/stores/ui-store", () => ({
  useUIStore: jest.fn(),
}));

// Mock Tauri commands
jest.mock("@/lib/tauri/commands", () => ({
  aiCheckCliAvailable: jest.fn(),
  aiCheckCodexCliAvailable: jest.fn(),
}));

import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { aiCheckCliAvailable, aiCheckCodexCliAvailable } from "@/lib/tauri/commands";

const mockUseAIStore = useAIStore as jest.MockedFunction<typeof useAIStore>;
const mockUseClusterStore = useClusterStore as jest.MockedFunction<typeof useClusterStore>;
const mockUseUIStore = useUIStore as jest.MockedFunction<typeof useUIStore>;
const mockAiCheckCliAvailable = aiCheckCliAvailable as jest.MockedFunction<typeof aiCheckCliAvailable>;
const mockAiCheckCodexCliAvailable = aiCheckCodexCliAvailable as jest.MockedFunction<typeof aiCheckCodexCliAvailable>;

const createLogEntry = (message: string, timestamp: string): LogEntry => ({
  message,
  timestamp,
  container: "main",
  pod: "test-pod",
  namespace: "default",
});

// Helper to create CliInfo mock
const createCliInfo = (status: "authenticated" | "notauthenticated" | "notinstalled" | "error") => ({
  status,
  version: status === "authenticated" ? "1.0.0" : null,
  cli_path: status === "authenticated" ? "/usr/bin/cli" : null,
  error_message: status === "error" ? "Not available" : null,
});

describe("useLogAnalysis", () => {
  const mockLogs: LogEntry[] = [
    createLogEntry("INFO: Started", "2024-01-01T10:00:00Z"),
    createLogEntry("ERROR: Connection failed", "2024-01-01T10:01:00Z"),
    createLogEntry("WARN: High memory", "2024-01-01T10:02:00Z"),
  ];

  const mockSetPendingAnalysis = jest.fn();
  const mockSetAIAssistantOpen = jest.fn();
  const mockT = jest.fn((key: string) => `translated:${key}`);

  const defaultOptions = {
    namespace: "default",
    podName: "test-pod",
    container: "main",
    logs: mockLogs,
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAIStore.mockReturnValue({
      setPendingAnalysis: mockSetPendingAnalysis,
    } as unknown as ReturnType<typeof useAIStore>);

    mockUseClusterStore.mockReturnValue({
      currentCluster: { context: "test-cluster" },
      currentNamespace: "default",
    } as unknown as ReturnType<typeof useClusterStore>);

    mockUseUIStore.mockReturnValue({
      setAIAssistantOpen: mockSetAIAssistantOpen,
    } as unknown as ReturnType<typeof useUIStore>);

    // Default: CLI available
    mockAiCheckCliAvailable.mockResolvedValue(createCliInfo("authenticated"));
    mockAiCheckCodexCliAvailable.mockResolvedValue(createCliInfo("error"));
  });

  it("returns isAICliAvailable and analyzeWithAI function", async () => {
    const { result } = renderHook(() => useLogAnalysis(defaultOptions));

    expect(typeof result.current.analyzeWithAI).toBe("function");

    // Wait for CLI check
    await waitFor(() => {
      expect(result.current.isAICliAvailable).toBe(true);
    });
  });

  it("checks CLI availability on mount", async () => {
    renderHook(() => useLogAnalysis(defaultOptions));

    await waitFor(() => {
      expect(mockAiCheckCliAvailable).toHaveBeenCalled();
      expect(mockAiCheckCodexCliAvailable).toHaveBeenCalled();
    });
  });

  it("sets isAICliAvailable to true when Claude CLI is authenticated", async () => {
    mockAiCheckCliAvailable.mockResolvedValue(createCliInfo("authenticated"));
    mockAiCheckCodexCliAvailable.mockResolvedValue(createCliInfo("error"));

    const { result } = renderHook(() => useLogAnalysis(defaultOptions));

    await waitFor(() => {
      expect(result.current.isAICliAvailable).toBe(true);
    });
  });

  it("sets isAICliAvailable to true when Codex CLI is authenticated", async () => {
    mockAiCheckCliAvailable.mockResolvedValue(createCliInfo("error"));
    mockAiCheckCodexCliAvailable.mockResolvedValue(createCliInfo("authenticated"));

    const { result } = renderHook(() => useLogAnalysis(defaultOptions));

    await waitFor(() => {
      expect(result.current.isAICliAvailable).toBe(true);
    });
  });

  it("sets isAICliAvailable to false when no CLI is authenticated", async () => {
    mockAiCheckCliAvailable.mockResolvedValue(createCliInfo("error"));
    mockAiCheckCodexCliAvailable.mockResolvedValue(createCliInfo("error"));

    const { result } = renderHook(() => useLogAnalysis(defaultOptions));

    await waitFor(() => {
      expect(result.current.isAICliAvailable).toBe(false);
    });
  });

  it("analyzeWithAI sets pending analysis and opens AI assistant", async () => {
    const { result } = renderHook(() => useLogAnalysis(defaultOptions));

    await waitFor(() => {
      expect(result.current.isAICliAvailable).toBe(true);
    });

    act(() => {
      result.current.analyzeWithAI();
    });

    expect(mockSetPendingAnalysis).toHaveBeenCalledWith({
      message: expect.stringContaining("translated:logs.aiPromptTitle"),
      clusterContext: "test-cluster",
      namespace: "default",
    });
    expect(mockSetAIAssistantOpen).toHaveBeenCalledWith(true);
  });

  it("analyzeWithAI does nothing when no cluster", async () => {
    mockUseClusterStore.mockReturnValue({
      currentCluster: null,
      currentNamespace: null,
    } as unknown as ReturnType<typeof useClusterStore>);

    const { result } = renderHook(() => useLogAnalysis(defaultOptions));

    // Wait for async CLI check to complete
    await waitFor(() => {
      expect(mockAiCheckCliAvailable).toHaveBeenCalled();
    });

    act(() => {
      result.current.analyzeWithAI();
    });

    expect(mockSetPendingAnalysis).not.toHaveBeenCalled();
  });

  it("analyzeWithAI does nothing when no logs", async () => {
    const { result } = renderHook(() =>
      useLogAnalysis({ ...defaultOptions, logs: [] })
    );

    // Wait for async CLI check to complete
    await waitFor(() => {
      expect(mockAiCheckCliAvailable).toHaveBeenCalled();
    });

    act(() => {
      result.current.analyzeWithAI();
    });

    expect(mockSetPendingAnalysis).not.toHaveBeenCalled();
  });

  it("uses i18n for prompt messages", async () => {
    const { result } = renderHook(() => useLogAnalysis(defaultOptions));

    await waitFor(() => {
      expect(result.current.isAICliAvailable).toBe(true);
    });

    act(() => {
      result.current.analyzeWithAI();
    });

    expect(mockT).toHaveBeenCalledWith("logs.aiPromptTitle", expect.any(Object));
    expect(mockT).toHaveBeenCalledWith("logs.aiPromptStats", expect.any(Object));
    expect(mockT).toHaveBeenCalledWith("logs.aiPromptLogsHeader", expect.any(Object));
    expect(mockT).toHaveBeenCalledWith("logs.aiPromptInstructions");
  });
});
