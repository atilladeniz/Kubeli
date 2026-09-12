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
  describe("mod shortcuts", () => {
    const press = (key: string, init: KeyboardEventInit) => {
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key, ...init }));
      });
    };

    it("fires with Ctrl on Windows/Linux and with Cmd on macOS", () => {
      const handler = jest.fn();
      renderHook(() =>
        useKeyboardShortcuts([{ key: "t", mod: true, handler, description: "new tab" }])
      );

      // Regression: meta-only configs never matched a Ctrl press, so every
      // Cmd shortcut was dead on Windows and Linux.
      press("t", { ctrlKey: true });
      expect(handler).toHaveBeenCalledTimes(1);

      press("t", { metaKey: true });
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("does not fire without a modifier", () => {
      const handler = jest.fn();
      renderHook(() =>
        useKeyboardShortcuts([{ key: "t", mod: true, handler, description: "new tab" }])
      );

      press("t", {});
      expect(handler).not.toHaveBeenCalled();
    });

    it("respects shift for mod shortcuts", () => {
      const next = jest.fn();
      const prev = jest.fn();
      renderHook(() =>
        useKeyboardShortcuts([
          { key: "Tab", mod: true, handler: next, description: "next tab" },
          { key: "Tab", mod: true, shift: true, handler: prev, description: "previous tab" },
        ])
      );

      press("Tab", { ctrlKey: true });
      press("Tab", { ctrlKey: true, shiftKey: true });
      expect(next).toHaveBeenCalledTimes(1);
      expect(prev).toHaveBeenCalledTimes(1);
    });

    it("keeps plain shortcuts from firing while a modifier is held", () => {
      const handler = jest.fn();
      renderHook(() =>
        useKeyboardShortcuts([{ key: "r", handler, description: "refresh" }])
      );

      press("r", { ctrlKey: true });
      press("r", { metaKey: true });
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
