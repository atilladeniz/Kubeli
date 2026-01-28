import { renderHook, act } from "@testing-library/react";
import { useAutoScroll } from "../useAutoScroll";

describe("useAutoScroll", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns refs and state", () => {
    const { result } = renderHook(() => useAutoScroll({ dependencies: [] }));

    expect(result.current.containerRef).toBeDefined();
    expect(result.current.endRef).toBeDefined();
    expect(result.current.autoScroll).toBe(true);
    expect(typeof result.current.scrollToBottom).toBe("function");
    expect(typeof result.current.handleScroll).toBe("function");
  });

  it("autoScroll is true by default", () => {
    const { result } = renderHook(() => useAutoScroll({ dependencies: [] }));
    expect(result.current.autoScroll).toBe(true);
  });

  it("can manually set autoScroll", () => {
    const { result } = renderHook(() => useAutoScroll({ dependencies: [] }));

    act(() => {
      result.current.setAutoScroll(false);
    });

    expect(result.current.autoScroll).toBe(false);
  });

  it("scrollToBottom re-enables autoScroll after delay", () => {
    const { result } = renderHook(() => useAutoScroll({ dependencies: [] }));

    // Mock endRef.current with a DOM element
    const mockElement = document.createElement("div");
    mockElement.scrollIntoView = jest.fn();
    Object.defineProperty(result.current.endRef, "current", {
      value: mockElement,
      writable: true,
    });

    // First disable
    act(() => {
      result.current.setAutoScroll(false);
    });
    expect(result.current.autoScroll).toBe(false);

    // scrollToBottom sets autoScroll after 300ms delay
    act(() => {
      result.current.scrollToBottom();
    });
    // Not yet enabled
    expect(result.current.autoScroll).toBe(false);

    // Advance timers by 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.autoScroll).toBe(true);
  });

  it("handleScroll is callable", () => {
    const { result } = renderHook(() => useAutoScroll({ dependencies: [] }));

    // Should not throw when called without a container
    expect(() => {
      act(() => {
        result.current.handleScroll();
      });
    }).not.toThrow();
  });
});
