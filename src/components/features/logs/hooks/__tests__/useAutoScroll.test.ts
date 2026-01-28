import { renderHook, act } from "@testing-library/react";
import { useAutoScroll } from "../useAutoScroll";

describe("useAutoScroll", () => {
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

  it("scrollToBottom re-enables autoScroll", () => {
    const { result } = renderHook(() => useAutoScroll({ dependencies: [] }));

    // First disable
    act(() => {
      result.current.setAutoScroll(false);
    });
    expect(result.current.autoScroll).toBe(false);

    // Then scrollToBottom should re-enable
    act(() => {
      result.current.scrollToBottom();
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
