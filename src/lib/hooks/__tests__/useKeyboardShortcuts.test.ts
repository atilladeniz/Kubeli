import { renderHook, act } from "@testing-library/react";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const pressKey = (key: string) => {
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key }));
    });
  };

  it("fires the handler for a two-key sequence", () => {
    const handler = jest.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ key: "g p", handler, description: "goto pods" }])
    );

    pressKey("g");
    pressKey("p");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("clears the pending key after 1 second", () => {
    const handler = jest.fn();
    const { result } = renderHook(() =>
      useKeyboardShortcuts([{ key: "g p", handler, description: "goto pods" }])
    );

    pressKey("g");
    expect(result.current.pendingKey).toBe("g");

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.pendingKey).toBeNull();
  });

  it("cancels the pending sequence timer on unmount", () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts([{ key: "g p", handler, description: "goto pods" }])
    );

    pressKey("g");
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    unmount();

    // Regression: the 1s sequence timer used to keep running after unmount
    // and call setState on an unmounted component.
    expect(jest.getTimerCount()).toBe(0);
  });
});
