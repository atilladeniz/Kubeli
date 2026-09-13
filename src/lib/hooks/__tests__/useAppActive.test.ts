import { renderHook, act } from "@testing-library/react";
import { useAppActive, IDLE_GRACE_MS } from "../useAppActive";

const fire = (target: EventTarget, type: string) =>
  act(() => {
    target.dispatchEvent(new Event(type));
  });

const setHidden = (hidden: boolean) =>
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });

describe("useAppActive", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    setHidden(false);
    fire(window, "focus");
    jest.useRealTimers();
  });

  it("stays active through a short loss of focus", () => {
    const { result } = renderHook(() => useAppActive());
    expect(result.current).toBe(true);

    fire(window, "blur");
    act(() => {
      jest.advanceTimersByTime(IDLE_GRACE_MS - 1);
    });
    expect(result.current).toBe(true);

    fire(window, "focus");
    act(() => {
      jest.advanceTimersByTime(IDLE_GRACE_MS);
    });
    expect(result.current).toBe(true);
  });

  it("goes idle after the grace period and resumes on focus", () => {
    const { result } = renderHook(() => useAppActive());

    fire(window, "blur");
    act(() => {
      jest.advanceTimersByTime(IDLE_GRACE_MS);
    });
    expect(result.current).toBe(false);

    fire(window, "focus");
    expect(result.current).toBe(true);
  });

  it("goes idle when the document is hidden even while focused", () => {
    const { result } = renderHook(() => useAppActive());

    setHidden(true);
    fire(document, "visibilitychange");
    act(() => {
      jest.advanceTimersByTime(IDLE_GRACE_MS);
    });
    expect(result.current).toBe(false);

    setHidden(false);
    fire(document, "visibilitychange");
    expect(result.current).toBe(true);
  });
});
