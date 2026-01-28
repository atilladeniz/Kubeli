import { renderHook, act } from "@testing-library/react";
import { useThinkingMessage } from "../useThinkingMessage";

// Mock the constant
jest.mock("../../types", () => ({
  THINKING_MESSAGE_INTERVAL: 100, // Use shorter interval for tests
}));

describe("useThinkingMessage", () => {
  const messages = ["Message 1", "Message 2", "Message 3"];

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the first message initially", () => {
    const { result } = renderHook(() => useThinkingMessage(false, messages));
    expect(result.current).toBe("Message 1");
  });

  it("does not cycle messages when not processing", () => {
    const { result } = renderHook(() => useThinkingMessage(false, messages));

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toBe("Message 1");
  });

  it("cycles through messages when processing", () => {
    const { result } = renderHook(() => useThinkingMessage(true, messages));

    expect(result.current).toBe("Message 1");

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("Message 2");

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("Message 3");

    // Should wrap around to first message
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("Message 1");
  });

  it("resets to first message when processing stops", () => {
    const { result, rerender } = renderHook(
      ({ isProcessing }) => useThinkingMessage(isProcessing, messages),
      { initialProps: { isProcessing: true } }
    );

    // Advance to second message
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("Message 2");

    // Stop processing
    rerender({ isProcessing: false });
    expect(result.current).toBe("Message 1");
  });

  it("starts cycling when processing begins", () => {
    const { result, rerender } = renderHook(
      ({ isProcessing }) => useThinkingMessage(isProcessing, messages),
      { initialProps: { isProcessing: false } }
    );

    expect(result.current).toBe("Message 1");

    // Start processing
    rerender({ isProcessing: true });

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("Message 2");
  });

  it("handles empty messages array gracefully", () => {
    const { result } = renderHook(() => useThinkingMessage(true, []));
    // Should return undefined or handle gracefully
    expect(result.current).toBeUndefined();
  });

  it("handles single message array", () => {
    const singleMessage = ["Only message"];
    const { result } = renderHook(() => useThinkingMessage(true, singleMessage));

    expect(result.current).toBe("Only message");

    act(() => {
      jest.advanceTimersByTime(100);
    });
    // Should stay on the same message (wraps to index 0)
    expect(result.current).toBe("Only message");
  });
});
